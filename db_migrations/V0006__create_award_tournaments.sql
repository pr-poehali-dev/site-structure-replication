CREATE TABLE IF NOT EXISTS award_tournaments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);