import json
import os
import re

import psycopg2

from chess_rules import Board, sq, parse_sq

SAN_RE = re.compile(r'^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([QRBN]))?$')


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def resp(status, body):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def is_admin(event):
    headers = event.get('headers') or {}
    pwd = headers.get('X-Admin-Password') or headers.get('x-admin-password')
    return bool(pwd) and pwd == os.environ.get('ADMIN_PASSWORD')


def user_id_by_token(cur, event):
    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def mv_to_uci(mv):
    f1, r1, f2, r2, extra = mv
    promo = extra.lower() if extra in ('Q', 'R', 'B', 'N') else ''
    return sq(f1, r1) + sq(f2, r2) + promo


def apply_uci(board, uci):
    promo = uci[4:5] or None
    mv = board.find_move(uci[0:2], uci[2:4], promo)
    if not mv:
        return None
    board.apply_move(mv)
    return mv


def san_to_uci(board, san):
    clean = san.strip().rstrip('+#!?')
    if clean in ('O-O', '0-0', 'O-O-O', '0-0-0'):
        extra = 'O-O' if clean in ('O-O', '0-0') else 'O-O-O'
        for mv in board.legal_moves():
            if mv[4] == extra:
                return mv_to_uci(mv)
        return None
    m = SAN_RE.match(clean)
    if not m:
        return None
    piece, dfile, drank, dest, promo = m.groups()
    piece = piece or 'P'
    tf, tr = parse_sq(dest)
    found = []
    for mv in board.legal_moves():
        f1, r1, f2, r2, extra = mv
        p = board.board[r1][f1]
        if p.upper() != piece or f2 != tf or r2 != tr:
            continue
        if dfile and 'abcdefgh'[f1] != dfile:
            continue
        if drank and str(r1 + 1) != drank:
            continue
        if extra in ('Q', 'R', 'B', 'N') and promo and extra != promo:
            continue
        if extra in ('Q', 'R', 'B', 'N') and not promo:
            continue
        found.append(mv)
    return mv_to_uci(found[0]) if len(found) == 1 else None


def validate_puzzle(fen, solution):
    try:
        board = Board(fen)
    except Exception:
        return 'Неверная позиция FEN'
    kings = sum(1 for row in board.board for p in row if p in ('K', 'k'))
    if kings != 2:
        return 'В позиции должно быть по одному королю'
    if not solution:
        return 'Укажите решение'
    for uci in solution:
        if not apply_uci(board, uci):
            return f'Ход {uci} невозможен в этой позиции'
    return None


def clean_solution(raw):
    if isinstance(raw, str):
        raw = raw.split()
    return [str(x).strip().lower() for x in (raw or []) if str(x).strip()]


def parse_pgn(text):
    games = []
    for chunk in re.split(r'\n\s*\n(?=\[)', text.replace('\r', '')):
        headers = dict(re.findall(r'\[(\w+)\s+"([^"]*)"\]', chunk))
        body = re.sub(r'\[[^\]]*\]', '', chunk)
        body = re.sub(r'\{[^}]*\}', ' ', body)
        body = re.sub(r';[^\n]*', ' ', body)
        while True:
            nxt = re.sub(r'\([^()]*\)', ' ', body)
            if nxt == body:
                break
            body = nxt
        body = re.sub(r'\$\d+', ' ', body)
        body = re.sub(r'\d+\.(\.\.)?', ' ', body)
        tokens = [t for t in body.split() if t not in ('1-0', '0-1', '1/2-1/2', '*')]
        games.append((headers, tokens))
    return games


