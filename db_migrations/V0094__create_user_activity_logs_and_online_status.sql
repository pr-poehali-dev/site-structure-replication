CREATE TABLE user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_type VARCHAR(20) NOT NULL,
    meta JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX idx_user_activity_logs_event_type ON user_activity_logs(event_type);

CREATE TABLE user_online_status (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    last_seen TIMESTAMP NOT NULL DEFAULT now()
);
