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
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }


def generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(8))


def handler(event: dict, context) -> dict:
    """Управление промокодами для бесплатного участия в турнирах: админский CRUD и публичная проверка/применение кода"""
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

    # Публичное применение промокода при подаче заявки (POST _action=apply, без пароля)
    if method == 'POST' and action == 'apply' and not is_admin:
        code = (body.get('code') or '').strip().upper()
        application_id = body.get('application_id')
        if not code or not application_id:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'code и application_id обязательны'})}

        cur.execute("SELECT id, active, expires_at, used_at FROM promo_codes WHERE code = %s", (code,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Промокод не найден'})}

        promo_id, active, expires_at, used_at = row
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
            "UPDATE promo_codes SET used_at = %s, used_by_application_id = %s WHERE id = %s",
            (now, application_id, promo_id)
        )
        cur.execute(
            "UPDATE applications SET status = 'paid', promo_code = %s WHERE id = %s AND status = 'pending_payment'",
            (code, application_id)
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    # Всё остальное — только для админа
    if not is_admin:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    if method == 'GET':
        cur.execute(
            """SELECT pc.id, pc.code, pc.active, pc.expires_at, pc.used_at, pc.used_by_application_id, pc.created_at,
                      a.fio, a.tournament_title
               FROM promo_codes pc
               LEFT JOIN applications a ON a.id = pc.used_by_application_id
               ORDER BY pc.created_at DESC"""
        )
        rows = cur.fetchall()
        conn.close()
        cols = ['id', 'code', 'active', 'expires_at', 'used_at', 'used_by_application_id', 'created_at', 'used_by_fio', 'used_by_tournament_title']
        items = [dict(zip(cols, r)) for r in rows]
        for it in items:
            it['created_at'] = str(it['created_at'])
            it['expires_at'] = str(it['expires_at']) if it['expires_at'] else None
            it['used_at'] = str(it['used_at']) if it['used_at'] else None
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'promo_codes': items})}

    if method == 'POST' and action == 'create':
        code = (body.get('code') or '').strip().upper() or generate_code()
        expires_at = body.get('expires_at') or None
        cur.execute(
            "INSERT INTO promo_codes (code, active, expires_at) VALUES (%s, %s, %s) RETURNING id",
            (code, True, expires_at)
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