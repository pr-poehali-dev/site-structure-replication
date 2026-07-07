ALTER TABLE orders ADD COLUMN IF NOT EXISTS yookassa_payment_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_orders_yookassa_payment_id ON orders(yookassa_payment_id);