INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, paid_from_balance, bonus_paid)
SELECT 41, t.title, u.last_name || ' ' || u.first_name || ' Тестович', EXTRACT(YEAR FROM age(DATE '2026-10-18', u.birth_date))::int::text, u.fsr_id, u.coach_fio, u.country_city, u.institution, u.email, u.phone, 'paid', u.id, false, 0
FROM users u CROSS JOIN tournaments t
WHERE t.id = 41 AND u.id BETWEEN 177 AND 191
AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id AND a.tournament_id = 41);