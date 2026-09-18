INSERT INTO tournament_players (tournament_id, user_id, fio, rating, active)
VALUES
  (25, 7, 'Тестов1 t1', 1022, true),
  (25, 8, 'Тестов2 t2', 1053, true)
RETURNING id, user_id;
