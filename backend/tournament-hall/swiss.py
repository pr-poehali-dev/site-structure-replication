"""Логика швейцарской жеребьёвки для шахматных турниров.

Первый тур: полностью случайная жеребьёвка (перемешивание списка участников).
Со 2-го тура: игроки сортируются по очкам (затем рейтингу), разбиваются на пары
внутри групп с одинаковыми очками. Игрок, которому не хватило пары, получает
технический бай (если он ещё не получал бай в этом турнире).

Жёсткое правило: повторная встреча одних и тех же двух игроков ЗАПРЕЩЕНА.
Пары подбираются полным перебором с возвратом (backtracking), чтобы находить
корректную расстановку без повторов, если она в принципе существует. Если
такой тур составить невозможно (единственные варианты пар — уже сыгранные),
make_pairings возвращает None — турнир в этом случае завершается досрочно
текущим количеством туров.
"""
import random


def _find_pairing_without_repeats(unpaired, previous_pairs):
    """Полный перебор с возвратом: пытается разбить unpaired на пары так,
    чтобы ни одна пара не встречалась в previous_pairs. Порядок игроков в
    unpaired задаёт приоритет (первый по порядку игрок паруется первым,
    перебираются его возможные соперники по порядку списка).
    Возвращает список пар [(p1, p2), ...] или None, если решения нет."""
    n = len(unpaired)
    if n == 0:
        return []

    used = [False] * n
    result = [None] * (n // 2)

    def backtrack(pair_index, start_from):
        if pair_index == n // 2:
            return True
        i = start_from
        while used[i]:
            i += 1
        used[i] = True
        for j in range(i + 1, n):
            if used[j]:
                continue
            if frozenset({unpaired[i]['id'], unpaired[j]['id']}) in previous_pairs:
                continue
            used[j] = True
            result[pair_index] = (unpaired[i], unpaired[j])
            if backtrack(pair_index + 1, i + 1):
                return True
            used[j] = False
        used[i] = False
        return False

    if backtrack(0, 0):
        return result
    return None


def make_pairings(players, previous_pairs, bye_used_ids, round_number=1):
    """
    players: list of dict {id, points, rating, color_balance}
    previous_pairs: set of frozenset({id1, id2}) — уже сыгранные пары
    bye_used_ids: set игроков, которые уже получали бай
    round_number: номер тура — 1-й тур жеребьюется полностью случайно

    Возвращает список пар: [{'white_id':.., 'black_id':.., 'bye': False}, ...]
    либо None, если тур без повторных встреч составить невозможно.
    """
    if round_number <= 1:
        pool = players[:]
        random.shuffle(pool)
    else:
        pool = sorted(players, key=lambda p: (-p['points'], -p['rating']))

    # Нечётное число участников — бай получает игрок с наименьшим числом очков,
    # который ещё не получал бай. Если такого нет — минимально очковый игрок.
    bye_pair = None
    unpaired = pool[:]
    if len(unpaired) % 2 == 1:
        for i in range(len(unpaired) - 1, -1, -1):
            if unpaired[i]['id'] not in bye_used_ids:
                bye_player = unpaired.pop(i)
                bye_pair = {'white_id': bye_player['id'], 'black_id': None, 'bye': True}
                break
        else:
            bye_player = unpaired.pop()
            bye_pair = {'white_id': bye_player['id'], 'black_id': None, 'bye': True}

    matched = _find_pairing_without_repeats(unpaired, previous_pairs)
    if matched is None:
        return None

    pairs = []
    if bye_pair:
        pairs.append(bye_pair)

    for p1, p2 in matched:
        if p1['color_balance'] > p2['color_balance']:
            white, black = p2, p1
        elif p1['color_balance'] < p2['color_balance']:
            white, black = p1, p2
        else:
            white, black = p1, p2
        pairs.append({'white_id': white['id'], 'black_id': black['id'], 'bye': False})

    return pairs


def compute_buchholz(cur, tournament_id):
    """Коэффициент Бухгольца каждого игрока — сумма очков всех его соперников
    (по сыгранным партиям, бай не учитывается как соперник)."""
    cur.execute(
        "SELECT id, points FROM tournament_players WHERE tournament_id = %s",
        (tournament_id,)
    )
    points_by_id = {r[0]: float(r[1]) for r in cur.fetchall()}

    cur.execute(
        """SELECT white_player_id, black_player_id FROM tournament_games
           WHERE tournament_id = %s AND black_player_id IS NOT NULL""",
        (tournament_id,)
    )
    buchholz = {pid: 0.0 for pid in points_by_id}
    for white_id, black_id in cur.fetchall():
        if white_id in buchholz:
            buchholz[white_id] += points_by_id.get(black_id, 0.0)
        if black_id in buchholz:
            buchholz[black_id] += points_by_id.get(white_id, 0.0)
    return buchholz


def update_buchholz(cur, tournament_id):
    buchholz = compute_buchholz(cur, tournament_id)
    for player_id, value in buchholz.items():
        cur.execute(
            "UPDATE tournament_players SET buchholz = %s WHERE id = %s",
            (value, player_id)
        )


def compute_head_to_head(cur, tournament_id):
    """Для каждой упорядоченной пары игроков (a, b) — сколько очков a набрал
    в личных партиях против b (бай не считается — там нет соперника)."""
    cur.execute(
        """SELECT white_player_id, black_player_id, result FROM tournament_games
           WHERE tournament_id = %s AND black_player_id IS NOT NULL AND status = 'finished' AND result IS NOT NULL""",
        (tournament_id,)
    )
    h2h = {}
    for white_id, black_id, result in cur.fetchall():
        if result == '1-0':
            white_score, black_score = 1.0, 0.0
        elif result == '0-1':
            white_score, black_score = 0.0, 1.0
        elif result == '1/2-1/2':
            white_score, black_score = 0.5, 0.5
        else:
            continue
        h2h[(white_id, black_id)] = h2h.get((white_id, black_id), 0.0) + white_score
        h2h[(black_id, white_id)] = h2h.get((black_id, white_id), 0.0) + black_score
    return h2h


def assign_places(cur, tournament_id):
    """Проставляет итоговые места: очки → Бухгольц → личная встреча между претендентами
    на одинаковое место → число побед → рейтинг.

    Личные встречи считаются только внутри группы игроков с полностью одинаковыми
    очками и Бухгольцем — сравнивается, сколько очков они набрали друг против друга
    в сыгранных между ними партиях."""
    update_buchholz(cur, tournament_id)
    cur.execute(
        "SELECT id, points, buchholz, wins, rating FROM tournament_players WHERE tournament_id = %s",
        (tournament_id,)
    )
    players = [
        {'id': r[0], 'points': float(r[1]), 'buchholz': float(r[2]), 'wins': r[3], 'rating': r[4]}
        for r in cur.fetchall()
    ]
    h2h = compute_head_to_head(cur, tournament_id)

    players.sort(key=lambda p: (-p['points'], -p['buchholz']))

    ordered = []
    i, n = 0, len(players)
    while i < n:
        j = i
        key = (players[i]['points'], players[i]['buchholz'])
        while j < n and (players[j]['points'], players[j]['buchholz']) == key:
            j += 1
        group = players[i:j]
        if len(group) > 1:
            group_ids = {p['id'] for p in group}
            for p in group:
                p['h2h_score'] = sum(h2h.get((p['id'], opp_id), 0.0) for opp_id in group_ids if opp_id != p['id'])
            group.sort(key=lambda p: (-p['h2h_score'], -p['wins'], -p['rating']))
        ordered.extend(group)
        i = j

    for place, p in enumerate(ordered, start=1):
        cur.execute("UPDATE tournament_players SET place = %s WHERE id = %s", (place, p['id']))