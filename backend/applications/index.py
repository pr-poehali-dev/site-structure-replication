import json
import os
import psycopg2
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
                          COALESCE(t.hall_status, 'not_started'), tp.place
                   FROM applications a LEFT JOIN tournaments t ON t.id = a.tournament_id
                          LEFT JOIN tournament_players tp ON tp.tournament_id = a.tournament_id AND tp.user_id = a.user_id
                   WHERE a.user_id = %s ORDER BY a.created_at DESC""",
                (user_id,)
            )
            rows = cur.fetchall()
            conn.close()
            cols = ['id', 'tournament_id', 'tournament_title', 'fio', 'age', 'status', 'created_at', 'hall_open', 'tournament_status',
                     'description', 'date', 'location', 'age_category', 'price', 'time_control', 'time_msk',
                     'diploma_sample_url', 'regulation_url', 'announcement_url', 'hall_status', 'place']
            my_apps = [dict(zip(cols, r)) for r in rows]
            for a in my_apps:
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
            "SELECT id, price, status FROM applications WHERE user_id = %s AND tournament_id = %s AND status NOT IN ('cancelled')",
            (user_id, tournament_id)
        )
        app_row = cur.fetchone()
        if not app_row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Заявка не найдена'})}
        app_id, app_price, app_status = app_row
        cur.execute(
            "UPDATE applications SET status = 'cancelled' WHERE id = %s",
            (app_id,)
        )
        if app_price and float(app_price) > 0 and app_status == 'paid':
            cur.execute("UPDATE users SET balance = balance + %s WHERE id = %s", (app_price, user_id))
            cur.execute(
                """INSERT INTO balance_transactions (user_id, amount, type, description, application_id)
                   VALUES (%s, %s, 'refund', 'Возврат взноса за отменённое участие', %s)""",
                (user_id, app_price, app_id)
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

        cur.execute("SELECT status, max_participants FROM tournaments WHERE id = %s", (tournament_id,))
        t_row = cur.fetchone()
        if not t_row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}
        t_status, max_participants = t_row
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
            cur.execute("SELECT balance FROM users WHERE id = %s", (user_id,))
            balance_row = cur.fetchone()
            current_balance = float(balance_row[0]) if balance_row else 0
            if current_balance < price:
                conn.close()
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недостаточно средств на балансе. Пополните баланс в личном кабинете.'})}

        initial_status = 'paid' if price > 0 else 'new'
        cur.execute(
            """INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, price, paid_from_balance)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (tournament_id, body.get('tournament_title'), body.get('fio'),
             body.get('age'), body.get('fsr_id'), body.get('coach'),
             body.get('country_city'), body.get('school'), body.get('email'), body.get('phone'),
             initial_status, user_id, price if price > 0 else None, price > 0)
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
            cur.execute("UPDATE users SET balance = balance - %s WHERE id = %s", (price, user_id))
            cur.execute(
                """INSERT INTO balance_transactions (user_id, amount, type, description, application_id)
                   VALUES (%s, %s, 'payment', %s, %s)""",
                (user_id, -price, f"Оплата взноса: {body.get('tournament_title') or ''}", new_id)
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