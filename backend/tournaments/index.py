import re
import json
import os
import base64
import time
import random
import uuid
import psycopg2
import psycopg2.pool
import boto3

from swiss import assign_places, update_buchholz
from rating import apply_rating_changes
from pusher_client import trigger

# Пул соединений на "тёплый" контейнер — та же схема, что в tournament-hall и chess-game
# (см. подробный комментарий там): каждый вызов на время своей работы владеет отдельным
# физическим соединением из пула, что убирает накладные расходы на новый TCP+TLS+auth
# хендшейк на каждый вызов и снижает нагрузку на общий лимит подключений/запросов к БД.
_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            1, 3, os.environ['DATABASE_URL'],
            options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}"
        )
    return _pool


def get_conn():
    return _get_pool().getconn()


def release_conn(conn):
    try:
        conn.rollback()
    except Exception:
        pass
    try:
        _get_pool().putconn(conn)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass


def commit_with_retry(conn, attempts=3):
    """conn.commit() с повторными попытками при "rate limit exceeded" от БД — см.
    подробности в tournament-hall/index.py и chess-game/index.py."""
    for i in range(attempts):
        try:
            conn.commit()
            return
        except psycopg2.errors.QueryCanceled:
            if i == attempts - 1:
                raise
            time.sleep(0.15 * (i + 1) + random.uniform(0, 0.15))

def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def sync_finished_tournaments(cur):
    """Подстраховка: если последний раунд турнира со статусом 'active' уже полностью
    доигран (все партии завершены), но никто не зашёл в турнирный зал после этого —
    hall_status так и остаётся 'active'. Здесь мы находим такие турниры и переводим их
    в 'finished' с расстановкой итоговых мест и пересчётом рейтинга — так же, как это
    делает турнирный зал (tournament-hall/index.py maybe_advance) и chess-game
    (check_round_completion) сразу по завершении последней партии."""
    cur.execute("SELECT id, title, rounds_count, rating_type FROM tournaments WHERE hall_status = 'active'")
    active_tournaments = cur.fetchall()
    for tournament_id, title, rounds_count, rating_type in active_tournaments:
        cur.execute(
            "SELECT id, round_number, status FROM tournament_rounds WHERE tournament_id = %s ORDER BY round_number DESC LIMIT 1",
            (tournament_id,)
        )
        row = cur.fetchone()
        if not row:
            continue
        round_id, round_number, status = row
        if round_number < rounds_count:
            continue
        cur.execute("SELECT COUNT(*) FROM tournament_games WHERE round_id = %s", (round_id,))
        if cur.fetchone()[0] == 0:
            continue
        cur.execute("SELECT COUNT(*) FROM tournament_games WHERE round_id = %s AND status != 'finished'", (round_id,))
        if cur.fetchone()[0] > 0:
            continue
        if status != 'completed':
            cur.execute("UPDATE tournament_rounds SET status = 'completed', completed_at = now() WHERE id = %s AND status != 'completed'", (round_id,))
        # Атомарный условный UPDATE вместо блокировки (FOR UPDATE/advisory-лок ненадёжны в этой
        # инфраструктуре между отдельными SQL-запросами): если этот же турнир параллельно уже
        # закрыла tournament-hall (maybe_advance) или chess-game (check_round_completion), здесь
        # обновится 0 строк и медали/рейтинг повторно не начислятся.
        cur.execute(
            "UPDATE tournaments SET hall_status = 'finished' WHERE id = %s AND hall_status = 'active' RETURNING id",
            (tournament_id,)
        )
        if not cur.fetchone():
            continue
        update_buchholz(cur, tournament_id)
        assign_places(cur, tournament_id)
        apply_rating_changes(cur, tournament_id, title, rating_type or 'rapid')
        trigger(f"tournament-{tournament_id}", 'finished', {})

def parse_lila_tournament(value):
    value = (value or '').strip()
    if not value:
        return None, 'swiss'
    m = re.search(r'/(swiss|tournament)/([A-Za-z0-9]{8})', value)
    if m:
        return m.group(2), 'swiss' if m.group(1) == 'swiss' else 'arena'
    if re.fullmatch(r'[A-Za-z0-9]{8}', value):
        return value, 'swiss'
    return None, 'swiss'


