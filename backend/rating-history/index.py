import json
import os

import psycopg2


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    """История изменений рейтинга МШ пользователя по итогам турниров"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    if event.get('httpMethod') != 'GET':
        return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}

    headers = event.get('headers', {}) or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()

    user_id = get_user_id_by_token(cur, token)
    if not user_id:
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'})}

    cur.execute(
        """SELECT id, tournament_id, tournament_title, rating_type, rating_before, rating_after, delta, points, expected_points, games_count, created_at
           FROM rating_history WHERE user_id = %s ORDER BY created_at DESC LIMIT 200""",
        (user_id,)
    )
    rows = cur.fetchall()
    conn.close()
    history = [
        {
            'id': r[0], 'tournament_id': r[1], 'tournament_title': r[2], 'rating_type': r[3],
            'rating_before': r[4], 'rating_after': r[5], 'delta': float(r[6]), 'points': float(r[7]),
            'expected_points': float(r[8]), 'games_count': r[9], 'created_at': str(r[10]),
        }
        for r in rows
    ]
    return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'history': history})}
