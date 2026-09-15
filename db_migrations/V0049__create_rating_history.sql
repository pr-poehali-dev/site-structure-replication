CREATE TABLE rating_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  tournament_title TEXT NOT NULL,
  rating_type VARCHAR(10) NOT NULL,
  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  delta NUMERIC(6,2) NOT NULL,
  points NUMERIC(4,1) NOT NULL,
  expected_points NUMERIC(6,3) NOT NULL,
  games_count INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);
CREATE INDEX idx_rating_history_user ON rating_history(user_id, created_at DESC);
