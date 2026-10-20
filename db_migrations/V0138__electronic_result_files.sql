CREATE TABLE IF NOT EXISTS electronic_result_files (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL,
    username VARCHAR(100) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_er_files ON electronic_result_files (tournament_id, lower(username), kind);