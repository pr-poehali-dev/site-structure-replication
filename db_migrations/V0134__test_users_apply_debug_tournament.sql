INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, paid_from_balance)
SELECT 37, t.title, u.last_name || ' ' || u.first_name || ' ' || u.middle_name, date_part('year', age(u.birth_date))::int::text, u.fsr_id, u.coach_fio, u.country_city, u.institution, u.email, u.phone, 'paid', u.id, false
FROM users u CROSS JOIN (SELECT title FROM tournaments WHERE id = 37) t
WHERE u.last_name = 'Тестовый' AND u.login ~ '^Test[0-9]+$' AND u.login <> 'Test1'
AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.tournament_id = 37 AND a.user_id = u.id);