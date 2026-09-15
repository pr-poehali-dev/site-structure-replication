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


def assign_places(cur, tournament_id):
    """Проставляет итоговые места: очки → Бухгольц → число побед → рейтинг."""
    update_buchholz(cur, tournament_id)
    cur.execute(
        """SELECT id FROM tournament_players WHERE tournament_id = %s
           ORDER BY points DESC, buchholz DESC, wins DESC, rating DESC""",
        (tournament_id,)
    )
    for place, (player_id,) in enumerate(cur.fetchall(), start=1):
        cur.execute("UPDATE tournament_players SET place = %s WHERE id = %s", (place, player_id))
