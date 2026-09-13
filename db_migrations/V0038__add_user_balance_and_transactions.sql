ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS balance_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(10,2) NOT NULL,
    type VARCHAR(20) NOT NULL,
    description TEXT,
    application_id INTEGER REFERENCES applications(id),
    order_id INTEGER REFERENCES orders(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_id ON balance_transactions(user_id);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS paid_from_balance BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);