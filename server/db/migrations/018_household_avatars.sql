CREATE TABLE household_avatars (household_id TEXT PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE, data_url TEXT NOT NULL, updated_at TEXT NOT NULL);
