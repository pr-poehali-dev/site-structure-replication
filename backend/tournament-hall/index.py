import json
import os
import re
from datetime import datetime, timedelta

import psycopg2

from swiss import make_pairings
from pusher_client import trigger

DEFAULT_BASE_MS = 600000
DEFAULT_INC_MS = 0


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def parse_time_control(tc: str):
    if not tc:
        return DEFAULT_BASE_MS, DEFAULT_INC_MS
    m = re.match(r'\s*(\d+)\s*\+\s*(\d+)\s*', tc)
    if not m:
        m2 = re.match(r'\s*(\d+)\s*', tc)
        if m2:
            return int(m2.group(1)) * 60000, 0
        return DEFAULT_BASE_MS, DEFAULT_INC_MS
    minutes, inc = int(m.group(1)), int(m.group(2))
    return minutes * 60000, inc * 1000


def create_round_games(cur, tournament_id, round_id, pairs, base_ms, inc_ms):
    for p in pairs:
        if p['bye']:
            cur.execute(
                """INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, result, result_reason, white_time_ms, black_time_ms, increment_ms, started_at, finished_at)
                   VALUES (%s, %s, %s, NULL, true, 'finished', '1-0', 'bye', %s, %s, %s, now(), now())""",
                (round_id, tournament_id, p['white_id'], base_ms, base_ms, inc_ms)
            )
            cur.execute("UPDATE tournament_players SET points = points + 1, byes_used = byes_used + 1 WHERE id = %s", (p['white_id'],))
        else:
            cur.execute(
                """INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
                   VALUES (%s, %s, %s, %s, false, 'active', %s, %s, %s, now(), now())""",
                (round_id, tournament_id, p['white_id'], p['black_id'], base_ms, base_ms, inc_ms)
            )
            cur.execute("UPDATE tournament_players SET color_balance = color_balance + 1 WHERE id = %s", (p['white_id'],))
            cur.execute("UPDATE tournament_players SET color_balance = color_balance - 1 WHERE id = %s", (p['black_id'],))


def get_previous_pairs(cur, tournament_id):
    cur.execute(
        "SELECT white_player_id, black_player_id FROM tournament_games WHERE tournament_id = %s AND black_player_id IS NOT NULL",
        (tournament_id,)
    )
    return {frozenset({r[0], r[1]}) for r in cur.fetchall()}


def start_next_round(cur, tournament, round_number):
    cur.execute("SELECT id, rating, points, color_balance FROM tournament_players WHERE tournament_id = %s AND active = true", (tournament['id'],))
    players = [{'id': r[0], 'rating': r[1], 'points': float(r[2]), 'color_balance': r[3]} for r in cur.fetchall()]
    if len(players) < 2:
        return None

    previous_pairs = get_previous_pairs(cur, tournament['id'])
    cur.execute("SELECT id FROM tournament_players WHERE tournament_id = %s AND byes_used > 0", (tournament['id'],))
    bye_used = {r[0] for r in cur.fetchall()}

    pairs = make_pairings(players, previous_pairs, bye_used)

    cur.execute(
        "INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at) VALUES (%s, %s, 'active', now()) RETURNING id",
        (tournament['id'], round_number)
    )
    round_id = cur.fetchone()[0]
    base_ms, inc_ms = parse_time_control(tournament['time_control'])
    create_round_games(cur, tournament['id'], round_id, pairs, base_ms, inc_ms)
    return round_id


def maybe_advance(cur, tournament):
    """Возвращает ISO-время старта следующего тура, если сейчас идёт перерыв между турами."""
    cur.execute(
        "SELECT id, round_number, status, completed_at FROM tournament_rounds WHERE tournament_id = %s ORDER BY round_number DESC LIMIT 1",
        (tournament['id'],)
    )
    row = cur.fetchone()
    if not row:
        return None
    round_id, round_number, status, completed_at = row

    if status == 'active':
        cur.execute(
            "SELECT COUNT(*) FROM tournament_games WHERE round_id = %s AND status != 'finished'",
            (round_id,)
        )
        unfinished = cur.fetchone()[0]
        if unfinished == 0:
            cur.execute("UPDATE tournament_rounds SET status = 'completed', completed_at = now() WHERE id = %s", (round_id,))
            if round_number >= tournament['rounds_count']:
                cur.execute("UPDATE tournaments SET hall_status = 'finished' WHERE id = %s", (tournament['id'],))
                trigger(f"tournament-{tournament['id']}", 'finished', {})
            else:
                trigger(f"tournament-{tournament['id']}", 'round-completed', {'round_number': round_number})
                break_seconds = tournament.get('round_break_seconds', 60)
                return (datetime.utcnow() + timedelta(seconds=break_seconds)).isoformat()
        return None

    if status == 'completed' and round_number < tournament['rounds_count']:
        break_seconds = tournament.get('round_break_seconds', 60)
        next_round_at = completed_at + timedelta(seconds=break_seconds) if completed_at else None
        if completed_at and datetime.utcnow() >= completed_at + timedelta(seconds=break_seconds):
            new_round_id = start_next_round(cur, tournament, round_number + 1)
            if new_round_id:
                trigger(f"tournament-{tournament['id']}", 'round-started', {'round_number': round_number + 1})
            return None
        return next_round_at.isoformat() if next_round_at else None

    return None


