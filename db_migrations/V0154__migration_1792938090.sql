ALTER TABLE electronic_results ADD COLUMN IF NOT EXISTS thanks_rating_limit VARCHAR(100);
ALTER TABLE electronic_results ADD COLUMN IF NOT EXISTS thanks_text_color VARCHAR(10) DEFAULT 'black';