import hashlib
import json
import os
import re
import secrets
import string
# redeploy-trigger: forcing fresh instance to pick up updated LILA_ENC_KEY secret
import urllib.request
import urllib.parse
import urllib.error

import psycopg2
from cryptography.fernet import Fernet

LILA_BASE_URL = os.environ.get('LILA_BASE_URL', 'https://world-chess.ru')
BRIDGE_TOKEN_TTL_SECONDS = 30


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


NO_REDIRECT_OPENER = urllib.request.build_opener(_NoRedirect)


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Bridge-Secret',
    }


def get_fernet():
    # .strip() защищает от случайных пробелов/переносов строк при вставке значения
    # секрета через UI — Fernet требует ровно 32 байта в base64 без хвостовых символов.
    return Fernet(os.environ['LILA_ENC_KEY'].strip().encode())


def encrypt_password(plain: str) -> str:
    return get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(token: str) -> str:
    return get_fernet().decrypt(token.encode()).decode()


def get_user_by_token(cur, token: str):
    if not token:
        return None
    cur.execute(
        """SELECT u.id, u.email, u.lila_username, u.lila_password_enc, u.lila_sync_status, u.login, u.password_hash, u.password_salt
           FROM user_sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = %s AND s.expires_at > now()""",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'email': row[1], 'lila_username': row[2], 'lila_password_enc': row[3], 'lila_sync_status': row[4], 'login': row[5], 'password_hash': row[6], 'password_salt': row[7]}


def make_lila_username(user_id: int) -> str:
    """Lila требует username 2-20 символов, буквы/цифры. Генерируем детерминированно
    из id пользователя нашего сайта плюс случайный суффикс — чтобы не раскрывать id
    напрямую и избежать коллизий, если username уже занят на Lila по другой причине."""
    suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(5))
    return f"wc{user_id}{suffix}"[:20]


def make_service_email(user_id: int) -> str:
    """Служебный уникальный email для зеркального аккаунта Lila. Реальный email игрока
    не передаём: он может быть уже занят на Lila. Письма Lila на этот адрес никому
    не приходят. Требует, чтобы на сервере Lila была отключена проверка MX-записи."""
    domain = os.environ.get('LILA_SERVICE_EMAIL_DOMAIN', 'xn----8sba3atdzuy2a.xn--p1ai').strip()
    suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"wc{user_id}x{suffix}@{domain}"


def make_lila_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(24))


def lila_request(path, data=None, cookie=None, method=None):
    """Простой HTTP-клиент на urllib (без внешних зависимостей вроде requests, которых
    нет в окружении) — POST с form-encoded телом, как отправляет обычная HTML-форма Lila.
    Возвращает (status_code, response_cookie_header, body_text)."""
    url = f"{LILA_BASE_URL}{path}"
    body_bytes = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body_bytes, method=method or ('POST' if data is not None else 'GET'))
    req.add_header('User-Agent', 'Mozilla/5.0 (lila-sync-bridge)')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    req.add_header('Accept-Language', 'ru-RU,ru;q=0.9')
    if cookie:
        req.add_header('Cookie', cookie)
    try:
        with NO_REDIRECT_OPENER.open(req, timeout=8) as resp:
            set_cookie = resp.headers.get('Set-Cookie')
            return resp.status, set_cookie, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        set_cookie = e.headers.get('Set-Cookie') if e.headers else None
        return e.code, set_cookie, e.read().decode('utf-8', errors='replace')


def parse_session_cookie(set_cookie_header: str):
    if not set_cookie_header:
        return None
    m = re.search(r'lila2=([^;]+)', set_cookie_header)
    return m.group(0) if m else None


