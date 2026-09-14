CREATE TABLE IF NOT EXISTS fsr_official_cache (
    fsr_id VARCHAR(100) PRIMARY KEY,
    rating_blitz INTEGER,
    rating_rapid INTEGER,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fsr_official_sync_log (
    id SERIAL PRIMARY KEY,
    synced_at TIMESTAMP NOT NULL DEFAULT now(),
    total_players INTEGER NOT NULL DEFAULT 0,
    matched_users INTEGER NOT NULL DEFAULT 0
);