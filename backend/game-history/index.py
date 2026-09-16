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
    """История сыгранных шахматных партий пользователя во всех турнирах"""
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

    cur.execute("SELECT id FROM tournament_players WHERE user_id = %s", (user_id,))
    player_ids = [r[0] for r in cur.fetchall()]
    if not player_ids:
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'games': []})}

    cur.execute(
        """SELECT g.id, g.tournament_id, t.title, g.white_player_id, wp.fio, wp.user_id,
                  g.black_player_id, bp.fio, bp.user_id, g.status, g.result, g.result_reason,
                  g.fen, g.pgn, g.is_bye, g.finished_at, g.started_at, tr.round_number, t.rating_type
           FROM tournament_games g
           JOIN tournaments t ON t.id = g.tournament_id
           LEFT JOIN tournament_players wp ON wp.id = g.white_player_id
           LEFT JOIN tournament_players bp ON bp.id = g.black_player_id
           JOIN tournament_rounds tr ON tr.id = g.round_id
           WHERE g.status = 'finished' AND g.is_bye = false
             AND (g.white_player_id = ANY(%s) OR g.black_player_id = ANY(%s))
           ORDER BY g.finished_at DESC NULLS LAST, g.id DESC
           LIMIT 200""",
        (player_ids, player_ids)
    )
    rows = cur.fetchall()
    conn.close()

    player_id_set = set(player_ids)
    games = []
    for r in rows:
        (game_id, tournament_id, tournament_title, white_id, white_fio, white_user_id,
         black_id, black_fio, black_user_id, status, result, result_reason,
         fen, pgn, is_bye, finished_at, started_at, round_number, rating_type) = r

        my_color = 'white' if white_id in player_id_set else 'black'
        opponent_fio = black_fio if my_color == 'white' else white_fio

        if result == '1-0':
            outcome = 'win' if my_color == 'white' else 'loss'
        elif result == '0-1':
            outcome = 'win' if my_color == 'black' else 'loss'
        else:
            outcome = 'draw'

        games.append({
            'id': game_id,
            'tournament_id': tournament_id,
            'tournament_title': tournament_title,
            'round_number': round_number,
            'rating_type': rating_type,
            'my_color': my_color,
            'opponent_fio': opponent_fio,
            'result': result,
            'result_reason': result_reason,
            'outcome': outcome,
            'fen': fen,
            'moves_count': len(pgn.split()) if pgn else 0,
            'finished_at': str(finished_at) if finished_at else None,
            'started_at': str(started_at) if started_at else None,
        })

    return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'games': games})}
