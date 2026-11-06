CREATE TABLE iriva.iriva_memory (
  user_id TEXT PRIMARY KEY REFERENCES iriva.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE TABLE iriva.iriva_contacts (
  owner_id TEXT NOT NULL REFERENCES iriva.users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES iriva.organizations(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL REFERENCES iriva.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  PRIMARY KEY (owner_id, organization_id, peer_id)
);
ALTER TABLE iriva.iriva_memory ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON iriva.iriva_memory TO iriva_runtime;
CREATE POLICY server_access ON iriva.iriva_memory TO iriva_runtime USING (true) WITH CHECK (true);
ALTER TABLE iriva.iriva_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON iriva.iriva_contacts TO iriva_runtime;
CREATE POLICY server_access ON iriva.iriva_contacts TO iriva_runtime USING (true) WITH CHECK (true);
