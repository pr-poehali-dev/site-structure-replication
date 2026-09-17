import os
import threading

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
    """Отправляет real-time событие СИНХРОННО (дожидается ответа Pusher). Ошибки Pusher
    не должны ломать основной запрос — в худшем случае клиент обновит данные по
    резервному опросу."""
    try:
        get_pusher().trigger(channel, event, data or {})
    except Exception:
        pass


def trigger_async(channel: str, event: str, data: dict = None):
    """Отправляет real-time событие в фоновом потоке, не дожидаясь ответа Pusher —
    используется на "горячем пути" хода, чтобы соперник получал уведомление как можно
    быстрее, а сходивший игрок не ждал сетевой round-trip до Pusher перед своим ответом.
    Поток демон-, но т.к. HTTP-ответ функции формируется и уходит клиенту уже ПОСЛЕ
    вызова этой функции (стандартный поток исполнения ниже по коду), на практике поток
    успевает отправить запрос в Pusher до завершения работы функции."""
    def _run():
        try:
            get_pusher().trigger(channel, event, data or {})
        except Exception:
            pass
    threading.Thread(target=_run, daemon=True).start()