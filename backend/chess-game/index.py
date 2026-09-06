import json
import os
from datetime import datetime

import psycopg2

from chess_rules import Board

CHECKMATE = 'checkmate'
STALEMATE = 'stalemate'
DRAW_AGREED = 'draw_agreed'
RESIGNATION = 'resignation'
TIMEOUT = 'timeout'
INSUFFICIENT = 'insufficient_material'


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def load_game(cur, game_id):
    cur.execute(
        """SELECT g.id, g.round_id, g.tournament_id, g.white_player_id, wp.fio, wp.user_id,
                  g.black_player_id, bp.fio, bp.user_id, g.status, g.result, g.result_reason,
                  g.fen, g.pgn, g.turn, g.white_time_ms, g.black_time_ms, g.increment_ms,
                  g.last_move_at, g.draw_offered_by, t.title
           FROM tournament_games g
           LEFT JOIN tournament_players wp ON wp.id = g.white_player_id
           LEFT JOIN tournament_players bp ON bp.id = g.black_player_id
           LEFT JOIN tournaments t ON t.id = g.tournament_id
           WHERE g.id = %s""",
        (game_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        'id': row[0], 'round_id': row[1], 'tournament_id': row[2],
        'white_player_id': row[3], 'white_fio': row[4], 'white_user_id': row[5],
        'black_player_id': row[6], 'black_fio': row[7], 'black_user_id': row[8],
        'status': row[9], 'result': row[10], 'result_reason': row[11],
        'fen': row[12], 'pgn': row[13], 'turn': row[14],
        'white_time_ms': row[15], 'black_time_ms': row[16], 'increment_ms': row[17],
        'last_move_at': row[18], 'draw_offered_by': row[19], 'tournament_title': row[20],
    }


def compute_live_times(game):
    white_ms, black_ms = game['white_time_ms'], game['black_time_ms']
    if game['status'] == 'active' and game['last_move_at']:
        elapsed = (datetime.utcnow() - game['last_move_at']).total_seconds() * 1000
        if game['turn'] == 'white':
            white_ms = max(0, white_ms - int(elapsed))
        else:
            black_ms = max(0, black_ms - int(elapsed))
    return white_ms, black_ms


def finish_game(cur, game_id, result, reason, winner_player_id=None, loser_player_id=None):
    cur.execute(
        "UPDATE tournament_games SET status = 'finished', result = %s, result_reason = %s, finished_at = now() WHERE id = %s",
        (result, reason, game_id)
    )
    if winner_player_id:
        cur.execute("UPDATE tournament_players SET points = points + 1 WHERE id = %s", (winner_player_id,))
    if result == '1/2-1/2':
        cur.execute(
            "UPDATE tournament_players SET points = points + 0.5 WHERE id IN (SELECT white_player_id FROM tournament_games WHERE id = %s UNION SELECT black_player_id FROM tournament_games WHERE id = %s)",
            (game_id, game_id)
        )


def player_role(game, user_id):
    if user_id and game['white_user_id'] == user_id:
        return 'white'
    if user_id and game['black_user_id'] == user_id:
        return 'black'
    return None


def handler(event: dict, context) -> dict:
    """Игра в шахматы: ходы, часы, ничья, сдача, чат партии турнира"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()
    user_id = get_user_id_by_token(cur, auth_token)

    if method == 'GET':
        game_id = params.get('game_id')
        if not game_id:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'game_id required'})}
        game = load_game(cur, game_id)
        if not game:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}

        white_ms, black_ms = compute_live_times(game)

        if game['status'] == 'active' and (white_ms <= 0 or black_ms <= 0):
            loser_color = 'white' if white_ms <= 0 else 'black'
            winner_id = game['black_player_id'] if loser_color == 'white' else game['white_player_id']
            loser_id = game['white_player_id'] if loser_color == 'white' else game['black_player_id']
            result = '0-1' if loser_color == 'white' else '1-0'
            finish_game(cur, game['id'], result, TIMEOUT, winner_id, loser_id)
            conn.commit()
            game = load_game(cur, game_id)
            white_ms, black_ms = compute_live_times(game)

        cur.execute(
            "SELECT gm.message, gm.created_at, gm.player_id, COALESCE(tp.fio, 'Игрок') FROM game_chat_messages gm LEFT JOIN tournament_players tp ON tp.id = gm.player_id WHERE gm.game_id = %s ORDER BY gm.id ASC",
            (game_id,)
        )
        chat = [{'message': r[0], 'created_at': str(r[1]), 'player_id': r[2], 'fio': r[3]} for r in cur.fetchall()]

        conn.close()
        role = player_role(game, user_id)
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'game': {
                'id': game['id'], 'status': game['status'], 'result': game['result'], 'result_reason': game['result_reason'],
                'fen': game['fen'], 'pgn': game['pgn'], 'turn': game['turn'],
                'white_fio': game['white_fio'], 'black_fio': game['black_fio'],
                'white_time_ms': white_ms, 'black_time_ms': black_ms,
                'draw_offered_by': game['draw_offered_by'], 'tournament_title': game['tournament_title'],
                'tournament_id': game['tournament_id'],
            },
            'chat': chat, 'my_role': role,
        })}

    if method == 'POST' and action == 'move':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role:
            conn.close()
            return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Вы не участник этой партии'})}
        if game['status'] != 'active':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия завершена'})}
        if role != game['turn']:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Сейчас не ваш ход'})}

        board = Board(game['fen'])
        from_sq = body.get('from')
        to_sq = body.get('to')
        promotion = body.get('promotion')
        mv = board.find_move(from_sq, to_sq, promotion)
        if not mv:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недопустимый ход'})}
        san = board.move_to_san(mv)
        board.apply_move(mv)

        white_ms, black_ms = compute_live_times(game)
        inc = game['increment_ms']
        if role == 'white':
            white_ms += inc
        else:
            black_ms += inc

        new_pgn = (game['pgn'] + ' ' + san).strip()
        new_turn = 'black' if role == 'white' else 'white'

        cur.execute(
            "UPDATE tournament_games SET fen = %s, pgn = %s, turn = %s, white_time_ms = %s, black_time_ms = %s, last_move_at = now(), draw_offered_by = NULL WHERE id = %s",
            (board.to_fen(), new_pgn, new_turn, white_ms, black_ms, game_id)
        )

        if board.is_checkmate():
            winner_id = game['white_player_id'] if role == 'white' else game['black_player_id']
            loser_id = game['black_player_id'] if role == 'white' else game['white_player_id']
            result = '1-0' if role == 'white' else '0-1'
            finish_game(cur, game_id, result, CHECKMATE, winner_id, loser_id)
        elif board.is_stalemate():
            finish_game(cur, game_id, '1/2-1/2', STALEMATE)
        elif board.is_insufficient_material():
            finish_game(cur, game_id, '1/2-1/2', INSUFFICIENT)

        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'resign':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role or game['status'] != 'active':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Невозможно сдаться'})}
        winner_id = game['black_player_id'] if role == 'white' else game['white_player_id']
        loser_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        result = '0-1' if role == 'white' else '1-0'
        finish_game(cur, game_id, result, RESIGNATION, winner_id, loser_id)
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'offer_draw':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role or game['status'] != 'active':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Невозможно предложить ничью'})}
        player_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        cur.execute("UPDATE tournament_games SET draw_offered_by = %s WHERE id = %s", (player_id, game_id))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'accept_draw':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role or game['status'] != 'active' or not game['draw_offered_by']:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нет предложения ничьи'})}
        my_player_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        if game['draw_offered_by'] == my_player_id:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нельзя принять собственное предложение'})}
        finish_game(cur, game_id, '1/2-1/2', DRAW_AGREED)
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'decline_draw':
        game_id = body.get('game_id')
        cur.execute("UPDATE tournament_games SET draw_offered_by = NULL WHERE id = %s", (game_id,))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'chat':
        game_id = body.get('game_id')
        message = (body.get('message') or '').strip()[:500]
        if not message:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Пустое сообщение'})}
        game = load_game(cur, game_id)
        if not game:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role:
            conn.close()
            return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Вы не участник этой партии'})}
        player_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        cur.execute("INSERT INTO game_chat_messages (game_id, player_id, message) VALUES (%s, %s, %s)", (game_id, player_id, message))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}
