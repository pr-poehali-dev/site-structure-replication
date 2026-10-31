import json
import os
import re
import urllib.parse
import urllib.request
import psycopg2

SENDER_NAME = 'Мир шахмат'
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
    }


def resp(code, data):
    return {'statusCode': code, 'headers': cors(), 'body': json.dumps(data, ensure_ascii=False)}


def esc(v):
    return "'" + str(v).replace("'", "''") + "'"


def unisender(method, params):
    params = {**params, 'format': 'json', 'api_key': os.environ['UNISENDER_API_KEY']}
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(f'https://api.unisender.com/ru/api/{method}', data=data)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def get_list_id():
    res = unisender('getLists', {})
    for item in res.get('result') or []:
        if item.get('title') == 'Мир шахмат — рассылка':
            return item['id']
    res = unisender('createList', {'title': 'Мир шахмат — рассылка'})
    return res['result']['id']


def send_batch(emails, subject, body, sender_email):
    list_id = get_list_id()
    res = unisender('sendEmail', {
        'email': ','.join(emails),
        'sender_name': SENDER_NAME,
        'sender_email': sender_email,
        'subject': subject,
        'body': body,
        'list_id': list_id,
    })
    return res


def handler(event: dict, context) -> dict:
    """Рассылки: шаблоны писем, контакты и отправка через Unisender (только для админа)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    if not os.environ.get('ADMIN_PASSWORD') or headers.get('x-admin-password') != os.environ['ADMIN_PASSWORD']:
        return resp(401, {'error': 'Неверный пароль'})

    method = event.get('httpMethod')
    conn = get_conn()
    cur = conn.cursor()
    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        what = params.get('what', 'templates')
        if what == 'template':
            cur.execute(f"SELECT id, name, subject, html_body FROM mailing_templates WHERE id = {int(params.get('id', 0))}")
            r = cur.fetchone()
            conn.close()
            if not r:
                return resp(404, {'error': 'Шаблон не найден'})
            return resp(200, {'id': r[0], 'name': r[1], 'subject': r[2], 'html_body': r[3]})
        if what == 'contacts':
            cur.execute("SELECT id, email, name, organization, role FROM mailing_contacts ORDER BY id DESC")
            rows = cur.fetchall()
            conn.close()
            return resp(200, {'contacts': [{'id': r[0], 'email': r[1], 'name': r[2], 'organization': r[3], 'role': r[4]} for r in rows]})
        if what == 'campaigns':
            cur.execute("SELECT id, subject, sent_count, failed_count, created_at FROM mailing_campaigns ORDER BY id DESC LIMIT 20")
            rows = cur.fetchall()
            conn.close()
            return resp(200, {'campaigns': [{'id': r[0], 'subject': r[1], 'sent': r[2], 'failed': r[3], 'created_at': str(r[4])} for r in rows]})
        cur.execute("SELECT id, name, subject FROM mailing_templates ORDER BY id DESC")
        rows = cur.fetchall()
        conn.close()
        return resp(200, {'templates': [{'id': r[0], 'name': r[1], 'subject': r[2]} for r in rows]})

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action')

    if action == 'add_contacts':
        added = 0
        for line in (body.get('text') or '').splitlines():
            parts = [p.strip() for p in re.split(r'[;\t,]', line) if p.strip()]
            email = next((p for p in parts if EMAIL_RE.match(p)), None)
            if not email:
                continue
            others = [p for p in parts if p != email]
            name = others[0] if others else ''
            org = others[1] if len(others) > 1 else ''
            cur.execute(
                f"INSERT INTO mailing_contacts (email, name, organization) VALUES ({esc(email.lower())}, {esc(name)}, {esc(org)}) ON CONFLICT (email) DO NOTHING"
            )
            added += cur.rowcount
        conn.commit()
        conn.close()
        return resp(200, {'ok': True, 'added': added})

    if action == 'delete_contact':
        cur.execute(f"DELETE FROM mailing_contacts WHERE id = {int(body.get('id', 0))}")
        conn.commit()
        conn.close()
        return resp(200, {'ok': True})

    if action in ('send_test', 'send'):
        cur.execute(f"SELECT subject, html_body FROM mailing_templates WHERE id = {int(body.get('template_id', 0))}")
        t = cur.fetchone()
        if not t:
            conn.close()
            return resp(404, {'error': 'Шаблон не найден'})
        subject, html = t
        sender_email = os.environ.get('MAILING_SENDER_EMAIL', 'mir.shahmat@inbox.ru')

        if action == 'send_test':
            email = (body.get('email') or '').strip()
            if not EMAIL_RE.match(email):
                conn.close()
                return resp(400, {'error': 'Укажите корректный email'})
            emails = [email]
        else:
            cur.execute("SELECT email FROM mailing_contacts ORDER BY id")
            emails = [r[0] for r in cur.fetchall()]
            if not emails:
                conn.close()
                return resp(400, {'error': 'Список контактов пуст'})

        sent = failed = 0
        errors = []
        for i in range(0, len(emails), 100):
            chunk = emails[i:i + 100]
            res = send_batch(chunk, subject, html, sender_email)
            if res.get('error'):
                failed += len(chunk)
                errors.append(f"{res.get('error')} ({res.get('code', '')})")
                print(f"Unisender sendEmail error: {json.dumps(res, ensure_ascii=False)}")
            else:
                sent += len(chunk)

        if action == 'send':
            cur.execute(f"INSERT INTO mailing_campaigns (subject, body, sent_count, failed_count) VALUES ({esc(subject)}, {esc('template ' + str(body.get('template_id')))}, {sent}, {failed})")
            conn.commit()
        conn.close()
        if failed and not sent:
            return resp(502, {'error': f'Unisender не принял письма: {errors[0] if errors else "ошибка"}'})
        return resp(200, {'ok': True, 'sent': sent, 'failed': failed})

    conn.close()
    return resp(400, {'error': 'Неизвестное действие'})
