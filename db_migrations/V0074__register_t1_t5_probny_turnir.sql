INSERT INTO applications (tournament_id, tournament_title, fio, age, user_id, status, price)
SELECT 22, 'Пробный турнир', CONCAT(u.last_name, ' ', u.first_name, ' ', COALESCE(u.middle_name, '')), '10', u.id, 'paid', 0
FROM users u WHERE u.id IN (7,8,9,10,11);
