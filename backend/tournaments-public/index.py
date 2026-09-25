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
    cur.execute(
        """SELECT t.id, t.title, t.description, t.date, t.location, t.age_category, t.price, t.time_control, t.status,
                  t.diploma_sample_url, t.regulation_url, t.announcement_url, t.time_msk, t.max_participants,
                  COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled'))
           FROM tournaments t
           LEFT JOIN applications a ON a.tournament_id = t.id
           WHERE t.status != 'archived'
           GROUP BY t.id
           ORDER BY t.date ASC NULLS LAST, t.created_at DESC"""
    )
    rows = cur.fetchall()
    conn.close()

    tournaments = []
    for r in rows:
        max_participants = r[13]
        applied_count = r[14]
        tournaments.append({
            'id': r[0], 'title': r[1], 'description': r[2],
            'date': str(r[3]) if r[3] else None,
            'location': r[4], 'age_category': r[5],
            'price': float(r[6]) if r[6] else None,
            'time_control': r[7], 'status': r[8],
            'diploma_sample_url': r[9], 'regulation_url': r[10], 'announcement_url': r[11],
            'time_msk': r[12],
            'max_participants': max_participants,
            'spots_left': (max(0, max_participants - applied_count) if max_participants else None),
        })

    return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'tournaments': tournaments})}