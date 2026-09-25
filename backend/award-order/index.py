import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p58220589_site_structure_repli')


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
        'Content-Type': 'application/json',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute(f"SELECT user_id FROM {SCHEMA}.user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    """Сохраняет заказ наград в базу данных. Поддерживает оплату с баланса личного кабинета. GET — только для администратора."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers_in = event.get('headers', {}) or {}

    if event.get('httpMethod') == 'GET':
        admin_password = headers_in.get('X-Admin-Password') or headers_in.get('x-admin-password', '')
        if admin_password != os.environ.get('ADMIN_PASSWORD', ''):
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Unauthorized'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(f"SELECT id, customer_name, customer_phone, customer_email, items, total_price, status, notes, created_at, paid_from_balance FROM {SCHEMA}.award_orders ORDER BY created_at DESC")
        rows = cur.fetchall()
        orders = []
        for r in rows:
            orders.append({
                'id': r[0], 'customer_name': r[1], 'customer_phone': r[2],
                'customer_email': r[3], 'items': r[4], 'total_price': float(r[5]) if r[5] else None,
                'status': r[6], 'notes': r[7], 'created_at': str(r[8]), 'paid_from_balance': r[9]
            })
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'orders': orders})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')
    auth_token = headers_in.get('X-Auth-Token') or headers_in.get('x-auth-token', '')

    if action == 'delete':
        admin_password = headers_in.get('X-Admin-Password') or headers_in.get('x-admin-password', '')
        if admin_password != os.environ.get('ADMIN_PASSWORD', ''):
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Unauthorized'})}

        order_id = body.get('id')
        if not order_id:
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'id required'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        # Если заказ был оплачен с баланса — возвращаем сумму пользователю перед удалением
        cur.execute(f"SELECT user_id, total_price, paid_from_balance, customer_name FROM {SCHEMA}.award_orders WHERE id = %s", (order_id,))
        order_row = cur.fetchone()
        if order_row and order_row[2] and order_row[0] and order_row[1]:
            cur.execute(f"UPDATE {SCHEMA}.users SET balance = balance + %s WHERE id = %s", (order_row[1], order_row[0]))
            cur.execute(
                f"""INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, type, description, award_order_id)
                   VALUES (%s, %s, 'refund', %s, %s)""",
                (order_row[0], order_row[1], f"Возврат за отменённый заказ наград: {order_row[3]}", order_id)
            )
        cur.execute(
            f"DELETE FROM {SCHEMA}.order_items WHERE order_id IN "
            f"(SELECT id FROM {SCHEMA}.orders WHERE award_order_id = %s)",
            (order_id,)
        )
        cur.execute(f"DELETE FROM {SCHEMA}.orders WHERE award_order_id = %s", (order_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.award_orders WHERE id = %s", (order_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'success': True})}

    customer_name = body.get('customer_name', '').strip()
    customer_phone = body.get('customer_phone', '').strip()
    customer_email = body.get('customer_email', '').strip()
    items = body.get('items', [])
    notes = body.get('notes', '').strip()

    if not customer_name or not customer_phone or not items:
        return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Заполните имя, телефон и выберите хотя бы один комплект'})}

    total_price = sum(item.get('price', 0) or 0 for item in items)

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    # Оплата с баланса личного кабинета (пользователь авторизован через X-Auth-Token)
    if action == 'pay_from_balance':
        user_id = get_user_id_by_token(cur, auth_token)
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Необходимо авторизоваться'})}
        if total_price <= 0:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Стоимость заказа не определена'})}

        cur.execute(f"SELECT balance FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        balance_row = cur.fetchone()
        current_balance = float(balance_row[0]) if balance_row else 0
        if current_balance < total_price:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недостаточно средств на балансе. Пополните баланс в личном кабинете.'})}

        cur.execute(
            f"""INSERT INTO {SCHEMA}.award_orders (customer_name, customer_phone, customer_email, items, total_price, notes, user_id, paid_from_balance)
               VALUES (%s, %s, %s, %s, %s, %s, %s, true) RETURNING id""",
            (customer_name, customer_phone, customer_email or None, json.dumps(items, ensure_ascii=False), total_price or None, notes or None, user_id)
        )
        order_id = cur.fetchone()[0]

        cur.execute(f"UPDATE {SCHEMA}.users SET balance = balance - %s WHERE id = %s", (total_price, user_id))
        cur.execute(
            f"""INSERT INTO {SCHEMA}.balance_transactions (user_id, amount, type, description, award_order_id)
               VALUES (%s, %s, 'payment', %s, %s)""",
            (user_id, -total_price, f"Оплата заказа наград: {customer_name}", order_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({'success': True, 'order_id': order_id})
        }

    cur.execute(
        f"INSERT INTO {SCHEMA}.award_orders (customer_name, customer_phone, customer_email, items, total_price, notes) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (customer_name, customer_phone, customer_email or None, json.dumps(items, ensure_ascii=False), total_price or None, notes or None)
    )
    order_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': json.dumps({'success': True, 'order_id': order_id})
    }