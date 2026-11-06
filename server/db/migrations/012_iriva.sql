CREATE TABLE iriva_memory (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE TABLE iriva_contacts (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  PRIMARY KEY (owner_id, organization_id, peer_id)
);
