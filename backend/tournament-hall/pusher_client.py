import os

import pusher


def get_pusher():
    return pusher.Pusher(
        app_id=os.environ['PUSHER_APP_ID'],
        key=os.environ['PUSHER_KEY'],
        secret=os.environ['PUSHER_SECRET'],
        cluster=os.environ.get('PUSHER_CLUSTER', 'eu'),
        ssl=True,
    )


def trigger(channel: str, event: str, data: dict = None):
    """Отправляет real-time событие. Ошибки Pusher не должны ломать основной запрос —
    в худшем случае клиент обновит данные по резервному опросу."""
    try:
        get_pusher().trigger(channel, event, data or {})
    except Exception:
        pass
