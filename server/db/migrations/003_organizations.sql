CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE organization_memberships (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('learn','host','ops')), version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,user_id,role));
INSERT INTO organizations VALUES ('10000000-0000-4000-8000-000000001001','IRIVA','I','#12658a',1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
ALTER TABLE households ADD COLUMN organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001' REFERENCES organizations(id);
ALTER TABLE applications ADD COLUMN organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001' REFERENCES organizations(id);
INSERT INTO organization_memberships SELECT 'org-' || id, '10000000-0000-4000-8000-000000001001',id,CASE WHEN id='10000000-0000-4000-8000-000000000006' THEN 'ops' WHEN id IN (SELECT host_id FROM households) THEN 'host' ELSE 'learn' END,1,created_at,updated_at FROM users;
CREATE INDEX households_organization ON households(organization_id);
CREATE INDEX applications_organization ON applications(organization_id);
CREATE INDEX organization_memberships_user ON organization_memberships(user_id);
