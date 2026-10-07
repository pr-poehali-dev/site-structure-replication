import json
import urllib.request

LILA = 'https://' + 'play.мир-шахмат.рф'.encode('idna').decode()


def _request(path, data=None, accept='application/json'):
    req = urllib.request.Request(LILA + path, data=data, headers={'Accept': accept, 'User-Agent': 'Mozilla/5.0 (mir-shakhmat)'})
    with urllib.request.urlopen(req, timeout=8) as r:
        return r.read().decode('utf-8')


def recalc_from_lila(cur, tournament_id, title, rating_type, lila_id, kind):
    """Читает рейтинги блица и рапида участников турнира из Lila, записывает их как рейтинг МШ
    и сохраняет изменение в rating_history (рейтинг «до» фиксируется при первом пересчёте)."""
    path = f'/api/tournament/{lila_id}/results' if kind == 'arena' else f'/api/swiss/{lila_id}/results'
    results = [json.loads(l) for l in _request(path, accept='application/x-ndjson').split('\n') if l.strip()]
    names = [r['username'] for r in results][:300]
    if not names:
        return {'players': 0, 'updated': 0, 'skipped': 0}
    points = {r['username'].lower(): r.get('score', r.get('points', 0)) for r in results}

    ratings = {}
    for u in json.loads(_request('/api/users', data=','.join(names).encode('utf-8'))):
        perfs = u.get('perfs') or {}
        ratings[u['id'].lower()] = {
            'blitz': (perfs.get('blitz') or {}).get('rating'),
            'rapid': (perfs.get('rapid') or {}).get('rating'),
        }

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
        cur.execute("UPDATE users SET rating_blitz = %s, rating_rapid = %s WHERE id = %s", (new_blitz, new_rapid, user_id))

        old = old_blitz if rating_type == 'blitz' else old_rapid
        after = new_blitz if rating_type == 'blitz' else new_rapid
        if after is None:
            continue
        before = old if old is not None else after
        cur.execute(
            """INSERT INTO rating_history
               (user_id, tournament_id, tournament_title, rating_type, rating_before, rating_after, delta, points, expected_points, games_count)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, 0)
               ON CONFLICT (user_id, tournament_id) DO UPDATE SET
                 rating_after = EXCLUDED.rating_after,
                 delta = EXCLUDED.rating_after - rating_history.rating_before,
                 points = EXCLUDED.points,
                 rating_type = EXCLUDED.rating_type""",
            (user_id, tournament_id, title, rating_type, before, after, after - before, points.get(uname, 0)),
        )
        updated += 1
    return {'players': len(names), 'updated': updated, 'skipped': len(names) - updated}
