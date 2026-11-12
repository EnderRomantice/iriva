-- Keep the existing receipt row shape compatible with the previous application version.
CREATE TABLE iriva.mutation_fingerprints (
  actor_id text NOT NULL,
  command_id text NOT NULL,
  fingerprint text NOT NULL,
  PRIMARY KEY (actor_id, command_id),
  FOREIGN KEY (actor_id, command_id) REFERENCES iriva.mutation_receipts(actor_id, command_id) ON DELETE CASCADE
);
ALTER TABLE iriva.mutation_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON iriva.mutation_fingerprints TO iriva_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.mutation_fingerprints TO iriva_runtime;
