ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id);
CREATE INDEX idx_applications_user_id ON applications(user_id);
