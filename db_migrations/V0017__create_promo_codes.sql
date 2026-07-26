CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_by_application_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);