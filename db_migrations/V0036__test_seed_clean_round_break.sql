-- Тест: один завершённый тур, идёт перерыв 50 сек до следующего
UPDATE tournaments SET hall_status = 'active' WHERE id = 18;
INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at, completed_at)
VALUES (18, 1, 'completed', now() - interval '70 seconds', now() - interval '10 seconds');
