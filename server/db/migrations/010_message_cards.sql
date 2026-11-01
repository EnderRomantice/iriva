CREATE TABLE messages_with_cards (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reactions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(reactions)),
  cards TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(cards) AND json_type(cards)='array' AND json_array_length(cards)<=5),
  CHECK(length(trim(body))>0 OR json_array_length(cards)>0)
);
INSERT INTO messages_with_cards (id,channel_id,author_id,body,version,created_at,updated_at,reactions)
SELECT id,channel_id,author_id,body,version,created_at,updated_at,reactions FROM messages;
DROP TABLE messages;
ALTER TABLE messages_with_cards RENAME TO messages;
CREATE INDEX messages_channel_time ON messages(channel_id,created_at,id);
