import json
import os
import re
from datetime import datetime, timedelta

import psycopg2

from swiss import make_pairings, assign_places, update_buchholz
from rating import apply_rating_changes
from pusher_client import trigger

DEFAULT_BASE_MS = 600000
DEFAULT_INC_MS = 0


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def parse_time_control(tc: str):
    if not tc:
        return DEFAULT_BASE_MS, DEFAULT_INC_MS
    m = re.match(r'\s*(\d+)\s*\+\s*(\d+)\s*', tc)
    if not m:
        m2 = re.match(r'\s*(\d+)\s*', tc)
        if m2:
            return int(m2.group(1)) * 60000, 0
        return DEFAULT_BASE_MS, DEFAULT_INC_MS
    minutes, inc = int(m.group(1)), int(m.group(2))
    return minutes * 60000, inc * 1000


def create_round_games(cur, tournament_id, round_id, pairs, base_ms, inc_ms):
    for p in pairs:
        if p['bye']:
            cur.execute(
                """INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, result, result_reason, white_time_ms, black_time_ms, increment_ms, started_at, finished_at)
                   VALUES (%s, %s, %s, NULL, true, 'finished', '1-0', 'bye', %s, %s, %s, now(), now())""",
                (round_id, tournament_id, p['white_id'], base_ms, base_ms, inc_ms)
            )
            cur.execute("UPDATE tournament_players SET points = points + 1, byes_used = byes_used + 1 WHERE id = %s", (p['white_id'],))
        else:
            cur.execute(
                """INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
                   VALUES (%s, %s, %s, %s, false, 'active', %s, %s, %s, now(), now())""",
                (round_id, tournament_id, p['white_id'], p['black_id'], base_ms, base_ms, inc_ms)
            )
            cur.execute("UPDATE tournament_players SET color_balance = color_balance + 1 WHERE id = %s", (p['white_id'],))
            cur.execute("UPDATE tournament_players SET color_balance = color_balance - 1 WHERE id = %s", (p['black_id'],))


def get_previous_pairs(cur, tournament_id):
    cur.execute(
        "SELECT white_player_id, black_player_id FROM tournament_games WHERE tournament_id = %s AND black_player_id IS NOT NULL",
        (tournament_id,)
    )
    return {frozenset({r[0], r[1]}) for r in cur.fetchall()}


def finish_tournament_early(cur, tournament, rounds_played):
    """Завершает турнир раньше срока: очередной тур без повторных встреч
    составить нельзя. Официальное число туров турнира уменьшается до
    количества фактически сыгранных.

    Возвращает список отложенных push-событий (не отправляет их сама) — их нужно
    разослать ПОСЛЕ conn.commit() в вызывающем коде, иначе игрок может получить
    уведомление о партии/туре раньше, чем эти данные реально попадут в БД
    (см. комментарий у maybe_advance)."""
    cur.execute("UPDATE tournaments SET rounds_count = %s WHERE id = %s", (rounds_played, tournament['id']))
    assign_places(cur, tournament['id'])
    apply_rating_changes(cur, tournament['id'], tournament['title'], tournament['rating_type'])
    cur.execute("UPDATE tournaments SET hall_status = 'finished' WHERE id = %s", (tournament['id'],))
    return [(f"tournament-{tournament['id']}", 'finished', {})]


