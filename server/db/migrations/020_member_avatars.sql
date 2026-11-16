CREATE TABLE member_avatars (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data_url TEXT NOT NULL, updated_at TEXT NOT NULL);
