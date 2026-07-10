import json
import os
import psycopg2
from pywebpush import webpush, WebPushException


def notify_admins_new_application(conn, tournament_title: str, fio: str):
    """Отправляет push-уведомление всем подписанным администраторам о новой заявке"""
    public_key = os.environ.get('VAPID_PUBLIC_KEY', '')
    private_key = os.environ.get('VAPID_PRIVATE_KEY', '')
    if not public_key or not private_key:
        return

    cur = conn.cursor()
    cur.execute("SELECT id, endpoint, p256dh, auth FROM push_subscriptions")
    subs = cur.fetchall()

    payload = json.dumps({
        'title': 'Новая заявка на турнир',
        'body': f'{fio} — «{tournament_title}»',
        'url': '/admin',
    })

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
        except WebPushException as e:
            status = getattr(e.response, 'status_code', None)
            if status in (404, 410):
                dead_ids.append(sub_id)
        except Exception:
            pass

    if dead_ids:
        cur.execute("DELETE FROM push_subscriptions WHERE id = ANY(%s)", (dead_ids,))
        conn.commit()
