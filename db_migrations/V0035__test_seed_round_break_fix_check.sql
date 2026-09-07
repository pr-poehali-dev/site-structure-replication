-- Временный тест: симулируем перерыв между турами для турнира 18
UPDATE tournaments SET hall_status = 'active' WHERE id = 18;
INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at, completed_at)
VALUES (18, 1, 'completed', now() - interval '70 seconds', now() - interval '10 seconds')
ON CONFLICT (tournament_id, round_number) DO UPDATE SET status = 'completed', completed_at = now() - interval '10 seconds';
