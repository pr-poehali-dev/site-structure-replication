import json
import os
import base64
import uuid
import psycopg2
import boto3

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }

def is_admin(event):
    return event.get('headers', {}).get('X-Admin-Password') == os.environ.get('ADMIN_PASSWORD')

def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def handler(event: dict, context) -> dict:
    """Управление результатами: олимпиады (ссылки) и турниры (таблица). Публичный GET, admin POST/PUT/DELETE. Поддерживает загрузку PDF-файлов."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    section = params.get('section', '')

    conn = get_conn()
    cur = conn.cursor()

    # GET — публичный
    if method == 'GET':
        cur.execute("SELECT id, title, url, sort_order FROM olympiad_results ORDER BY sort_order, id")
        olympiads = [{'id': r[0], 'title': r[1], 'url': r[2], 'sort_order': r[3]} for r in cur.fetchall()]

        cur.execute("SELECT id, number, date, title, fsr_rating, protocol_url, regulation_url FROM tournament_results ORDER BY date DESC NULLS LAST, id DESC")
        tournaments = []
        for r in cur.fetchall():
            tournaments.append({
                'id': r[0],
                'number': r[1],
                'date': r[2].isoformat() if r[2] else None,
                'title': r[3],
                'fsr_rating': r[4],
                'protocol_url': r[5],
                'regulation_url': r[6],
            })

        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'olympiads': olympiads, 'tournaments': tournaments}), 'isBase64Encoded': False}

    # Admin-only методы
    if not is_admin(event):
        cur.close()
        conn.close()
        return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Forbidden'}), 'isBase64Encoded': False}

    body = json.loads(event.get('body') or '{}')

    # Загрузка файла (протокол или положение)
    if method == 'POST' and section == 'upload':
        file_b64 = body.get('file_b64', '')
        content_type = body.get('content_type', 'application/pdf')
        original_name = body.get('file_name', 'file.pdf')
        ext = original_name.rsplit('.', 1)[-1].lower() if '.' in original_name else 'pdf'
        key = f"results/{uuid.uuid4().hex[:12]}.{ext}"
        data = base64.b64decode(file_b64)
        s3 = get_s3()
        s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)
        url = cdn_url(key)
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'url': url}), 'isBase64Encoded': False}

    if method == 'POST':
        if section == 'olympiad':
            cur.execute(
                "INSERT INTO olympiad_results (title, url, sort_order) VALUES (%s, %s, %s) RETURNING id",
                (body.get('title'), body.get('url'), body.get('sort_order', 0))
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'id': new_id}), 'isBase64Encoded': False}

        if section == 'tournament':
            cur.execute(
                "INSERT INTO tournament_results (number, date, title, fsr_rating, protocol_url, regulation_url) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (body.get('number'), body.get('date') or None, body.get('title'), body.get('fsr_rating'), body.get('protocol_url'), body.get('regulation_url'))
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'id': new_id}), 'isBase64Encoded': False}

    if method == 'PUT':
        row_id = body.get('id')
        if section == 'olympiad':
            cur.execute(
                "UPDATE olympiad_results SET title=%s, url=%s, sort_order=%s WHERE id=%s",
                (body.get('title'), body.get('url'), body.get('sort_order', 0), row_id)
            )
        if section == 'tournament':
            cur.execute(
                "UPDATE tournament_results SET number=%s, date=%s, title=%s, fsr_rating=%s, protocol_url=%s, regulation_url=%s WHERE id=%s",
                (body.get('number'), body.get('date') or None, body.get('title'), body.get('fsr_rating'), body.get('protocol_url'), body.get('regulation_url'), row_id)
            )
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}), 'isBase64Encoded': False}

    if method == 'DELETE':
        row_id = params.get('id')
        if section == 'olympiad':
            cur.execute("DELETE FROM olympiad_results WHERE id=%s", (row_id,))
        if section == 'tournament':
            cur.execute("DELETE FROM tournament_results WHERE id=%s", (row_id,))
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}), 'isBase64Encoded': False}

    cur.close(); conn.close()
    return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Bad request'}), 'isBase64Encoded': False}
