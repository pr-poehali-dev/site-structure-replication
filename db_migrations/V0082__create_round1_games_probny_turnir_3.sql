INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, result, result_reason, white_time_ms, black_time_ms, increment_ms, started_at, finished_at)
VALUES (64, 24, 81, NULL, true, 'finished', '1-0', 'bye', 180000, 180000, 2000, now(), now());
UPDATE tournament_players SET points = points + 1, byes_used = byes_used + 1 WHERE id = 81;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
VALUES (64, 24, 82, 83, false, 'active', 180000, 180000, 2000, now(), now());
UPDATE tournament_players SET color_balance = color_balance + 1 WHERE id = 82;
UPDATE tournament_players SET color_balance = color_balance - 1 WHERE id = 83;

INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
VALUES (64, 24, 84, 85, false, 'active', 180000, 180000, 2000, now(), now());
UPDATE tournament_players SET color_balance = color_balance + 1 WHERE id = 84;
UPDATE tournament_players SET color_balance = color_balance - 1 WHERE id = 85;
