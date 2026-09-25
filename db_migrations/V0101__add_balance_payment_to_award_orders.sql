ALTER TABLE award_orders ADD COLUMN user_id integer NULL REFERENCES users(id);
ALTER TABLE award_orders ADD COLUMN paid_from_balance boolean NOT NULL DEFAULT false;