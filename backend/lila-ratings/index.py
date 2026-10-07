import json
import os
import urllib.request
import psycopg2

LILA = 'https://' + 'play.мир-шахмат.рф'.encode('idna').decode()
MAX_TOURNAMENTS_PER_CALL = 2


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def resp(status: int, body) -> dict:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, ensure_ascii=False),
    }


def lila_request(path: str, data: bytes = None, accept: str = 'application/json'):
    req = urllib.request.Request(LILA + path, data=data, headers={'Accept': accept})
    with urllib.request.urlopen(req, timeout=8) as r:
        return r.read().decode('utf-8')


def is_finished(lila_id: str, kind: str) -> bool:
    if kind == 'arena':
        info = json.loads(lila_request(f'/api/tournament/{lila_id}'))
        return bool(info.get('isFinished'))
    info = json.loads(lila_request(f'/api/swiss/{lila_id}'))
    return info.get('status') == 'finished'


def load_results(lila_id: str, kind: str):
    path = f'/api/tournament/{lila_id}/results' if kind == 'arena' else f'/api/swiss/{lila_id}/results'
    text = lila_request(path, accept='application/x-ndjson')
    return [json.loads(l) for l in text.split('\n') if l.strip()]


def load_ratings(usernames):
    text = lila_request('/api/users', data=','.join(usernames).encode('utf-8'))
    out = {}
    for u in json.loads(text):
        perfs = u.get('perfs') or {}
        out[u['id'].lower()] = {
            'blitz': (perfs.get('blitz') or {}).get('rating'),
            'rapid': (perfs.get('rapid') or {}).get('rating'),
        }
    return out


def sync_tournament(cur, tournament_id, title, rating_type, lila_id, kind):
    results = load_results(lila_id, kind)
    names = [r['username'] for r in results][:300]
    if not names:
        return 0
    ratings = load_ratings(names)
    points_by_name = {r['username'].lower(): r.get('points', 0) for r in results}

    placeholders = ','.join(['%s'] * len(names))
    cur.execute(
        f"SELECT id, lower(lila_username), rating_blitz, rating_rapid FROM users WHERE lower(lila_username) IN ({placeholders})",
        [n.lower() for n in names],
    )
    updated = 0
    for user_id, uname, old_blitz, old_rapid in cur.fetchall():
        new = ratings.get(uname)
        if not new:
            continue
        new_blitz = new['blitz'] if new['blitz'] is not None else old_blitz
        new_rapid = new['rapid'] if new['rapid'] is not None else old_rapid
        cur.execute(
            "UPDATE users SET rating_blitz = %s, rating_rapid = %s WHERE id = %s",
            (new_blitz, new_rapid, user_id),
        )
        old = old_blitz if rating_type == 'blitz' else old_rapid
        after = new_blitz if rating_type == 'blitz' else new_rapid
        if after is not None:
            before = old if old is not None else after
            cur.execute(
                """INSERT INTO rating_history
                   (user_id, tournament_id, tournament_title, rating_type, rating_before, rating_after, delta, points, expected_points, games_count)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, 0)
                   ON CONFLICT (user_id, tournament_id) DO NOTHING""",
                (user_id, tournament_id, title, rating_type, before, after, after - before, points_by_name.get(uname, 0)),
            )
        updated += 1
    return updated


def handler(event: dict, context) -> dict:
    """После завершения турнира в Lila считывает рейтинги блица и рапида участников и записывает их вместо рейтинга МШ."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, title, rating_type, lila_tournament_id, COALESCE(lila_tournament_kind, 'swiss')
           FROM tournaments
           WHERE lila_tournament_id IS NOT NULL AND lila_ratings_synced_at IS NULL
           ORDER BY id LIMIT %s""",
        (MAX_TOURNAMENTS_PER_CALL,),
    )
    pending = cur.fetchall()

    synced = []
    for tournament_id, title, rating_type, lila_id, kind in pending:
        try:
            if not is_finished(lila_id, kind):
                continue
            count = sync_tournament(cur, tournament_id, title, rating_type or 'rapid', lila_id, kind)
            cur.execute("UPDATE tournaments SET lila_ratings_synced_at = now() WHERE id = %s", (tournament_id,))
            conn.commit()
            synced.append({'tournament_id': tournament_id, 'players_updated': count})
        except Exception as e:
            conn.rollback()
            print(f'lila-ratings: tournament {tournament_id} failed: {e}')

    cur.close()
    conn.close()
    return resp(200, {'checked': len(pending), 'synced': synced})
