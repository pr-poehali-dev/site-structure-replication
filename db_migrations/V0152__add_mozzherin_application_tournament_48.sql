INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, price, paid_from_balance, bonus_paid)
SELECT 48, 'Спасибо тренеру', fio, age, fsr_id, coach, country_city, school, email, phone, 'paid', user_id, 0, false, 0
FROM applications WHERE id = 528
AND NOT EXISTS (SELECT 1 FROM applications WHERE user_id = 226 AND tournament_id = 48);