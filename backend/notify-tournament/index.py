import json
import os
import psycopg2
from pywebpush import webpush, WebPushException

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }

def handler(event: dict, context) -> dict:
    """Ручная рассылка push-уведомления всем подписанным посетителям сайта о турнире (кнопка в админке)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')

    if not is_admin:
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}

    if method != 'POST':
        return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body') or '{}')
    tournament_id = body.get('tournament_id')
    tournament_title = (body.get('tournament_title') or '').strip()
    message = (body.get('message') or '').strip()

    if not tournament_title:
        return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не указано название турнира'})}

    public_key = os.environ.get('VAPID_PUBLIC_KEY', '')
    private_key = os.environ.get('VAPID_PRIVATE_KEY', '')
    if not public_key or not private_key:
        return {'statusCode': 500, 'headers': cors_headers(), 'body': json.dumps({'error': 'VAPID-ключи не настроены'})}

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, endpoint, p256dh, auth FROM public_push_subscriptions")
    subs = cur.fetchall()

    payload = json.dumps({
        'title': f'Турнир «{tournament_title}»',
        'body': message or 'Открыта регистрация — успейте подать заявку!',
        'url': '/tournaments' + (f'?tournament_id={tournament_id}' if tournament_id else ''),
    })

    sent = 0
    dead_ids = []
    for sub_id, endpoint, p256dh, auth in subs:
        try:
            webpush(
                subscription_info={
                    'endpoint': endpoint,
                    'keys': {'p256dh': p256dh, 'auth': auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={'sub': 'mailto:admin@example.com'},
            )
            sent += 1
        except WebPushException as e:
            status = getattr(e.response, 'status_code', None)
            if status in (404, 410):
                dead_ids.append(sub_id)
        except Exception:
            pass

    if dead_ids:
        cur.execute("DELETE FROM public_push_subscriptions WHERE id = ANY(%s)", (dead_ids,))
        conn.commit()

    conn.close()
    return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'sent': sent, 'total': len(subs)})}
