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
    """Отправляет real-time событие СИНХРОННО (дожидается ответа Pusher) — обязательно
    ДО return из handler'а. В serverless-окружении процесс может быть заморожен сразу
    после возврата HTTP-ответа, поэтому фоновый поток здесь не годится: он не гарантированно
    успевает отправить запрос к Pusher до заморозки, и событие могло уйти только при
    следующем "тёплом" вызове функции — соперник получал уведомление о ходе с задержкой.
    Ошибки Pusher не должны ломать основной запрос — в худшем случае клиент обновит
    данные по резервному опросу."""
    try:
        get_pusher().trigger(channel, event, data or {})
    except Exception:
        pass