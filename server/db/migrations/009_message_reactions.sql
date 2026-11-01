ALTER TABLE messages ADD COLUMN reactions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(reactions));
