ALTER TABLE t_p58220589_site_structure_repli.tournament_games
    ADD COLUMN IF NOT EXISTS moves JSONB NOT NULL DEFAULT '[]'::jsonb;