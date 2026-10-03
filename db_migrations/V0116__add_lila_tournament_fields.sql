ALTER TABLE tournaments
    ADD COLUMN lila_tournament_id VARCHAR(32),
    ADD COLUMN lila_tournament_kind VARCHAR(10) NOT NULL DEFAULT 'swiss',
    ADD COLUMN lila_tournament_password VARCHAR(100);

ALTER TABLE lila_bridge_tokens
    ADD COLUMN tournament_id INTEGER;