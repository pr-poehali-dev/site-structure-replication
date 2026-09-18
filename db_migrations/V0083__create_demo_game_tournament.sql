INSERT INTO tournaments (title, description, time_control, status, hall_open, rounds_count, hall_status, rating_type, round_break_seconds)
VALUES ('Тестовая партия t1 vs t2 (админ)', 'Служебная статичная партия для быстрой проверки функциональности игры. Не участвует в общих турнирах.', '5+3', 'archived', false, 9999, 'active', 'blitz', 5)
RETURNING id;
