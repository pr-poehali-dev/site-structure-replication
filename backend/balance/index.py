import json
import os
import uuid
from datetime import datetime

import psycopg2


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


YOOKASSA_API_URL = "https://api.yookassa.ru/v3/payments"


def create_yookassa_payment(shop_id, secret_key, amount, description, return_url, customer_email, metadata):
    import base64
    from urllib.request import Request, urlopen
    auth_bytes = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
    idempotence_key = str(uuid.uuid4())
    payload = {
        "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": description,
        "receipt": {
            "customer": {"email": customer_email},
            "items": [{
                "description": description[:128],
                "quantity": "1.000",
                "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
                "vat_code": 1,
                "payment_subject": "service",
                "payment_mode": "full_payment",
            }],
        },
        "metadata": metadata,
    }
    request = Request(
        YOOKASSA_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Basic {auth_bytes}',
            'Idempotence-Key': idempotence_key,
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


def handler(event: dict, context) -> dict:
    """Баланс пользователя: получение суммы, история транзакций, пополнение через ЮKassa"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()

    user_id = get_user_id_by_token(cur, token)
    if not user_id:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}

    # Баланс и история транзакций
    if method == 'GET':
        cur.execute("SELECT balance FROM users WHERE id = %s", (user_id,))
        balance = float(cur.fetchone()[0])
        cur.execute(
            """SELECT id, amount, type, description, created_at FROM balance_transactions
               WHERE user_id = %s ORDER BY created_at DESC LIMIT 100""",
            (user_id,)
        )
        rows = cur.fetchall()
        conn.close()
        transactions = [
            {'id': r[0], 'amount': float(r[1]), 'type': r[2], 'description': r[3], 'created_at': str(r[4])}
            for r in rows
        ]
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'balance': balance, 'transactions': transactions})}

    # Создание платежа на пополнение баланса через ЮKassa
    if method == 'POST' and action == 'topup':
        amount = body.get('amount')
        return_url = body.get('return_url', '').strip()
        user_email = body.get('user_email', '').strip()
        user_name = body.get('user_name', '').strip()

        if not amount or float(amount) < 1:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректная сумма пополнения'})}
        if not return_url or not return_url.startswith('https://'):
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'return_url must be a valid HTTPS URL'})}
        if not user_email:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Email обязателен'})}

        shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
        secret_key = os.environ.get('YOOKASSA_SECRET_KEY', '')
        if not shop_id or not secret_key:
            conn.close()
            return {'statusCode': 500, 'headers': cors_headers(), 'body': json.dumps({'error': 'YooKassa credentials not configured'})}

        amount = float(amount)
        now = datetime.utcnow().isoformat()
        order_number = f"YK-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

        cur.execute(
            """INSERT INTO orders (order_number, user_name, user_email, amount, status, order_type, user_id, created_at, updated_at)
               VALUES (%s, %s, %s, %s, 'pending', 'balance_topup', %s, %s, %s) RETURNING id""",
            (order_number, user_name or user_email, user_email, amount, user_id, now, now)
        )
        order_id = cur.fetchone()[0]

        try:
            payment_response = create_yookassa_payment(
                shop_id=shop_id,
                secret_key=secret_key,
                amount=amount,
                description=f'Пополнение баланса на {amount:.0f} ₽',
                return_url=return_url,
                customer_email=user_email,
                metadata={'order_id': str(order_id), 'order_number': order_number},
            )
        except Exception as e:
            conn.rollback()
            conn.close()
            return {'statusCode': 500, 'headers': cors_headers(), 'body': json.dumps({'error': f'YooKassa API error: {e}'})}

        payment_id = payment_response.get('id')
        confirmation_url = payment_response.get('confirmation', {}).get('confirmation_url', '')

        cur.execute(
            "UPDATE orders SET yookassa_payment_id = %s, payment_url = %s, updated_at = %s WHERE id = %s",
            (payment_id, confirmation_url, now, order_id)
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'payment_url': confirmation_url, 'order_id': order_id, 'order_number': order_number,
        })}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
