CREATE TABLE IF NOT EXISTS olympiad_results (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_results (
    id SERIAL PRIMARY KEY,
    number INTEGER,
    date DATE,
    title TEXT NOT NULL,
    fsr_rating TEXT,
    protocol_url TEXT,
    regulation_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
