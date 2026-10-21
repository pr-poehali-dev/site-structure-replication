INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, paid_from_balance, price, bonus_paid)
SELECT 44, t.title, trim(concat_ws(' ', u.last_name, u.first_name, u.middle_name)),
       date_part('year', age(u.birth_date))::int::text, u.fsr_id, u.coach_fio, u.country_city, u.institution, u.email, u.phone,
       'paid', u.id, false, 0, 0
FROM users u, tournaments t
WHERE u.id = 226 AND t.id = 44
AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.tournament_id = 44 AND a.user_id = 226);