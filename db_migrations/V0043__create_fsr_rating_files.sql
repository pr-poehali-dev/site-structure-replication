CREATE TABLE IF NOT EXISTS fsr_rating_files (
    id SERIAL PRIMARY KEY,
    rating_type VARCHAR(10) NOT NULL CHECK (rating_type IN ('blitz', 'rapid')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fsr_rating_files_type ON fsr_rating_files (rating_type, uploaded_at DESC);