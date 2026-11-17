CREATE TABLE household_message_reactions (
 message_id TEXT NOT NULL REFERENCES household_messages(id), household_id TEXT NOT NULL REFERENCES households(id),
 user_id TEXT NOT NULL REFERENCES users(id), emoji TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(message_id,user_id,emoji)
);
CREATE INDEX household_reactions_recent ON household_message_reactions(household_id,created_at);
