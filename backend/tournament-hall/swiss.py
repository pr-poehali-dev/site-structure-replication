"""Логика швейцарской жеребьёвки для шахматных турниров.

Упрощённый алгоритм: игроки сортируются по очкам (затем рейтингу),
разбиваются на пары внутри групп с одинаковыми очками, избегая повторных
встреч. Игрок, которому не хватило пары, получает технический бай
(если он ещё не получал бай в этом турнире).
"""


def make_pairings(players, previous_pairs, bye_used_ids):
    """
    players: list of dict {id, points, rating, color_balance}
    previous_pairs: set of frozenset({id1, id2}) — уже сыгранные пары
    bye_used_ids: set игроков, которые уже получали бай

    Возвращает список пар: [{'white_id':.., 'black_id':.., 'bye': False}, ...]
    """
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
