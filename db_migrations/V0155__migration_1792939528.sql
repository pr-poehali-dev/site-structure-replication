ALTER TABLE electronic_results ADD COLUMN IF NOT EXISTS nom_rating_limit VARCHAR(100);
ALTER TABLE electronic_results ADD COLUMN IF NOT EXISTS nom_text_color VARCHAR(10) DEFAULT 'black';
ALTER TABLE electronic_results ADD COLUMN IF NOT EXISTS awards_enabled BOOLEAN NOT NULL DEFAULT TRUE;