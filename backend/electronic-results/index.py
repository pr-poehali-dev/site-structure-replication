import base64
import json
import os
import re
import uuid
import urllib.request
from datetime import date, datetime

import boto3
import psycopg2

LILA = 'https://' + 'play.мир-шахмат.рф'.encode('idna').decode()
KINDS = {'best_mate': 1, 'beautiful_mate': 3, 'best_woman': 3}
PROTOCOL_USER = '_tournament'
FILE_KINDS = ['protocol', 'diploma', 'diploma_template', 'thanks', 'nom_best_mate', 'nom_beautiful_mate', 'nom_best_woman']
ALLOWED_TYPES = {'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg'}


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def load_files(cur, tid, username=None):
    if username:
        cur.execute(
            "SELECT username, kind, file_url, file_name FROM electronic_result_files WHERE tournament_id = %s AND lower(username) = lower(%s)",
            (tid, username),
        )
    else:
        cur.execute("SELECT username, kind, file_url, file_name FROM electronic_result_files WHERE tournament_id = %s", (tid,))
    return [{'username': r[0], 'kind': r[1], 'file_url': r[2], 'file_name': r[3]} for r in cur.fetchall()]


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def resp(status, body, cache=0):
    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
    if cache and status == 200:
        headers['Cache-Control'] = f'public, max-age={cache}'
    return {
        'statusCode': status,
        'headers': headers,
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def is_admin(event):
    headers = event.get('headers') or {}
    pwd = headers.get('X-Admin-Password') or headers.get('x-admin-password')
    return bool(pwd) and pwd == os.environ.get('ADMIN_PASSWORD')


def lila_results(lila_id, kind):
    path = f'/api/tournament/{lila_id}/results' if kind == 'arena' else f'/api/swiss/{lila_id}/results'
    req = urllib.request.Request(LILA + path, headers={'Accept': 'application/x-ndjson', 'User-Agent': 'Mozilla/5.0 (mir-shakhmat)'})
    with urllib.request.urlopen(req, timeout=8) as r:
        text = r.read().decode('utf-8')
    return [json.loads(l) for l in text.split('\n') if l.strip()]


def calc_age(birth, on):
    if not birth:
        return None
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def short_fio(last, first):
    return ' '.join(p for p in [last, first] if p)


def load_tournament(cur, tid):
    cur.execute("SELECT id, title, date, lila_tournament_id, lila_tournament_kind FROM tournaments WHERE id = %s", (tid,))
    row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'title': row[1], 'date': row[2], 'lila_id': row[3], 'kind': row[4] or 'swiss'}


def build_rows(cur, t):
    results = lila_results(t['lila_id'], t['kind'])
    names = [r['username'].lower() for r in results]
    users = {}
    if names:
        ph = ','.join(['%s'] * len(names))
        cur.execute(
            f"SELECT id, lower(lila_username), last_name, first_name, birth_date, gender FROM users WHERE lower(lila_username) IN ({ph})",
            names,
        )
        for uid, uname, ln, fn, bd, g in cur.fetchall():
            users[uname] = (uid, short_fio(ln, fn), bd, g)
    on = t['date'] or date.today()
    rows = []
    for r in results:
        u = users.get(r['username'].lower())
        rows.append({
            'rank': r.get('rank'),
            'username': r['username'],
            'user_id': u[0] if u else None,
            'fio': (u[1] if u and u[1] else r['username']),
            'age': calc_age(u[2], on) if u else None,
            'gender': u[3] if u else None,
            'points': r.get('score', r.get('points', 0)),
            'tieBreak': r.get('tieBreak'),
            'rating': r.get('rating'),
            'performance': r.get('performance'),
        })
    rows.sort(key=lambda x: x['rank'] or 9999)
    return rows


def assign_group(age, groups):
    if age is None:
        return None
    for g in groups:
        if g['min'] <= age <= g['max']:
            return g['name']
    return None


