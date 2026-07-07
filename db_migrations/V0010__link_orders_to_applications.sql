ALTER TABLE orders ADD COLUMN IF NOT EXISTS application_id INTEGER REFERENCES applications(id);
CREATE INDEX IF NOT EXISTS idx_orders_application_id ON orders(application_id);