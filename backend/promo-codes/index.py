import json
import os
import random
import string
import psycopg2
from datetime import datetime, timezone


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
    }


def generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(8))


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    """Промокоды на пополнение баланса: админский CRUD и активация кода пользователем"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    conn = get_conn()
    cur = conn.cursor()

    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    # Активация промокода пользователем — начисляет сумму промокода на баланс
    if method == 'POST' and action == 'activate' and not is_admin:
        user_id = get_user_id_by_token(cur, auth_token)
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}

        code = (body.get('code') or '').strip().upper()
        if not code:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Введите промокод'})}

        cur.execute("SELECT id, active, expires_at, used_at, amount FROM promo_codes WHERE code = %s", (code,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Промокод не найден'})}

        promo_id, active, expires_at, used_at, amount = row
        now = datetime.now(timezone.utc)
        if not active:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Промокод отключён'})}
        if used_at is not None:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Промокод уже использован'})}
        if expires_at is not None and expires_at < now:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Срок действия промокода истёк'})}

        cur.execute(
            "UPDATE promo_codes SET used_at = %s, used_by_user_id = %s WHERE id = %s",
            (now, user_id, promo_id)
        )
        cur.execute("UPDATE users SET balance = balance + %s WHERE id = %s", (amount, user_id))
        cur.execute(
            """INSERT INTO balance_transactions (user_id, amount, type, description)
               VALUES (%s, %s, 'promo', %s)""",
            (user_id, amount, f'Активация промокода {code}')
        )
        conn.commit()
        cur.execute("SELECT balance FROM users WHERE id = %s", (user_id,))
        new_balance = float(cur.fetchone()[0])
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'amount': float(amount), 'balance': new_balance})}

    # Всё остальное — только для админа
    if not is_admin:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    if method == 'GET':
        cur.execute(
            """SELECT pc.id, pc.code, pc.active, pc.expires_at, pc.used_at, pc.amount, pc.created_at,
                      u.last_name, u.first_name
               FROM promo_codes pc
               LEFT JOIN users u ON u.id = pc.used_by_user_id
               ORDER BY pc.created_at DESC"""
        )
        rows = cur.fetchall()
        conn.close()
        cols = ['id', 'code', 'active', 'expires_at', 'used_at', 'amount', 'created_at', 'used_by_last_name', 'used_by_first_name']
        items = [dict(zip(cols, r)) for r in rows]
        for it in items:
            it['created_at'] = str(it['created_at'])
            it['expires_at'] = str(it['expires_at']) if it['expires_at'] else None
            it['used_at'] = str(it['used_at']) if it['used_at'] else None
            it['amount'] = float(it['amount'])
            it['used_by_fio'] = ' '.join(filter(None, [it.pop('used_by_last_name'), it.pop('used_by_first_name')])) or None
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'promo_codes': items})}

    if method == 'POST' and action == 'create':
        code = (body.get('code') or '').strip().upper() or generate_code()
        expires_at = body.get('expires_at') or None
        amount = body.get('amount') or 250
        cur.execute(
            "INSERT INTO promo_codes (code, active, expires_at, amount) VALUES (%s, %s, %s, %s) RETURNING id",
            (code, True, expires_at, amount)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'id': new_id, 'code': code})}

    if method == 'POST' and action == 'set_active':
        cur.execute("UPDATE promo_codes SET active = %s WHERE id = %s", (bool(body.get('active')), body.get('id')))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'delete':
        cur.execute("DELETE FROM promo_codes WHERE id = %s", (body.get('id'),))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
