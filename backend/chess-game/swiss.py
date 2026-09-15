"""Подсчёт коэффициента Бухгольца и итоговых мест по завершении турнира.

Дублирует одноимённые функции из backend/tournament-hall/swiss.py — используется
при завершении последней партии последнего тура турнира (index.py вызывает
эти функции сразу в момент завершения партии, чтобы медали и порядок в таблице
появились без ожидания захода кого-либо в турнирный зал).
"""


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
