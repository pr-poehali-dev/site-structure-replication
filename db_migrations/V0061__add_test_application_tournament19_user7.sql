INSERT INTO applications (tournament_id, tournament_title, fio, age, user_id, status, price)
SELECT 19, title, 'Тестов1 t1 Иванович', '12', 7, 'new', 0
FROM tournaments WHERE id = 19;
