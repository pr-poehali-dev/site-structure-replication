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
    """Парсит CSV-файл рейтинга ФШР, возвращает {fsr_id: rating}.
    Поддерживает два формата: короткий (ID;рейтинг — 2 столбца) и полный (формат Swiss Master,
    рейтинг в 5-м столбце, индекс 4)."""
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
        rating_field = row[1] if len(row) == 2 else (row[4] if len(row) > 4 else None)
        try:
            rating_value = int(float(rating_field)) if rating_field else None
        except (ValueError, TypeError):
            rating_value = None
        if rating_value is None:
            continue
        ratings_by_fsr_id[fsr_id] = rating_value
    return ratings_by_fsr_id


def parse_ratings_bytes_fast(data: bytes):
    """Быстрый построчный разбор официального CSV ФШР без декодирования всего файла в текст и без csv-модуля.
    Формат Swiss Master: fsr_id;ФИО;;регион;рейтинг;...  Рейтинг — 5-е поле (индекс 4).
    Также поддерживает короткий формат: fsr_id;рейтинг (2 столбца)."""
    ratings_by_fsr_id = {}
    for line in data.split(b'\n'):
        if not line:
            continue
        parts = line.split(b';')
        if len(parts) == 2:
            rating_idx = 1
        elif len(parts) >= 5:
            rating_idx = 4
        else:
            continue
        fsr_id_b = parts[0].strip()
        if not fsr_id_b or not fsr_id_b[0:1].isdigit():
            continue
        rating_b = parts[rating_idx].strip()
        if not rating_b:
            continue
        try:
            rating_value = int(float(rating_b))
        except ValueError:
            continue
        try:
            fsr_id = fsr_id_b.decode('ascii')
        except UnicodeDecodeError:
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


def sync_one_rating_type(cur, conn, rating_type: str):
    """Скачивает один официальный файл ФШР (блиц или рапид), обновляет рейтинг всех зарегистрированных
    пользователей и общий кэш (для автозаполнения при регистрации новых). Разбито по одному типу за вызов,
    чтобы уложиться в лимит времени и памяти функции."""
    data = download_official(rating_type)
    ratings = parse_ratings_bytes_fast(data)

    column = 'fsr_rating_blitz' if rating_type == 'blitz' else 'fsr_rating_rapid'
    cur.execute("SELECT id, fsr_id FROM users WHERE fsr_id IS NOT NULL AND fsr_id <> ''")
    existing_users = cur.fetchall()
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

    cache_col = 'rating_blitz' if rating_type == 'blitz' else 'rating_rapid'
    rows_batch = list(ratings.items())
    if rows_batch:
        upsert_sql = (
            f"INSERT INTO fsr_official_cache (fsr_id, {cache_col}) VALUES %s "
            f"ON CONFLICT (fsr_id) DO UPDATE SET {cache_col} = EXCLUDED.{cache_col}, updated_at = now()"
        )
        # Одним пакетом (минимум обращений к удалённой БД) — иначе на 400+ тыс. строк набегает
        # много сетевых round-trip'ов и функция не укладывается в лимит времени
        execute_values(cur, upsert_sql, rows_batch, template="(%s, %s::integer)", page_size=len(rows_batch))

    cur.execute(
        "INSERT INTO fsr_official_sync_log (rating_type, total_players, matched_users) VALUES (%s, %s, %s)",
        (rating_type, len(ratings), matched_count)
    )
    conn.commit()
    return {'total_rows': len(ratings), 'matched_count': matched_count}


def handler(event: dict, context) -> dict:
    """Загрузка/синхронизация рейтингов ФШР (блиц/рапид): ручная загрузка CSV частями, автосинхронизация с официального сайта ФШР по одному типу за вызов, поиск рейтинга одного игрока по ID, история загрузок"""
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
        cur.execute(
            "SELECT DISTINCT ON (rating_type) rating_type, synced_at, total_players, matched_users "
            "FROM fsr_official_sync_log ORDER BY rating_type, synced_at DESC"
        )
        last_sync = {
            r[0]: {'synced_at': str(r[1]), 'total_players': r[2], 'matched_users': r[3]}
            for r in cur.fetchall()
        }
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'files': rows, 'last_official_sync': last_sync})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    # Синхронизация с официальным сайтом ФШР — по одному типу рейтинга за вызов (укладывается в лимит времени/памяти)
    if method == 'POST' and action == 'sync_official':
        rating_type = body.get('rating_type')
        if rating_type not in RATING_TYPES:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректный тип рейтинга'})}
        try:
            result = sync_one_rating_type(cur, conn, rating_type)
        except Exception as e:
            conn.rollback()
            cur.close(); conn.close()
            err_detail = f"{type(e).__name__}: {e}"
            print(f"sync_official error: {err_detail}\n{traceback.format_exc()}")
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не удалось синхронизировать с сайтом ФШР', 'detail': err_detail})}

        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'rating_type': rating_type, 'result': result})}

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