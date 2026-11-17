ALTER TABLE team_members ADD COLUMN role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff'));
CREATE TABLE password_attempts (email TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX password_attempts_email ON password_attempts(email, created_at);
