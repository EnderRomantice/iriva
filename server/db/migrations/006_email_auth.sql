CREATE TABLE email_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX email_challenges_email_created ON email_challenges(email, created_at);
CREATE TABLE email_identities (user_id TEXT PRIMARY KEY REFERENCES users(id), verified_at INTEGER NOT NULL);
