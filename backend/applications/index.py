import json
import os
import psycopg2
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from push_utils import notify_admins_new_application

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
    }

def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


LILA = 'https://' + 'play.мир-шахмат.рф'.encode('idna').decode()

def fetch_lila_finished(item):
    lila_id, kind = item
    path = 'tournament' if kind == 'arena' else 'swiss'
    try:
        req = urllib.request.Request(f'{LILA}/api/{path}/{lila_id}', headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (mir-shakhmat)'})
        with urllib.request.urlopen(req, timeout=3) as r:
            info = json.loads(r.read().decode('utf-8'))
        return bool(info.get('isFinished')) if kind == 'arena' else info.get('status') == 'finished'
    except Exception as e:
        print(f'lila status failed {path}/{lila_id}: {e}')
        return None

def refresh_lila_finished(cur, conn, tournament_ids):
    if not tournament_ids:
        return {}
    cur.execute(
        """SELECT t.id, t.lila_tournament_id, COALESCE(t.lila_tournament_kind, 'swiss'), COALESCE(s.is_finished, false),
                  (s.synced_at IS NOT NULL AND s.synced_at > now() - interval '1 minute')
           FROM tournaments t LEFT JOIN lila_tournament_sync s ON s.tournament_id = t.id
           WHERE t.id = ANY(%s) AND t.lila_tournament_id IS NOT NULL""",
        (list(tournament_ids),)
    )
    state = {}
    todo = []
    for tid, lila_id, kind, finished, fresh in cur.fetchall():
        state[tid] = finished
        if not finished and not fresh:
            todo.append((tid, lila_id, kind))
    if todo:
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda t: fetch_lila_finished((t[1], t[2])), todo))
        for (tid, _, _), fin in zip(todo, results):
            if fin is None:
                continue
            state[tid] = fin
            cur.execute(
                """INSERT INTO lila_tournament_sync (tournament_id, synced_at, is_finished) VALUES (%s, now(), %s)
                   ON CONFLICT (tournament_id) DO UPDATE SET is_finished = EXCLUDED.is_finished""",
                (tid, fin)
            )
        conn.commit()
    return state

