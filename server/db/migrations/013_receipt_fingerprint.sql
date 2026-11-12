CREATE TABLE mutation_fingerprints (
  actor_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  PRIMARY KEY (actor_id, command_id),
  FOREIGN KEY (actor_id, command_id) REFERENCES mutation_receipts(actor_id, command_id) ON DELETE CASCADE
);
