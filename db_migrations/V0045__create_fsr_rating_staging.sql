CREATE TABLE IF NOT EXISTS fsr_rating_staging (
    fsr_id VARCHAR(100) NOT NULL,
    rating_value INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fsr_rating_staging_fsr_id ON fsr_rating_staging (fsr_id);