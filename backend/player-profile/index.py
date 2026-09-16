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


def handler(event: dict, context) -> dict:
    """Публичный профиль игрока: доступен всем участникам турниров для просмотра
    (ФИО, рейтинги, тренер, учреждение, город, история турниров и партий).
    Телефон и email не отдаются — это приватные контактные данные."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    if event.get('httpMethod') != 'GET':
        return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}

    params = event.get('queryStringParameters') or {}
    user_id = params.get('user_id')
    if not user_id:
        return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'user_id required'})}

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """SELECT id, last_name, first_name, middle_name, birth_date, fsr_id, coach_fio,
                  institution, country_city, created_at, avatar_url,
                  rating_blitz, rating_rapid, fsr_rating_blitz, fsr_rating_rapid
           FROM users WHERE id = %s""",
        (user_id,)
    )
    row = cur.fetchone()
    if not row:
        conn.close()
        return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Игрок не найден'})}

    profile = {
        'id': row[0], 'last_name': row[1], 'first_name': row[2], 'middle_name': row[3],
        'birth_date': str(row[4]) if row[4] else None, 'fsr_id': row[5], 'coach_fio': row[6],
        'institution': row[7], 'country_city': row[8], 'created_at': str(row[9]),
        'avatar_url': row[10], 'rating_blitz': row[11], 'rating_rapid': row[12],
        'fsr_rating_blitz': row[13], 'fsr_rating_rapid': row[14],
    }

    cur.execute("SELECT id FROM tournament_players WHERE user_id = %s", (user_id,))
    player_ids = [r[0] for r in cur.fetchall()]

    tournaments = []
    if player_ids:
        cur.execute(
            """SELECT tp.tournament_id, t.title, t.hall_status, tp.points, tp.place, t.rating_type, tp.id
               FROM tournament_players tp
               JOIN tournaments t ON t.id = tp.tournament_id
               WHERE tp.user_id = %s
               ORDER BY tp.created_at DESC
               LIMIT 100""",
            (user_id,)
        )
        tournaments = [
            {
                'tournament_id': r[0], 'title': r[1], 'hall_status': r[2],
                'points': float(r[3]), 'place': r[4], 'rating_type': r[5],
            }
            for r in cur.fetchall()
        ]

        cur.execute(
            """SELECT g.id, g.tournament_id, t.title, g.white_player_id, wp.fio,
                      g.black_player_id, bp.fio, g.status, g.result, g.result_reason,
                      g.fen, g.pgn, g.finished_at, tr.round_number, t.rating_type
               FROM tournament_games g
               JOIN tournaments t ON t.id = g.tournament_id
               LEFT JOIN tournament_players wp ON wp.id = g.white_player_id
               LEFT JOIN tournament_players bp ON bp.id = g.black_player_id
               JOIN tournament_rounds tr ON tr.id = g.round_id
               WHERE g.status = 'finished' AND g.is_bye = false
                 AND (g.white_player_id = ANY(%s) OR g.black_player_id = ANY(%s))
               ORDER BY g.finished_at DESC NULLS LAST, g.id DESC
               LIMIT 50""",
            (player_ids, player_ids)
        )
        player_id_set = set(player_ids)
        games = []
        for g in cur.fetchall():
            (game_id, tournament_id, tournament_title, white_id, white_fio,
             black_id, black_fio, status, result, result_reason,
             fen, pgn, finished_at, round_number, rating_type) = g
            my_color = 'white' if white_id in player_id_set else 'black'
            opponent_fio = black_fio if my_color == 'white' else white_fio
            if result == '1-0':
                outcome = 'win' if my_color == 'white' else 'loss'
            elif result == '0-1':
                outcome = 'win' if my_color == 'black' else 'loss'
            else:
                outcome = 'draw'
            games.append({
                'id': game_id, 'tournament_id': tournament_id, 'tournament_title': tournament_title,
                'round_number': round_number, 'rating_type': rating_type, 'my_color': my_color,
                'opponent_fio': opponent_fio, 'result': result, 'result_reason': result_reason,
                'outcome': outcome, 'fen': fen, 'moves_count': len(pgn.split()) if pgn else 0,
                'finished_at': str(finished_at) if finished_at else None,
            })
    else:
        games = []

    conn.close()
    return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
        'profile': profile, 'tournaments': tournaments, 'games': games,
    })}