def load_config(cur, tid):
    cur.execute("SELECT status, age_groups, published_at, diploma_rating_limit FROM electronic_results WHERE tournament_id = %s", (tid,))
    row = cur.fetchone()
    groups = json.loads(row[1]) if row else []
    cur.execute(
        "SELECT id, group_name, kind, place, username, game_url FROM electronic_result_nominations WHERE tournament_id = %s ORDER BY group_name, kind, place",
        (tid,),
    )
    noms = [{'id': r[0], 'group_name': r[1], 'kind': r[2], 'place': r[3], 'username': r[4], 'game_url': r[5]} for r in cur.fetchall()]
    return {'status': row[0] if row else 'draft', 'published_at': row[2] if row else None, 'age_groups': groups, 'nominations': noms,
            'diploma_rating_limit': row[3] if row else None}


def build_snapshot(t, rows, cfg):
    groups = cfg['age_groups']
    by_name = {r['username'].lower(): r for r in rows}
    for r in rows:
        r['group'] = assign_group(r['age'], groups)
    out_groups = []
    for g in groups:
        members = [r for r in rows if r['group'] == g['name']]
        table = [{**m, 'place': i + 1} for i, m in enumerate(members)]
        noms = {k: [] for k in KINDS}
        for n in cfg['nominations']:
            if n['group_name'] != g['name'] or n['kind'] not in KINDS:
                continue
            p = by_name.get(n['username'].lower())
            noms[n['kind']].append({
                'place': n['place'], 'username': n['username'],
                'fio': p['fio'] if p else n['username'], 'game_url': n['game_url'],
            })
        out_groups.append({'name': g['name'], 'min': g['min'], 'max': g['max'], 'table': table, 'nominations': noms})
    return {
        'tournament': {'id': t['id'], 'title': t['title'], 'date': t['date'], 'has_hall': bool(t['lila_id'])},
        'overall': rows,
        'groups': out_groups,
    }


def parse_groups(raw):
    groups = []
    for g in raw or []:
        name = str(g.get('name') or '').strip()[:100]
        try:
            lo, hi = int(g.get('min')), int(g.get('max'))
        except (TypeError, ValueError):
            continue
        if name and lo <= hi:
            groups.append({'name': name, 'min': lo, 'max': hi})
    return groups


