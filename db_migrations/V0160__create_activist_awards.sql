CREATE TABLE IF NOT EXISTS t_p58220589_site_structure_repli.activist_awards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p58220589_site_structure_repli.users(id),
  month VARCHAR(7) NOT NULL,
  place SMALLINT NOT NULL CHECK (place BETWEEN 1 AND 3),
  points INTEGER NOT NULL DEFAULT 0,
  tournaments INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_activist_awards_month ON t_p58220589_site_structure_repli.activist_awards(month);