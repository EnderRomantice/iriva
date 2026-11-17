CREATE TABLE iriva.member_avatars (user_id TEXT PRIMARY KEY REFERENCES iriva.users(id) ON DELETE CASCADE, data_url TEXT NOT NULL, updated_at TEXT NOT NULL);

ALTER TABLE iriva.member_avatars ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.member_avatars TO iriva_runtime;
CREATE POLICY server_access ON iriva.member_avatars TO iriva_runtime USING (true) WITH CHECK (true);
