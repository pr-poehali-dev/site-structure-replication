CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  location TEXT,
  age_category TEXT,
  price NUMERIC(10, 2),
  fsr_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);