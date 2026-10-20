import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import psycopg2

LILA_ORIGIN = 'https://play.' + 'мир-шахмат.рф'.encode('idna').decode()


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def resp(status: int, body, cache: int = 0) -> dict:
    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
    if cache and status == 200:
        headers['Cache-Control'] = f'public, max-age={cache}'
    return {
        'statusCode': status,
        'headers': headers,
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
        def fetch_page(page):
            req = urllib.request.Request(
                f'{LILA_ORIGIN}/swiss/{sheets_ref}/standing/{page}',
                headers={'Accept': 'application/json'},
            )
            try:
                with urllib.request.urlopen(req, timeout=4) as r:
                    return json.loads(r.read().decode('utf-8')).get('players') or []
            except Exception:
                return []

        sheets = {}
        for start in range(1, 31, 5):
            with ThreadPoolExecutor(max_workers=5) as ex:
                batches = list(ex.map(fetch_page, range(start, start + 5)))
            done = False
            for batch in batches:
                for pl in batch:
                    name = ((pl.get('user') or {}).get('name') or '').lower()
                    if name:
                        sheets[name] = (pl.get('sheetMin') or '').split('|')
                if len(batch) < 10:
                    done = True
                    break
            if done:
                break
        return resp(200, {'sheets': sheets}, 5)

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
            "SELECT id, date FROM tournaments WHERE lila_tournament_id = %s LIMIT 1",
            (tournament_ref,),
        )
        row = cur.fetchone()
        t_id = row[0] if row else None
        t_date = row[1] if row else None
        if t_date:
            for uname, birth in births.items():
                if birth:
                    players[uname]['age'] = t_date.year - birth.year - ((t_date.month, t_date.day) < (birth.month, birth.day))
        if t_id:
            cur.execute("SELECT user_id, delta FROM rating_history WHERE tournament_id = %s", (t_id,))
            delta_by_user = {r[0]: float(r[1]) for r in cur.fetchall()}
            for info in players.values():
                info['rating_delta'] = delta_by_user.get(info['user_id'])
    cur.close()
    conn.close()
    return resp(200, {'players': players}, 10)
