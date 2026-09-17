INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, result, result_reason, white_time_ms, black_time_ms, increment_ms, started_at, finished_at)
VALUES (58, 23, 76, NULL, true, 'finished', '1-0', 'bye', 180000, 180000, 2000, now(), now());
UPDATE tournament_players SET points = points + 1, byes_used = byes_used + 1 WHERE id = 76;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
VALUES (58, 23, 77, 78, false, 'active', 180000, 180000, 2000, now(), now());
UPDATE tournament_players SET color_balance = color_balance + 1 WHERE id = 77;
UPDATE tournament_players SET color_balance = color_balance - 1 WHERE id = 78;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
VALUES (58, 23, 79, 80, false, 'active', 180000, 180000, 2000, now(), now());
UPDATE tournament_players SET color_balance = color_balance + 1 WHERE id = 79;
UPDATE tournament_players SET color_balance = color_balance - 1 WHERE id = 80;