def start_next_round(cur, tournament, round_number):
    """Возвращает (round_id, events) — round_id нового тура (или None, если тур не создан)
    и список отложенных push-событий, которые вызывающий код должен отправить ПОСЛЕ
    conn.commit(). Партии тура должны быть гарантированно видны в БД до того, как игрок
    получит push-уведомление и запросит их — иначе возможна ситуация "партия не найдена"
    при обновлении раньше, чем транзакция зафиксировалась."""
    # Резервируем номер тура атомарной вставкой ДО жеребьёвки: на tournament_rounds есть
    # ограничение уникальности (tournament_id, round_number), поэтому если два параллельных
    # запроса одновременно решат, что пора начинать этот тур, вставку выполнит только один —
    # у второго ON CONFLICT DO NOTHING не вернёт строку, и он тут же выйдет, не трогая пары
    # и партии. Это надёжнее блокировок (FOR UPDATE/advisory-лок), которые в этой инфраструктуре
    # не гарантируют удержание между отдельными SQL-запросами одной функции.
    cur.execute(
        """INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
           VALUES (%s, %s, 'active', now())
           ON CONFLICT (tournament_id, round_number) DO NOTHING
           RETURNING id""",
        (tournament['id'], round_number)
    )
    reserved = cur.fetchone()
    if not reserved:
        return None, []
    round_id = reserved[0]

    cur.execute("SELECT id, rating, points, color_balance FROM tournament_players WHERE tournament_id = %s AND active = true", (tournament['id'],))
    players = [{'id': r[0], 'rating': r[1], 'points': float(r[2]), 'color_balance': r[3]} for r in cur.fetchall()]
    if len(players) < 2:
        cur.execute("DELETE FROM tournament_rounds WHERE id = %s", (round_id,))
        return None, []

    previous_pairs = get_previous_pairs(cur, tournament['id'])
    cur.execute("SELECT id FROM tournament_players WHERE tournament_id = %s AND byes_used > 0", (tournament['id'],))
    bye_used = {r[0] for r in cur.fetchall()}

    pairs = make_pairings(players, previous_pairs, bye_used, round_number=round_number)
    if pairs is None:
        # Нельзя составить тур без повторной встречи — турнир завершается
        # досрочно тем числом туров, что уже сыграно.
        cur.execute("DELETE FROM tournament_rounds WHERE id = %s", (round_id,))
        events = finish_tournament_early(cur, tournament, round_number - 1)
        return None, events

    base_ms, inc_ms = parse_time_control(tournament['time_control'])
    create_round_games(cur, tournament['id'], round_id, pairs, base_ms, inc_ms)
    return round_id, []


def maybe_advance(cur, tournament):
    """Возвращает (next_round_at, events): ISO-время старта следующего тура (если сейчас
    идёт перерыв между турами) и список отложенных push-событий (channel, event, data),
    которые вызывающий код обязан отправить ПОСЛЕ conn.commit() — иначе игрок может получить
    push-уведомление о новом туре/партии раньше, чем эти данные реально зафиксируются в БД,
    и увидеть "Партия не найдена" при первой же попытке её открыть.

    Турнирный зал опрашивается одновременно всеми участниками (обычный поллинг + push-события),
    поэтому несколько параллельных запросов могут одновременно увидеть "все партии тура
    завершены" и попытаться закрыть тур/создать следующий. Каждый шаг здесь — атомарная
    условная операция (UPDATE ... WHERE ... RETURNING или INSERT ... ON CONFLICT DO NOTHING
    в start_next_round), поэтому при гонке реальное действие выполнится только у одного
    запроса, а остальные увидят, что оно уже сделано, и просто прочитают актуальное состояние."""
    cur.execute(
        "SELECT id, round_number, status, completed_at FROM tournament_rounds WHERE tournament_id = %s ORDER BY round_number DESC LIMIT 1",
        (tournament['id'],)
    )
    row = cur.fetchone()
    if not row:
        return None, []
    round_id, round_number, status, completed_at = row

    if status == 'active':
        # Считаем отдельно общее число партий и незавершённых: между вставкой строки тура
        # и вставкой его партий (в start_next_round) есть краткий промежуток, в течение
        # которого у тура ещё 0 партий — без проверки total > 0 это выглядело бы как "все
        # партии завершены" и тур закрывался бы пустым, ещё до жеребьёвки.
        cur.execute(
            "SELECT COUNT(*), COUNT(*) FILTER (WHERE status != 'finished') FROM tournament_games WHERE round_id = %s",
            (round_id,)
        )
        total, unfinished = cur.fetchone()
        events = []
        if total > 0 and unfinished == 0:
            cur.execute(
                "UPDATE tournament_rounds SET status = 'completed', completed_at = now() WHERE id = %s AND status = 'active' RETURNING id",
                (round_id,)
            )
            if cur.fetchone():
                update_buchholz(cur, tournament['id'])
                if round_number >= tournament['rounds_count']:
                    cur.execute(
                        "UPDATE tournaments SET hall_status = 'finished' WHERE id = %s AND hall_status = 'active' RETURNING id",
                        (tournament['id'],)
                    )
                    if cur.fetchone():
                        assign_places(cur, tournament['id'])
                        apply_rating_changes(cur, tournament['id'], tournament['title'], tournament['rating_type'])
                        events.append((f"tournament-{tournament['id']}", 'finished', {}))
                else:
                    events.append((f"tournament-{tournament['id']}", 'round-completed', {'round_number': round_number}))
            if round_number < tournament['rounds_count']:
                break_seconds = tournament.get('round_break_seconds', 60)
                next_round_at = (datetime.utcnow() + timedelta(seconds=break_seconds)).isoformat() + 'Z'
                return next_round_at, events
        return None, events

    if status == 'completed' and round_number < tournament['rounds_count']:
        break_seconds = tournament.get('round_break_seconds', 60)
        next_round_at = completed_at + timedelta(seconds=break_seconds) if completed_at else None
        if completed_at and datetime.utcnow() >= completed_at + timedelta(seconds=break_seconds):
            new_round_id, events = start_next_round(cur, tournament, round_number + 1)
            if new_round_id:
                events.append((f"tournament-{tournament['id']}", 'round-started', {'round_number': round_number + 1}))
            return None, events
        return (next_round_at.isoformat() + 'Z' if next_round_at else None), []

    return None, []


