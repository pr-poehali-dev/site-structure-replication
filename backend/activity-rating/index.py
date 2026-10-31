import json
import os
from datetime import date

import psycopg2

TYPE_POINTS = {'warmup': 1, 'training': 2}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }


def collect_participation(cur):
    """Возвращает {(tournament_id, user_id): (очки, дата турнира)}.
    Источники: опубликованные электронные результаты и завершённые турниры зала; один турнир учитывается один раз."""
    cur.execute("SELECT id, tournament_type, date, created_at FROM tournaments")
    info = {}
    for tid, ttype, tdate, created in cur.fetchall():
        info[tid] = (TYPE_POINTS.get(ttype, 3), tdate)

    part = {}

    cur.execute("SELECT tournament_id, snapshot, published_at FROM electronic_results WHERE status = 'published' AND snapshot IS NOT NULL")
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
        """SELECT DISTINCT tp.tournament_id, tp.user_id
           FROM tournament_players tp JOIN tournaments t ON t.id = tp.tournament_id
           WHERE t.hall_status = 'finished' AND tp.user_id IS NOT NULL"""
    )
    for tid, uid in cur.fetchall():
        if (tid, uid) not in part and tid in info:
            pts, tdate = info[tid]
            part[(tid, uid)] = (pts, tdate)
    cur.execute("SELECT user_id, awarded_at FROM avatar_bonuses")
    for uid, awarded_at in cur.fetchall():
        part[('avatar', uid)] = (1, awarded_at.date())
    return part


def build_ranking(part, period):
    today = date.today()
    totals = {}
    for (tid, uid), (pts, when) in part.items():
        if period == 'month' and not (when and when.year == today.year and when.month == today.month):
            continue
        cur_pts, cnt = totals.get(uid, (0, 0))
        totals[uid] = (cur_pts + pts, cnt + (0 if tid == 'avatar' else 1))
    ordered = sorted(totals.items(), key=lambda x: (-x[1][0], -x[1][1], x[0]))
    ranking = []
    prev_key, place = None, 0
    for i, (uid, (pts, cnt)) in enumerate(ordered, start=1):
        if (pts, cnt) != prev_key:
            place = i
            prev_key = (pts, cnt)
        ranking.append({'user_id': uid, 'points': pts, 'tournaments': cnt, 'place': place})
    return ranking


def handler(event: dict, context) -> dict:
    """Рейтинг активности: очки за турниры (разминочный 1, тренировочный 2, квалификационный 3) по результатам турниров.
    period=all|month. Без user_id — топ (limit, по умолчанию 10; all=1 — все). С user_id — очки и место игрока."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    params = event.get('queryStringParameters') or {}
    period = 'month' if params.get('period') == 'month' else 'all'
    conn = get_conn()
    cur = conn.cursor()

    rating_kind = params.get('rating')
    if rating_kind in ('blitz', 'rapid'):
        col = 'rating_blitz' if rating_kind == 'blitz' else 'rating_rapid'
        ids = sorted({uid for (tid, uid) in collect_participation(cur) if tid != 'avatar'})
        players = []
        if ids:
            id_list = ','.join(str(i) for i in ids)
            cur.execute(f"SELECT id, last_name, first_name, avatar_url, {col} FROM users WHERE id IN ({id_list}) AND {col} IS NOT NULL ORDER BY {col} DESC, last_name, first_name")
            rows = cur.fetchall()
            prev, place = None, 0
            for i, r in enumerate(rows, start=1):
                if r[4] != prev:
                    place, prev = i, r[4]
                players.append({'user_id': r[0], 'points': int(r[4]), 'tournaments': 0, 'place': place,
                                'last_name': r[1], 'first_name': r[2], 'avatar_url': r[3]})
        conn.close()
        total = len(players)
        if params.get('all') != '1':
            limit = params.get('limit') or '10'
            players = players[:max(1, min(int(limit) if limit.isdigit() else 10, 100))]
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Cache-Control': 'public, max-age=30'}, 'body': json.dumps({'players': players, 'total': total})}
    ranking = build_ranking(collect_participation(cur), period)

    user_id = (params.get('user_id') or '').strip()
    if user_id:
        if not user_id.isdigit():
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Некорректный user_id'})}
        mine = next((r for r in ranking if r['user_id'] == int(user_id)), None)
        conn.close()
        body = {'points': mine['points'], 'tournaments': mine['tournaments'], 'place': mine['place']} if mine else {'points': 0, 'tournaments': 0, 'place': None}
        body['total_players'] = len(ranking)
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Cache-Control': 'public, max-age=30'}, 'body': json.dumps(body)}

    if params.get('all') != '1':
        limit = params.get('limit') or '10'
        limit = max(1, min(int(limit) if limit.isdigit() else 10, 100))
        shown = ranking[:limit]
    else:
        shown = ranking

    users = {}
    if shown:
        ids = ','.join(str(r['user_id']) for r in shown)
        cur.execute(f"SELECT id, last_name, first_name, avatar_url FROM users WHERE id IN ({ids})")
        users = {r[0]: r for r in cur.fetchall()}
    conn.close()

    players = []
    for r in shown:
        u = users.get(r['user_id'])
        if not u:
            continue
        players.append({**r, 'last_name': u[1], 'first_name': u[2], 'avatar_url': u[3]})
    return {'statusCode': 200, 'headers': {**cors_headers(), 'Cache-Control': 'public, max-age=30'}, 'body': json.dumps({'players': players, 'total': len(ranking)})}
