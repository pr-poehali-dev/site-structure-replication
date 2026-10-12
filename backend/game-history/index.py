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


REFRESH_MINUTES = 5
MAX_SYNC_PER_REQUEST = 3


def lila_get(path: str, accept: str = 'application/json') -> str:
    req = urllib.request.Request(
        f'{LILA}{path}',
        headers={'Accept': accept, 'User-Agent': 'Mozilla/5.0 (mir-shakhmat)'},
    )
    with urllib.request.urlopen(req, timeout=4) as r:
        return r.read().decode('utf-8')


def fetch_tournament(kind: str, lila_id: str):
    path = 'tournament' if kind == 'arena' else 'swiss'
    try:
        info = json.loads(lila_get(f'/api/{path}/{lila_id}'))
        finished = bool(info.get('isFinished')) if kind == 'arena' else info.get('status') == 'finished'
        query = urllib.parse.urlencode({'moves': 'true', 'lastFen': 'true', 'clocks': 'false', 'opening': 'false'})
        text = lila_get(f'/api/{path}/{lila_id}/games?{query}', 'application/x-ndjson')
    except Exception as e:
        print(f'lila sync failed {path}/{lila_id}: {e}')
        return None
    games = []
    for line in text.split('\n'):
        line = line.strip()
        if line:
            try:
                games.append(json.loads(line))
            except ValueError:
                pass
    return finished, games


def sync_tournaments(cur, conn, tournaments):
    cur.execute(
        "SELECT tournament_id, is_finished, synced_at > now() - make_interval(mins => %s) FROM lila_tournament_sync WHERE tournament_id = ANY(%s)",
        (REFRESH_MINUTES, [t[0] for t in tournaments])
    )
    state = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    stale = []
    for t in tournaments:
        finished, fresh = state.get(t[0], (False, False))
        if t[0] in state and (finished or fresh):
            continue
        stale.append((t, t[0] not in state))
    stale.sort(key=lambda x: not x[1])
    stale = [t for t, _ in stale[:MAX_SYNC_PER_REQUEST]]
    if not stale:
        return

    with ThreadPoolExecutor(max_workers=MAX_SYNC_PER_REQUEST) as pool:
        fetched = list(pool.map(lambda t: fetch_tournament(t[4], str(t[3])), stale))

    for t, res in zip(stale, fetched):
        if res is None:
            continue
        finished, games = res
        for g in games:
            players = g.get('players') or {}
            white = ((players.get('white') or {}).get('user') or {}).get('id')
            black = ((players.get('black') or {}).get('user') or {}).get('id')
            if not g.get('id') or not white or not black:
                continue
            cur.execute(
                """INSERT INTO lila_games (game_id, tournament_id, white_username, black_username, winner, status, speed, moves_count, last_fen, created_at_ms, last_move_ms)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (game_id) DO UPDATE SET
                     winner = EXCLUDED.winner, status = EXCLUDED.status, moves_count = EXCLUDED.moves_count,
                     last_fen = EXCLUDED.last_fen, last_move_ms = EXCLUDED.last_move_ms""",
                (g['id'], t[0], white, black, g.get('winner'), g.get('status'), g.get('speed'),
                 len((g.get('moves') or '').split()), g.get('lastFen'), g.get('createdAt'), g.get('lastMoveAt'))
            )
        cur.execute(
            """INSERT INTO lila_tournament_sync (tournament_id, synced_at, is_finished) VALUES (%s, now(), %s)
               ON CONFLICT (tournament_id) DO UPDATE SET synced_at = now(), is_finished = EXCLUDED.is_finished""",
            (t[0], finished)
        )
    conn.commit()


def build_lila_items(cur, conn, user_id: int, username: str) -> list:
    cur.execute(
        "SELECT id, title, rating_type, lila_tournament_id, COALESCE(lila_tournament_kind, 'swiss') FROM tournaments WHERE lila_tournament_id IS NOT NULL ORDER BY id DESC LIMIT 20"
    )
    tournaments = cur.fetchall()
    if not tournaments:
        return []

    sync_tournaments(cur, conn, tournaments)

    me = username.lower()
    by_id = {t[0]: t for t in tournaments}
    cur.execute(
        """SELECT game_id, tournament_id, white_username, black_username, winner, status, speed, moves_count, last_fen, created_at_ms, last_move_ms
           FROM lila_games
           WHERE tournament_id = ANY(%s) AND (lower(white_username) = %s OR lower(black_username) = %s)
           ORDER BY tournament_id, created_at_ms""",
        (list(by_id.keys()), me, me)
    )
    rows = cur.fetchall()

    opponent_names = set()
    for r in rows:
        opp = r[3] if (r[2] or '').lower() == me else r[2]
        if opp:
            opponent_names.add(opp.lower())
    fio_by_name = {}
    if opponent_names:
        cur.execute(
            "SELECT lower(lila_username), last_name, first_name FROM users WHERE lower(lila_username) = ANY(%s)",
            (list(opponent_names),)
        )
        for uname, last_name, first_name in cur.fetchall():
            fio_by_name[uname] = f"{last_name or ''} {first_name or ''}".strip()

    items = []
    round_counter = {}
    for game_id, tournament_id, white, black, winner, status, speed, moves_count, last_fen, created_ms, last_ms in rows:
        t = by_id[tournament_id]
        round_counter[tournament_id] = round_counter.get(tournament_id, 0) + 1
        my_color = 'white' if (white or '').lower() == me else 'black'
        opp_name = black if my_color == 'white' else white
        result = '1-0' if winner == 'white' else '0-1' if winner == 'black' else '1/2-1/2'
        if result == '1/2-1/2':
            outcome = 'draw'
        else:
            outcome = 'win' if (result == '1-0') == (my_color == 'white') else 'loss'
        items.append({
            'id': f"lila-{game_id}",
            'source': 'lila',
            'lila_url': f"{LILA}/{game_id}",
            'tournament_id': tournament_id,
            'tournament_title': t[1],
            'round_number': round_counter[tournament_id],
            'rating_type': t[2] or ('blitz' if speed in ('blitz', 'bullet') else 'rapid'),
            'my_color': my_color,
            'opponent_fio': fio_by_name.get((opp_name or '').lower()) or opp_name or None,
            'result': result,
            'result_reason': REASON_MAP.get(status or ''),
            'outcome': outcome,
            'fen': last_fen or 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves_count': moves_count,
            'finished_at': datetime_from_ms(last_ms or created_ms),
            'started_at': datetime_from_ms(created_ms),
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
    lila_items = build_lila_items(cur, conn, user_id, lila_username) if lila_username else []

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
