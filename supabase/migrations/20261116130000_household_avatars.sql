CREATE TABLE iriva.household_avatars (household_id TEXT PRIMARY KEY REFERENCES iriva.households(id) ON DELETE CASCADE, data_url TEXT NOT NULL, updated_at TEXT NOT NULL);

ALTER TABLE iriva.household_avatars ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.household_avatars TO iriva_runtime;
CREATE POLICY server_access ON iriva.household_avatars TO iriva_runtime USING (true) WITH CHECK (true);
