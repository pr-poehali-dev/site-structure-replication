import json
import os
import base64
import uuid
import io
import csv
import traceback
from urllib.request import Request, urlopen

import psycopg2
from psycopg2.extras import execute_values
import boto3

RATING_TYPES = ('blitz', 'rapid')

OFFICIAL_URLS = {
    'blitz': 'https://ratings.ruchess.ru/api/smaster_blitz.csv',
    'rapid': 'https://ratings.ruchess.ru/api/smaster_rapid.csv',
}


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


def parse_ratings_csv(data: bytes):
    """Парсит CSV-файл рейтинга ФШР (формат Swiss Master), возвращает {fsr_id: rating}. Рейтинг — 5-е поле (индекс 4)."""
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
        delimiter = ';'

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    ratings_by_fsr_id = {}
    for row in reader:
        if not row or not row[0]:
            continue
        fsr_id = str(row[0]).strip()
        if not fsr_id or not fsr_id[0].isdigit():
            continue
        try:
            rating_value = int(float(row[4])) if len(row) > 4 and row[4] else None
        except (ValueError, TypeError):
            rating_value = None
        if rating_value is None:
            continue
        ratings_by_fsr_id[fsr_id] = rating_value
    return ratings_by_fsr_id


def process_csv_and_save(cur, conn, rating_type, file_name, data):
    ratings_by_fsr_id = parse_ratings_csv(data)
    total_rows = len(ratings_by_fsr_id)
    column = 'fsr_rating_blitz' if rating_type == 'blitz' else 'fsr_rating_rapid'

    matched_count = 0
    if ratings_by_fsr_id:
        cur.execute("SELECT id, fsr_id FROM users WHERE fsr_id IS NOT NULL AND fsr_id <> ''")
        existing_users = cur.fetchall()

        updates = [
            (user_id, ratings_by_fsr_id[fsr_id])
            for user_id, fsr_id in existing_users
            if fsr_id in ratings_by_fsr_id
        ]

        if updates:
            update_sql = (
                f"UPDATE users AS u SET {column} = data.rating_value "
                f"FROM (VALUES %s) AS data(user_id, rating_value) "
                f"WHERE u.id = data.user_id"
            )
            execute_values(cur, update_sql, updates, template="(%s, %s::integer)", page_size=len(updates))
            matched_count = cur.rowcount

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


def download_official(rating_type: str) -> bytes:
    req = Request(OFFICIAL_URLS[rating_type], headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=15) as resp:
        return resp.read()


def sync_official_ratings(cur, conn):
    """Скачивает оба официальных файла ФШР, обновляет рейтинги всех зарегистрированных пользователей
    и общий кэш (для автозаполнения при регистрации новых). Файлы не сохраняются в S3 — это отдельный
    быстрый путь для автосинхронизации, в отличие от ручной загрузки конкретного файла администратором."""
    ratings_by_type = {}
    for rating_type in RATING_TYPES:
        data = download_official(rating_type)
        ratings_by_type[rating_type] = parse_ratings_csv(data)

    cur.execute("SELECT id, fsr_id FROM users WHERE fsr_id IS NOT NULL AND fsr_id <> ''")
    existing_users = cur.fetchall()

    results = {}
    for rating_type, ratings in ratings_by_type.items():
        column = 'fsr_rating_blitz' if rating_type == 'blitz' else 'fsr_rating_rapid'
        updates = [(user_id, ratings[fsr_id]) for user_id, fsr_id in existing_users if fsr_id in ratings]
        matched_count = 0
        if updates:
            update_sql = (
                f"UPDATE users AS u SET {column} = data.rating_value "
                f"FROM (VALUES %s) AS data(user_id, rating_value) "
                f"WHERE u.id = data.user_id"
            )
            execute_values(cur, update_sql, updates, template="(%s, %s::integer)", page_size=len(updates))
            matched_count = cur.rowcount
        results[rating_type] = {'total_rows': len(ratings), 'matched_count': matched_count}

    for rating_type, ratings in ratings_by_type.items():
        col = 'rating_blitz' if rating_type == 'blitz' else 'rating_rapid'
        rows_batch = list(ratings.items())
        if rows_batch:
            upsert_sql = (
                f"INSERT INTO fsr_official_cache (fsr_id, {col}) VALUES %s "
                f"ON CONFLICT (fsr_id) DO UPDATE SET {col} = EXCLUDED.{col}, updated_at = now()"
            )
            execute_values(cur, upsert_sql, rows_batch, template="(%s, %s::integer)", page_size=50000)

    total_players = sum(r['total_rows'] for r in results.values())
    matched_users = max((r['matched_count'] for r in results.values()), default=0)
    cur.execute(
        "INSERT INTO fsr_official_sync_log (total_players, matched_users) VALUES (%s, %s)",
        (total_players, matched_users)
    )
    conn.commit()
    return results


def handler(event: dict, context) -> dict:
    """Загрузка/синхронизация рейтингов ФШР (блиц/рапид): ручная загрузка CSV частями, автосинхронизация с официального сайта ФШР, поиск рейтинга одного игрока по ID, история загрузок"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}

    # Публичный поиск рейтинга одного игрока по ID ФШР (используется при регистрации, без пароля админа)
    if method == 'GET' and qs.get('lookup_fsr_id'):
        fsr_id = str(qs.get('lookup_fsr_id')).strip()
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT rating_blitz, rating_rapid FROM fsr_official_cache WHERE fsr_id = %s", (fsr_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'found': False})}
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'found': True, 'fsr_rating_blitz': row[0], 'fsr_rating_rapid': row[1]
        })}

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
        cur.execute("SELECT synced_at, total_players, matched_users FROM fsr_official_sync_log ORDER BY synced_at DESC LIMIT 1")
        last_sync_row = cur.fetchone()
        last_sync = None
        if last_sync_row:
            last_sync = {'synced_at': str(last_sync_row[0]), 'total_players': last_sync_row[1], 'matched_users': last_sync_row[2]}
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'files': rows, 'last_official_sync': last_sync})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    # Синхронизация с официальным сайтом ФШР (обновляет всех пользователей + кэш для новых регистраций)
    if method == 'POST' and action == 'sync_official':
        try:
            results = sync_official_ratings(cur, conn)
        except Exception as e:
            conn.rollback()
            cur.close(); conn.close()
            err_detail = f"{type(e).__name__}: {e}"
            print(f"sync_official error: {err_detail}\n{traceback.format_exc()}")
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не удалось синхронизировать с сайтом ФШР', 'detail': err_detail})}

        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'results': results})}

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