ALTER TABLE t_p58220589_site_structure_repli.orders
  ADD COLUMN IF NOT EXISTS order_type character varying(20) NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS items_data jsonb NULL,
  ADD COLUMN IF NOT EXISTS award_order_id integer NULL REFERENCES t_p58220589_site_structure_repli.award_orders(id);