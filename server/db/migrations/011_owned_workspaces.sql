ALTER TABLE organizations ADD COLUMN kind TEXT NOT NULL DEFAULT 'platform' CHECK(kind IN ('platform','personal','host'));
ALTER TABLE organizations ADD COLUMN owner_id TEXT REFERENCES users(id);
ALTER TABLE organizations ADD COLUMN parent_id TEXT REFERENCES organizations(id);
ALTER TABLE organizations ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX one_primary_workspace ON organizations(owner_id) WHERE is_primary=1;
CREATE TABLE host_grants (
 id TEXT PRIMARY KEY, platform_id TEXT NOT NULL REFERENCES organizations(id),
 email TEXT NOT NULL COLLATE NOCASE, user_id TEXT REFERENCES users(id),
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 UNIQUE(platform_id,email)
);
CREATE TABLE group_requests (
 id TEXT PRIMARY KEY, platform_id TEXT NOT NULL REFERENCES organizations(id),
 host_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 workspace_id TEXT REFERENCES organizations(id), reviewed_by TEXT REFERENCES users(id),
 review_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, reviewed_at TEXT
);
CREATE UNIQUE INDEX one_pending_group_request ON group_requests(platform_id,host_id) WHERE status='pending';
CREATE TRIGGER one_group_per_owned_workspace BEFORE INSERT ON households
WHEN EXISTS(SELECT 1 FROM organizations WHERE id=NEW.organization_id AND kind <> 'platform')
AND EXISTS(SELECT 1 FROM households WHERE organization_id=NEW.organization_id)
BEGIN SELECT RAISE(ABORT,'A workspace already has a group'); END;
