UPDATE tournament_games SET
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn = '', turn = 'white', status = 'active', result = NULL, result_reason = NULL,
  white_time_ms = 300000, black_time_ms = 300000, last_move_at = NULL, draw_offered_by = NULL,
  moves = '[]'::jsonb, started_at = now(), finished_at = NULL
WHERE id = 124;
