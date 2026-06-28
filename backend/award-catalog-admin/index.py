import json
import os
import base64
import uuid
import psycopg2
import boto3

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p58220589_site_structure_repli')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')


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
    """Управление каталогом наград: CRUD + загрузка фото (только для администратора)."""
    headers_out = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**headers_out, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    pwd = event.get('headers', {}).get('X-Admin-Password') or event.get('headers', {}).get('x-admin-password', '')
    if pwd != ADMIN_PASSWORD:
        return {'statusCode': 401, 'headers': headers_out, 'body': json.dumps({'error': 'Unauthorized'})}

    method = event.get('httpMethod', 'GET')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if method == 'GET':
        cur.execute(
            f"SELECT id, title, description, composition, price, icon, photo_url, sort_order, is_active, created_at FROM {SCHEMA}.award_catalog ORDER BY sort_order, id"
        )
        rows = cur.fetchall()
        items = []
        for r in rows:
            items.append({
                'id': r[0], 'title': r[1], 'description': r[2],
                'composition': list(r[3]) if r[3] else [],
                'price': float(r[4]) if r[4] is not None else None,
                'icon': r[5], 'photo_url': r[6],
                'sort_order': r[7], 'is_active': r[8],
                'created_at': str(r[9])
            })
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers_out, 'body': json.dumps({'items': items})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', 'create')

    if action == 'upload_photo':
        item_id = body.get('id')
        photo_b64 = body.get('photo_b64', '')
        content_type = body.get('content_type', 'image/jpeg')
        ext = content_type.split('/')[-1].replace('jpeg', 'jpg')
        key = f"awards/{item_id or 'tmp'}_{uuid.uuid4().hex[:8]}.{ext}"
        data = base64.b64decode(photo_b64)
        s3 = get_s3()
        s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)
        url = cdn_url(key)
        if item_id:
            cur.execute(f"UPDATE {SCHEMA}.award_catalog SET photo_url=%s WHERE id=%s", (url, item_id))
            conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers_out, 'body': json.dumps({'photo_url': url})}

    if action == 'create':
        title = body.get('title', '').strip()
        if not title:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': headers_out, 'body': json.dumps({'error': 'title required'})}
        composition = body.get('composition', [])
        cur.execute(
            f"INSERT INTO {SCHEMA}.award_catalog (title, description, composition, price, icon, photo_url, sort_order, is_active) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (title, body.get('description'), composition or None,
             body.get('price'), body.get('icon', 'award'),
             body.get('photo_url'), body.get('sort_order', 0), body.get('is_active', True))
        )
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers_out, 'body': json.dumps({'success': True, 'id': new_id})}

    if action == 'update':
        item_id = body.get('id')
        composition = body.get('composition', [])
        cur.execute(
            f"UPDATE {SCHEMA}.award_catalog SET title=%s, description=%s, composition=%s, price=%s, icon=%s, photo_url=%s, sort_order=%s, is_active=%s WHERE id=%s",
            (body.get('title'), body.get('description'), composition or None,
             body.get('price'), body.get('icon', 'award'),
             body.get('photo_url'), body.get('sort_order', 0), body.get('is_active', True), item_id)
        )
        conn.commit(); cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers_out, 'body': json.dumps({'success': True})}

    if action == 'delete':
        item_id = body.get('id')
        cur.execute(f"DELETE FROM {SCHEMA}.award_catalog WHERE id=%s", (item_id,))
        conn.commit(); cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers_out, 'body': json.dumps({'success': True})}

    cur.close(); conn.close()
    return {'statusCode': 400, 'headers': headers_out, 'body': json.dumps({'error': 'unknown action'})}
