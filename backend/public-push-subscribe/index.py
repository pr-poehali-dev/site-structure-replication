import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

def handler(event: dict, context) -> dict:
    """Публичная подписка/отписка посетителей сайта на push-уведомления о новых турнирах"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')

    if method == 'GET':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'publicKey': os.environ.get('VAPID_PUBLIC_KEY', '')})}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('_action', 'subscribe')
        subscription = body.get('subscription') or {}
        endpoint = subscription.get('endpoint')
        keys = subscription.get('keys') or {}

        conn = get_conn()
        cur = conn.cursor()

        if action == 'unsubscribe':
            if endpoint:
                cur.execute("DELETE FROM public_push_subscriptions WHERE endpoint = %s", (endpoint,))
                conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

        if not endpoint or not keys.get('p256dh') or not keys.get('auth'):
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректная подписка'})}

        cur.execute(
            """INSERT INTO public_push_subscriptions (endpoint, p256dh, auth) VALUES (%s, %s, %s)
               ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth""",
            (endpoint, keys.get('p256dh'), keys.get('auth'))
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
