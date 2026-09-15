"""Пересчёт рейтинга МШ по итогам турнира.

Дублирует backend/tournament-hall/rating.py — используется при завершении
последней партии последнего тура (см. комментарий в chess-game/swiss.py).

Вместо обновления рейтинга после каждой партии считаем суммарное отклонение
фактических очков от ожидаемых по всем партиям турнира и применяем один
итоговый сдвиг (см. R' = R + K * (S_турнир - E_турнир)).

Бай (техническая победа без игры) учитывается как партия против «зеркального»
соперника с точно таким же рейтингом: ожидаемый результат 0,5, фактический —
1,0. Поэтому бай даёт небольшую прибавку к рейтингу (половину от K_FACTOR при
равных рейтингах), как обычная победа над равным по силе соперником, но не
может дать столько же, сколько победа над более сильным игроком.
"""

K_FACTOR = 32


def expected_score(own_rating, opponent_rating):
    return 1.0 / (1.0 + 10 ** ((opponent_rating - own_rating) / 400.0))


def compute_rating_changes(cur, tournament_id):
    """Возвращает список словарей с изменением рейтинга для каждого игрока,
    у которого есть привязанный пользователь и хотя бы одна учтённая партия
    (обычная партия или бай)."""
    cur.execute(
        "SELECT id, user_id, rating FROM tournament_players WHERE tournament_id = %s",
        (tournament_id,)
    )
    players = {r[0]: {'user_id': r[1], 'rating': r[2]} for r in cur.fetchall()}

    cur.execute(
        """SELECT white_player_id, black_player_id, is_bye, result FROM tournament_games
           WHERE tournament_id = %s AND status = 'finished' AND result IS NOT NULL""",
        (tournament_id,)
    )
    games = cur.fetchall()

    actual = {pid: 0.0 for pid in players}
    expected = {pid: 0.0 for pid in players}
    games_count = {pid: 0 for pid in players}

    for white_id, black_id, is_bye, result in games:
        if is_bye:
            if white_id not in players:
                continue
            own_rating = players[white_id]['rating']
            actual[white_id] += 1.0
            expected[white_id] += expected_score(own_rating, own_rating)
            games_count[white_id] += 1
            continue

        if white_id not in players or black_id not in players:
            continue
        white_rating = players[white_id]['rating']
        black_rating = players[black_id]['rating']

        if result == '1-0':
            white_score, black_score = 1.0, 0.0
        elif result == '0-1':
            white_score, black_score = 0.0, 1.0
        elif result == '1/2-1/2':
            white_score, black_score = 0.5, 0.5
        else:
            continue

        actual[white_id] += white_score
        actual[black_id] += black_score
        expected[white_id] += expected_score(white_rating, black_rating)
        expected[black_id] += expected_score(black_rating, white_rating)
        games_count[white_id] += 1
        games_count[black_id] += 1

    changes = []
    for player_id, info in players.items():
        if not info['user_id'] or games_count[player_id] == 0:
            continue
        rating_before = info['rating']
        delta = K_FACTOR * (actual[player_id] - expected[player_id])
        rating_after = round(rating_before + delta)
        changes.append({
            'player_id': player_id,
            'user_id': info['user_id'],
            'rating_before': rating_before,
            'rating_after': rating_after,
            'delta': round(delta, 2),
            'points': actual[player_id],
            'expected_points': round(expected[player_id], 3),
            'games_count': games_count[player_id],
        })
    return changes


def apply_rating_changes(cur, tournament_id, tournament_title, rating_type):
    """Считает и применяет изменение рейтинга МШ ко всем участникам турнира:
    обновляет users.rating_blitz/rating_rapid и пишет запись в rating_history."""
    changes = compute_rating_changes(cur, tournament_id)
    rating_column = 'rating_blitz' if rating_type == 'blitz' else 'rating_rapid'

    for c in changes:
        cur.execute(
            f"UPDATE users SET {rating_column} = %s WHERE id = %s",
            (c['rating_after'], c['user_id'])
        )
        cur.execute(
            """INSERT INTO rating_history
               (user_id, tournament_id, tournament_title, rating_type, rating_before, rating_after, delta, points, expected_points, games_count)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id, tournament_id) DO NOTHING""",
            (c['user_id'], tournament_id, tournament_title, rating_type,
             c['rating_before'], c['rating_after'], c['delta'], c['points'], c['expected_points'], c['games_count'])
        )
    return changes