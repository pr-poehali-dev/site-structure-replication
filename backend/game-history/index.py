import json
import os
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import psycopg2

LILA = 'https://' + 'play.мир-шахмат.рф'.encode('idna').decode()

REASON_MAP = {
    'mate': 'checkmate',
    'resign': 'resignation',
    'stalemate': 'stalemate',
    'timeout': 'timeout',
    'outoftime': 'timeout',
    'draw': 'draw_agreed',
    'noStart': 'first_move_timeout',
}


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


def fetch_lila_games(kind: str, lila_id: str, username: str) -> list:
    path = 'tournament' if kind == 'arena' else 'swiss'
    query = urllib.parse.urlencode({'player': username, 'moves': 'true', 'lastFen': 'true', 'clocks': 'false', 'opening': 'false'})
    req = urllib.request.Request(
        f'{LILA}/api/{path}/{lila_id}/games?{query}',
        headers={'Accept': 'application/x-ndjson', 'User-Agent': 'Mozilla/5.0 (mir-shakhmat)'},
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as r:
            text = r.read().decode('utf-8')
    except Exception as e:
        print(f'lila games fetch failed {path}/{lila_id}: {e}')
        return []
    games = []
    for line in text.split('\n'):
        line = line.strip()
        if line:
            try:
                games.append(json.loads(line))
            except ValueError:
                pass
    return games


def build_lila_items(cur, user_id: int, username: str) -> list:
    cur.execute(
        "SELECT id, title, rating_type, lila_tournament_id, COALESCE(lila_tournament_kind, 'swiss') FROM tournaments WHERE lila_tournament_id IS NOT NULL ORDER BY id DESC LIMIT 20"
    )
    tournaments = cur.fetchall()
    if not tournaments:
        return []

    with ThreadPoolExecutor(max_workers=6) as pool:
        fetched = list(pool.map(lambda t: fetch_lila_games(t[4], str(t[3]), username), tournaments))

    me = username.lower()
    raw = []
    opponent_names = set()
    for t, games in zip(tournaments, fetched):
        for index, g in enumerate(reversed(games), start=1):
            players = g.get('players') or {}
            white = (players.get('white') or {}).get('user') or {}
            black = (players.get('black') or {}).get('user') or {}
            if (white.get('id') or '').lower() == me:
                my_color, opp = 'white', black
            elif (black.get('id') or '').lower() == me:
                my_color, opp = 'black', white
            else:
                continue
            if opp.get('name'):
                opponent_names.add(opp['name'].lower())
            raw.append((t, index, g, my_color, opp))

    fio_by_name = {}
    if opponent_names:
        cur.execute(
            "SELECT lower(lila_username), last_name, first_name FROM users WHERE lower(lila_username) = ANY(%s)",
            (list(opponent_names),)
        )
        for uname, last_name, first_name in cur.fetchall():
            fio_by_name[uname] = f"{last_name or ''} {first_name or ''}".strip()

    items = []
    for t, index, g, my_color, opp in raw:
        winner = g.get('winner')
        if winner == 'white':
            result = '1-0'
        elif winner == 'black':
            result = '0-1'
        else:
            result = '1/2-1/2'
        if result == '1-0':
            outcome = 'win' if my_color == 'white' else 'loss'
        elif result == '0-1':
            outcome = 'win' if my_color == 'black' else 'loss'
        else:
            outcome = 'draw'
        moves = (g.get('moves') or '').split()
        opp_name = (opp.get('name') or '')
        finished_ms = g.get('lastMoveAt') or g.get('createdAt')
        started_ms = g.get('createdAt')
        items.append({
            'id': f"lila-{g['id']}",
            'source': 'lila',
            'lila_url': f"{LILA}/{g['id']}",
            'tournament_id': t[0],
            'tournament_title': t[1],
            'round_number': index,
            'rating_type': t[2] or ('blitz' if g.get('speed') in ('blitz', 'bullet') else 'rapid'),
            'my_color': my_color,
            'opponent_fio': fio_by_name.get(opp_name.lower()) or opp_name or None,
            'result': result,
            'result_reason': REASON_MAP.get(g.get('status') or ''),
            'outcome': outcome,
            'fen': g.get('lastFen') or 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves_count': len(moves),
            'finished_at': datetime_from_ms(finished_ms),
            'started_at': datetime_from_ms(started_ms),
        })
    return items


def datetime_from_ms(ms):
    if not ms:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S')


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

    cur.execute("SELECT lila_username FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    lila_username = row[0] if row else None
    lila_items = build_lila_items(cur, user_id, lila_username) if lila_username else []

    cur.execute("SELECT id FROM tournament_players WHERE user_id = %s", (user_id,))
    player_ids = [r[0] for r in cur.fetchall()]
    if not player_ids:
        conn.close()
        lila_items.sort(key=lambda g: g['finished_at'] or '', reverse=True)
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'games': lila_items})}

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

    games.extend(lila_items)
    games.sort(key=lambda g: g['finished_at'] or '', reverse=True)
    return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'games': games})}
