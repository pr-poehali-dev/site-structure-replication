INSERT INTO t_p58220589_site_structure_repli.applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, paid_from_balance, bonus_paid)
SELECT 42, 'Тестовый 5', a.fio, a.age, a.fsr_id, a.coach, a.country_city, a.school, a.email, a.phone, 'paid', a.user_id, false, 0
FROM t_p58220589_site_structure_repli.applications a
WHERE a.tournament_id = 41
  AND a.user_id BETWEEN 177 AND 191
  AND NOT EXISTS (SELECT 1 FROM t_p58220589_site_structure_repli.applications x WHERE x.tournament_id = 42 AND x.user_id = a.user_id);