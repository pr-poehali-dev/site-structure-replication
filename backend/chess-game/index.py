import json
import os
from datetime import datetime

import psycopg2

from chess_rules import Board, START_FEN
from pusher_client import trigger, trigger_many
from swiss import assign_places, update_buchholz
from rating import apply_rating_changes

CHECKMATE = 'checkmate'
STALEMATE = 'stalemate'
DRAW_AGREED = 'draw_agreed'
RESIGNATION = 'resignation'
TIMEOUT = 'timeout'
INSUFFICIENT = 'insufficient_material'
FIRST_MOVE_TIMEOUT = 'first_move_timeout'
THREEFOLD_REPETITION = 'threefold_repetition'


def count_position_repetitions(moves_including_current, target_fen):
    """Считает, сколько раз позиция target_fen встречалась в партии — включая
    начальную позицию перед первым ходом и позицию после каждого хода вплоть до
    только что сделанного (moves_including_current — это game['moves'] уже С
    добавленным текущим ходом). Сравнение идёт по position_key (фигуры + очередь
    хода + права рокировки + взятие на проходе), а не по полному FEN, чтобы
    отличающиеся только счётчиком ходов позиции считались одинаковыми, как того
    требуют правила шахмат."""
    target_key = Board(target_fen).position_key()
    count = 1 if Board(START_FEN).position_key() == target_key else 0
    for m in moves_including_current:
        if Board(m['fen']).position_key() == target_key:
            count += 1
    return count

FIRST_MOVE_GRACE_MS = 60000


def replay_moves_from_pgn(pgn):
    """Восстанавливает историю ходов (SAN + FEN после каждого хода) для старых партий,
    сыгранных до появления столбца moves, проигрывая сохранённый pgn с самого начала."""
    sans = pgn.split()
    if not sans:
        return []
    board = Board()
    result = []
    for san in sans:
        bare_san = san.rstrip('+#')
        found = None
        for mv in board.legal_moves():
            if board.move_to_san(mv) == bare_san:
                found = mv
                break
        if not found:
            break
        color = 'white' if board.turn == 'w' else 'black'
        board.apply_move(found)
        result.append({'san': san, 'fen': board.to_fen(), 'color': color})
    return result


def get_conn():
    """ВАЖНО: каждый вызов открывает НОВОЕ соединение — переиспользование общего соединения
    между вызовами (через глобальную переменную) оказалось небезопасным: когда платформа
    обрабатывает несколько запросов параллельно на одном "тёплом" контейнере (например,
    несколько игроков одновременно делают ходы в разных партиях одного тура), параллельные
    запросы на ОДНОМ соединении могут путать результаты своих SQL-запросов между собой.
    Это привело к реальному багу 26.09 в турнирном зале (tournament-hall) — там же было
    точно такое же переиспользование, из-за него часть игроков и очков "потерялась" при
    одновременных запросах. Открытие нового соединения на каждый вызов исключает эту гонку
    ценой чуть большей нагрузки на лимит подключений БД."""
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f"-c search_path={os.environ.get('MAIN_DB_SCHEMA', 'public')}")


def release_conn(conn):
    try:
        conn.close()
    except Exception:
        pass


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Admin-Password',
    }


def get_user_id_by_token(cur, token: str):
    if not token:
        return None
    cur.execute("SELECT user_id FROM user_sessions WHERE token = %s AND expires_at > now()", (token,))
    row = cur.fetchone()
    return row[0] if row else None


PRESENCE_ONLINE_SECONDS = 25


