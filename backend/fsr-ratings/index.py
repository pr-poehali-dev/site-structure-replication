import json
import os
import base64
import uuid
import io
import csv
import traceback

import psycopg2
from psycopg2.extras import execute_values
import boto3

RATING_TYPES = ('blitz', 'rapid')


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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


def file_to_dict(row):
    return {
        'id': row[0],
        'rating_type': row[1],
        'file_name': row[2],
        'file_url': row[3],
        'total_rows': row[4],
        'matched_count': row[5],
        'uploaded_at': str(row[6]),
    }


def process_csv_and_save(cur, conn, rating_type, file_name, data):
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = data.decode('cp1251')

    newline_pos = text.find('\n')
    sample = text[:newline_pos] if newline_pos > 0 else text[:200]
    try:
        dialect = csv.Sniffer().sniff(sample)
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ','

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    column = 'fsr_rating_blitz' if rating_type == 'blitz' else 'fsr_rating_rapid'

    update_sql = (
        f"UPDATE users AS u SET {column} = data.rating_value "
        f"FROM (VALUES %s) AS data(fsr_id, rating_value) "
        f"WHERE u.fsr_id = data.fsr_id"
    )

    total_rows = 0
    matched_count = 0
    batch = []
    BATCH_SIZE = 10000
    for row in reader:
        if not row or not row[0]:
            continue
        fsr_id = str(row[0]).strip()
        if not fsr_id or not fsr_id[0].isdigit():
            continue
        try:
            rating_value = int(float(row[3])) if len(row) > 3 and row[3] else None
        except (ValueError, TypeError):
            rating_value = None
        if rating_value is None:
            continue
        batch.append((fsr_id, rating_value))
        total_rows += 1
        if len(batch) >= BATCH_SIZE:
            execute_values(cur, update_sql, batch, template="(%s, %s::integer)", page_size=BATCH_SIZE)
            matched_count += cur.rowcount
            batch.clear()

    if batch:
        execute_values(cur, update_sql, batch, template="(%s, %s::integer)", page_size=len(batch))
        matched_count += cur.rowcount
        batch.clear()

    del text, reader

    key = f"fsr-ratings/{rating_type}_{uuid.uuid4().hex[:12]}_{file_name}"
    s3 = get_s3()
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType='text/csv')
    file_url = cdn_url(key)

    cur.execute(
        "INSERT INTO fsr_rating_files (rating_type, file_name, file_url, total_rows, matched_count) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id, rating_type, file_name, file_url, total_rows, matched_count, uploaded_at",
        (rating_type, file_name, file_url, total_rows, matched_count)
    )
    new_row = cur.fetchone()
    conn.commit()
    return new_row


def handler(event: dict, context) -> dict:
    """Загрузка CSV-файлов рейтинга ФШР (блиц/рапид) частями, автообновление рейтингов пользователей по ID ФШР и история загрузок"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if not is_admin(event):
        return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Forbidden'})}

    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        cur.execute(
            "SELECT id, rating_type, file_name, file_url, total_rows, matched_count, uploaded_at "
            "FROM fsr_rating_files ORDER BY uploaded_at DESC LIMIT 100"
        )
        rows = [file_to_dict(r) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'files': rows})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    # Загрузка файла одним куском (небольшие файлы)
    if method == 'POST' and action == 'upload':
        rating_type = body.get('rating_type')
        file_b64 = body.get('file_b64', '')
        file_name = body.get('file_name', 'rating.csv')

        if rating_type not in RATING_TYPES:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректный тип рейтинга'})}
        if not file_b64:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Файл не передан'})}

        try:
            data = base64.b64decode(file_b64)
            new_row = process_csv_and_save(cur, conn, rating_type, file_name, data)
        except Exception as e:
            conn.rollback()
            cur.close(); conn.close()
            err_detail = f"{type(e).__name__}: {e}"
            print(f"upload error: {err_detail}\n{traceback.format_exc()}")
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не удалось обработать CSV-файл', 'detail': err_detail})}

        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'file': file_to_dict(new_row)})}

    # Загрузка файла частями (крупные файлы)
    if method == 'POST' and action == 'upload_chunk':
        session_id = body.get('session_id', '')
        chunk_index = body.get('chunk_index')
        total_chunks = body.get('total_chunks')
        chunk_b64 = body.get('chunk_b64', '')

        if not session_id or chunk_index is None or total_chunks is None:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректные параметры части файла'})}

        cur.execute(
            "INSERT INTO fsr_rating_upload_chunks (session_id, chunk_index, chunk_b64) VALUES (%s, %s, %s)",
            (session_id, chunk_index, chunk_b64)
        )
        conn.commit()

        if chunk_index < total_chunks - 1:
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'received': chunk_index})}

        rating_type = body.get('rating_type')
        file_name = body.get('file_name', 'rating.csv')

        if rating_type not in RATING_TYPES:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректный тип рейтинга'})}

        cur.execute(
            "SELECT chunk_b64 FROM fsr_rating_upload_chunks WHERE session_id = %s ORDER BY chunk_index",
            (session_id,)
        )
        chunks = [r[0] for r in cur.fetchall()]

        try:
            full_b64 = ''.join(chunks)
            chunks.clear()
            data = base64.b64decode(full_b64)
            full_b64 = ''
            new_row = process_csv_and_save(cur, conn, rating_type, file_name, data)
        except Exception as e:
            conn.rollback()
            cur.close(); conn.close()
            err_detail = f"{type(e).__name__}: {e}"
            print(f"upload_chunk error: {err_detail}\n{traceback.format_exc()}")
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не удалось обработать CSV-файл', 'detail': err_detail})}

        cur.execute("DELETE FROM fsr_rating_upload_chunks WHERE session_id = %s", (session_id,))
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'file': file_to_dict(new_row)})}

    cur.close()
    conn.close()
    return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Bad request'})}