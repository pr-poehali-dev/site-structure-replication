ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE balance_transactions ADD COLUMN IF NOT EXISTS account VARCHAR(10) NOT NULL DEFAULT 'money';

ALTER TABLE applications ADD COLUMN IF NOT EXISTS bonus_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_balance_transactions_account ON balance_transactions(user_id, account);