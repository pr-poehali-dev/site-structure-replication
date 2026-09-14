CREATE TABLE IF NOT EXISTS fsr_rating_upload_chunks (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_b64 TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fsr_chunks_session ON fsr_rating_upload_chunks (session_id, chunk_index);