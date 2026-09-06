-- Временные тестовые данные: тур 1 с несколькими партиями для визуальной проверки зала
INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
VALUES (14, 1, 'active', now())
ON CONFLICT (tournament_id, round_number) DO NOTHING;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, status, white_time_ms, black_time_ms, started_at, last_move_at)
SELECT r.id, 14, 1, 2, 'active', 600000, 600000, now(), now()
FROM tournament_rounds r WHERE r.tournament_id = 14 AND r.round_number = 1
ON CONFLICT DO NOTHING;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, status, result, result_reason, white_time_ms, black_time_ms, started_at, finished_at)
SELECT r.id, 14, 3, 4, 'finished', '1-0', 'checkmate', 550000, 480000, now(), now()
FROM tournament_rounds r WHERE r.tournament_id = 14 AND r.round_number = 1
ON CONFLICT DO NOTHING;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, status, white_time_ms, black_time_ms, started_at, last_move_at)
SELECT r.id, 14, 5, 6, 'active', 590000, 600000, now(), now()
FROM tournament_rounds r WHERE r.tournament_id = 14 AND r.round_number = 1
ON CONFLICT DO NOTHING;
