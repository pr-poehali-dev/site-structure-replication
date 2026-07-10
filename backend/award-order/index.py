import json
import os
import psycopg2


def handler(event: dict, context) -> dict:
    """Сохраняет заказ наград в базу данных. GET — только для администратора."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    if event.get('httpMethod') == 'GET':
        headers_in = event.get('headers', {}) or {}
        admin_password = headers_in.get('X-Admin-Password') or headers_in.get('x-admin-password', '')
        if admin_password != os.environ.get('ADMIN_PASSWORD', ''):
            return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'Unauthorized'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute("SELECT id, customer_name, customer_phone, customer_email, items, total_price, status, notes, created_at FROM t_p58220589_site_structure_repli.award_orders ORDER BY created_at DESC")
        rows = cur.fetchall()
        orders = []
        for r in rows:
            orders.append({
                'id': r[0], 'customer_name': r[1], 'customer_phone': r[2],
                'customer_email': r[3], 'items': r[4], 'total_price': float(r[5]) if r[5] else None,
                'status': r[6], 'notes': r[7], 'created_at': str(r[8])
            })
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps({'orders': orders})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    if action == 'delete':
        headers_in = event.get('headers', {}) or {}
        admin_password = headers_in.get('X-Admin-Password') or headers_in.get('x-admin-password', '')
        if admin_password != os.environ.get('ADMIN_PASSWORD', ''):
            return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'Unauthorized'})}

        order_id = body.get('id')
        if not order_id:
            return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'id required'})}

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute("DELETE FROM t_p58220589_site_structure_repli.award_orders WHERE id = %s", (order_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps({'success': True})}

    customer_name = body.get('customer_name', '').strip()
    customer_phone = body.get('customer_phone', '').strip()
    customer_email = body.get('customer_email', '').strip()
    items = body.get('items', [])
    notes = body.get('notes', '').strip()

    if not customer_name or not customer_phone or not items:
        return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'Заполните имя, телефон и выберите хотя бы один комплект'})}

    total_price = sum(item.get('price', 0) or 0 for item in items)

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO t_p58220589_site_structure_repli.award_orders (customer_name, customer_phone, customer_email, items, total_price, notes) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (customer_name, customer_phone, customer_email or None, json.dumps(items, ensure_ascii=False), total_price or None, notes or None)
    )
    order_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps({'success': True, 'order_id': order_id})
    }