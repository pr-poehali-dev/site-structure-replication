import json
import os

import psycopg2

EVENT_LABELS = {
    'register': 'Регистрация',
    'login': 'Вход',
    'logout': 'Выход',
    'hall_enter': 'Турнирный зал',
}

ONLINE_WINDOW_MINUTES = 3


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }


def is_admin(event):
    return event.get('headers', {}).get('X-Admin-Password') == os.environ.get('ADMIN_PASSWORD')


def handler(event: dict, context) -> dict:
    """Логи активности пользователей для админки: вход/выход/регистрация/переходы
    в турнирный зал и статус "последний раз онлайн" (с учётом живого heartbeat)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    if event.get('httpMethod') != 'GET':
        return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}

    if not is_admin(event):
        return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Доступ запрещён'})}

    params = event.get('queryStringParameters') or {}
    user_id = params.get('user_id')
    search = (params.get('search') or '').strip().lower()
    limit = min(int(params.get('limit', 200)), 500)

    conn = get_conn()
    cur = conn.cursor()

    where = []
    args = []
    if user_id:
        where.append("l.user_id = %s")
        args.append(user_id)
    if search:
        where.append("lower(u.last_name || ' ' || u.first_name || ' ' || u.email) LIKE %s")
        args.append(f"%{search}%")
    where_sql = f"WHERE {' AND '.join(where)}" if where else ''

    cur.execute(
        f"""SELECT l.id, l.user_id, u.last_name, u.first_name, u.email, l.event_type, l.meta, l.created_at
           FROM user_activity_logs l
           JOIN users u ON u.id = l.user_id
           {where_sql}
           ORDER BY l.created_at DESC LIMIT %s""",
        (*args, limit)
    )
    logs = []
    for r in cur.fetchall():
        meta = r[6] or {}
        logs.append({
            'id': r[0], 'user_id': r[1], 'fio': f"{r[2]} {r[3]}", 'email': r[4],
            'event_type': r[5], 'event_label': EVENT_LABELS.get(r[5], r[5]),
            'meta': meta, 'created_at': str(r[7]),
        })

    cur.execute(
        """SELECT u.id, u.last_name, u.first_name, u.email, o.last_seen,
                  (now() - o.last_seen) < interval '%s minutes'
           FROM user_online_status o JOIN users u ON u.id = o.user_id
           ORDER BY o.last_seen DESC LIMIT 200""" % ONLINE_WINDOW_MINUTES
    )
    online_status = [
        {'user_id': r[0], 'fio': f"{r[1]} {r[2]}", 'email': r[3], 'last_seen': str(r[4]), 'is_online': r[5]}
        for r in cur.fetchall()
    ]

    conn.close()
    return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'logs': logs, 'online_status': online_status})}
