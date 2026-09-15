-- wins тоже задвоился тем же багом (1 лишняя победа full-move timeout)
UPDATE tournament_players SET wins = 3 WHERE id = 54 AND tournament_id = 20;
