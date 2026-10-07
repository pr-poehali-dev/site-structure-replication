import json
import os
import psycopg2


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
    raw = params.get('usernames') or ''
    names = sorted({n.strip().lower() for n in raw.split(',') if n.strip()})[:200]
    if not names:
        return resp(400, {'error': 'usernames required'})

    conn = get_conn()
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(names))
    cur.execute(
        f"""SELECT id, lower(lila_username), last_name, first_name, avatar_url
            FROM users WHERE lower(lila_username) IN ({placeholders})""",
        names,
    )
    players = {}
    for uid, uname, last_name, first_name, avatar in cur.fetchall():
        fio = ' '.join(p for p in [last_name, first_name] if p)
        players[uname] = {'user_id': uid, 'fio': fio or None, 'avatar_url': avatar}
    tournament_ref = (params.get('tournament') or '').strip()
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
