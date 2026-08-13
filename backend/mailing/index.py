import json
import os
import urllib.request
import urllib.parse
import psycopg2

SCHEMA = 't_p58220589_site_structure_repli'
SENDER_EMAIL = 'mir.shahmat@inbox.ru'
SENDER_NAME = 'ЦПДШС "Мир шахмат"'


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def check_auth(event: dict) -> bool:
    headers_in = event.get('headers', {}) or {}
    admin_password = headers_in.get('X-Admin-Password') or headers_in.get('x-admin-password', '')
    return admin_password == os.environ.get('ADMIN_PASSWORD', '')


def cors_response(status: int, data: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps(data, ensure_ascii=False)
    }


def unisender_call(method: str, params: dict) -> dict:
    api_key = os.environ['UNISENDER_API_KEY']
    all_params = {'format': 'json', 'api_key': api_key, **params}
    data = urllib.parse.urlencode(all_params).encode('utf-8')
    req = urllib.request.Request(f'https://api.unisender.com/ru/api/{method}', data=data, method='POST')
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))


def get_or_create_list_id() -> str:
    list_title = 'Тренеры и руководители'
    result = unisender_call('getLists', {})
    lists = result.get('result', []) or []
    for lst in lists:
        if lst.get('title') == list_title:
            return str(lst.get('id'))
    created = unisender_call('createList', {'title': list_title})
    return str(created.get('result', {}).get('id'))


def unisender_send_email(list_id: str, to_email: str, to_name: str, subject: str, body_html: str):
    params = {
        'email': to_email,
        'sender_name': SENDER_NAME,
        'sender_email': SENDER_EMAIL,
        'subject': subject,
        'body': body_html,
        'list_id': list_id,
    }
    return unisender_call('sendEmail', params)


def handler(event: dict, context) -> dict:
    """Управление базой email-адресов тренеров/руководителей и рассылка писем через Unisender"""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
                'Access-Control-Max-Age': '86400',
            },
            'body': ''
        }

    if not check_auth(event):
        return cors_response(401, {'error': 'Unauthorized'})

    method = event.get('httpMethod')

    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, email, name, organization, role, created_at FROM {SCHEMA}.mailing_contacts ORDER BY created_at DESC")
        rows = cur.fetchall()
        contacts = [{
            'id': r[0], 'email': r[1], 'name': r[2], 'organization': r[3], 'role': r[4], 'created_at': str(r[5])
        } for r in rows]
        cur.execute(f"SELECT id, subject, sent_count, failed_count, created_at FROM {SCHEMA}.mailing_campaigns ORDER BY created_at DESC LIMIT 20")
        rows2 = cur.fetchall()
        campaigns = [{
            'id': r[0], 'subject': r[1], 'sent_count': r[2], 'failed_count': r[3], 'created_at': str(r[4])
        } for r in rows2]
        cur.execute(f"SELECT id, name, subject, html_body, created_at FROM {SCHEMA}.mailing_templates ORDER BY id")
        rows3 = cur.fetchall()
        templates = [{
            'id': r[0], 'name': r[1], 'subject': r[2], 'html_body': r[3], 'created_at': str(r[4])
        } for r in rows3]
        cur.close()
        conn.close()
        return cors_response(200, {'contacts': contacts, 'campaigns': campaigns, 'templates': templates})

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    if action == 'add_contact':
        email = (body.get('email') or '').strip().lower()
        name = (body.get('name') or '').strip()
        organization = (body.get('organization') or '').strip()
        role = (body.get('role') or '').strip()
        if not email:
            return cors_response(400, {'error': 'Укажите email'})
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(
                f"INSERT INTO {SCHEMA}.mailing_contacts (email, name, organization, role) VALUES (%s, %s, %s, %s) RETURNING id",
                (email, name or None, organization or None, role or None)
            )
            new_id = cur.fetchone()[0]
            conn.commit()
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            cur.close()
            conn.close()
            return cors_response(400, {'error': 'Такой email уже есть в базе'})
        cur.close()
        conn.close()
        return cors_response(200, {'success': True, 'id': new_id})

    if action == 'delete_contact':
        contact_id = body.get('id')
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.mailing_contacts WHERE id = %s", (contact_id,))
        conn.commit()
        cur.close()
        conn.close()
        return cors_response(200, {'success': True})

    if action == 'import_contacts':
        raw = body.get('raw', '')
        emails = [e.strip().lower() for e in raw.replace(';', ',').replace('\n', ',').split(',') if e.strip()]
        conn = get_conn()
        cur = conn.cursor()
        added = 0
        for email in emails:
            if '@' not in email:
                continue
            cur.execute(
                f"INSERT INTO {SCHEMA}.mailing_contacts (email) VALUES (%s) ON CONFLICT (email) DO NOTHING",
                (email,)
            )
            added += cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return cors_response(200, {'success': True, 'added': added})

    if action == 'send_campaign':
        subject = body.get('subject', '').strip()
        html_body = body.get('body', '')
        if not subject or not html_body:
            return cors_response(400, {'error': 'Укажите тему и текст письма'})

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT email, name FROM {SCHEMA}.mailing_contacts")
        contacts = cur.fetchall()

        if not contacts:
            cur.close()
            conn.close()
            return cors_response(400, {'error': 'В базе нет ни одного адреса'})

        try:
            list_id = get_or_create_list_id()
        except Exception:
            cur.close()
            conn.close()
            return cors_response(502, {'error': 'Не удалось подключиться к Unisender. Проверьте API-ключ.'})

        sent_count = 0
        failed_count = 0
        errors = []
        for email, name in contacts:
            try:
                result = unisender_send_email(list_id, email, name or '', subject, html_body)
                if result.get('result'):
                    sent_count += 1
                else:
                    failed_count += 1
                    errors.append(f"{email}: {result.get('error') or result}")
            except Exception as e:
                failed_count += 1
                errors.append(f"{email}: {e}")

        if errors:
            print('MAILING ERRORS:', errors)

        cur.execute(
            f"INSERT INTO {SCHEMA}.mailing_campaigns (subject, body, sent_count, failed_count) VALUES (%s, %s, %s, %s) RETURNING id",
            (subject, html_body, sent_count, failed_count)
        )
        campaign_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return cors_response(200, {'success': True, 'campaign_id': campaign_id, 'sent_count': sent_count, 'failed_count': failed_count, 'errors': errors})

    return cors_response(405, {'error': 'Method not allowed'})