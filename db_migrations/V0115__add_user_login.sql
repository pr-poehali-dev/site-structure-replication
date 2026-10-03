ALTER TABLE users ADD COLUMN login VARCHAR(20);
CREATE UNIQUE INDEX idx_users_login_lower ON users (lower(login)) WHERE login IS NOT NULL;