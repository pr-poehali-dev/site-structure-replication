"""Логика швейцарской жеребьёвки для шахматных турниров.

Первый тур: полностью случайная жеребьёвка (перемешивание списка участников).
Со 2-го тура: игроки сортируются по очкам (затем рейтингу), разбиваются на пары
внутри групп с одинаковыми очками, избегая повторных встреч. Игрок, которому
не хватило пары, получает технический бай (если он ещё не получал бай в этом
турнире).
"""
import random


def make_pairings(players, previous_pairs, bye_used_ids, round_number=1):
    """
    players: list of dict {id, points, rating, color_balance}
    previous_pairs: set of frozenset({id1, id2}) — уже сыгранные пары
    bye_used_ids: set игроков, которые уже получали бай
    round_number: номер тура — 1-й тур жеребьюется полностью случайно

    Возвращает список пар: [{'white_id':.., 'black_id':.., 'bye': False}, ...]
    """
    if round_number <= 1:
        pool = players[:]
        random.shuffle(pool)
    else:
        pool = sorted(players, key=lambda p: (-p['points'], -p['rating']))
    pairs = []
    unpaired = pool[:]

    # Нечётное число участников — бай получает игрок с наименьшим числом очков,
    # который ещё не получал бай
    if len(unpaired) % 2 == 1:
        for i in range(len(unpaired) - 1, -1, -1):
            if unpaired[i]['id'] not in bye_used_ids:
                bye_player = unpaired.pop(i)
                pairs.append({'white_id': bye_player['id'], 'black_id': None, 'bye': True})
                break
        else:
            bye_player = unpaired.pop()
            pairs.append({'white_id': bye_player['id'], 'black_id': None, 'bye': True})

    used = set()
    for i in range(len(unpaired)):
        if unpaired[i]['id'] in used:
            continue
        p1 = unpaired[i]
        opponent = None
        for j in range(i + 1, len(unpaired)):
            p2 = unpaired[j]
            if p2['id'] in used:
                continue
            if frozenset({p1['id'], p2['id']}) in previous_pairs:
                continue
            opponent = p2
            break
        if opponent is None:
            for j in range(i + 1, len(unpaired)):
                p2 = unpaired[j]
                if p2['id'] not in used:
                    opponent = p2
                    break
        if opponent is None:
            continue
        used.add(p1['id'])
        used.add(opponent['id'])

        if p1['color_balance'] > opponent['color_balance']:
            white, black = opponent, p1
        elif p1['color_balance'] < opponent['color_balance']:
            white, black = p1, opponent
        else:
            white, black = p1, opponent

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
    """Проставляет итоговые места: очки → Бухгольц → число побед → личные встречи
    между претендентами на одинаковое место → рейтинг.

    Личные встречи считаются только внутри группы игроков с полностью
    одинаковыми очками/Бухгольцем/победами — сравнивается, сколько очков они
    набрали друг против друга в сыгранных между ними партиях."""
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

    players.sort(key=lambda p: (-p['points'], -p['buchholz'], -p['wins']))

    ordered = []
    i, n = 0, len(players)
    while i < n:
        j = i
        key = (players[i]['points'], players[i]['buchholz'], players[i]['wins'])
        while j < n and (players[j]['points'], players[j]['buchholz'], players[j]['wins']) == key:
            j += 1
        group = players[i:j]
        if len(group) > 1:
            group_ids = {p['id'] for p in group}
            for p in group:
                p['h2h_score'] = sum(h2h.get((p['id'], opp_id), 0.0) for opp_id in group_ids if opp_id != p['id'])
            group.sort(key=lambda p: (-p['h2h_score'], -p['rating']))
        ordered.extend(group)
        i = j

    for place, p in enumerate(ordered, start=1):
        cur.execute("UPDATE tournament_players SET place = %s WHERE id = %s", (place, p['id']))