def load_game(cur, game_id):
    cur.execute(
        """SELECT g.id, g.round_id, g.tournament_id, g.white_player_id, wp.fio, wp.user_id,
                  g.black_player_id, bp.fio, bp.user_id, g.status, g.result, g.result_reason,
                  g.fen, g.pgn, g.turn, g.white_time_ms, g.black_time_ms, g.increment_ms,
                  g.last_move_at, g.draw_offered_by, t.title, g.moves, wu.avatar_url, bu.avatar_url,
                  g.white_present_at, g.black_present_at
           FROM tournament_games g
           LEFT JOIN tournament_players wp ON wp.id = g.white_player_id
           LEFT JOIN tournament_players bp ON bp.id = g.black_player_id
           LEFT JOIN users wu ON wu.id = wp.user_id
           LEFT JOIN users bu ON bu.id = bp.user_id
           LEFT JOIN tournaments t ON t.id = g.tournament_id
           WHERE g.id = %s""",
        (game_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    pgn = row[13]
    moves = row[21] if row[21] is not None else []
    if not moves and pgn:
        moves = replay_moves_from_pgn(pgn)
    return {
        'id': row[0], 'round_id': row[1], 'tournament_id': row[2],
        'white_player_id': row[3], 'white_fio': row[4], 'white_user_id': row[5],
        'black_player_id': row[6], 'black_fio': row[7], 'black_user_id': row[8],
        'status': row[9], 'result': row[10], 'result_reason': row[11],
        'fen': row[12], 'pgn': pgn, 'turn': row[14],
        'white_time_ms': row[15], 'black_time_ms': row[16], 'increment_ms': row[17],
        'last_move_at': row[18], 'draw_offered_by': row[19], 'tournament_title': row[20],
        'moves': moves, 'white_avatar_url': row[22], 'black_avatar_url': row[23],
        'white_present_at': row[24], 'black_present_at': row[25],
    }


def is_present(present_at):
    if not present_at:
        return False
    return (datetime.utcnow() - present_at).total_seconds() < PRESENCE_ONLINE_SECONDS


def is_first_white_move(game):
    """Партия ещё не начата (нет ни одного хода) и сейчас ход белых —
    значит идёт 30-секундный льготный период на первый ход, который не тратит их основное время."""
    return not game['pgn'] and game['turn'] == 'white'


def compute_live_times(game):
    white_ms, black_ms = game['white_time_ms'], game['black_time_ms']
    if game['status'] == 'active' and game['last_move_at'] and not is_first_white_move(game):
        elapsed = (datetime.utcnow() - game['last_move_at']).total_seconds() * 1000
        if game['turn'] == 'white':
            white_ms = max(0, white_ms - int(elapsed))
        else:
            black_ms = max(0, black_ms - int(elapsed))
    return white_ms, black_ms


def compute_first_move_grace_ms(game):
    """Остаток льготных 30 секунд на первый ход белых, либо None, если льготный период неактуален."""
    if game['status'] != 'active' or not game['last_move_at'] or not is_first_white_move(game):
        return None
    elapsed = (datetime.utcnow() - game['last_move_at']).total_seconds() * 1000
    return max(0, FIRST_MOVE_GRACE_MS - int(elapsed))


def finish_game(cur, game_id, result, reason, winner_player_id=None, loser_player_id=None, white_time_ms=None, black_time_ms=None):
    """Помечает партию завершённой и начисляет очки. Условие "AND status = 'active'" в UPDATE
    делает операцию атомарной: если два параллельных запроса (резервный опрос раз в 15 секунд
    и push-уведомление) одновременно решат, что время истекло, очки начислятся только один раз —
    второй вызов увидит rowcount = 0 и ничего не сделает.

    white_time_ms/black_time_ms (если переданы) — актуальные "живые" часы на момент завершения
    (посчитанные compute_live_times), которые нужно зафиксировать в БД. Без этого в столбцах
    оставалось бы устаревшее значение с момента последнего хода: например, при завершении по
    таймауту часы проигравшего должны показывать 0:00, а не то время, что было час назад."""
    if white_time_ms is not None and black_time_ms is not None:
        cur.execute(
            "UPDATE tournament_games SET status = 'finished', result = %s, result_reason = %s, finished_at = now(), "
            "white_time_ms = %s, black_time_ms = %s WHERE id = %s AND status = 'active'",
            (result, reason, white_time_ms, black_time_ms, game_id)
        )
    else:
        cur.execute(
            "UPDATE tournament_games SET status = 'finished', result = %s, result_reason = %s, finished_at = now() WHERE id = %s AND status = 'active'",
            (result, reason, game_id)
        )
    if cur.rowcount == 0:
        return False
    if winner_player_id:
        cur.execute("UPDATE tournament_players SET points = points + 1, wins = wins + 1 WHERE id = %s", (winner_player_id,))
    if result == '1/2-1/2':
        cur.execute(
            "UPDATE tournament_players SET points = points + 0.5 WHERE id IN (SELECT white_player_id FROM tournament_games WHERE id = %s UNION SELECT black_player_id FROM tournament_games WHERE id = %s)",
            (game_id, game_id)
        )
    return True


def check_round_completion(cur, tournament_id, round_id):
    """Если только что завершённая партия была последней активной в туре — закрывает тур.
    Если это был последний тур турнира — сразу проставляет итоговые места (медали)
    и пересчитывает рейтинг участников, как это делает турнирный зал по завершении тура.

    Возвращает список отложенных push-событий (не отправляет их сама) — вызывающий код
    должен отправить их ОДНИМ batch-запросом вместе с остальными событиями этого хода
    (см. trigger_many в pusher_client.py). Раньше здесь был прямой синхронный trigger(),
    из-за чего при завершении партии, закрывающей заодно тур и весь турнир, уходило
    несколько последовательных HTTP-запросов к Pusher подряд — суммарная задержка
    ответа игроку могла доходить до нескольких секунд.

    Турнирный зал опрашивается одновременно всеми участниками, поэтому эта же проверка
    может параллельно выполниться и здесь, и в tournament-hall (maybe_advance) прямо в
    момент, когда доигрывается последняя партия тура. Условный UPDATE ... WHERE status =
    'active' — атомарная операция на уровне БД: если несколько запросов одновременно решат,
    что тур пора закрыть, обновление и всё, что после него (медали, рейтинг), выполнится
    только у одного из них — остальные получат 0 обновлённых строк и ничего не сделают.
    Обычные блокировки (FOR UPDATE/advisory-лок) здесь не используются, так как в этой
    инфраструктуре не гарантируют удержание между отдельными SQL-запросами одной функции."""
    cur.execute("SELECT round_number, status FROM tournament_rounds WHERE id = %s", (round_id,))
    row = cur.fetchone()
    if not row:
        return []
    round_number, status = row
    if status != 'active':
        return []
    # total > 0 обязателен: между вставкой строки тура и вставкой его партий в
    # tournament-hall (start_next_round) есть краткий промежуток, когда у тура ещё 0 партий —
    # без этой проверки такой тур выглядел бы как "все партии завершены".
    cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE status != 'finished') FROM tournament_games WHERE round_id = %s", (round_id,))
    total, unfinished = cur.fetchone()
    if total == 0 or unfinished > 0:
        return []
    cur.execute(
        "UPDATE tournament_rounds SET status = 'completed', completed_at = now() WHERE id = %s AND status = 'active' RETURNING id",
        (round_id,)
    )
    if not cur.fetchone():
        return []
    cur.execute("SELECT rounds_count, title, rating_type FROM tournaments WHERE id = %s", (tournament_id,))
    rounds_count, title, rating_type = cur.fetchone()
    update_buchholz(cur, tournament_id)
    if round_number >= rounds_count:
        cur.execute(
            "UPDATE tournaments SET hall_status = 'finished' WHERE id = %s AND hall_status = 'active' RETURNING id",
            (tournament_id,)
        )
        if cur.fetchone():
            assign_places(cur, tournament_id)
            apply_rating_changes(cur, tournament_id, title, rating_type or 'rapid')
            return [(f"tournament-{tournament_id}", 'finished', {})]
        return []
    return [(f"tournament-{tournament_id}", 'round-completed', {'round_number': round_number})]


def game_update_payload(game, white_ms, black_ms):
    """Собирает тот же набор полей, что отдаёт GET, чтобы отправить его прямо в push-событие
    'update' — тогда соперник применяет новую позицию сразу по событию, без отдельного
    HTTP-запроса за состоянием партии (тот самый лишний round-trip, что давал заметную
    задержку в быстрых партиях)."""
    draw_offered_by_role = None
    if game['draw_offered_by']:
        if game['draw_offered_by'] == game['white_player_id']:
            draw_offered_by_role = 'white'
        elif game['draw_offered_by'] == game['black_player_id']:
            draw_offered_by_role = 'black'
    return {
        'id': game['id'], 'status': game['status'], 'result': game['result'], 'result_reason': game['result_reason'],
        'fen': game['fen'], 'pgn': game['pgn'], 'turn': game['turn'], 'moves': game['moves'],
        'white_time_ms': white_ms, 'black_time_ms': black_ms,
        'draw_offered_by': game['draw_offered_by'], 'draw_offered_by_role': draw_offered_by_role,
    }


def player_role(game, user_id):
    if user_id and game['white_user_id'] == user_id:
        return 'white'
    if user_id and game['black_user_id'] == user_id:
        return 'black'
    return None


def handler(event: dict, context) -> dict:
    """Игра в шахматы: ходы, часы, ничья, сдача, чат партии турнира"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**cors_headers(), 'Access-Control-Max-Age': '86400'}, 'body': ''}

    method = event.get('httpMethod')
    headers = event.get('headers', {}) or {}
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('_action', '')
    auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')
    admin_password = headers.get('X-Admin-Password', '')
    is_admin = bool(admin_password) and admin_password == os.environ.get('ADMIN_PASSWORD', '')

    conn = get_conn()
    cur = conn.cursor()
    user_id = get_user_id_by_token(cur, auth_token)

    if method == 'POST' and action == 'admin_reset':
        # Сброс служебной статичной партии (для быстрой проверки игры админом) к начальной
        # позиции — сохраняет игроков и возвращает часы на полный контроль времени. base_ms
        # приходит из админки (контроль партии известен заранее); если не передан — берём
        # больший из текущих остатков как разумный запасной вариант.
        if not is_admin:
            release_conn(conn)
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный пароль'})}
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        base_ms = body.get('base_ms') or max(game['white_time_ms'], game['black_time_ms'], 1)
        cur.execute(
            """UPDATE tournament_games SET
                   fen = %s, pgn = '', turn = 'white', status = 'active', result = NULL, result_reason = NULL,
                   white_time_ms = %s, black_time_ms = %s, last_move_at = now(), draw_offered_by = NULL,
                   moves = '[]'::jsonb, started_at = now(), finished_at = NULL
               WHERE id = %s""",
            (START_FEN, base_ms, base_ms, game_id)
        )
        cur.execute("DELETE FROM game_chat_messages WHERE game_id = %s", (game_id,))
        conn.commit()
        release_conn(conn)
        trigger(f'game-{game_id}', 'update', {
            'id': int(game_id), 'status': 'active', 'result': None, 'result_reason': None,
            'fen': START_FEN, 'pgn': '', 'turn': 'white', 'moves': [],
            'white_time_ms': base_ms, 'black_time_ms': base_ms,
            'draw_offered_by': None, 'draw_offered_by_role': None,
        })
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'GET':
        game_id = params.get('game_id')
        if not game_id:
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'game_id required'})}
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}

        white_ms, black_ms = compute_live_times(game)
        first_move_grace_ms = compute_first_move_grace_ms(game)

        # Отмечаем присутствие игрока в партии — используется фронтендом для индикатора
        # "соперник на связи" рядом с его именем. Обновляется на каждом опросе партии
        # (push-событие 'update' его не даёт, но резервный опрос теперь достаточно частый —
        # см. интервал в Game.tsx), поэтому статус отстаёт максимум на пару секунд.
        role_for_presence = player_role(game, user_id)
        if role_for_presence == 'white':
            cur.execute("UPDATE tournament_games SET white_present_at = now() WHERE id = %s", (game_id,))
            game['white_present_at'] = datetime.utcnow()
        elif role_for_presence == 'black':
            cur.execute("UPDATE tournament_games SET black_present_at = now() WHERE id = %s", (game_id,))
            game['black_present_at'] = datetime.utcnow()
        if role_for_presence:
            conn.commit()

        if game['status'] == 'active' and first_move_grace_ms == 0:
            finish_game(cur, game['id'], '0-1', FIRST_MOVE_TIMEOUT, game['black_player_id'], game['white_player_id'])
            round_events = check_round_completion(cur, game['tournament_id'], game['round_id'])
            conn.commit()
            game = load_game(cur, game_id)
            white_ms, black_ms = compute_live_times(game)
            first_move_grace_ms = None
            trigger_many([
                (f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms)),
                (f"tournament-{game['tournament_id']}", 'game-finished', {}),
                *round_events,
            ])
        elif game['status'] == 'active' and (white_ms <= 0 or black_ms <= 0):
            loser_color = 'white' if white_ms <= 0 else 'black'
            winner_id = game['black_player_id'] if loser_color == 'white' else game['white_player_id']
            loser_id = game['white_player_id'] if loser_color == 'white' else game['black_player_id']
            result = '0-1' if loser_color == 'white' else '1-0'
            finish_game(cur, game['id'], result, TIMEOUT, winner_id, loser_id, white_ms, black_ms)
            round_events = check_round_completion(cur, game['tournament_id'], game['round_id'])
            conn.commit()
            game = load_game(cur, game_id)
            white_ms, black_ms = compute_live_times(game)
            first_move_grace_ms = None
            trigger_many([
                (f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms)),
                (f"tournament-{game['tournament_id']}", 'game-finished', {}),
                *round_events,
            ])

        cur.execute(
            "SELECT gm.message, gm.created_at, gm.player_id, COALESCE(tp.fio, 'Игрок') FROM game_chat_messages gm LEFT JOIN tournament_players tp ON tp.id = gm.player_id WHERE gm.game_id = %s ORDER BY gm.id ASC",
            (game_id,)
        )
        chat = [{'message': r[0], 'created_at': str(r[1]), 'player_id': r[2], 'fio': r[3]} for r in cur.fetchall()]

        release_conn(conn)
        role = player_role(game, user_id)
        draw_offered_by_role = None
        if game['draw_offered_by']:
            if game['draw_offered_by'] == game['white_player_id']:
                draw_offered_by_role = 'white'
            elif game['draw_offered_by'] == game['black_player_id']:
                draw_offered_by_role = 'black'
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
            'game': {
                'id': game['id'], 'status': game['status'], 'result': game['result'], 'result_reason': game['result_reason'],
                'fen': game['fen'], 'pgn': game['pgn'], 'turn': game['turn'], 'moves': game['moves'],
                'white_fio': game['white_fio'], 'black_fio': game['black_fio'],
                'white_avatar_url': game['white_avatar_url'], 'black_avatar_url': game['black_avatar_url'],
                'white_time_ms': white_ms, 'black_time_ms': black_ms,
                'first_move_grace_ms': first_move_grace_ms,
                'draw_offered_by': game['draw_offered_by'], 'draw_offered_by_role': draw_offered_by_role,
                'tournament_title': game['tournament_title'],
                'tournament_id': game['tournament_id'],
                'white_present': is_present(game['white_present_at']),
                'black_present': is_present(game['black_present_at']),
            },
            'chat': chat, 'my_role': role,
            'pusher_key': os.environ.get('PUSHER_KEY', ''),
            'pusher_cluster': os.environ.get('PUSHER_CLUSTER', 'eu'),
        })}

    if method == 'POST' and action == 'move':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role:
            release_conn(conn)
            return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Вы не участник этой партии'})}
        if game['status'] != 'active':
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия завершена'})}
        if role != game['turn']:
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Сейчас не ваш ход'})}

        board = Board(game['fen'])
        from_sq = body.get('from')
        to_sq = body.get('to')
        promotion = body.get('promotion')
        mv = board.find_move(from_sq, to_sq, promotion)
        if not mv:
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Недопустимый ход'})}
        san = board.move_to_san(mv)
        board.apply_move(mv)

        # Добавляем в SAN признак шаха "+" или мата "#" — используется фронтендом
        # для выбора звукового эффекта хода.
        if board.is_checkmate():
            san += '#'
        elif board.in_check(board.turn):
            san += '+'

        white_ms, black_ms = compute_live_times(game)
        inc = game['increment_ms']
        if role == 'white':
            white_ms += inc
        else:
            black_ms += inc

        new_pgn = (game['pgn'] + ' ' + san).strip()
        new_turn = 'black' if role == 'white' else 'white'
        new_fen = board.to_fen()
        # white_time_ms/black_time_ms — снимок часов сразу после этого хода (с учётом
        # инкремента), нужен фронтенду для показа корректного времени при просмотре
        # истории партии назад/вперёд по ходам.
        new_moves = game['moves'] + [{'san': san, 'fen': new_fen, 'color': role, 'white_time_ms': white_ms, 'black_time_ms': black_ms}]

        cur.execute(
            "UPDATE tournament_games SET fen = %s, pgn = %s, turn = %s, white_time_ms = %s, black_time_ms = %s, last_move_at = now(), draw_offered_by = NULL, moves = %s WHERE id = %s",
            (new_fen, new_pgn, new_turn, white_ms, black_ms, json.dumps(new_moves), game_id)
        )

        # Обновляем локальную копию партии теми же значениями, что уже записаны в БД —
        # чтобы собрать payload для push-события без лишнего SELECT обратно к базе.
        game['fen'], game['pgn'], game['turn'] = new_fen, new_pgn, new_turn
        game['white_time_ms'], game['black_time_ms'], game['moves'] = white_ms, black_ms, new_moves
        game['draw_offered_by'] = None

        game_finished = False
        if board.is_checkmate():
            winner_id = game['white_player_id'] if role == 'white' else game['black_player_id']
            loser_id = game['black_player_id'] if role == 'white' else game['white_player_id']
            result = '1-0' if role == 'white' else '0-1'
            finish_game(cur, game_id, result, CHECKMATE, winner_id, loser_id)
            game['status'], game['result'], game['result_reason'] = 'finished', result, CHECKMATE
            game_finished = True
        elif board.is_stalemate():
            finish_game(cur, game_id, '1/2-1/2', STALEMATE)
            game['status'], game['result'], game['result_reason'] = 'finished', '1/2-1/2', STALEMATE
            game_finished = True
        elif board.is_insufficient_material():
            finish_game(cur, game_id, '1/2-1/2', INSUFFICIENT)
            game['status'], game['result'], game['result_reason'] = 'finished', '1/2-1/2', INSUFFICIENT
            game_finished = True
        elif count_position_repetitions(new_moves, new_fen) >= 3:
            # Троекратное повторение позиции — ничья засчитывается автоматически (не по
            # заявлению игрока, как в очном шахматном регламенте, а сразу движком), так
            # как в этом онлайн-зале нет отдельного действия "заявить ничью".
            finish_game(cur, game_id, '1/2-1/2', THREEFOLD_REPETITION)
            game['status'], game['result'], game['result_reason'] = 'finished', '1/2-1/2', THREEFOLD_REPETITION
            game_finished = True

        round_events = check_round_completion(cur, game['tournament_id'], game['round_id']) if game_finished else []

        conn.commit()
        release_conn(conn)
        # Синхронный trigger (дожидается ответа Pusher) — в serverless-окружении процесс
        # может быть заморожен сразу после возврата HTTP-ответа, поэтому фоновый поток,
        # запущенный перед return, не гарантированно успевает отправить запрос: событие
        # могло уйти только при следующем "тёплом" вызове функции, из-за чего соперник
        # получал уведомление о ходе с задержкой. Синхронная отправка добавляет ~100-200мс
        # к ответу ходившему игроку, зато гарантирует мгновенную доставку сопернику.
        # Полезная нагрузка (fen/ход/часы) в самом событии избавляет его от повторного
        # HTTP-запроса за состоянием партии. Все события отправляются ОДНИМ batch-запросом
        # (trigger_many) — если ход завершает ещё и тур/турнир, это экономит несколько
        # последовательных HTTP round-trip'ов к Pusher.
        events = [(f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms))]
        if game_finished:
            events.append((f"tournament-{game['tournament_id']}", 'game-finished', {}))
        events.extend(round_events)
        trigger_many(events)
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'resign':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role or game['status'] != 'active':
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Невозможно сдаться'})}
        winner_id = game['black_player_id'] if role == 'white' else game['white_player_id']
        loser_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        result = '0-1' if role == 'white' else '1-0'
        finish_game(cur, game_id, result, RESIGNATION, winner_id, loser_id)
        round_events = check_round_completion(cur, game['tournament_id'], game['round_id'])
        conn.commit()
        release_conn(conn)
        white_ms, black_ms = compute_live_times(game)
        game['status'], game['result'], game['result_reason'] = 'finished', result, RESIGNATION
        trigger_many([
            (f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms)),
            (f"tournament-{game['tournament_id']}", 'game-finished', {}),
            *round_events,
        ])
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'offer_draw':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role or game['status'] != 'active':
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Невозможно предложить ничью'})}
        player_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        cur.execute("UPDATE tournament_games SET draw_offered_by = %s WHERE id = %s", (player_id, game_id))
        conn.commit()
        release_conn(conn)
        white_ms, black_ms = compute_live_times(game)
        game['draw_offered_by'] = player_id
        trigger(f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms))
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'accept_draw':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role or game['status'] != 'active' or not game['draw_offered_by']:
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нет предложения ничьи'})}
        my_player_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        if game['draw_offered_by'] == my_player_id:
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нельзя принять собственное предложение'})}
        finish_game(cur, game_id, '1/2-1/2', DRAW_AGREED)
        round_events = check_round_completion(cur, game['tournament_id'], game['round_id'])
        conn.commit()
        release_conn(conn)
        white_ms, black_ms = compute_live_times(game)
        game['status'], game['result'], game['result_reason'], game['draw_offered_by'] = 'finished', '1/2-1/2', DRAW_AGREED, None
        trigger_many([
            (f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms)),
            (f"tournament-{game['tournament_id']}", 'game-finished', {}),
            *round_events,
        ])
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'decline_draw':
        game_id = body.get('game_id')
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        cur.execute("UPDATE tournament_games SET draw_offered_by = NULL WHERE id = %s", (game_id,))
        conn.commit()
        release_conn(conn)
        white_ms, black_ms = compute_live_times(game)
        game['draw_offered_by'] = None
        trigger(f'game-{game_id}', 'update', game_update_payload(game, white_ms, black_ms))
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    if method == 'POST' and action == 'chat':
        game_id = body.get('game_id')
        message = (body.get('message') or '').strip()[:500]
        if not message:
            release_conn(conn)
            return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Пустое сообщение'})}
        game = load_game(cur, game_id)
        if not game:
            release_conn(conn)
            return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Партия не найдена'})}
        role = player_role(game, user_id)
        if not role:
            release_conn(conn)
            return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Вы не участник этой партии'})}
        player_id = game['white_player_id'] if role == 'white' else game['black_player_id']
        cur.execute("INSERT INTO game_chat_messages (game_id, player_id, message) VALUES (%s, %s, %s)", (game_id, player_id, message))
        conn.commit()
        release_conn(conn)
        fio = game['white_fio'] if role == 'white' else game['black_fio']
        trigger(f'game-{game_id}', 'chat', {'message': message, 'fio': fio, 'player_id': player_id})
        return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True})}

    release_conn(conn)
    return {'statusCode': 405, 'headers': cors_headers(), 'body': json.dumps({'error': 'Method not allowed'})}