-- Применяем изменение рейтинга МШ (блиц) по итогам тестового турнира — не сработало из-за бага, уже исправленного
UPDATE users SET rating_blitz = 1016 WHERE id = 10; -- t4
UPDATE users SET rating_blitz = 1016 WHERE id = 11; -- t5
UPDATE users SET rating_blitz = 1000 WHERE id = 9;  -- t3
UPDATE users SET rating_blitz = 1000 WHERE id = 7;  -- t1
UPDATE users SET rating_blitz = 968  WHERE id = 8;  -- t2

INSERT INTO rating_history (user_id, tournament_id, tournament_title, rating_type, rating_before, rating_after, delta, points, expected_points, games_count)
VALUES
  (10, 20, 'Тестовый 1 ', 'blitz', 1000, 1016, 16.0, 3.0, 2.5, 5),
  (11, 20, 'Тестовый 1 ', 'blitz', 1000, 1016, 16.0, 2.5, 2.0, 4),
  (9,  20, 'Тестовый 1 ', 'blitz', 1000, 1000, 0.0,  2.0, 2.0, 4),
  (7,  20, 'Тестовый 1 ', 'blitz', 1000, 1000, 0.0,  2.0, 2.0, 4),
  (8,  20, 'Тестовый 1 ', 'blitz', 1000, 968,  -32.0, 0.5, 1.5, 3)
ON CONFLICT (user_id, tournament_id) DO NOTHING;
