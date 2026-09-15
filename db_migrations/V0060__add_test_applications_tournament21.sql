INSERT INTO applications (tournament_id, tournament_title, fio, age, user_id, status, price)
SELECT 21, 'Тестовый 2', fio, age, user_id, 'paid', 0
FROM applications
WHERE tournament_id = 20 AND user_id IN (7,8,9,10,11);