def get_tournament(cur, tournament_id):
    cur.execute(
        "SELECT id, title, time_control, rounds_count, hall_status, round_break_seconds FROM tournaments WHERE id = %s",
        (tournament_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'title': row[1], 'time_control': row[2], 'rounds_count': row[3], 'hall_status': row[4], 'round_break_seconds': row[5]}


def handler(event: dict, context) -> dict:
    """Турнирный зал: жеребьёвка швейцарской системы, состояние туров и партий"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')

    admin_password = headers.get('X-Admin-Password', '')
    is_admin = admin_password == os.environ.get('ADMIN_PASSWORD', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        tournament_id = params.get('tournament_id')
        if not tournament_id:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'tournament_id required'})}

        tournament = get_tournament(cur, tournament_id)
        if not tournament:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}

        next_round_at = None
        if tournament['hall_status'] == 'active':
            next_round_at = maybe_advance(cur, tournament)
            conn.commit()
            tournament = get_tournament(cur, tournament_id)

        user_id = get_user_id_by_token(cur, auth_token) if not is_admin else None
        my_player_id = None
        if user_id:
            cur.execute("SELECT id FROM tournament_players WHERE tournament_id = %s AND user_id = %s", (tournament_id, user_id))
            r = cur.fetchone()
            my_player_id = r[0] if r else None

            # Если турнир ещё не начался — регистрируем зашедшего в зал пользователя
            # в таблице участников сразу (по его оплаченной заявке), чтобы он был виден остальным
            if not my_player_id and tournament['hall_status'] == 'not_started':
                cur.execute(
                    "SELECT id, fio FROM applications WHERE tournament_id = %s AND user_id = %s AND status = 'paid' LIMIT 1",
                    (tournament_id, user_id)
                )
                app_row = cur.fetchone()
                if app_row:
                    app_id, fio = app_row
                    cur.execute(
                        """INSERT INTO tournament_players (tournament_id, user_id, application_id, fio, rating)
                           VALUES (%s, %s, %s, %s, 1200)
                           ON CONFLICT (tournament_id, application_id) DO NOTHING
                           RETURNING id""",
                        (tournament_id, user_id, app_id, fio)
                    )
                    new_row = cur.fetchone()
                    conn.commit()
                    if new_row:
                        my_player_id = new_row[0]
                        trigger(f'tournament-{tournament_id}', 'player-joined', {})

        cur.execute(
            "SELECT id, fio, rating, points, buchholz FROM tournament_players WHERE tournament_id = %s ORDER BY points DESC, rating DESC",
            (tournament_id,)
        )
        players = [{'id': r[0], 'fio': r[1], 'rating': r[2], 'points': float(r[3]), 'buchholz': float(r[4])} for r in cur.fetchall()]

        cur.execute(
            "SELECT id, round_number, status, started_at, completed_at FROM tournament_rounds WHERE tournament_id = %s ORDER BY round_number ASC",
            (tournament_id,)
        )
        rounds_rows = cur.fetchall()
        rounds = []
        my_game_id = None
        for rr in rounds_rows:
            round_id, round_number, r_status, started_at, completed_at = rr
            cur.execute(
                """SELECT g.id, g.white_player_id, wp.fio, g.black_player_id, bp.fio, g.is_bye, g.status, g.result
                   FROM tournament_games g
                   LEFT JOIN tournament_players wp ON wp.id = g.white_player_id
                   LEFT JOIN tournament_players bp ON bp.id = g.black_player_id
                   WHERE g.round_id = %s ORDER BY g.id ASC""",
                (round_id,)
            )
            games = []
            for g in cur.fetchall():
                games.append({
                    'id': g[0], 'white_player_id': g[1], 'white_fio': g[2],
                    'black_player_id': g[3], 'black_fio': g[4], 'is_bye': g[5],
                    'status': g[6], 'result': g[7],
                })
                if my_player_id and g[6] != 'finished' and (g[1] == my_player_id or g[3] == my_player_id):
                    my_game_id = g[0]
            rounds.append({
                'round_number': round_number, 'status': r_status,
                'started_at': str(started_at) if started_at else None,
                'completed_at': str(completed_at) if completed_at else None,
                'games': games,
            })

        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'tournament': tournament, 'players': players, 'rounds': rounds,
            'my_player_id': my_player_id, 'my_game_id': my_game_id,
            'next_round_at': next_round_at,
            'pusher_key': os.environ.get('PUSHER_KEY', ''),
            'pusher_cluster': os.environ.get('PUSHER_CLUSTER', 'eu'),
        })}

    if method == 'POST' and action == 'start':
        if not is_admin:
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}
        tournament_id = body.get('tournament_id')
        tournament = get_tournament(cur, tournament_id)
        if not tournament:
            conn.close()
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир не найден'})}
        if tournament['hall_status'] != 'not_started':
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Турнир уже запущен'})}

        cur.execute(
            "SELECT id, user_id, fio FROM applications WHERE tournament_id = %s AND status = 'paid'",
            (tournament_id,)
        )
        paid_apps = cur.fetchall()
        if len(paid_apps) < 2:
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недостаточно оплаченных участников (нужно минимум 2)'})}

        for app_id, user_id, fio in paid_apps:
            cur.execute(
                """INSERT INTO tournament_players (tournament_id, user_id, application_id, fio, rating)
                   VALUES (%s, %s, %s, %s, 1200)
                   ON CONFLICT (tournament_id, application_id) DO NOTHING""",
                (tournament_id, user_id, app_id, fio)
            )

        cur.execute("UPDATE tournaments SET hall_status = 'active' WHERE id = %s", (tournament_id,))
        conn.commit()
        tournament = get_tournament(cur, tournament_id)
        round_id = start_next_round(cur, tournament, 1)
        conn.commit()
        conn.close()
        if not round_id:
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не удалось создать пары'})}
        trigger(f'tournament-{tournament_id}', 'round-started', {'round_number': 1})
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    conn.close()
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}