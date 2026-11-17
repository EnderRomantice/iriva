CREATE TABLE iriva.household_message_reactions (
 message_id TEXT NOT NULL REFERENCES iriva.household_messages(id), household_id TEXT NOT NULL REFERENCES iriva.households(id),
 user_id TEXT NOT NULL REFERENCES iriva.users(id), emoji TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(message_id,user_id,emoji)
);
CREATE INDEX household_reactions_recent ON iriva.household_message_reactions(household_id,created_at);

ALTER TABLE iriva.household_message_reactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.household_message_reactions TO iriva_runtime;
CREATE POLICY server_access ON iriva.household_message_reactions TO iriva_runtime USING (true) WITH CHECK (true);
