import json
import os

import psycopg2

POINTS_SQL = """
    SELECT tp.user_id,
           SUM(CASE t.tournament_type WHEN 'warmup' THEN 1 WHEN 'training' THEN 2 ELSE 3 END) AS pts,
           COUNT(*) AS cnt
    FROM tournament_players tp
    JOIN tournaments t ON t.id = tp.tournament_id
    WHERE t.hall_status = 'finished' AND tp.user_id IS NOT NULL
    GROUP BY tp.user_id
"""


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }


def handler(event: dict, context) -> dict:
    """Рейтинг активности: очки за завершённые турниры (разминочный 1, тренировочный 2, квалификационный 3).
    Без параметров — топ игроков (limit, по умолчанию 10; all=1 — все). С user_id — очки и место игрока."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    params = event.get('queryStringParameters') or {}
    conn = get_conn()
    cur = conn.cursor()

    ranked = f"""SELECT s.user_id, s.pts, s.cnt, RANK() OVER (ORDER BY s.pts DESC, s.cnt DESC) AS place
                 FROM ({POINTS_SQL}) s"""

    user_id = (params.get('user_id') or '').strip()
    if user_id:
        if not user_id.isdigit():
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректный user_id'})}
        cur.execute(f"SELECT pts, cnt, place FROM ({ranked}) r WHERE user_id = %s", (int(user_id),))
        row = cur.fetchone()
        cur.execute(f"SELECT COUNT(*) FROM ({ranked}) r")
        total = cur.fetchone()[0]
        conn.close()
        body = {'points': int(row[0]), 'tournaments': int(row[1]), 'place': int(row[2])} if row else {'points': 0, 'tournaments': 0, 'place': None}
        body['total_players'] = total
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Cache-Control': 'public, max-age=30'}, 'body': json.dumps(body)}

    limit_sql = ''
    if params.get('all') != '1':
        limit = params.get('limit') or '10'
        limit = int(limit) if limit.isdigit() else 10
        limit_sql = f"LIMIT {max(1, min(limit, 100))}"
    cur.execute(
        f"""SELECT r.user_id, r.pts, r.cnt, r.place, u.last_name, u.first_name, u.avatar_url
            FROM ({ranked}) r JOIN users u ON u.id = r.user_id
            ORDER BY r.place, u.last_name, u.first_name {limit_sql}"""
    )
    players = [
        {'user_id': r[0], 'points': int(r[1]), 'tournaments': int(r[2]), 'place': int(r[3]),
         'last_name': r[4], 'first_name': r[5], 'avatar_url': r[6]}
        for r in cur.fetchall()
    ]
    cur.execute(f"SELECT COUNT(*) FROM ({ranked}) r")
    total = cur.fetchone()[0]
    conn.close()
    return {'statusCode': 200, 'headers': {**cors_headers(), 'Cache-Control': 'public, max-age=30'}, 'body': json.dumps({'players': players, 'total': total})}
