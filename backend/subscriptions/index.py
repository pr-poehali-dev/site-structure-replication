import json
import os
import random
import string
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }


def generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return 'AB-' + ''.join(random.choice(chars) for _ in range(8))


def handler(event: dict, context) -> dict:
    """Абонементы на участие в турнирах: тарифы, покупка через ЮKassa, применение кода к заявке, админ CRUD"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '') or params.get('_action', '')

    conn = get_conn()
    cur = conn.cursor()

    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')

    # Публичный список активных тарифов (для страницы покупки)
    if method == 'GET' and params.get('scope') == 'plans':
        cur.execute(
            "SELECT id, title, participations, price FROM subscription_plans WHERE is_active = true ORDER BY sort_order, id"
        )
        rows = cur.fetchall()
        conn.close()
        plans = [{'id': r[0], 'title': r[1], 'participations': r[2], 'price': float(r[3])} for r in rows]
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'plans': plans})}

    # Публичная проверка/применение абонемента при подаче заявки
    if method == 'POST' and action == 'apply' and not is_admin:
        code = (body.get('code') or '').strip().upper()
        application_id = body.get('application_id')
        if not code or not application_id:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'code и application_id обязательны'})}

        cur.execute(
            "SELECT id, active, status, total_participations, used_participations FROM subscriptions WHERE code = %s",
            (code,)
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Абонемент не найден'})}

        sub_id, active, status, total, used = row
        if status != 'paid':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Абонемент ещё не оплачен'})}
        if not active:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Абонемент отключён'})}
        if used >= total:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'В абонементе закончились участия'})}

        cur.execute("UPDATE subscriptions SET used_participations = used_participations + 1 WHERE id = %s", (sub_id,))
        cur.execute("INSERT INTO subscription_usages (subscription_id, application_id) VALUES (%s, %s)", (sub_id, application_id))
        cur.execute(
            "UPDATE applications SET status = 'paid', subscription_code = %s WHERE id = %s AND status = 'pending_payment'",
            (code, application_id)
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'remaining': total - used - 1})}

    # Публичная проверка статуса абонемента по order_number (после оплаты)
    if method == 'GET' and params.get('order_number'):
        order_number = params.get('order_number')
        cur.execute(
            """SELECT s.code, s.status, s.total_participations, s.plan_title
               FROM subscriptions s JOIN orders o ON o.id = s.order_id
               WHERE o.order_number = %s""",
            (order_number,)
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'not found'})}
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'code': row[0], 'status': row[1], 'total_participations': row[2], 'plan_title': row[3]
        })}

    # Всё остальное — только для админа
    if not is_admin:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    # GET — админский список тарифов и абонементов
    if method == 'GET':
        cur.execute("SELECT id, title, participations, price, is_active, sort_order, created_at FROM subscription_plans ORDER BY sort_order, id")
        rows = cur.fetchall()
        plans = [{
            'id': r[0], 'title': r[1], 'participations': r[2], 'price': float(r[3]),
            'is_active': r[4], 'sort_order': r[5], 'created_at': str(r[6])
        } for r in rows]

        cur.execute(
            """SELECT id, code, plan_title, total_participations, used_participations, price,
                      customer_name, customer_email, customer_phone, active, status, created_at, paid_at
               FROM subscriptions ORDER BY created_at DESC"""
        )
        rows2 = cur.fetchall()
        subs = [{
            'id': r[0], 'code': r[1], 'plan_title': r[2], 'total_participations': r[3], 'used_participations': r[4],
            'price': float(r[5]), 'customer_name': r[6], 'customer_email': r[7], 'customer_phone': r[8],
            'active': r[9], 'status': r[10], 'created_at': str(r[11]), 'paid_at': str(r[12]) if r[12] else None
        } for r in rows2]

        sub_ids = [s['id'] for s in subs]
        usages_map = {}
        if sub_ids:
            cur.execute(
                f"""SELECT su.subscription_id, a.fio, a.tournament_title, su.used_at
                    FROM subscription_usages su LEFT JOIN applications a ON a.id = su.application_id
                    WHERE su.subscription_id = ANY(%s) ORDER BY su.used_at ASC""",
                (sub_ids,)
            )
            for sid, fio, t_title, used_at in cur.fetchall():
                usages_map.setdefault(sid, []).append({'fio': fio, 'tournament_title': t_title, 'used_at': str(used_at)})
        for s in subs:
            s['usages'] = usages_map.get(s['id'], [])

        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'plans': plans, 'subscriptions': subs})}

    if method == 'POST' and action == 'create_plan':
        cur.execute(
            "INSERT INTO subscription_plans (title, participations, price, sort_order) VALUES (%s, %s, %s, %s) RETURNING id",
            (body.get('title'), body.get('participations'), body.get('price'), body.get('sort_order', 0))
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'id': new_id})}

    if method == 'POST' and action == 'update_plan':
        cur.execute(
            "UPDATE subscription_plans SET title=%s, participations=%s, price=%s, sort_order=%s WHERE id=%s",
            (body.get('title'), body.get('participations'), body.get('price'), body.get('sort_order', 0), body.get('id'))
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'set_plan_active':
        cur.execute("UPDATE subscription_plans SET is_active = %s WHERE id = %s", (bool(body.get('active')), body.get('id')))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'delete_plan':
        cur.execute("DELETE FROM subscription_plans WHERE id = %s", (body.get('id'),))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'set_subscription_active':
        cur.execute("UPDATE subscriptions SET active = %s WHERE id = %s", (bool(body.get('active')), body.get('id')))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'delete_subscription':
        sub_id = body.get('id')
        cur.execute("DELETE FROM subscription_usages WHERE subscription_id = %s", (sub_id,))
        cur.execute("UPDATE orders SET subscription_id = NULL WHERE subscription_id = %s", (sub_id,))
        cur.execute("DELETE FROM subscriptions WHERE id = %s", (sub_id,))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    # Ручная выдача абонемента администратором (без оплаты, сразу оплаченный)
    if method == 'POST' and action == 'create_manual':
        plan_id = body.get('plan_id')
        cur.execute("SELECT title, participations, price FROM subscription_plans WHERE id = %s", (plan_id,))
        plan_row = cur.fetchone()
        if not plan_row:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Тариф не найден'})}
        plan_title, participations, price = plan_row
        code = generate_code()
        cur.execute(
            """INSERT INTO subscriptions (code, plan_id, plan_title, total_participations, price, customer_name, customer_email, customer_phone, status, active, paid_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'paid', true, now()) RETURNING id""",
            (code, plan_id, plan_title, participations, price, body.get('customer_name'), body.get('customer_email'), body.get('customer_phone'))
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'id': new_id, 'code': code})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
