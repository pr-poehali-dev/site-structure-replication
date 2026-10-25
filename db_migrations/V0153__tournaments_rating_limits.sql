ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rating_min integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rating_max integer;