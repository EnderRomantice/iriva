ALTER TABLE iriva.team_members ADD COLUMN role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff'));
CREATE TABLE iriva.password_attempts (email TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE INDEX password_attempts_email ON iriva.password_attempts(email, created_at);

ALTER TABLE iriva.password_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.password_attempts TO iriva_runtime;
CREATE POLICY server_access ON iriva.password_attempts TO iriva_runtime USING (true) WITH CHECK (true);