def import_pgn(cur, text):
    created, errors = 0, []
    for idx, (headers, tokens) in enumerate(parse_pgn(text), start=1):
        fen = headers.get('FEN')
        if not fen:
            errors.append(f'Задача {idx}: нет позиции FEN')
            continue
        board = Board(fen)
        solution = []
        ok = True
        for san in tokens:
            uci = san_to_uci(board, san)
            if not uci or not apply_uci(board, uci):
                errors.append(f'Задача {idx}: не удалось разобрать ход {san}')
                ok = False
                break
            solution.append(uci)
        if not ok:
            continue
        err = validate_puzzle(fen, solution)
        if err:
            errors.append(f'Задача {idx}: {err}')
            continue
        title = headers.get('Event') or headers.get('White') or f'Задача {idx}'
        try:
            difficulty = max(1, min(5, int(headers.get('Difficulty', 1))))
        except ValueError:
            difficulty = 1
        cur.execute(
            "INSERT INTO puzzles (title, fen, solution, difficulty, theme, hint) VALUES (%s, %s, %s, %s, %s, %s)",
            (title[:200], fen, ' '.join(solution), difficulty, (headers.get('Theme') or '')[:100] or None, headers.get('Hint') or None),
        )
        created += 1
    return created, errors


def puzzle_public(row, solved):
    pid, title, fen, difficulty, theme, hint, solution = row
    return {
        'id': pid, 'title': title, 'fen': fen, 'difficulty': difficulty, 'theme': theme,
        'has_hint': bool(hint), 'turn': fen.split()[1] if len(fen.split()) > 1 else 'w',
        'moves_count': (len(solution.split()) + 1) // 2, 'solved': solved,
    }