def handler(event: dict, context) -> dict:
    """Управление турнирами: создание, получение списка, удаление, загрузка файлов (диплом, положение)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = event.get('headers', {}) or {}
    admin_password = headers.get('X-Admin-Password', '')
    if admin_password != os.environ.get('ADMIN_PASSWORD', ''):
        return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Неверный пароль'})}

    method = event.get('httpMethod')
    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        sync_finished_tournaments(cur)
        commit_with_retry(conn)
        cur.execute("SELECT id, title, description, date, location, age_category, price, time_control, created_at, status, diploma_sample_url, regulation_url, announcement_url, time_msk, hall_open, rounds_count, hall_status, rating_type, max_participants, admin_message, lila_tournament_id, lila_tournament_kind, lila_tournament_password FROM tournaments ORDER BY created_at DESC")
        rows = cur.fetchall()
        tournaments = []
        for r in rows:
            tournaments.append({
                'id': r[0], 'title': r[1], 'description': r[2],
                'date': str(r[3]) if r[3] else None, 'location': r[4],
                'age_category': r[5], 'price': float(r[6]) if r[6] else None,
                'time_control': r[7], 'created_at': str(r[8]), 'status': r[9],
                'diploma_sample_url': r[10], 'regulation_url': r[11], 'announcement_url': r[12],
                'time_msk': r[13], 'hall_open': r[14], 'rounds_count': r[15], 'hall_status': r[16],
                'rating_type': r[17], 'max_participants': r[18], 'admin_message': r[19],
                'lila_tournament_id': r[20], 'lila_tournament_kind': r[21] or 'swiss', 'lila_tournament_password': r[22],
            })
        release_conn(conn)
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'tournaments': tournaments})}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('_action', '')

        if action == 'upload_file':
            file_b64 = body.get('file_b64', '')
            content_type = body.get('content_type', 'application/pdf')
            original_name = body.get('file_name', 'file.pdf')
            ext = original_name.rsplit('.', 1)[-1].lower() if '.' in original_name else 'pdf'
            key = f"tournaments/{uuid.uuid4().hex[:12]}.{ext}"
            data = base64.b64decode(file_b64)
            s3 = get_s3()
            s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)
            release_conn(conn)
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'url': cdn_url(key)})}

        if action == 'delete':
            tournament_id = body.get('id')
            # Сначала удаляем заказы, связанные с заявками этого турнира,
            # затем сами заявки — иначе внешние ключи не дадут удалить турнир
            cur.execute(
                "DELETE FROM orders WHERE application_id IN (SELECT id FROM applications WHERE tournament_id = %s)",
                (tournament_id,)
            )
            cur.execute("DELETE FROM applications WHERE tournament_id = %s", (tournament_id,))
            cur.execute("DELETE FROM tournaments WHERE id = %s", (tournament_id,))
            commit_with_retry(conn)
            release_conn(conn)
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        if action == 'set_status':
            cur.execute("UPDATE tournaments SET status = %s WHERE id = %s", (body.get('status'), body.get('id')))
            commit_with_retry(conn)
            release_conn(conn)
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        if action == 'set_hall_open':
            cur.execute("UPDATE tournaments SET hall_open = %s WHERE id = %s", (bool(body.get('hall_open')), body.get('id')))
            commit_with_retry(conn)
            release_conn(conn)
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        lila_id, lila_kind = parse_lila_tournament(body.get('lila_tournament_ref'))
        if body.get('lila_tournament_ref') and not lila_id:
            release_conn(conn)
            return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Не удалось распознать номер или ссылку турнира Lila'})}

        if action == 'update':
            rating_type = body.get('rating_type') if body.get('rating_type') in ('blitz', 'rapid') else 'rapid'
            cur.execute(
                "UPDATE tournaments SET title = %s, description = %s, date = %s, location = %s, age_category = %s, price = %s, time_control = %s, diploma_sample_url = %s, regulation_url = %s, announcement_url = %s, time_msk = %s, hall_open = %s, rounds_count = %s, rating_type = %s, max_participants = %s, admin_message = %s, lila_tournament_id = %s, lila_tournament_kind = %s, lila_tournament_password = %s WHERE id = %s",
                (body.get('title'), body.get('description'), body.get('date') or None,
                 body.get('location'), body.get('age_category'), body.get('price') or None, body.get('time_control'),
                 body.get('diploma_sample_url') or None, body.get('regulation_url') or None, body.get('announcement_url') or None,
                 body.get('time_msk'), bool(body.get('hall_open')), body.get('rounds_count') or 5, rating_type,
                 body.get('max_participants') or None, body.get('admin_message') or None,
                 lila_id, lila_kind, (body.get('lila_tournament_password') or '').strip() or None, body.get('id'))
            )
            commit_with_retry(conn)
            release_conn(conn)
            return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True})}

        if action == 'split':
            tournament_id = body.get('tournament_id')
            cur.execute(
                """SELECT id, title, description, date, location, age_category, price, time_control, time_msk,
                   diploma_sample_url, regulation_url, announcement_url, hall_open, rounds_count, rating_type, hall_status
                   FROM tournaments WHERE id = %s""",
                (tournament_id,)
            )
            row = cur.fetchone()
            if not row:
                release_conn(conn)
                return {'statusCode': 404, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Турнир не найден'})}
            (t_id, title, description, date, location, age_category, price, time_control, time_msk,
             diploma_sample_url, regulation_url, announcement_url, hall_open, rounds_count, rating_type, hall_status) = row

            if hall_status != 'not_started':
                release_conn(conn)
                return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Турнир уже начат — разделение невозможно'})}

            # В разделении участвуют только заявки с подтверждённым участием (оплачена/подтверждена).
            # Новые и ждущие оплаты заявки остаются в исходном турнире как есть.
            cur.execute(
                "SELECT id, fio, fsr_id, user_id FROM applications WHERE tournament_id = %s AND status IN ('paid', 'confirmed')",
                (tournament_id,)
            )
            app_rows = cur.fetchall()
            if len(app_rows) < 2:
                release_conn(conn)
                return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Недостаточно оплаченных/подтверждённых заявок для разделения (нужно минимум 2)'})}

            rating_col = 'rating_blitz' if rating_type == 'blitz' else 'rating_rapid'

            # Заявки без привязанного аккаунта (добавлены админом вручную) не имеют собственного
            # рейтинга МШ — разделение по рейтингу для них некорректно. Такие заявки должны быть
            # либо привязаны к аккаунту, либо удалены до разделения турнира.
            no_account = [fio for _, fio, _, user_id in app_rows if not user_id]
            if no_account:
                release_conn(conn)
                names = ', '.join(no_account[:5]) + ('…' if len(no_account) > 5 else '')
                return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({
                    'error': f'В турнире есть заявки без привязанного аккаунта, у них нет своего рейтинга МШ: {names}. Привяжите аккаунт или удалите эти заявки перед разделением.'
                })}

            enriched = []
            for app_id, fio, fsr_id, user_id in app_rows:
                cur.execute(f"SELECT {rating_col} FROM users WHERE id = %s", (user_id,))
                r = cur.fetchone()
                rating = r[0] if r and r[0] is not None else 1200
                enriched.append((app_id, rating))

            # Сильнейшие (по рейтингу МШ турнира — блиц или рапид) — в группу А.
            # При нечётном числе участников в группе А на одного больше.
            enriched.sort(key=lambda x: x[1], reverse=True)
            total = len(enriched)
            group_a_size = (total + 1) // 2
            group_a = enriched[:group_a_size]
            group_b = enriched[group_a_size:]

            def create_group_tournament(suffix):
                new_title = f"{title} — Группа {suffix}"
                cur.execute(
                    """INSERT INTO tournaments (title, description, date, location, age_category, price, time_control,
                       diploma_sample_url, regulation_url, announcement_url, time_msk, hall_open, rounds_count, rating_type,
                       max_participants, status)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'closed') RETURNING id""",
                    (new_title, description, date, location, age_category, price, time_control,
                     diploma_sample_url, regulation_url, announcement_url, time_msk, hall_open, rounds_count, rating_type,
                     None)
                )
                return cur.fetchone()[0], new_title

            group_a_id, group_a_title = create_group_tournament('А')
            group_b_id, group_b_title = create_group_tournament('Б')

            for app_id, _ in group_a:
                cur.execute("UPDATE applications SET tournament_id = %s, tournament_title = %s WHERE id = %s", (group_a_id, group_a_title, app_id))
            for app_id, _ in group_b:
                cur.execute("UPDATE applications SET tournament_id = %s, tournament_title = %s WHERE id = %s", (group_b_id, group_b_title, app_id))

            commit_with_retry(conn)
            release_conn(conn)
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'ok': True,
                    'group_a': {'id': group_a_id, 'title': group_a_title, 'count': len(group_a)},
                    'group_b': {'id': group_b_id, 'title': group_b_title, 'count': len(group_b)},
                })
            }

        rating_type = body.get('rating_type') if body.get('rating_type') in ('blitz', 'rapid') else 'rapid'
        cur.execute(
            "INSERT INTO tournaments (title, description, date, location, age_category, price, time_control, diploma_sample_url, regulation_url, announcement_url, time_msk, hall_open, rounds_count, rating_type, max_participants, admin_message, lila_tournament_id, lila_tournament_kind, lila_tournament_password) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.get('title'), body.get('description'), body.get('date') or None,
             body.get('location'), body.get('age_category'), body.get('price') or None, body.get('time_control'),
             body.get('diploma_sample_url') or None, body.get('regulation_url') or None, body.get('announcement_url') or None,
             body.get('time_msk'), bool(body.get('hall_open')), body.get('rounds_count') or 5, rating_type,
             body.get('max_participants') or None, body.get('admin_message') or None,
             lila_id, lila_kind, (body.get('lila_tournament_password') or '').strip() or None)
        )
        new_id = cur.fetchone()[0]
        commit_with_retry(conn)
        release_conn(conn)
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'ok': True, 'id': new_id})}

    release_conn(conn)
    return {'statusCode': 405, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Method not allowed'})}