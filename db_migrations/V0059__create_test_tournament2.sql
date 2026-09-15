INSERT INTO tournaments (title, description, date, location, age_category, price, time_control, hall_open, rounds_count, hall_status, round_break_seconds, rating_type, status)
VALUES ('Тестовый 2', 'Тестовый турнир для проверки жеребьёвки без повторов', CURRENT_DATE, 'Онлайн', 'Открытая', 0, '1+0', true, 5, 'not_started', 15, 'blitz', 'open')
RETURNING id;
