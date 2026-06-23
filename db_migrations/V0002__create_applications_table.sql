CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  tournament_title TEXT,
  fio TEXT NOT NULL,
  age TEXT,
  fsr_id TEXT,
  coach TEXT,
  country_city TEXT,
  school TEXT,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);