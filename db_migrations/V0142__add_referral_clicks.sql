CREATE TABLE IF NOT EXISTS referral_clicks (
  id SERIAL PRIMARY KEY,
  referral_code VARCHAR(16) NOT NULL,
  referrer_id INTEGER REFERENCES users(id),
  visitor_id VARCHAR(64),
  is_unique BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer ON referral_clicks(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_created ON referral_clicks(created_at);