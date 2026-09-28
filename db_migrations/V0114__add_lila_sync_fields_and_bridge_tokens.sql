ALTER TABLE users
    ADD COLUMN lila_username VARCHAR(20),
    ADD COLUMN lila_password_enc TEXT,
    ADD COLUMN lila_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN lila_sync_error TEXT,
    ADD COLUMN lila_synced_at TIMESTAMP;

CREATE UNIQUE INDEX idx_users_lila_username ON users(lila_username) WHERE lila_username IS NOT NULL;

CREATE TABLE lila_bridge_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_lila_bridge_tokens_token ON lila_bridge_tokens(token);
