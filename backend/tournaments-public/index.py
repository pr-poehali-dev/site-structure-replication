import json
import os
import psycopg2

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")

def handler(event: dict, context) -> dict:
    """Публичный список турниров для отображения на сайте"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, title, description, date, location, age_category, price, time_control, status, diploma_sample_url, regulation_url, announcement_url FROM tournaments ORDER BY date ASC NULLS LAST, created_at DESC")
    rows = cur.fetchall()
    conn.close()

    tournaments = []
    for r in rows:
        tournaments.append({
            'id': r[0], 'title': r[1], 'description': r[2],
            'date': str(r[3]) if r[3] else None,
            'location': r[4], 'age_category': r[5],
            'price': float(r[6]) if r[6] else None,
            'time_control': r[7], 'status': r[8],
            'diploma_sample_url': r[9], 'regulation_url': r[10], 'announcement_url': r[11],
        })

    return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'tournaments': tournaments})}