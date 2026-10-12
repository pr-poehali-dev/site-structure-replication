CREATE TABLE IF NOT EXISTS puzzles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    fen TEXT NOT NULL,
    solution TEXT NOT NULL,
    difficulty INTEGER NOT NULL DEFAULT 1,
    theme VARCHAR(100),
    hint TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS puzzle_solves (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    puzzle_id INTEGER NOT NULL,
    solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, puzzle_id)
);

CREATE INDEX IF NOT EXISTS idx_puzzle_solves_puzzle ON puzzle_solves (puzzle_id);