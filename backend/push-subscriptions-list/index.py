import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }

def handler(event: dict, context) -> dict:
    """Список подписчиков на push-уведомления о новых турнирах (для админки)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')

    if not is_admin:
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        cur.execute("SELECT id, endpoint, created_at FROM public_push_subscriptions ORDER BY created_at DESC")
        rows = cur.fetchall()
        conn.close()
        subs = [{'id': r[0], 'endpoint': r[1], 'created_at': str(r[2])} for r in rows]
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'subscriptions': subs, 'count': len(subs)})}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        if body.get('_action') == 'delete':
            sub_id = body.get('id')
            cur.execute("DELETE FROM public_push_subscriptions WHERE id = %s", (sub_id,))
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}
        conn.close()
        return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Unknown action'})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
