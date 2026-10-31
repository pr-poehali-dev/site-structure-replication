import json
import os
from datetime import date

import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p58220589_site_structure_repli')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
TYPE_POINTS = {'warmup': 1, 'training': 2}


def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
        'Content-Type': 'application/json',
    }


def resp(code, data):
    return {'statusCode': code, 'headers': cors(), 'body': json.dumps(data, default=str)}


def collect_participation(cur):
    """Возвращает {(tournament_id, user_id): (очки, дата турнира)} так же, как рейтинг активности."""
    cur.execute(f"SELECT id, tournament_type, date FROM {SCHEMA}.tournaments")
    info = {tid: (TYPE_POINTS.get(ttype, 3), tdate) for tid, ttype, tdate in cur.fetchall()}
    part = {}
    cur.execute(f"SELECT tournament_id, snapshot, published_at FROM {SCHEMA}.electronic_results WHERE status = 'published' AND snapshot IS NOT NULL")
    for tid, snapshot, published_at in cur.fetchall():
        if tid not in info:
            continue
        pts, tdate = info[tid]
        when = tdate or (published_at.date() if published_at else None)
        try:
            rows = json.loads(snapshot).get('overall') or []
        except (ValueError, AttributeError):
            continue
        for r in rows:
            uid = r.get('user_id')
            if uid:
                part[(tid, int(uid))] = (pts, when)
    cur.execute(
        f"""SELECT DISTINCT tp.tournament_id, tp.user_id
            FROM {SCHEMA}.tournament_players tp JOIN {SCHEMA}.tournaments t ON t.id = tp.tournament_id
            WHERE t.hall_status = 'finished' AND tp.user_id IS NOT NULL"""
    )
    for tid, uid in cur.fetchall():
        if (tid, uid) not in part and tid in info:
            part[(tid, uid)] = info[tid]
    cur.execute(f"SELECT user_id, awarded_at FROM {SCHEMA}.avatar_bonuses")
    for uid, awarded_at in cur.fetchall():
        part[('avatar', uid)] = (1, awarded_at.date())
    return part


def month_ranking(part, month):
    totals = {}
    for (tid, uid), (pts, when) in part.items():
        if not when or when.strftime('%Y-%m') != month:
            continue
        p, c = totals.get(uid, (0, 0))
        totals[uid] = (p + pts, c + (0 if tid == 'avatar' else 1))
    ordered = sorted(totals.items(), key=lambda x: (-x[1][0], -x[1][1], x[0]))
    out, prev, place = [], None, 0
    for i, (uid, (p, c)) in enumerate(ordered, start=1):
        if (p, c) != prev:
            place, prev = i, (p, c)
        out.append({'user_id': uid, 'points': p, 'tournaments': c, 'rank': place})
    return out


def valid_month(m):
    return isinstance(m, str) and len(m) == 7 and m[4] == '-' and m[:4].isdigit() and m[5:].isdigit() and 1 <= int(m[5:]) <= 12


def handler(event: dict, context) -> dict:
    """Награды «Активист месяца»: админ видит рейтинг активности по месяцам и выбирает призёров (1-3 места, по несколько человек);
    пользователь с X-Auth-Token получает список своих наград для скачивания грамот."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers', {}) or {}
    admin_pw = headers.get('X-Admin-Password') or headers.get('x-admin-password', '')
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')
    params = event.get('queryStringParameters') or {}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if admin_pw and ADMIN_PASSWORD and admin_pw == ADMIN_PASSWORD:
        if method == 'GET':
            part = collect_participation(cur)
            months = sorted({w.strftime('%Y-%m') for (_, w) in part.values() if w}, reverse=True)
            cur.execute(f"SELECT DISTINCT month FROM {SCHEMA}.activist_awards")
            months = sorted(set(months) | {r[0] for r in cur.fetchall()}, reverse=True)
            month = params.get('month') or (months[0] if months else date.today().strftime('%Y-%m'))
            if not valid_month(month):
                conn.close()
                return resp(400, {'error': 'Некорректный месяц'})
            ranking = month_ranking(part, month)
            ids = [r['user_id'] for r in ranking]
            users = {}
            if ids:
                cur.execute(f"SELECT id, last_name, first_name, institution, avatar_url FROM {SCHEMA}.users WHERE id IN ({','.join(str(int(i)) for i in ids)})")
                users = {r[0]: r for r in cur.fetchall()}
            players = []
            for r in ranking:
                u = users.get(r['user_id'])
                if u:
                    players.append({**r, 'last_name': u[1], 'first_name': u[2], 'institution': u[3], 'avatar_url': u[4]})
            cur.execute(f"SELECT user_id, place FROM {SCHEMA}.activist_awards WHERE month = %s", (month,))
            awarded = {r[0]: r[1] for r in cur.fetchall()}
            conn.close()
            return resp(200, {'month': month, 'months': months, 'players': players, 'awarded': awarded})

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            month = body.get('month')
            if not valid_month(month):
                conn.close()
                return resp(400, {'error': 'Некорректный месяц'})
            picks = body.get('awards') or {}
            chosen = {}
            for place in (1, 2, 3):
                for uid in picks.get(str(place), []) or []:
                    if isinstance(uid, int) and uid not in chosen:
                        chosen[uid] = place
            ranking = {r['user_id']: r for r in month_ranking(collect_participation(cur), month)}
            cur.execute(f"DELETE FROM {SCHEMA}.activist_awards WHERE month = %s", (month,))
            for uid, place in chosen.items():
                r = ranking.get(uid, {'points': 0, 'tournaments': 0})
                cur.execute(
                    f"INSERT INTO {SCHEMA}.activist_awards (user_id, month, place, points, tournaments) VALUES (%s, %s, %s, %s, %s)",
                    (uid, month, place, r['points'], r['tournaments']),
                )
            conn.commit()
            conn.close()
            return resp(200, {'ok': True, 'saved': len(chosen)})

    if method == 'GET' and token:
        cur.execute(f"SELECT user_id FROM {SCHEMA}.user_sessions WHERE token = %s AND expires_at > now()", (token,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return resp(401, {'error': 'Не авторизован'})
        cur.execute(
            f"SELECT month, place, points, tournaments, created_at FROM {SCHEMA}.activist_awards WHERE user_id = %s ORDER BY month DESC",
            (row[0],),
        )
        awards = [{'month': r[0], 'place': r[1], 'points': r[2], 'tournaments': r[3], 'created_at': r[4]} for r in cur.fetchall()]
        conn.close()
        return resp(200, {'awards': awards})

    conn.close()
    return resp(401, {'error': 'Unauthorized'})
