import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta

import psycopg2

SESSION_DAYS = 30


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    }


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()


def user_to_dict(row):
    cols = ['id', 'last_name', 'first_name', 'middle_name', 'birth_date', 'fsr_id',
            'coach_fio', 'institution', 'country_city', 'email', 'phone', 'created_at']
    d = dict(zip(cols, row))
    d['birth_date'] = str(d['birth_date']) if d['birth_date'] else None
    d['created_at'] = str(d['created_at'])
    return d


def get_user_by_token(cur, token: str):
    if not token:
        return None
    cur.execute(
        """SELECT u.id, u.last_name, u.first_name, u.middle_name, u.birth_date, u.fsr_id,
                  u.coach_fio, u.institution, u.country_city, u.email, u.phone, u.created_at
           FROM user_sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = %s AND s.expires_at > now()""",
        (token,)
    )
    row = cur.fetchone()
    return user_to_dict(row) if row else None


def handler(event: dict, context) -> dict:
    """Регистрация, вход и профиль участников турниров"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()

    # Регистрация нового участника
    if method == 'POST' and action == 'register':
        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''
        last_name = (body.get('last_name') or '').strip()
        first_name = (body.get('first_name') or '').strip()

        if not email or not password or not last_name or not first_name:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Заполните обязательные поля'})}
        if len(password) < 6:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Пароль должен быть не короче 6 символов'})}

        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            conn.close()
            return {'statusCode': 409, 'headers': cors_headers(), 'body': json.dumps({'error': 'Пользователь с таким email уже зарегистрирован'})}

        salt = secrets.token_hex(16)
        pwd_hash = hash_password(password, salt)

        cur.execute(
            """INSERT INTO users (last_name, first_name, middle_name, birth_date, fsr_id, coach_fio, institution, country_city, email, phone, password_hash, password_salt)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (last_name, first_name, body.get('middle_name') or None, body.get('birth_date') or None,
             body.get('fsr_id') or None, body.get('coach_fio') or None, body.get('institution') or None,
             body.get('country_city') or None, email, body.get('phone') or None, pwd_hash, salt)
        )
        user_id = cur.fetchone()[0]

        new_token = secrets.token_hex(32)
        expires_at = datetime.utcnow() + timedelta(days=SESSION_DAYS)
        cur.execute("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (%s, %s, %s)", (user_id, new_token, expires_at))
        conn.commit()

        cur.execute(
            """SELECT id, last_name, first_name, middle_name, birth_date, fsr_id, coach_fio, institution, country_city, email, phone, created_at
               FROM users WHERE id = %s""", (user_id,)
        )
        user = user_to_dict(cur.fetchone())
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'token': new_token, 'user': user})}

    # Вход
    if method == 'POST' and action == 'login':
        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''

        cur.execute("SELECT id, password_hash, password_salt FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row or hash_password(password, row[2]) != row[1]:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный email или пароль'})}

        user_id = row[0]
        new_token = secrets.token_hex(32)
        expires_at = datetime.utcnow() + timedelta(days=SESSION_DAYS)
        cur.execute("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (%s, %s, %s)", (user_id, new_token, expires_at))
        conn.commit()

        cur.execute(
            """SELECT id, last_name, first_name, middle_name, birth_date, fsr_id, coach_fio, institution, country_city, email, phone, created_at
               FROM users WHERE id = %s""", (user_id,)
        )
        user = user_to_dict(cur.fetchone())
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'token': new_token, 'user': user})}

    # Выход
    if method == 'POST' and action == 'logout':
        if token:
            cur.execute("DELETE FROM user_sessions WHERE token = %s", (token,))
            conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    # Текущий пользователь по токену
    if method == 'GET':
        user = get_user_by_token(cur, token)
        conn.close()
        if not user:
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'user': user})}

    # Обновление профиля
    if method == 'POST' and action == 'update_profile':
        user = get_user_by_token(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}

        cur.execute(
            """UPDATE users SET last_name=%s, first_name=%s, middle_name=%s, birth_date=%s, fsr_id=%s,
               coach_fio=%s, institution=%s, country_city=%s, phone=%s WHERE id=%s""",
            (body.get('last_name'), body.get('first_name'), body.get('middle_name') or None,
             body.get('birth_date') or None, body.get('fsr_id') or None, body.get('coach_fio') or None,
             body.get('institution') or None, body.get('country_city') or None, body.get('phone') or None,
             user['id'])
        )
        conn.commit()

        cur.execute(
            """SELECT id, last_name, first_name, middle_name, birth_date, fsr_id, coach_fio, institution, country_city, email, phone, created_at
               FROM users WHERE id = %s""", (user['id'],)
        )
        updated = user_to_dict(cur.fetchone())
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'user': updated})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