def handler(event: dict, context) -> dict:
    """Управление заявками на турниры: публичное создание и админское CRUD"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')  # 'update' для редактирования

    conn = get_conn()
    cur = conn.cursor()

    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    # GET — публичный (только участники), список "моих заявок" или админский (полные заявки)
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        tournament_id = params.get('tournament_id')
        scope = params.get('scope', '')

        if not is_admin and scope == 'my':
            user_id = get_user_id_by_token(cur, auth_token)
            if not user_id:
                conn.close()
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute(
                """SELECT a.id, a.tournament_id, a.tournament_title, a.fio, a.age, a.status, a.created_at, COALESCE(t.hall_open, false), COALESCE(t.status, 'active'),
                          t.description, t.date, t.location, t.age_category, t.price, t.time_control, t.time_msk,
                          t.diploma_sample_url, t.regulation_url, t.announcement_url,
                          COALESCE(t.hall_status, 'not_started'), tp.place, (t.lila_tournament_id IS NOT NULL), t.cancel_reason,
                          EXISTS (SELECT 1 FROM electronic_results er WHERE er.tournament_id = a.tournament_id AND er.status = 'published')
                   FROM applications a LEFT JOIN tournaments t ON t.id = a.tournament_id
                          LEFT JOIN tournament_players tp ON tp.tournament_id = a.tournament_id AND tp.user_id = a.user_id
                   WHERE a.user_id = %s ORDER BY a.created_at DESC""",
                (user_id,)
            )
            rows = cur.fetchall()
            open_ids = [r[1] for r in rows if r[7] and r[19] != 'finished' and r[21]]
            lila_state = refresh_lila_finished(cur, conn, open_ids)
            conn.close()
            cols = ['id', 'tournament_id', 'tournament_title', 'fio', 'age', 'status', 'created_at', 'hall_open', 'tournament_status',
                     'description', 'date', 'location', 'age_category', 'price', 'time_control', 'time_msk',
                     'diploma_sample_url', 'regulation_url', 'announcement_url', 'hall_status', 'place', 'lila_ready', 'cancel_reason', 'results_published']
            my_apps = [dict(zip(cols, r)) for r in rows]
            for a in my_apps:
                a['lila_finished'] = bool(lila_state.get(a['tournament_id']))
                a['created_at'] = str(a['created_at'])
                a['date'] = str(a['date']) if a['date'] else None
                a['price'] = float(a['price']) if a['price'] is not None else None
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'applications': my_apps})}

        if not is_admin:
            # Публичный: только ФИО и возраст, tournament_id обязателен
            # Заявки, ожидающие оплаты, в список участников не попадают
            if not tournament_id:
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'tournament_id required'})}
            cur.execute(
                "SELECT fio, age FROM applications WHERE tournament_id = %s AND status NOT IN ('cancelled', 'pending_payment') ORDER BY created_at ASC",
                (tournament_id,)
            )
            rows = cur.fetchall()
            conn.close()
            participants = [{'fio': r[0], 'age': r[1]} for r in rows]
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'participants': participants, 'count': len(participants)})}

    # Отмена своей заявки пользователем (_action: cancel, без пароля админа)
    # Если взнос был оплачен (списан с баланса) — сумма возвращается на баланс
    if method == 'POST' and action == 'cancel' and not is_admin:
        user_id = get_user_id_by_token(cur, auth_token)
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}
        tournament_id = body.get('tournament_id')
        cur.execute(
            "SELECT id, price, status, bonus_paid FROM applications WHERE user_id = %s AND tournament_id = %s AND status NOT IN ('cancelled')",
            (user_id, tournament_id)
        )
        app_row = cur.fetchone()
        if not app_row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Заявка не найдена'})}
        app_id, app_price, app_status, app_bonus = app_row
        cur.execute("SELECT COALESCE(hall_open, false), COALESCE(hall_status, 'not_started') FROM tournaments WHERE id = %s", (tournament_id,))
        t_row = cur.fetchone()
        if t_row and (t_row[0] or t_row[1] != 'not_started'):
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнирный зал уже открыт, отменить участие нельзя'})}
        cur.execute(
            "UPDATE applications SET status = 'cancelled' WHERE id = %s",
            (app_id,)
        )
        if app_price and float(app_price) > 0 and app_status == 'paid':
            bonus_back = min(float(app_bonus or 0), float(app_price))
            money_back = round(float(app_price) - bonus_back, 2)
            if bonus_back > 0:
                cur.execute("UPDATE users SET bonus_balance = bonus_balance + %s WHERE id = %s", (bonus_back, user_id))
                cur.execute(
                    """INSERT INTO balance_transactions (user_id, amount, type, description, application_id, account)
                       VALUES (%s, %s, 'refund', 'Возврат взноса за отменённое участие', %s, 'bonus')""",
                    (user_id, bonus_back, app_id)
                )
            if money_back > 0:
                cur.execute("UPDATE users SET balance = balance + %s WHERE id = %s", (money_back, user_id))
                cur.execute(
                    """INSERT INTO balance_transactions (user_id, amount, type, description, application_id, account)
                       VALUES (%s, %s, 'refund', 'Возврат взноса за отменённое участие', %s, 'money')""",
                    (user_id, money_back, app_id)
                )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    # Публичное создание заявки (POST без _action и без пароля)
    # Если турнир платный — стоимость сразу списывается с баланса пользователя.
    # Недостаточно средств — заявка не создаётся, пользователь должен пополнить баланс.
    if method == 'POST' and action == '' and not is_admin:
        user_id = get_user_id_by_token(cur, auth_token)
        tournament_id = body.get('tournament_id')
        if user_id:
            cur.execute(
                "SELECT id FROM applications WHERE user_id = %s AND tournament_id = %s AND status NOT IN ('cancelled')",
                (user_id, tournament_id)
            )
            if cur.fetchone():
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Вы уже подали заявку на этот турнир'})}

        cur.execute("SELECT status, max_participants, rating_min, rating_max, rating_type FROM tournaments WHERE id = %s", (tournament_id,))
        t_row = cur.fetchone()
        if not t_row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}
        t_status, max_participants, rating_min, rating_max, t_rating_type = t_row
        if rating_min is not None or rating_max is not None:
            if not user_id:
                conn.close()
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Для этого турнира необходимо войти в личный кабинет'})}
            rcol = 'rating_blitz' if t_rating_type == 'blitz' else 'rating_rapid'
            cur.execute(f"SELECT {rcol} FROM users WHERE id = %s", (user_id,))
            rr = cur.fetchone()
            u_rating = rr[0] if rr and rr[0] is not None else 1200
            if rating_max is not None and u_rating > rating_max:
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': f'В этот турнир допускаются участники с рейтингом до {rating_max}. Ваш рейтинг: {u_rating}.'})}
            if rating_min is not None and u_rating < rating_min:
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': f'В этот турнир допускаются участники с рейтингом от {rating_min}. Ваш рейтинг: {u_rating}.'})}
        if t_status != 'open':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Приём заявок на этот турнир закрыт'})}
        if max_participants:
            cur.execute(
                "SELECT COUNT(*) FROM applications WHERE tournament_id = %s AND status NOT IN ('cancelled')",
                (tournament_id,)
            )
            if cur.fetchone()[0] >= max_participants:
                cur.execute("UPDATE tournaments SET status = 'closed' WHERE id = %s AND status = 'open'", (tournament_id,))
                conn.commit()
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Достигнуто максимальное количество участников, приём заявок закрыт'})}

        price = body.get('price') or 0
        try:
            price = float(price)
        except (TypeError, ValueError):
            price = 0

        if price > 0:
            if not user_id:
                conn.close()
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Необходимо авторизоваться'})}
            cur.execute("SELECT balance, bonus_balance FROM users WHERE id = %s FOR UPDATE", (user_id,))
            balance_row = cur.fetchone()
            current_balance = float(balance_row[0]) if balance_row else 0
            current_bonus = float(balance_row[1]) if balance_row else 0
            if current_balance + current_bonus < price:
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недостаточно средств на балансе. Пополните баланс в личном кабинете.'})}
            bonus_part = round(min(current_bonus, price), 2)
            money_part = round(price - bonus_part, 2)
        else:
            bonus_part = 0
            money_part = 0

        initial_status = 'paid'
        cur.execute(
            """INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, price, paid_from_balance, bonus_paid)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (tournament_id, body.get('tournament_title'), body.get('fio'),
             body.get('age'), body.get('fsr_id'), body.get('coach'),
             body.get('country_city'), body.get('school'), body.get('email'), body.get('phone'),
             initial_status, user_id, price if price > 0 else None, price > 0, bonus_part)
        )
        new_id = cur.fetchone()[0]

        if max_participants:
            cur.execute(
                "SELECT COUNT(*) FROM applications WHERE tournament_id = %s AND status NOT IN ('cancelled')",
                (tournament_id,)
            )
            if cur.fetchone()[0] >= max_participants:
                cur.execute("UPDATE tournaments SET status = 'closed' WHERE id = %s AND status = 'open'", (tournament_id,))

        if price > 0:
            pay_desc = f"Оплата взноса: {body.get('tournament_title') or ''}"
            if bonus_part > 0:
                cur.execute("UPDATE users SET bonus_balance = bonus_balance - %s WHERE id = %s", (bonus_part, user_id))
                cur.execute(
                    """INSERT INTO balance_transactions (user_id, amount, type, description, application_id, account)
                       VALUES (%s, %s, 'payment', %s, %s, 'bonus')""",
                    (user_id, -bonus_part, pay_desc, new_id)
                )
            if money_part > 0:
                cur.execute("UPDATE users SET balance = balance - %s WHERE id = %s", (money_part, user_id))
                cur.execute(
                    """INSERT INTO balance_transactions (user_id, amount, type, description, application_id, account)
                       VALUES (%s, %s, 'payment', %s, %s, 'money')""",
                    (user_id, -money_part, pay_desc, new_id)
                )

        conn.commit()
        try:
            notify_admins_new_application(conn, body.get('tournament_title') or '', body.get('fio') or '')
        except Exception:
            pass
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'id': new_id})}

    # Все остальные — только для админа
    if not is_admin:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    # GET — полный список заявок для админа
    if method == 'GET':
        tournament_id = (event.get('queryStringParameters') or {}).get('tournament_id')
        # Рейтинг МШ участника: сначала берётся из его профиля (rating_blitz/rating_rapid,
        # если аккаунт привязан), иначе — из справочника ФШР по указанному в заявке ID.
        select_sql = (
            "SELECT a.id, a.tournament_id, a.tournament_title, a.fio, a.age, a.fsr_id, a.coach, a.country_city, "
            "a.school, a.email, a.phone, a.status, a.notes, a.created_at, a.promo_code, "
            "COALESCE(u.rating_blitz, f.rating_blitz), COALESCE(u.rating_rapid, f.rating_rapid) "
            "FROM applications a "
            "LEFT JOIN users u ON u.id = a.user_id "
            "LEFT JOIN fsr_official_cache f ON f.fsr_id = a.fsr_id"
        )
        if tournament_id:
            cur.execute(select_sql + " WHERE a.tournament_id = %s ORDER BY a.created_at DESC", (tournament_id,))
        else:
            cur.execute(select_sql + " ORDER BY a.created_at DESC")
        rows = cur.fetchall()
        conn.close()
        cols = ['id', 'tournament_id', 'tournament_title', 'fio', 'age', 'fsr_id', 'coach', 'country_city', 'school', 'email', 'phone', 'status', 'notes', 'created_at', 'promo_code', 'rating_blitz', 'rating_rapid']
        apps = [dict(zip(cols, r)) for r in rows]
        for a in apps:
            a['created_at'] = str(a['created_at'])
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'applications': apps})}

    # Ручное создание заявки администратором (_action: create) — статус сразу "оплачена"
    if method == 'POST' and action == 'create':
        cur.execute(
            """INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (body.get('tournament_id'), body.get('tournament_title'), body.get('fio'),
             body.get('age'), body.get('fsr_id'), body.get('coach'),
             body.get('country_city'), body.get('school'), body.get('email'), body.get('phone'),
             'paid', body.get('notes', ''))
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'id': new_id})}

    # Удаление заявки (_action: delete)
    if method == 'POST' and action == 'delete':
        app_id = body.get('id')
        # Сначала удаляем зависимые записи, иначе внешний ключ не даст удалить заявку
        cur.execute("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE application_id = %s)", (app_id,))
        cur.execute("DELETE FROM orders WHERE application_id = %s", (app_id,))
        cur.execute("DELETE FROM subscription_usages WHERE application_id = %s", (app_id,))
        cur.execute("UPDATE balance_transactions SET application_id = NULL WHERE application_id = %s", (app_id,))
        cur.execute("SELECT id FROM tournament_players WHERE application_id = %s", (app_id,))
        player_row = cur.fetchone()
        if player_row:
            player_id = player_row[0]
            cur.execute(
                "SELECT id FROM tournament_games WHERE white_player_id = %s OR black_player_id = %s",
                (player_id, player_id)
            )
            game_ids = [r[0] for r in cur.fetchall()]
            if game_ids:
                cur.execute("DELETE FROM game_chat_messages WHERE game_id = ANY(%s)", (game_ids,))
                cur.execute("DELETE FROM tournament_games WHERE id = ANY(%s)", (game_ids,))
            cur.execute("DELETE FROM game_chat_messages WHERE player_id = %s", (player_id,))
            cur.execute("DELETE FROM tournament_players WHERE id = %s", (player_id,))
        cur.execute("DELETE FROM applications WHERE id = %s", (app_id,))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    # Редактирование заявки (_action: update)
    if method == 'POST' and action == 'update':
        cur.execute(
            "UPDATE applications SET tournament_id=%s, tournament_title=%s, fio=%s, age=%s, fsr_id=%s, coach=%s, country_city=%s, school=%s, email=%s, phone=%s, status=%s, notes=%s WHERE id=%s",
            (body.get('tournament_id'), body.get('tournament_title'),
             body.get('fio'), body.get('age'), body.get('fsr_id'), body.get('coach'),
             body.get('country_city'), body.get('school'), body.get('email'), body.get('phone'),
             body.get('status', 'new'), body.get('notes', ''), body.get('id'))
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}