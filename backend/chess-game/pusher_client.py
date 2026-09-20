import os

import pusher

_pusher = None


def get_pusher():
    # Переиспользуем клиент (и его requests.Session, держащую HTTP keep-alive соединение)
    # между вызовами на одном "тёплом" контейнере — создание нового Pusher-клиента на
    # каждый trigger() означало новое TLS-соединение каждый раз, что при нескольких
    # событиях подряд (например завершение партии, тура и турнира одним запросом)
    # заметно накапливалось в задержку ответа игроку.
    global _pusher
    if _pusher is None:
        _pusher = pusher.Pusher(
            app_id=os.environ['PUSHER_APP_ID'],
            key=os.environ['PUSHER_KEY'],
            secret=os.environ['PUSHER_SECRET'],
            cluster=os.environ.get('PUSHER_CLUSTER', 'eu'),
            ssl=True,
            timeout=3,
        )
    return _pusher


def trigger(channel: str, event: str, data: dict = None):
    """Отправляет одно real-time событие СИНХРОННО (дожидается ответа Pusher) — обязательно
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


def trigger_many(events: list):
    """Отправляет несколько событий ОДНИМ HTTP-запросом (batch API) вместо серии отдельных
    trigger() один за другим. Раньше при завершении партии, которая по цепочке закрывала
    тур/весь турнир, уходило 2-3 последовательных синхронных HTTP-запроса к Pusher —
    у каждого свой таймаут и сетевой round-trip, что суммарно давало заметную (5-10 сек)
    задержку в ответе игроку. events — список кортежей (channel, event, data)."""
    if not events:
        return
    try:
        get_pusher().trigger_batch([
            {'channel': channel, 'name': event, 'data': data or {}}
            for channel, event, data in events
        ])
    except Exception:
        pass