ALTER TABLE electronic_results ALTER COLUMN awards_enabled SET DEFAULT FALSE;
UPDATE electronic_results SET awards_enabled = FALSE;