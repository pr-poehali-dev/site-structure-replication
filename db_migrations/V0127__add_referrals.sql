ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16) NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

ALTER TABLE balance_transactions ADD COLUMN IF NOT EXISTS source_user_id INTEGER REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_tx_referral_order ON balance_transactions(order_id) WHERE type = 'bonus_referral';