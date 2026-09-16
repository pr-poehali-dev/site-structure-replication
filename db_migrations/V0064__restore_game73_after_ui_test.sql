UPDATE tournament_games SET status = 'finished', result = '0-1', result_reason = 'first_move_timeout', draw_offered_by = NULL, pgn = '', turn = 'white' WHERE id = 73;
