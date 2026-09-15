-- Пересчёт рейтинга тестового турнира 20 с учётом бая (алгоритм обновлён)
UPDATE users SET rating_blitz = 1016 WHERE id = 10; -- t4 (было 1016, без изменений)
UPDATE users SET rating_blitz = 1032 WHERE id = 11; -- t5 (было 1016 -> 1032, бай учтён)
UPDATE users SET rating_blitz = 1016 WHERE id = 9;  -- t3 (было 1000 -> 1016, бай учтён)
UPDATE users SET rating_blitz = 1016 WHERE id = 7;  -- t1 (было 1000 -> 1016, бай учтён)
UPDATE users SET rating_blitz = 984  WHERE id = 8;  -- t2 (было 968 -> 984, бай учтён)

UPDATE rating_history SET rating_after = 1016, delta = 16.0, points = 3.0, expected_points = 2.5, games_count = 5 WHERE user_id = 10 AND tournament_id = 20;
UPDATE rating_history SET rating_after = 1032, delta = 32.0, points = 3.5, expected_points = 2.5, games_count = 5 WHERE user_id = 11 AND tournament_id = 20;
UPDATE rating_history SET rating_after = 1016, delta = 16.0, points = 3.0, expected_points = 2.5, games_count = 5 WHERE user_id = 9  AND tournament_id = 20;
UPDATE rating_history SET rating_after = 1016, delta = 16.0, points = 3.0, expected_points = 2.5, games_count = 5 WHERE user_id = 7  AND tournament_id = 20;
UPDATE rating_history SET rating_after = 984,  delta = -16.0, points = 1.5, expected_points = 2.0, games_count = 4 WHERE user_id = 8  AND tournament_id = 20;