def seed_lila_rating(cur, conn, user_id: int, username: str):
    """Один раз после создания аккаунта передаёт мосту на сервере Lila стартовые рейтинги ФШР
    (блиц и рапид), чтобы мост записал их в базу Lila. Ошибки не прерывают регистрацию —
    при неудаче отметка не ставится и попытка повторится при следующем ensure_account."""
    try:
        cur.execute(
            "SELECT fsr_rating_blitz, fsr_rating_rapid, lila_rating_seeded_at FROM users WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        if not row or row[2] is not None:
            return
        blitz, rapid = row[0] or 1000, row[1] or 1000
        base = os.environ.get('LILA_BRIDGE_URL', 'https://play.xn----8sba3atdzuy2a.xn--p1ai').strip().rstrip('/')
        payload = json.dumps({'username': username, 'blitz': int(blitz), 'rapid': int(rapid)}).encode()
        req = urllib.request.Request(f"{base}/bridge/set-rating", data=payload, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('User-Agent', 'Mozilla/5.0 (lila-sync-bridge)')
        req.add_header('X-Bridge-Secret', os.environ.get('LILA_BRIDGE_SECRET', ''))
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status == 200:
                cur.execute("UPDATE users SET lila_rating_seeded_at = now() WHERE id = %s", (user_id,))
                conn.commit()
    except Exception as e:
        print(f'seed_lila_rating failed for user {user_id}: {e}')


def join_lila_club(cur, conn, user_id: int, username: str, password: str):
    """Вступает в клуб Lila (LILA_CLUB_ID) от имени игрока: логинится его учётными данными
    и отправляет форму вступления. Ошибки не прерывают регистрацию — отметка ставится только
    при успехе, поэтому попытка повторится при следующем ensure_account."""
    club_id = os.environ.get('LILA_CLUB_ID', '').strip()
    if not club_id:
        return
    try:
        cur.execute("SELECT lila_club_joined_at FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row or row[0] is not None:
            return
        ok, cookie = login_on_lila(username, password)
        if not ok:
            print(f'join_lila_club login failed for user {user_id}: {cookie}')
            return
        status, _, body = lila_request(f'/team/{club_id}/join', data={'message': 'Автоматическое вступление'}, cookie=cookie)
        if status in (200, 302, 303):
            cur.execute("UPDATE users SET lila_club_joined_at = now() WHERE id = %s", (user_id,))
            conn.commit()
        else:
            print(f'join_lila_club HTTP {status} for user {user_id}: {body[:200]}')
    except Exception as e:
        print(f'join_lila_club failed for user {user_id}: {e}')


def register_on_lila(username: str, password: str, email: str):
    """Регистрирует зеркальный аккаунт на world-chess.ru через обычную HTML-форму
    /signup — так же, как это делает браузер. ВАЖНО: на стороне Lila должна быть
    отключена капча Cloudflare Turnstile для этого пути, иначе форма будет отклонена
    (это настраивается в конфиге Lila, вне зоны нашего доступа)."""
    status, _, body = lila_request('/', method='GET')  # получаем базовую сессионную cookie
    # Первый запрос без cookie не даёт нам ничего полезного для CSRF — Lila привязывает
    # форму к сессии через сам cookie lila2, который сервер выдаёт на любой GET.
    status0, set_cookie0, _ = lila_request('/signup', method='GET')
    cookie = parse_session_cookie(set_cookie0)

    status, set_cookie, body = lila_request(
        '/signup',
        data={
            'username': username,
            'password': password,
            'email': email,
            'fp': '',
            'agreement.assistance': 'true',
            'agreement.nice': 'true',
            'agreement.account': 'true',
        },
        cookie=cookie,
    )
    if status not in (200, 302, 303):
        text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>|<style.*?</style>', '', body, flags=re.S)))
        if 'missing MX' in text:
            return False, f'Lila: email domain has no MX ({email})', None
        if 'Email address invalid or already taken' in text:
            return False, 'Lila: email invalid or already taken', None
        i = text.find('Password strength')
        return False, f'Lila signup HTTP {status}: {text[i:i + 350] if i >= 0 else text[:350]}', None
    # Статус 200 у Lila часто означает, что форма ОТКЛОНЕНА (ошибка валидации, капча,
    # подтверждение email) — поэтому проверяем реальным логином, что аккаунт создан.
    ok_login, login_result = login_on_lila(username, password)
    if not ok_login:
        snippet = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))[:200]
        return False, f'Lila signup not confirmed (signup HTTP {status}; {login_result}): {snippet}', None
    return True, None, login_result


def login_on_lila(username: str, password: str):
    status0, set_cookie0, _ = lila_request('/login', method='GET')
    cookie = parse_session_cookie(set_cookie0)
    status, set_cookie, body = lila_request(
        '/login',
        data={'username': username, 'password': password, 'remember': 'true'},
        cookie=cookie,
    )
    if status not in (200, 302, 303):
        return False, f'Lila login HTTP {status}'
    new_cookie = parse_session_cookie(set_cookie)
    if not new_cookie:
        return False, 'Lila login did not return session cookie'
    return True, new_cookie


def handler(event: dict, context) -> dict:
    """Синхронизация аккаунта пользователя с зеркальным аккаунтом на world-chess.ru (Lila):
    фоновое создание аккаунта, выдача одноразового bridge-токена при входе и обмен этого
    токена на логин/сессию Lila для моста на VPS (play.мир-шахмат.рф)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()

    # Вызывается фронтендом фоном сразу после регистрации/логина — если у пользователя
    # ещё нет зеркального аккаунта Lila, создаёт его. Идемпотентно: повторный вызов при
    # уже готовом аккаунте ничего не делает.
    if method == 'POST' and action == 'ensure_account':
        user = get_user_by_token(cur, auth_token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}

        if user['lila_sync_status'] == 'ok' and user['lila_username']:
            seed_lila_rating(cur, conn, user['id'], user['lila_username'])
            if user['lila_password_enc']:
                join_lila_club(cur, conn, user['id'], user['lila_username'], decrypt_password(user['lila_password_enc']))
            conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'status': 'ok'})}

        # Проверяем, что шифрование доступно, ДО обращения к Lila — иначе при сбое
        # шифрования аккаунт в Lila уже будет создан, но потерян для нашей системы
        # (email окажется навсегда занят, а мы не сможем повторить попытку).
        try:
            get_fernet()
        except Exception as e:
            conn.close()
            raw = os.environ.get('LILA_ENC_KEY', '')
            debug = f"len={len(raw)} head={raw[:8]!r} tail={raw[-8:]!r}"
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': False, 'status': 'error', 'error': f'Encryption key misconfigured: {e}', 'debug': debug})}

        username = user['login'] or make_lila_username(user['id'])
        site_password = body.get('password') or ''
        use_site_password = bool(site_password) and hashlib.pbkdf2_hmac(
            'sha256', site_password.encode('utf-8'), (user['password_salt'] or '').encode('utf-8'), 100000
        ).hex() == user['password_hash']

        password = site_password if use_site_password else make_lila_password()
        ok, error, _cookie = register_on_lila(username, password, make_service_email(user['id']))
        if not ok and use_site_password:
            password = make_lila_password()
            ok, error, _cookie = register_on_lila(username, password, make_service_email(user['id']))
        if not ok:
            ok, error, _cookie = register_on_lila(username, password, user['email'])

        if ok:
            cur.execute(
                """UPDATE users SET lila_username = %s, lila_password_enc = %s,
                   lila_sync_status = 'ok', lila_sync_error = NULL, lila_synced_at = now()
                   WHERE id = %s""",
                (username, encrypt_password(password), user['id'])
            )
            conn.commit()
            seed_lila_rating(cur, conn, user['id'], username)
            join_lila_club(cur, conn, user['id'], username, password)
            conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True, 'status': 'ok'})}
        else:
            cur.execute(
                "UPDATE users SET lila_sync_status = 'error', lila_sync_error = %s WHERE id = %s",
                (error, user['id'])
            )
            conn.commit()
            conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': False, 'status': 'error', 'error': error})}

    # Вызывается фронтендом при входе — выдаёт короткоживущий одноразовый токен,
    # который фронтенд передаёт мосту на VPS (play.мир-шахмат.рф) для тихой авторизации.
    if method == 'POST' and action == 'issue_bridge_token':
        user = get_user_by_token(cur, auth_token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}
        if not user['lila_username']:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Lila-аккаунт ещё не создан'})}

        bridge_token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO lila_bridge_tokens (user_id, token, expires_at) VALUES (%s, %s, now() + interval '30 seconds')",
            (user['id'], bridge_token)
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'bridge_token': bridge_token})}

    if method == 'POST' and action == 'issue_tournament_token':
        user = get_user_by_token(cur, auth_token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}
        if not user['lila_username']:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Игровой аккаунт ещё не создан'})}
        try:
            tournament_id = int(body.get('tournament_id'))
        except (TypeError, ValueError):
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не указан турнир'})}

        cur.execute(
            "SELECT lila_tournament_id FROM tournaments WHERE id = %s AND status = 'active'",
            (tournament_id,)
        )
        trow = cur.fetchone()
        if not trow or not trow[0]:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Для этого турнира ещё не открыт игровой зал'})}

        cur.execute(
            "SELECT 1 FROM applications WHERE user_id = %s AND tournament_id = %s AND status IN ('paid', 'confirmed') LIMIT 1",
            (user['id'], tournament_id)
        )
        if not cur.fetchone():
            conn.close()
            return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нет подтверждённой заявки на этот турнир'})}

        bridge_token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO lila_bridge_tokens (user_id, token, expires_at, tournament_id) VALUES (%s, %s, now() + interval '30 seconds', %s)",
            (user['id'], bridge_token, tournament_id)
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'bridge_token': bridge_token})}

    # Вызывается МОСТОМ на VPS (server-to-server, не браузером) — обменивает одноразовый
    # bridge_token на логин Lila-аккаунта, чтобы мост мог сам залогиниться в Lila и выдать
    # браузеру настоящую cookie сессии. Защищено общим секретом X-Bridge-Secret.
    if method == 'POST' and action == 'resolve_bridge_token':
        bridge_secret = headers.get('X-Bridge-Secret') or headers.get('x-bridge-secret', '')
        if not bridge_secret or bridge_secret != os.environ.get('LILA_BRIDGE_SECRET'):
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный bridge secret'})}

        # ВАЖНО: token НЕ требуем used_at IS NULL — намеренно разрешаем повторное
        # использование в пределах короткого TTL (30 сек). Причина: антивирусы
        # (особенно Kaspersky, массово стоит у пользователей в РФ) и часть браузеров
        # автоматически "прощупывают" ссылку на безопасность отдельным GET-запросом
        # ДО реального перехода пользователя — при строгой одноразовости это сжигало
        # токен раньше времени, и настоящий переход получал "уже использован". Риск
        # такого ослабления минимален: токен — 256-битный случайный секрет, живёт
        # всего 30 секунд и виден только этому браузеру и антивирус-сканеру на нём.
        bridge_token = body.get('bridge_token', '')
        cur.execute(
            """SELECT t.user_id, u.lila_username, u.lila_password_enc, t.tournament_id
               FROM lila_bridge_tokens t JOIN users u ON u.id = t.user_id
               WHERE t.token = %s AND t.expires_at > now()""",
            (bridge_token,)
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Токен недействителен или истёк'})}

        user_id, lila_username, lila_password_enc, token_tournament_id = row
        cur.execute("UPDATE lila_bridge_tokens SET used_at = now() WHERE token = %s AND used_at IS NULL", (bridge_token,))
        conn.commit()

        if not lila_username or not lila_password_enc:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Lila-аккаунт не создан для этого пользователя'})}

        result = {
            'lila_username': lila_username,
            'lila_password': decrypt_password(lila_password_enc),
        }
        if token_tournament_id:
            cur.execute(
                """SELECT t.lila_tournament_id, t.lila_tournament_kind, t.lila_tournament_password
                   FROM tournaments t
                   WHERE t.id = %s AND EXISTS (
                       SELECT 1 FROM applications a
                       WHERE a.tournament_id = t.id AND a.user_id = %s AND a.status IN ('paid', 'confirmed'))""",
                (token_tournament_id, user_id)
            )
            t = cur.fetchone()
            if t and t[0]:
                result['tournament'] = {'id': t[0], 'kind': t[1] or 'swiss', 'password': t[2] or ''}
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps(result)}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}