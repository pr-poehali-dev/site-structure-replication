-- Временные тестовые данные для проверки турнирного зала (визуальная проверка UI)
INSERT INTO tournament_players (tournament_id, user_id, application_id, fio, rating, points, buchholz)
SELECT 14, NULL, a.id, a.fio, 1200 + (a.id % 5) * 50, 0, 0
FROM applications a WHERE a.tournament_id = 14 AND a.status = 'paid'
ON CONFLICT (tournament_id, application_id) DO NOTHING;
