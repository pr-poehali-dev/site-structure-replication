import json
import os
import re
import urllib.request
import psycopg2

LILA_ORIGIN = 'https://play.' + 'мир-шахмат.рф'.encode('idna').decode()


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def resp(status: int, body) -> dict:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    """Возвращает ФИО, аватар и id профиля игроков по их логинам в Lila (параметр usernames через запятую)."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    params = event.get('queryStringParameters') or {}
    sheets_ref = (params.get('sheets') or '').strip()
    if sheets_ref:
        if not re.fullmatch(r'[A-Za-z0-9]{8}', sheets_ref):
            return resp(400, {'error': 'bad tournament id'})
        sheets = {}
        for page in range(1, 31):
            req = urllib.request.Request(
                f'{LILA_ORIGIN}/swiss/{sheets_ref}/standing/{page}',
                headers={'Accept': 'application/json'},
            )
            with urllib.request.urlopen(req, timeout=4) as r:
                data = json.loads(r.read().decode('utf-8'))
            batch = data.get('players') or []
            if not batch:
                break
            for pl in batch:
                name = ((pl.get('user') or {}).get('name') or '').lower()
                if name:
                    sheets[name] = (pl.get('sheetMin') or '').split('|')
            if len(batch) < 10:
                break
        return resp(200, {'sheets': sheets})

    raw = params.get('usernames') or ''
    names = sorted({n.strip().lower() for n in raw.split(',') if n.strip()})[:200]
    if not names:
        return resp(400, {'error': 'usernames required'})

    conn = get_conn()
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(names))
    cur.execute(
        f"""SELECT id, lower(lila_username), last_name, first_name, avatar_url, birth_date
            FROM users WHERE lower(lila_username) IN ({placeholders})""",
        names,
    )
    players = {}
    births = {}
    for uid, uname, last_name, first_name, avatar, birth in cur.fetchall():
        fio = ' '.join(p for p in [last_name, first_name] if p)
        players[uname] = {'user_id': uid, 'fio': fio or None, 'avatar_url': avatar, 'age': None}
        births[uname] = birth
    tournament_ref = (params.get('tournament') or '').strip()
    if tournament_ref and players:
        cur.execute(
            "SELECT date FROM tournaments WHERE lila_tournament_id = %s",
            (tournament_ref,),
        )
        row = cur.fetchone()
        t_date = row[0] if row else None
        if t_date:
            for uname, birth in births.items():
                if birth:
                    players[uname]['age'] = t_date.year - birth.year - ((t_date.month, t_date.day) < (birth.month, birth.day))
    if tournament_ref and players:
        cur.execute(
            """SELECT rh.user_id, rh.delta FROM rating_history rh
               JOIN tournaments t ON t.id = rh.tournament_id
               WHERE t.lila_tournament_id = %s""",
            (tournament_ref,),
        )
        delta_by_user = {r[0]: float(r[1]) for r in cur.fetchall()}
        for info in players.values():
            info['rating_delta'] = delta_by_user.get(info['user_id'])
    cur.close()
    conn.close()
    return resp(200, {'players': players})
