INSERT INTO tournament_games (round_id, tournament_id, white_player_id, black_player_id, is_bye, status, white_time_ms, black_time_ms, increment_ms, started_at, last_move_at)
VALUES (73, 25, 88, 89, false, 'active', 300000, 300000, 3000, now(), now())
RETURNING id;
