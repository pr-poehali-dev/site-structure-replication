UPDATE users SET balance = balance + 50 WHERE email IN ('t1@t1.ru','t2@t2.ru','t3@t3.ru','t4@t4.ru','t5@t5.ru','t6@t6.ru','t7@t7.ru','t8@t8.ru','t9@t9.ru','t10@t10.ru');

INSERT INTO balance_transactions (user_id, amount, type, description)
SELECT id, 50, 'deposit', 'Начисление тестового баланса'
FROM users WHERE email IN ('t1@t1.ru','t2@t2.ru','t3@t3.ru','t4@t4.ru','t5@t5.ru','t6@t6.ru','t7@t7.ru','t8@t8.ru','t9@t9.ru','t10@t10.ru');
