UPDATE users SET balance = balance - 80 WHERE id = 205 AND balance >= 80 AND NOT EXISTS (SELECT 1 FROM balance_transactions WHERE user_id = 205 AND description = 'Корректировка: списание ошибочного возврата взноса');
INSERT INTO balance_transactions (user_id, amount, type, description, application_id, account)
SELECT 205, -80, 'payment', 'Корректировка: списание ошибочного возврата взноса', 531, 'money'
WHERE NOT EXISTS (SELECT 1 FROM balance_transactions WHERE user_id = 205 AND description = 'Корректировка: списание ошибочного возврата взноса');