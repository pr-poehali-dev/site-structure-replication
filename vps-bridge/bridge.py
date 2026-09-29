"""
Мост тихой авторизации между мир-шахмат.рф и Lila (world-chess.ru).

Разворачивается на VPS рядом с Lila, на поддомене play.мир-шахмат.рф
(через Nginx reverse proxy, см. nginx-bridge.conf.example рядом).

Поток:
  1. Пользователь входит на мир-шахмат.рф — наш backend (lila-sync) выдаёт
     одноразовый короткоживущий bridge_token.
  2. Фронтенд мир-шахмат.рф открывает невидимый iframe:
     https://play.мир-шахмат.рф/bridge/login?token=<bridge_token>
  3. Этот сервис обменивает bridge_token на логин/пароль зеркального
     Lila-аккаунта (server-to-server запрос к lila-sync с общим секретом),
     логинится в Lila от имени пользователя и выставляет браузеру НАСТОЯЩУЮ
     cookie сессии Lila — уже на домене play.мир-шахмат.рф.
  4. Дальше игры/турниры открываются в iframe на play.мир-шахмат.рф уже
     авторизованными, без дополнительного логина.

Установка:
  pip install flask requests gunicorn
  export LILA_SYNC_URL=https://functions.poehali.dev/XXXXX   # URL функции lila-sync
  export LILA_BRIDGE_SECRET=...                               # тот же секрет, что в LILA_BRIDGE_SECRET на платформе
  export LILA_INTERNAL_URL=http://127.0.0.1:8080               # адрес, по которому Lila слушает НА ЭТОМ сервере
  gunicorn -w 2 -b 127.0.0.1:9321 bridge:app

Nginx (см. nginx-bridge.conf.example) должен проксировать play.мир-шахмат.рф
на 127.0.0.1:9321 для путей /bridge/*, и на Lila (127.0.0.1:8080) для всего
остального — так браузер видит play.мир-шахмат.рф как один сайт, где и
живёт сама игра, и мост для входа.
"""
import os
import re
import requests
from flask import Flask, request, Response

app = Flask(__name__)

LILA_SYNC_URL = os.environ['LILA_SYNC_URL']
LILA_BRIDGE_SECRET = os.environ['LILA_BRIDGE_SECRET']
LILA_INTERNAL_URL = os.environ.get('LILA_INTERNAL_URL', 'http://127.0.0.1:8080')


def resolve_bridge_token(bridge_token: str):
    resp = requests.post(
        LILA_SYNC_URL,
        json={'_action': 'resolve_bridge_token', 'bridge_token': bridge_token},
        headers={'X-Bridge-Secret': LILA_BRIDGE_SECRET},
        timeout=8,
    )
    if resp.status_code != 200:
        return None, resp.json().get('error', f'HTTP {resp.status_code}')
    data = resp.json()
    return data, None


def extract_lila2(set_cookie_header):
    """Достаёт значение cookie lila2 напрямую из сырого заголовка Set-Cookie.
    ВАЖНО: не используем requests.Session()/cookie jar — Lila выставляет Domain=
    play.мир-шахмат.рф (или world-chess.ru) в атрибуте cookie, а мы обращаемся к
    LILA_INTERNAL_URL (обычно 127.0.0.1:8080) — requests сверяет домен ответа с
    доменом в атрибуте cookie и, если они не совпадают, молча ОТБРАСЫВАЕТ такую
    cookie из jar. Поэтому читаем Set-Cookie сами, без домен-фильтрации."""
    if not set_cookie_header:
        return None
    m = re.search(r'lila2=([^;]+)', set_cookie_header)
    return m.group(1) if m else None


def login_to_lila(username: str, password: str):
    """Логинится в Lila изнутри сервера (server-to-server, минуя браузер пользователя)
    и возвращает значение cookie lila2, которую нужно выставить браузеру."""
    s = requests.Session()
    r0 = s.get(f'{LILA_INTERNAL_URL}/login', timeout=8)  # первичная сессионная cookie
    pre_cookie = extract_lila2(r0.headers.get('Set-Cookie'))

    headers = {}
    if pre_cookie:
        headers['Cookie'] = f'lila2={pre_cookie}'

    resp = requests.post(
        f'{LILA_INTERNAL_URL}/login',
        data={'username': username, 'password': password, 'remember': 'true'},
        headers=headers,
        allow_redirects=False,
        timeout=8,
    )
    cookie_value = extract_lila2(resp.headers.get('Set-Cookie'))
    if not cookie_value:
        return None
    return cookie_value


@app.route('/bridge/login')
def bridge_login():
    bridge_token = request.args.get('token', '')
    if not bridge_token:
        return Response('Missing token', status=400)

    data, error = resolve_bridge_token(bridge_token)
    if error:
        return Response(f'Bridge error: {error}', status=400)

    lila_username = data['lila_username']
    lila_password = data['lila_password']

    cookie_value = login_to_lila(lila_username, lila_password)
    if not cookie_value:
        return Response('Lila login failed', status=502)

    resp = Response(
        '<script>if(window.parent!==window){window.parent.postMessage("lila-bridge-ok","*")}</script>',
        mimetype='text/html',
    )
    # Cookie выставляется на ТЕКУЩИЙ домен (play.мир-шахмат.рф), на который реально
    # пришёл запрос — Flask сам берёт домен из заголовка Host, поэтому domain=None.
    resp.set_cookie(
        'lila2', cookie_value,
        max_age=315360000, secure=True, httponly=True, samesite='Lax', path='/',
    )
    return resp


@app.route('/bridge/health')
def health():
    return {'ok': True}