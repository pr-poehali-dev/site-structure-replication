CREATE TABLE IF NOT EXISTS t_p58220589_site_structure_repli.avatar_bonuses (
  user_id INTEGER PRIMARY KEY REFERENCES t_p58220589_site_structure_repli.users(id),
  awarded_at TIMESTAMP NOT NULL DEFAULT now()
);