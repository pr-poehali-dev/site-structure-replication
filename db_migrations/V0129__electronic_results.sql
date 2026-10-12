ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(1);

CREATE TABLE IF NOT EXISTS electronic_results (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    age_groups TEXT NOT NULL DEFAULT '[]',
    snapshot TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS electronic_result_nominations (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    kind VARCHAR(30) NOT NULL,
    place INTEGER NOT NULL DEFAULT 1,
    username VARCHAR(100) NOT NULL,
    game_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_er_nominations_tournament ON electronic_result_nominations (tournament_id);