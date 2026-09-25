UPDATE award_orders SET status = 'cancelled' WHERE id = 14;
UPDATE users SET balance = balance + 10 WHERE id = 9;
INSERT INTO balance_transactions (user_id, amount, type, description, award_order_id) VALUES (9, 10, 'refund', 'QA cleanup: возврат тестового заказа', 14);