def handler(event: dict, context) -> dict:
    """Электронные результаты турнира: админ настраивает возрастные группы и номинации и публикует итог, публично отдаётся опубликованный снимок."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Auth-Token',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    method = event.get('httpMethod')
    params = event.get('queryStringParameters') or {}
    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        tid = params.get('tournament_id')
        if params.get('my_files') == '1' and tid:
            hdrs = event.get('headers') or {}
            token = hdrs.get('X-Auth-Token') or hdrs.get('x-auth-token') or ''
            cur.execute(
                """SELECT u.lila_username FROM user_sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token = %s AND s.expires_at > now()""",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return resp(401, {'error': 'Не авторизован'})
            files = load_files(cur, int(tid), row[0]) if row[0] else []
            conn.close()
            return resp(200, {'files': files})
        if params.get('diploma_data') == '1' and tid:
            hdrs = event.get('headers') or {}
            token = hdrs.get('X-Auth-Token') or hdrs.get('x-auth-token') or ''
            cur.execute(
                """SELECT u.institution, u.country_city, u.coach_fio, u.id FROM user_sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token = %s AND s.expires_at > now()""",
                (token,),
            )
            urow = cur.fetchone()
            if not urow:
                conn.close()
                return resp(401, {'error': 'Не авторизован'})
            urow = list(urow)
            if not (urow[0] or '').strip() or not (urow[1] or '').strip() or not (urow[2] or '').strip():
                cur.execute(
                    "SELECT school, country_city, coach FROM applications WHERE user_id = %s ORDER BY created_at DESC LIMIT 5",
                    (urow[3],),
                )
                for school, city, coach in cur.fetchall():
                    for i, v in enumerate((school, city, coach)):
                        if not (urow[i] or '').strip() and (v or '').strip():
                            urow[i] = v.strip()
            cur.execute(
                "SELECT file_url FROM electronic_result_files WHERE tournament_id = %s AND kind = 'diploma_template' AND username = %s",
                (int(tid), PROTOCOL_USER),
            )
            frow = cur.fetchone()
            cur.execute("SELECT title, tournament_type, age_category, date FROM tournaments WHERE id = %s", (int(tid),))
            trow = cur.fetchone()
            cur.execute("SELECT diploma_rating_limit FROM electronic_results WHERE tournament_id = %s", (int(tid),))
            lrow = cur.fetchone()
            conn.close()
            if not trow:
                return resp(404, {'error': 'Турнир не найден'})
            return resp(200, {
                'template_url': frow[0] if frow else None,
                'rating_limit': lrow[0] if lrow else None,
                'tournament': {'title': trow[0], 'type': trow[1] or 'qualifying', 'age_category': trow[2], 'date': trow[3]},
                'profile': {'institution': urow[0], 'country_city': urow[1], 'coach_fio': urow[2]},
            })
        admin = params.get('admin') == '1'
        if admin:
            if not is_admin(event):
                conn.close()
                return resp(403, {'error': 'Нет доступа'})
            if not tid:
                cur.execute(
                    """SELECT t.id, t.title, t.date, COALESCE(er.status, '') FROM tournaments t
                       LEFT JOIN electronic_results er ON er.tournament_id = t.id
                       WHERE t.lila_tournament_id IS NOT NULL AND t.lila_tournament_id <> ''
                       ORDER BY t.date DESC NULLS LAST, t.id DESC LIMIT 100"""
                )
                items = [{'id': r[0], 'title': r[1], 'date': r[2], 'result_status': r[3]} for r in cur.fetchall()]
                conn.close()
                return resp(200, {'tournaments': items})
            t = load_tournament(cur, int(tid))
            if not t or not t['lila_id']:
                conn.close()
                return resp(404, {'error': 'У турнира не указана ссылка на Lila'})
            try:
                rows = build_rows(cur, t)
            except Exception:
                conn.close()
                return resp(502, {'error': 'Не удалось получить таблицу из Lila'})
            cfg = load_config(cur, t['id'])
            snap = build_snapshot(t, rows, cfg)
            files = load_files(cur, t['id'])
            conn.close()
            return resp(200, {'tournament': snap['tournament'], 'config': cfg, 'players': snap['overall'], 'preview': snap, 'files': files})

        if tid:
            cur.execute("SELECT snapshot FROM electronic_results WHERE tournament_id = %s AND status = 'published'", (int(tid),))
            row = cur.fetchone()
            if not row or not row[0]:
                conn.close()
                return resp(404, {'error': 'Результаты не опубликованы'})
            cur.execute("SELECT lila_tournament_id, lila_tournament_kind FROM tournaments WHERE id = %s", (int(tid),))
            trow = cur.fetchone()
            snap = json.loads(row[0])
            if trow and trow[0]:
                try:
                    extra = {r['username'].lower(): r for r in lila_results(trow[0], trow[1] or 'swiss')}
                    rows_all = list(snap.get('overall') or [])
                    for g in snap.get('groups') or []:
                        rows_all += g.get('table') or []
                    for r in rows_all:
                        e = extra.get(str(r.get('username', '')).lower())
                        if e:
                            if r.get('performance') is None:
                                r['performance'] = e.get('performance')
                            if r.get('tieBreak') is None:
                                r['tieBreak'] = e.get('tieBreak')
                except Exception:
                    pass
            snap.setdefault('tournament', {})['has_hall'] = bool(trow and trow[0])
            cur.execute("SELECT file_url FROM electronic_result_files WHERE tournament_id = %s AND kind = 'protocol' AND username = %s", (int(tid), PROTOCOL_USER))
            prow = cur.fetchone()
            snap['tournament']['protocol_url'] = prow[0] if prow else None
            conn.close()
            return resp(200, snap, 30)

        cur.execute(
            """SELECT er.tournament_id, t.title, t.date, er.published_at FROM electronic_results er
               JOIN tournaments t ON t.id = er.tournament_id
               WHERE er.status = 'published' ORDER BY t.date DESC NULLS LAST, er.tournament_id DESC"""
        )
        items = [{'tournament_id': r[0], 'title': r[1], 'date': r[2], 'published_at': r[3]} for r in cur.fetchall()]
        conn.close()
        return resp(200, {'items': items}, 30)

    if method == 'POST':
        if not is_admin(event):
            conn.close()
            return resp(403, {'error': 'Нет доступа'})
        body = json.loads(event.get('body') or '{}')
        action = body.get('_action')
        tid = body.get('tournament_id')
        t = load_tournament(cur, int(tid)) if tid else None
        if not t:
            conn.close()
            return resp(404, {'error': 'Турнир не найден'})

        if action in ('save', 'publish'):
            groups = parse_groups(body.get('age_groups'))
            try:
                rating_limit = int(body.get('diploma_rating_limit')) if body.get('diploma_rating_limit') not in (None, '') else None
            except (TypeError, ValueError):
                rating_limit = None
            cur.execute(
                """INSERT INTO electronic_results (tournament_id, age_groups, diploma_rating_limit) VALUES (%s, %s, %s)
                   ON CONFLICT (tournament_id) DO UPDATE SET age_groups = EXCLUDED.age_groups,
                   diploma_rating_limit = EXCLUDED.diploma_rating_limit, updated_at = now()""",
                (t['id'], json.dumps(groups, ensure_ascii=False), rating_limit),
            )
            cur.execute("DELETE FROM electronic_result_nominations WHERE tournament_id = %s", (t['id'],))
            group_names = {g['name'] for g in groups}
            for n in body.get('nominations') or []:
                kind = n.get('kind')
                place = int(n.get('place') or 1)
                username = str(n.get('username') or '').strip()
                if kind in KINDS and 1 <= place <= KINDS[kind] and username and n.get('group_name') in group_names:
                    cur.execute(
                        """INSERT INTO electronic_result_nominations (tournament_id, group_name, kind, place, username, game_url)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (t['id'], n['group_name'], kind, place, username, (n.get('game_url') or '').strip() or None),
                    )
            if action == 'publish':
                try:
                    rows = build_rows(cur, t)
                except Exception:
                    conn.rollback()
                    conn.close()
                    return resp(502, {'error': 'Не удалось получить таблицу из Lila'})
                snap = build_snapshot(t, rows, load_config(cur, t['id']))
                cur.execute(
                    "UPDATE electronic_results SET status = 'published', snapshot = %s, published_at = now() WHERE tournament_id = %s",
                    (json.dumps(snap, ensure_ascii=False, default=str), t['id']),
                )
            conn.commit()
            conn.close()
            return resp(200, {'ok': True})

        if action == 'upload_file':
            kind = body.get('kind')
            username = str(body.get('username') or '').strip()
            ctype = body.get('content_type')
            if kind not in FILE_KINDS or not username or ctype not in ALLOWED_TYPES or not body.get('file_b64'):
                conn.close()
                return resp(400, {'error': 'Неверные данные файла. Допустимы PDF, PNG, JPG'})
            data = base64.b64decode(body['file_b64'])
            if len(data) > 8 * 1024 * 1024:
                conn.close()
                return resp(400, {'error': 'Файл больше 8 МБ'})
            key = f"diplomas/{t['id']}/{uuid.uuid4().hex}.{ALLOWED_TYPES[ctype]}"
            get_s3().put_object(Bucket='files', Key=key, Body=data, ContentType=ctype)
            url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            name = re.sub(r'[^\w.\- ]', '', str(body.get('file_name') or ''))[:255] or None
            cur.execute("DELETE FROM electronic_result_files WHERE tournament_id = %s AND lower(username) = lower(%s) AND kind = %s", (t['id'], username, kind))
            cur.execute(
                "INSERT INTO electronic_result_files (tournament_id, username, kind, file_url, file_name) VALUES (%s, %s, %s, %s, %s)",
                (t['id'], username, kind, url, name),
            )
            conn.commit()
            conn.close()
            return resp(200, {'ok': True, 'file_url': url})

        if action == 'delete_file':
            cur.execute(
                "DELETE FROM electronic_result_files WHERE tournament_id = %s AND lower(username) = lower(%s) AND kind = %s",
                (t['id'], str(body.get('username') or ''), body.get('kind')),
            )
            conn.commit()
            conn.close()
            return resp(200, {'ok': True})

        if action == 'unpublish':
            cur.execute("UPDATE electronic_results SET status = 'draft' WHERE tournament_id = %s", (t['id'],))
            conn.commit()
            conn.close()
            return resp(200, {'ok': True})

    conn.close()
    return resp(400, {'error': 'Неверный запрос'})