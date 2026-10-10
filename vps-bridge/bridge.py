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
  pip install flask requests gunicorn pymongo
  export LILA_SYNC_URL=https://functions.poehali.dev/XXXXX   # URL функции lila-sync
  export LILA_BRIDGE_SECRET=...                               # тот же секрет, что в LILA_BRIDGE_SECRET на платформе
  export LILA_INTERNAL_URL=http://127.0.0.1:8080               # адрес, по которому Lila слушает НА ЭТОМ сервере
  export LILA_PUBLIC_HOST=play.xn----8sba3atdzuy2a.xn--p1ai     # публичный домен Lila (punycode), нужен для заголовка Host
  export LILA_MONGO_URI=mongodb://127.0.0.1:27017            # MongoDB Lila на этом сервере
  export LILA_MONGO_DB=lichess                                 # имя базы Lila
  gunicorn -w 2 -b 127.0.0.1:9321 bridge:app

Nginx (см. nginx-bridge.conf.example) должен проксировать play.мир-шахмат.рф
на 127.0.0.1:9321 для путей /bridge/*, и на Lila (127.0.0.1:8080) для всего
остального — так браузер видит play.мир-шахмат.рф как один сайт, где и
живёт сама игра, и мост для входа.
"""
import os
import re
import hmac
import requests
from flask import Flask, request, Response, jsonify
from pymongo import MongoClient

app = Flask(__name__)

LILA_SYNC_URL = os.environ['LILA_SYNC_URL']
LILA_BRIDGE_SECRET = os.environ['LILA_BRIDGE_SECRET']
LILA_INTERNAL_URL = os.environ.get('LILA_INTERNAL_URL', 'http://127.0.0.1:8080')
# Lila (Play Framework) маршрутизирует запрос по заголовку Host — при обращении
# напрямую на внутренний порт (127.0.0.1:8080) без публичного домена в Host
# сервер не находит подходящий сайт/маршрут и отвечает 404 даже для реально
# существующих путей типа /login. Поэтому явно подставляем публичный домен.
LILA_PUBLIC_HOST = os.environ.get('LILA_PUBLIC_HOST', 'play.xn----8sba3atdzuy2a.xn--p1ai')

LILA_MONGO_URI = os.environ.get('LILA_MONGO_URI', 'mongodb://127.0.0.1:27017')
LILA_MONGO_DB = os.environ.get('LILA_MONGO_DB', 'lichess')
_mongo = None


def get_users_collection():
    global _mongo
    if _mongo is None:
        _mongo = MongoClient(LILA_MONGO_URI, serverSelectionTimeoutMS=4000)
    return _mongo[LILA_MONGO_DB]['user4']


BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'


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
    и возвращает (cookie_value, debug_info). cookie_value is None при неудаче —
    debug_info тогда содержит статусы/заголовки для диагностики."""
    # User-Agent ОБЯЗАТЕЛЕН: без него (просто "python-requests/x.x" по умолчанию)
    # запрос к Lila получает 404 — судя по всему, отсекается как бот ещё до самого
    # приложения (Cloudflare/edge-защита перед Caddy). С обычным браузерным UA
    # запрос доходит и обрабатывается нормально.
    base_headers = {'Host': LILA_PUBLIC_HOST, 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'}

    r0 = requests.get(f'{LILA_INTERNAL_URL}/login', headers=base_headers, timeout=8)
    pre_cookie = extract_lila2(r0.headers.get('Set-Cookie'))

    headers = dict(base_headers)
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
    debug_info = {
        'get_status': r0.status_code,
        'get_set_cookie': r0.headers.get('Set-Cookie'),
        'post_status': resp.status_code,
        'post_set_cookie': resp.headers.get('Set-Cookie'),
        'post_location': resp.headers.get('Location'),
        'post_body_head': resp.text[:300] if not cookie_value else None,
    }
    return cookie_value, debug_info


def join_lila_tournament(cookie_value: str, tournament: dict):
    """Записывает игрока в турнир Lila от его имени (форма «Участвовать»).
    Возвращает путь турнира на Lila, куда нужно перенаправить браузер."""
    kind = 'tournament' if tournament.get('kind') == 'arena' else 'swiss'
    t_id = re.sub(r'[^A-Za-z0-9]', '', str(tournament.get('id', '')))[:8]
    if not t_id:
        return None
    path = f'/{kind}/{t_id}'
    data = {}
    if tournament.get('password'):
        data['password'] = tournament['password']
    base = {
        'Host': LILA_PUBLIC_HOST,
        'Origin': f'https://{LILA_PUBLIC_HOST}',
        'Referer': f'https://{LILA_PUBLIC_HOST}{path}',
        'Cookie': f'lila2={cookie_value}',
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    }
    try:
        me = requests.get(f'{LILA_INTERNAL_URL}/api/account', headers=base, allow_redirects=False, timeout=8)
        app.logger.warning('lila join: /api/account -> HTTP %s, body=%s', me.status_code, me.text[:200])
        join_resp = requests.post(
            f'{LILA_INTERNAL_URL}{path}/join',
            data=data,
            headers=base,
            allow_redirects=False,
            timeout=8,
        )
        app.logger.warning('lila join %s -> HTTP %s, has_password=%s, location=%s, body=%s', path, join_resp.status_code, bool(data.get('password')), join_resp.headers.get('Location'), join_resp.text[:300])
    except requests.RequestException as e:
        app.logger.warning('lila join %s failed: %s', path, e)
    return path


@app.route('/bridge/login')
def bridge_login():
    """Два режима вызова:
    - Прямой переход пользователя по клику на кнопку "Играть" (top-level navigation,
      не iframe) — сюда добавлен параметр redirect=1, после логина браузер СРАЗУ
      уводится редиректом на саму Lila (параметр next, по умолчанию '/'). Именно
      этот путь надёжен во всех браузерах: cookie ставится в обычном первом
      (не третьем) контексте навигации, так её не режут блокировщики трекеров.
    - Старый режим для невидимого фонового iframe (без redirect) оставлен для
      браузеров без строгой защиты от трекеров — возвращает postMessage-скрипт."""
    bridge_token = request.args.get('token', '')
    if not bridge_token:
        return Response('Missing token', status=400)

    data, error = resolve_bridge_token(bridge_token)
    if error:
        return Response(f'Bridge error: {error}', status=400)

    lila_username = data['lila_username']
    lila_password = data['lila_password']

    cookie_value, debug_info = login_to_lila(lila_username, lila_password)
    if not cookie_value:
        import json as _json
        return Response(f'Lila login failed. Debug: {_json.dumps(debug_info)}', status=502)

    tournament_path = None
    if data.get('tournament'):
        tournament_path = join_lila_tournament(cookie_value, data['tournament'])

    if request.args.get('redirect'):
        next_path = tournament_path or request.args.get('next', '/')
        if not next_path.startswith('/'):
            next_path = '/'
        resp = Response(status=302)
        resp.headers['Location'] = next_path
    else:
        resp = Response(
            '<script>if(window.parent!==window){window.parent.postMessage("lila-bridge-ok","*")}</script>',
            mimetype='text/html',
        )
    root_host = LILA_PUBLIC_HOST.split('.', 1)[1] if '.' in LILA_PUBLIC_HOST else None
    stale_domains = [LILA_PUBLIC_HOST, f'.{LILA_PUBLIC_HOST}']
    if root_host:
        stale_domains += [root_host, f'.{root_host}']
    for stale in stale_domains:
        resp.delete_cookie('lila2', path='/', domain=stale, secure=True, httponly=True, samesite='Lax')
    resp.set_cookie(
        'lila2', cookie_value,
        max_age=315360000, secure=True, httponly=True, samesite='Lax', path='/',
    )
    return resp


@app.route('/bridge/logout')
def bridge_logout():
    """Выход из Lila при выходе с мир-шахмат.рф: закрывает сессию на стороне Lila
    (если получится) и удаляет cookie lila2 у браузера. Вызывается невидимым iframe."""
    cookie_value = request.cookies.get('lila2')
    if cookie_value:
        try:
            requests.post(
                f'{LILA_INTERNAL_URL}/logout',
                headers={
                    'Host': LILA_PUBLIC_HOST,
                    'Origin': f'https://{LILA_PUBLIC_HOST}',
                    'Cookie': f'lila2={cookie_value}',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                },
                allow_redirects=False,
                timeout=5,
            )
        except requests.RequestException:
            pass

    resp = Response(
        '<script>if(window.parent!==window){window.parent.postMessage("lila-bridge-logout","*")}</script>',
        mimetype='text/html',
    )
    resp.headers['Cache-Control'] = 'no-store'
    root_host = LILA_PUBLIC_HOST.split('.', 1)[1] if '.' in LILA_PUBLIC_HOST else None
    domains = [None, LILA_PUBLIC_HOST, f'.{LILA_PUBLIC_HOST}']
    if root_host:
        domains += [root_host, f'.{root_host}']
    for d in domains:
        resp.delete_cookie('lila2', path='/', domain=d, secure=True, httponly=True, samesite='Lax')
    return resp


@app.route('/bridge/set-rating', methods=['POST'])
def set_rating():
    """Записывает стартовые рейтинги блиц/рапид игрока в базу Lila. Вызывается нашим
    backend (lila-sync) один раз после создания аккаунта. Защищён общим секретом.
    Меняется только значение рейтинга (gl.r) — число партий и неопределённость не трогаются,
    поэтому рейтинг остаётся предварительным, пока игрок не сыграет партии."""
    secret = request.headers.get('X-Bridge-Secret', '')
    if not hmac.compare_digest(secret, LILA_BRIDGE_SECRET):
        return jsonify({'error': 'forbidden'}), 403

    data = request.get_json(silent=True) or {}
    username = str(data.get('username') or '').strip().lower()
    try:
        blitz = int(data['blitz'])
        rapid = int(data['rapid'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'blitz and rapid required'}), 400
    if not username or not (100 <= blitz <= 4000) or not (100 <= rapid <= 4000):
        return jsonify({'error': 'bad values'}), 400

    result = get_users_collection().update_one(
        {'_id': username},
        {'$set': {'perfs.blitz.gl.r': float(blitz), 'perfs.rapid.gl.r': float(rapid)}},
    )
    if result.matched_count == 0:
        return jsonify({'error': 'user not found'}), 404
    return jsonify({'ok': True})


@app.route('/bridge/health')
def health():
    return {'ok': True}