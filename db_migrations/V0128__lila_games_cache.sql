CREATE TABLE IF NOT EXISTS lila_games (
    game_id VARCHAR(16) PRIMARY KEY,
    tournament_id INTEGER NOT NULL,
    white_username VARCHAR(64),
    black_username VARCHAR(64),
    winner VARCHAR(8),
    status VARCHAR(32),
    speed VARCHAR(16),
    moves_count INTEGER NOT NULL DEFAULT 0,
    last_fen TEXT,
    created_at_ms BIGINT,
    last_move_ms BIGINT
);

CREATE INDEX IF NOT EXISTS idx_lila_games_tournament ON lila_games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_lila_games_white ON lila_games(lower(white_username));
CREATE INDEX IF NOT EXISTS idx_lila_games_black ON lila_games(lower(black_username));

CREATE TABLE IF NOT EXISTS lila_tournament_sync (
    tournament_id INTEGER PRIMARY KEY,
    synced_at TIMESTAMP NOT NULL DEFAULT now(),
    is_finished BOOLEAN NOT NULL DEFAULT false
);