def handler(event: dict, context) -> dict:
    """Шахматные задачи: публичный список и проверка ходов (решение проверяет сервер), рейтинг решателей, админ-управление и импорт PGN."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Admin-Password',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    method = event.get('httpMethod')
    params = event.get('queryStringParameters') or {}
    conn = get_conn()
    cur = conn.cursor()

    if method == 'GET':
        if params.get('admin') == '1':
            if not is_admin(event):
                conn.close()
                return resp(403, {'error': 'Нет доступа'})
            cur.execute(
                """SELECT p.id, p.title, p.fen, p.solution, p.difficulty, p.theme, p.hint, p.is_active,
                          (SELECT count(*) FROM puzzle_solves s WHERE s.puzzle_id = p.id)
                   FROM puzzles p ORDER BY p.id DESC"""
            )
            items = [{'id': r[0], 'title': r[1], 'fen': r[2], 'solution': r[3], 'difficulty': r[4], 'theme': r[5],
                      'hint': r[6], 'is_active': r[7], 'solves': r[8]} for r in cur.fetchall()]
            conn.close()
            return resp(200, {'puzzles': items})

        if params.get('leaderboard') == '1':
            cur.execute(
                """SELECT u.id, u.last_name, u.first_name, u.avatar_url, count(*) AS cnt
                   FROM puzzle_solves s JOIN users u ON u.id = s.user_id
                   GROUP BY u.id, u.last_name, u.first_name, u.avatar_url
                   ORDER BY cnt DESC, min(s.solved_at) ASC LIMIT 50"""
            )
            leaders = [{'user_id': r[0], 'fio': ' '.join(p for p in [r[1], r[2]] if p), 'avatar_url': r[3], 'solved': r[4]} for r in cur.fetchall()]
            conn.close()
            return resp(200, {'leaders': leaders})

        uid = user_id_by_token(cur, event)

        if params.get('me') == '1':
            if not uid:
                conn.close()
                return resp(401, {'error': 'Не авторизован'})
            cur.execute("SELECT count(*) FROM puzzle_solves WHERE user_id = %s", (uid,))
            solved = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM puzzles WHERE is_active")
            total = cur.fetchone()[0]
            cur.execute(
                """SELECT count(*) + 1 FROM (SELECT user_id, count(*) c FROM puzzle_solves GROUP BY user_id) t WHERE t.c > %s""",
                (solved,),
            )
            rank = cur.fetchone()[0] if solved else None
            conn.close()
            return resp(200, {'solved': solved, 'total': total, 'rank': rank})

        solved_ids = set()
        if uid:
            cur.execute("SELECT puzzle_id FROM puzzle_solves WHERE user_id = %s", (uid,))
            solved_ids = {r[0] for r in cur.fetchall()}

        if params.get('id'):
            cur.execute("SELECT id, title, fen, difficulty, theme, hint, solution FROM puzzles WHERE id = %s AND is_active", (int(params['id']),))
            row = cur.fetchone()
            conn.close()
            if not row:
                return resp(404, {'error': 'Задача не найдена'})
            return resp(200, {'puzzle': puzzle_public(row, row[0] in solved_ids)})

        cur.execute("SELECT id, title, fen, difficulty, theme, hint, solution FROM puzzles WHERE is_active ORDER BY difficulty, id")
        items = [puzzle_public(r, r[0] in solved_ids) for r in cur.fetchall()]
        conn.close()
        return resp(200, {'puzzles': items})

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('_action')

        if action == 'check':
            cur.execute("SELECT fen, solution, hint FROM puzzles WHERE id = %s AND is_active", (int(body.get('puzzle_id') or 0),))
            row = cur.fetchone()
            if not row:
                conn.close()
                return resp(404, {'error': 'Задача не найдена'})
            fen, solution_raw, hint = row
            solution = solution_raw.split()
            played = clean_solution(body.get('played'))
            move = str(body.get('move') or '').strip().lower()
            step = len(played)
            if played != solution[:step] or step >= len(solution) or step % 2 != 0:
                conn.close()
                return resp(400, {'error': 'Неверное состояние задачи'})

            if body.get('hint'):
                conn.close()
                return resp(200, {'hint_from': solution[step][0:2], 'hint': hint})

            board = Board(fen)
            for uci in played:
                apply_uci(board, uci)
            correct = move == solution[step]
            if not correct:
                trial = Board(board.to_fen())
                if apply_uci(trial, move) and trial.is_checkmate() and step == len(solution) - 1:
                    correct = True
                    solution[step] = move
            if not correct:
                conn.close()
                return resp(200, {'correct': False})

            reply = solution[step + 1] if step + 1 < len(solution) else None
            solved = reply is None
            newly = False
            if solved:
                uid = user_id_by_token(cur, event)
                if uid:
                    cur.execute(
                        "INSERT INTO puzzle_solves (user_id, puzzle_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (uid, int(body['puzzle_id'])),
                    )
                    newly = cur.rowcount > 0
                    conn.commit()
            conn.close()
            return resp(200, {'correct': True, 'move': move, 'reply': reply, 'solved': solved, 'newly_solved': newly})

        if not is_admin(event):
            conn.close()
            return resp(403, {'error': 'Нет доступа'})

        if action == 'import_pgn':
            created, errors = import_pgn(cur, body.get('pgn') or '')
            conn.commit()
            conn.close()
            return resp(200, {'created': created, 'errors': errors[:20]})

        if action in ('create', 'update'):
            fen = (body.get('fen') or '').strip()
            solution = clean_solution(body.get('solution'))
            title = (body.get('title') or '').strip()
            if not title:
                conn.close()
                return resp(400, {'error': 'Укажите название'})
            err = validate_puzzle(fen, solution)
            if err:
                conn.close()
                return resp(400, {'error': err})
            try:
                difficulty = max(1, min(5, int(body.get('difficulty') or 1)))
            except ValueError:
                difficulty = 1
            values = (title[:200], fen, ' '.join(solution), difficulty,
                      (body.get('theme') or '').strip()[:100] or None, (body.get('hint') or '').strip() or None)
            if action == 'create':
                cur.execute("INSERT INTO puzzles (title, fen, solution, difficulty, theme, hint) VALUES (%s, %s, %s, %s, %s, %s)", values)
            else:
                cur.execute(
                    "UPDATE puzzles SET title=%s, fen=%s, solution=%s, difficulty=%s, theme=%s, hint=%s WHERE id=%s",
                    values + (int(body.get('id')),),
                )
            conn.commit()
            conn.close()
            return resp(200, {'ok': True})

        if action == 'toggle':
            cur.execute("UPDATE puzzles SET is_active = NOT is_active WHERE id = %s", (int(body.get('id')),))
            conn.commit()
            conn.close()
            return resp(200, {'ok': True})

        if action == 'delete':
            pid = int(body.get('id'))
            cur.execute("DELETE FROM puzzle_solves WHERE puzzle_id = %s", (pid,))
            cur.execute("DELETE FROM puzzles WHERE id = %s", (pid,))
            conn.commit()
            conn.close()
            return resp(200, {'ok': True})

    conn.close()
    return resp(400, {'error': 'Неверный запрос'})