def get_tournament(cur, tournament_id):
    cur.execute(
        "SELECT id, title, time_control, rounds_count, hall_status, round_break_seconds, rating_type FROM tournaments WHERE id = %s",
        (tournament_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        'id': row[0], 'title': row[1], 'time_control': row[2], 'rounds_count': row[3],
        'hall_status': row[4], 'round_break_seconds': row[5], 'rating_type': row[6] or 'rapid',
    }


def get_player_rating(cur, user_id, rating_type):
    """Стартовый рейтинг игрока в турнире = его рейтинг МШ (блиц/рапид, в зависимости
    от контроля времени турнира). Если рейтинга ещё нет — 1200 по умолчанию."""
    if not user_id:
        return 1200
    column = 'rating_blitz' if rating_type == 'blitz' else 'rating_rapid'
    cur.execute(f"SELECT {column} FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    return row[0] if row and row[0] is not None else 1200


def handler(event: dict, context) -> dict:
    """Турнирный зал: жеребьёвка швейцарской системы, состояние туров и партий"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        tournament_id = params.get('tournament_id')
        if not tournament_id:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'tournament_id required'})}

        tournament = get_tournament(cur, tournament_id)
        if not tournament:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}

        next_round_at = None
        if tournament['hall_status'] == 'active':
            next_round_at, advance_events = maybe_advance(cur, tournament)
            conn.commit()
            for channel, ev, data in advance_events:
                trigger(channel, ev, data)
            tournament = get_tournament(cur, tournament_id)

        user_id = get_user_id_by_token(cur, auth_token) if not is_admin else None
        my_player_id = None
        if user_id:
            # Зал опрашивается автоматически каждые ~20 секунд, пока открыта вкладка —
            # без троттлинга каждый такой опрос попадал бы в лог как отдельный "заход в зал".
            # Пишем новую запись, только если с прошлого захода в ЭТОТ турнир прошло от
            # 5 минут (значит вкладка была закрыта/неактивна и это действительно новый визит).
            cur.execute(
                """SELECT 1 FROM user_activity_logs
                   WHERE user_id = %s AND event_type = 'hall_enter' AND meta->>'tournament_id' = %s
                     AND created_at > now() - interval '5 minutes'""",
                (user_id, str(tournament_id))
            )
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO user_activity_logs (user_id, event_type, meta) VALUES (%s, 'hall_enter', %s)",
                    (user_id, json.dumps({'tournament_id': str(tournament_id), 'tournament_title': tournament['title']}))
                )
            cur.execute(
                """INSERT INTO user_online_status (user_id, last_seen) VALUES (%s, now())
                   ON CONFLICT (user_id) DO UPDATE SET last_seen = now()""",
                (user_id,)
            )
            conn.commit()

            cur.execute("SELECT id FROM tournament_players WHERE tournament_id = %s AND user_id = %s", (tournament_id, user_id))
            r = cur.fetchone()
            my_player_id = r[0] if r else None

            # До старта турнира — любой зашедший в зал с оплаченной заявкой сразу регистрируется
            # участником (он попадёт в жеребьёвку 1-го тура).
            # Пока идёт 1-й тур (или перерыв перед 2-м) — опоздавший тоже регистрируется, чтобы
            # сыграть со 2-го тура, но получает только 0,5 очка за пропущенный 1-й тур вместо игры.
            can_join_before_start = tournament['hall_status'] == 'not_started'
            can_join_late = False
            if not my_player_id and tournament['hall_status'] == 'active':
                cur.execute("SELECT MAX(round_number) FROM tournament_rounds WHERE tournament_id = %s", (tournament_id,))
                max_round_row = cur.fetchone()
                can_join_late = bool(max_round_row and max_round_row[0] == 1)

            if not my_player_id and (can_join_before_start or can_join_late):
                cur.execute(
                    "SELECT id, fio FROM applications WHERE tournament_id = %s AND user_id = %s AND status = 'paid' LIMIT 1",
                    (tournament_id, user_id)
                )
                app_row = cur.fetchone()
                if app_row:
                    app_id, fio = app_row
                    player_rating = get_player_rating(cur, user_id, tournament['rating_type'])
                    initial_points = 0.5 if can_join_late else 0
                    cur.execute(
                        """INSERT INTO tournament_players (tournament_id, user_id, application_id, fio, rating, points, joined_late)
                           VALUES (%s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (tournament_id, application_id) DO NOTHING
                           RETURNING id""",
                        (tournament_id, user_id, app_id, fio, player_rating, initial_points, can_join_late)
                    )
                    new_row = cur.fetchone()
                    conn.commit()
                    if new_row:
                        my_player_id = new_row[0]
                        trigger(f'tournament-{tournament_id}', 'player-joined', {})

        cur.execute(
            """SELECT tp.id, tp.fio, tp.rating, tp.points, tp.buchholz, tp.wins, tp.place, tp.joined_late, tp.user_id, u.avatar_url
               FROM tournament_players tp
               LEFT JOIN users u ON u.id = tp.user_id
               WHERE tp.tournament_id = %s ORDER BY tp.points DESC, tp.buchholz DESC, tp.wins DESC, tp.rating DESC""",
            (tournament_id,)
        )
        players = [
            {'id': r[0], 'fio': r[1], 'rating': r[2], 'points': float(r[3]), 'buchholz': float(r[4]), 'wins': r[5], 'place': r[6], 'joined_late': r[7], 'user_id': r[8], 'avatar_url': r[9], 'rating_delta': None}
            for r in cur.fetchall()
        ]

        if tournament['hall_status'] == 'finished':
            cur.execute(
                """SELECT tp.id, rh.delta FROM rating_history rh
                   JOIN tournament_players tp ON tp.tournament_id = rh.tournament_id AND tp.user_id = rh.user_id
                   WHERE rh.tournament_id = %s""",
                (tournament_id,)
            )
            delta_by_player = {r[0]: float(r[1]) for r in cur.fetchall()}
            for p in players:
                if p['id'] in delta_by_player:
                    p['rating_delta'] = delta_by_player[p['id']]

        cur.execute(
            "SELECT id, round_number, status, started_at, completed_at FROM tournament_rounds WHERE tournament_id = %s ORDER BY round_number ASC",
            (tournament_id,)
        )
        rounds_rows = cur.fetchall()
        rounds = []
        my_game_id = None
        for rr in rounds_rows:
            round_id, round_number, r_status, started_at, completed_at = rr
            cur.execute(
                """SELECT g.id, g.white_player_id, wp.fio, wp.user_id, wu.avatar_url,
                          g.black_player_id, bp.fio, bp.user_id, bu.avatar_url,
                          g.is_bye, g.status, g.result, g.fen
                   FROM tournament_games g
                   LEFT JOIN tournament_players wp ON wp.id = g.white_player_id
                   LEFT JOIN tournament_players bp ON bp.id = g.black_player_id
                   LEFT JOIN users wu ON wu.id = wp.user_id
                   LEFT JOIN users bu ON bu.id = bp.user_id
                   WHERE g.round_id = %s ORDER BY g.id ASC""",
                (round_id,)
            )
            games = []
            for g in cur.fetchall():
                games.append({
                    'id': g[0], 'white_player_id': g[1], 'white_fio': g[2], 'white_user_id': g[3], 'white_avatar_url': g[4],
                    'black_player_id': g[5], 'black_fio': g[6], 'black_user_id': g[7], 'black_avatar_url': g[8], 'is_bye': g[9],
                    'status': g[10], 'result': g[11], 'fen': g[12],
                })
                if my_player_id and g[10] != 'finished' and (g[1] == my_player_id or g[5] == my_player_id):
                    my_game_id = g[0]
            rounds.append({
                'round_number': round_number, 'status': r_status,
                'started_at': str(started_at) if started_at else None,
                'completed_at': str(completed_at) if completed_at else None,
                'games': games,
            })

        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'tournament': tournament, 'players': players, 'rounds': rounds,
            'my_player_id': my_player_id, 'my_game_id': my_game_id,
            'next_round_at': next_round_at,
            'pusher_key': os.environ.get('PUSHER_KEY', ''),
            'pusher_cluster': os.environ.get('PUSHER_CLUSTER', 'eu'),
        })}

    if method == 'POST' and action == 'start':
        if not is_admin:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}
        tournament_id = body.get('tournament_id')
        tournament = get_tournament(cur, tournament_id)
        if not tournament:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}
        if tournament['hall_status'] != 'not_started':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир уже запущен'})}

        # В жеребьёвку 1-го тура попадают только те, кто реально зашёл в турнирный зал
        # к моменту старта (уже есть запись в tournament_players — она создаётся автоматически
        # при GET-запросе зала). Заявки без привязанного аккаунта (user_id IS NULL, добавлены
        # админом вручную) не могут "зайти в зал" сами — их регистрируем при старте всегда,
        # иначе они никогда не попадут в турнир.
        cur.execute(
            "SELECT id, user_id, fio FROM applications WHERE tournament_id = %s AND status = 'paid' AND user_id IS NULL",
            (tournament_id,)
        )
        no_account_apps = cur.fetchall()

        cur.execute(
            "SELECT COUNT(*) FROM tournament_players WHERE tournament_id = %s",
            (tournament_id,)
        )
        already_in_hall = cur.fetchone()[0]

        if already_in_hall + len(no_account_apps) < 2:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недостаточно участников в турнирном зале (нужно минимум 2, зашедших в зал)'})}

        for app_id, user_id, fio in no_account_apps:
            player_rating = get_player_rating(cur, user_id, tournament['rating_type'])
            cur.execute(
                """INSERT INTO tournament_players (tournament_id, user_id, application_id, fio, rating)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (tournament_id, application_id) DO NOTHING""",
                (tournament_id, user_id, app_id, fio, player_rating)
            )

        # Приём заявок автоматически закрывается при старте турнира, если организатор
        # не закрыл его вручную заранее — после старта подать заявку уже бессмысленно.
        cur.execute("UPDATE tournaments SET hall_status = 'active', status = 'closed' WHERE id = %s", (tournament_id,))
        conn.commit()
        tournament = get_tournament(cur, tournament_id)
        round_id, start_events = start_next_round(cur, tournament, 1)
        conn.commit()
        conn.close()
        if not round_id:
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не удалось создать пары'})}
        trigger(f'tournament-{tournament_id}', 'round-started', {'round_number': 1})
        for channel, ev, data in start_events:
            trigger(channel, ev, data)
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'reset':
        if not is_admin:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}
        tournament_id = body.get('tournament_id')
        tournament = get_tournament(cur, tournament_id)
        if not tournament:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}

        cur.execute(
            """DELETE FROM game_chat_messages WHERE game_id IN
               (SELECT id FROM tournament_games WHERE tournament_id = %s)""",
            (tournament_id,)
        )
        cur.execute("DELETE FROM tournament_games WHERE tournament_id = %s", (tournament_id,))
        cur.execute("DELETE FROM tournament_rounds WHERE tournament_id = %s", (tournament_id,))
        cur.execute("DELETE FROM tournament_players WHERE tournament_id = %s", (tournament_id,))
        cur.execute(
            "UPDATE tournaments SET hall_status = 'not_started', hall_open = false WHERE id = %s",
            (tournament_id,)
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}