-- Заполняем профили 10 тестовых пользователей
UPDATE users SET
  middle_name = CASE email
    WHEN 't1@t1.ru' THEN 'Иванович'
    WHEN 't2@t2.ru' THEN 'Петрович'
    WHEN 't3@t3.ru' THEN 'Сергеевич'
    WHEN 't4@t4.ru' THEN 'Александрович'
    WHEN 't5@t5.ru' THEN 'Дмитриевич'
    WHEN 't6@t6.ru' THEN 'Николаевич'
    WHEN 't7@t7.ru' THEN 'Андреевич'
    WHEN 't8@t8.ru' THEN 'Михайлович'
    WHEN 't9@t9.ru' THEN 'Викторович'
    WHEN 't10@t10.ru' THEN 'Олегович'
  END,
  birth_date = CASE email
    WHEN 't1@t1.ru' THEN DATE '2014-03-12'
    WHEN 't2@t2.ru' THEN DATE '2013-07-25'
    WHEN 't3@t3.ru' THEN DATE '2015-01-09'
    WHEN 't4@t4.ru' THEN DATE '2012-11-30'
    WHEN 't5@t5.ru' THEN DATE '2014-05-18'
    WHEN 't6@t6.ru' THEN DATE '2013-09-02'
    WHEN 't7@t7.ru' THEN DATE '2015-06-21'
    WHEN 't8@t8.ru' THEN DATE '2012-02-14'
    WHEN 't9@t9.ru' THEN DATE '2014-10-05'
    WHEN 't10@t10.ru' THEN DATE '2013-04-17'
  END,
  coach_fio = CASE email
    WHEN 't1@t1.ru' THEN 'Смирнова Елена Викторовна'
    WHEN 't2@t2.ru' THEN 'Кузнецов Игорь Петрович'
    WHEN 't3@t3.ru' THEN 'Смирнова Елена Викторовна'
    WHEN 't4@t4.ru' THEN 'Кузнецов Игорь Петрович'
    WHEN 't5@t5.ru' THEN 'Волкова Анна Сергеевна'
    WHEN 't6@t6.ru' THEN 'Волкова Анна Сергеевна'
    WHEN 't7@t7.ru' THEN 'Смирнова Елена Викторовна'
    WHEN 't8@t8.ru' THEN 'Кузнецов Игорь Петрович'
    WHEN 't9@t9.ru' THEN 'Волкова Анна Сергеевна'
    WHEN 't10@t10.ru' THEN 'Смирнова Елена Викторовна'
  END,
  institution = CASE email
    WHEN 't1@t1.ru' THEN 'Школа №5'
    WHEN 't2@t2.ru' THEN 'Школа №12'
    WHEN 't3@t3.ru' THEN 'Школа №5'
    WHEN 't4@t4.ru' THEN 'Гимназия №1'
    WHEN 't5@t5.ru' THEN 'Школа №12'
    WHEN 't6@t6.ru' THEN 'Гимназия №1'
    WHEN 't7@t7.ru' THEN 'Школа №5'
    WHEN 't8@t8.ru' THEN 'Школа №12'
    WHEN 't9@t9.ru' THEN 'Гимназия №1'
    WHEN 't10@t10.ru' THEN 'Школа №5'
  END,
  country_city = CASE email
    WHEN 't1@t1.ru' THEN 'Россия, Москва'
    WHEN 't2@t2.ru' THEN 'Россия, Санкт-Петербург'
    WHEN 't3@t3.ru' THEN 'Россия, Москва'
    WHEN 't4@t4.ru' THEN 'Россия, Казань'
    WHEN 't5@t5.ru' THEN 'Россия, Санкт-Петербург'
    WHEN 't6@t6.ru' THEN 'Россия, Казань'
    WHEN 't7@t7.ru' THEN 'Россия, Москва'
    WHEN 't8@t8.ru' THEN 'Россия, Санкт-Петербург'
    WHEN 't9@t9.ru' THEN 'Россия, Казань'
    WHEN 't10@t10.ru' THEN 'Россия, Москва'
  END,
  phone = CASE email
    WHEN 't1@t1.ru' THEN '+79001112201'
    WHEN 't2@t2.ru' THEN '+79001112202'
    WHEN 't3@t3.ru' THEN '+79001112203'
    WHEN 't4@t4.ru' THEN '+79001112204'
    WHEN 't5@t5.ru' THEN '+79001112205'
    WHEN 't6@t6.ru' THEN '+79001112206'
    WHEN 't7@t7.ru' THEN '+79001112207'
    WHEN 't8@t8.ru' THEN '+79001112208'
    WHEN 't9@t9.ru' THEN '+79001112209'
    WHEN 't10@t10.ru' THEN '+79001112210'
  END
WHERE email IN ('t1@t1.ru','t2@t2.ru','t3@t3.ru','t4@t4.ru','t5@t5.ru','t6@t6.ru','t7@t7.ru','t8@t8.ru','t9@t9.ru','t10@t10.ru');

-- Регистрируем всех десятерых на турнир "Тестовый 1" (id=20), сразу как оплаченных
INSERT INTO applications (tournament_id, tournament_title, fio, age, fsr_id, coach, country_city, school, email, phone, status, user_id, price, paid_from_balance)
SELECT
  20,
  t.title,
  u.last_name || ' ' || u.first_name || COALESCE(' ' || u.middle_name, ''),
  (EXTRACT(YEAR FROM age(u.birth_date)))::text,
  u.fsr_id,
  u.coach_fio,
  u.country_city,
  u.institution,
  u.email,
  u.phone,
  'paid',
  u.id,
  t.price,
  true
FROM users u, tournaments t
WHERE u.email IN ('t1@t1.ru','t2@t2.ru','t3@t3.ru','t4@t4.ru','t5@t5.ru','t6@t6.ru','t7@t7.ru','t8@t8.ru','t9@t9.ru','t10@t10.ru')
  AND t.id = 20
  AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id AND a.tournament_id = 20 AND a.status <> 'cancelled');

-- Списываем взнос с баланса (турнир платный, 10 руб.)
UPDATE users SET balance = balance - 10
WHERE email IN ('t1@t1.ru','t2@t2.ru','t3@t3.ru','t4@t4.ru','t5@t5.ru','t6@t6.ru','t7@t7.ru','t8@t8.ru','t9@t9.ru','t10@t10.ru');

INSERT INTO balance_transactions (user_id, amount, type, description, application_id)
SELECT u.id, -10, 'payment', 'Оплата взноса: Тестовый 1', a.id
FROM users u
JOIN applications a ON a.user_id = u.id AND a.tournament_id = 20
WHERE u.email IN ('t1@t1.ru','t2@t2.ru','t3@t3.ru','t4@t4.ru','t5@t5.ru','t6@t6.ru','t7@t7.ru','t8@t8.ru','t9@t9.ru','t10@t10.ru');
