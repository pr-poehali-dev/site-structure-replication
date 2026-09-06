ALTER TABLE tournaments ADD COLUMN rounds_count INTEGER NOT NULL DEFAULT 5;
ALTER TABLE tournaments ADD COLUMN hall_status VARCHAR(20) NOT NULL DEFAULT 'not_started';
ALTER TABLE tournaments ADD COLUMN round_break_seconds INTEGER NOT NULL DEFAULT 60;

CREATE TABLE tournament_players (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  user_id INTEGER REFERENCES users(id),
  application_id INTEGER REFERENCES applications(id),
  fio VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1200,
  points NUMERIC(4,1) NOT NULL DEFAULT 0,
  buchholz NUMERIC(6,2) NOT NULL DEFAULT 0,
  byes_used INTEGER NOT NULL DEFAULT 0,
  color_balance INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, application_id)
);

CREATE TABLE tournament_rounds (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  round_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, round_number)
);

CREATE TABLE tournament_games (
  id SERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES tournament_rounds(id),
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  white_player_id INTEGER REFERENCES tournament_players(id),
  black_player_id INTEGER REFERENCES tournament_players(id),
  is_bye BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result VARCHAR(10),
  result_reason VARCHAR(30),
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn TEXT NOT NULL DEFAULT '',
  turn VARCHAR(5) NOT NULL DEFAULT 'white',
  white_time_ms INTEGER NOT NULL DEFAULT 600000,
  black_time_ms INTEGER NOT NULL DEFAULT 600000,
  increment_ms INTEGER NOT NULL DEFAULT 0,
  last_move_at TIMESTAMP,
  draw_offered_by INTEGER,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE game_chat_messages (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES tournament_games(id),
  player_id INTEGER REFERENCES tournament_players(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX idx_tournament_games_round ON tournament_games(round_id);
CREATE INDEX idx_tournament_games_tournament ON tournament_games(tournament_id);
CREATE INDEX idx_game_chat_game ON game_chat_messages(game_id);
