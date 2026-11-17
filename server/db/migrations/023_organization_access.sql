-- Structural organization roles shared by teams and Home; business roles stay separate.
CREATE TABLE organization_access (
 organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','admin','partner')), created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,user_id)
);
CREATE UNIQUE INDEX organization_one_owner ON organization_access(organization_id) WHERE role='owner';
INSERT INTO organization_access SELECT id,owner_id,'owner',created_at FROM organizations WHERE owner_id IS NOT NULL;
INSERT INTO organization_access SELECT organization_id,user_id,CASE WHEN role='ops' THEN 'admin' ELSE 'partner' END,created_at FROM organization_memberships WHERE 1=1 ON CONFLICT(organization_id,user_id) DO NOTHING;
INSERT INTO organization_access SELECT '10000000-0000-4000-8000-000000001001',u.id,CASE WHEN t.role='admin' THEN 'admin' ELSE 'partner' END,u.created_at FROM team_members t JOIN users u ON lower(u.email)=t.email WHERE 1=1 ON CONFLICT(organization_id,user_id) DO UPDATE SET role=CASE WHEN organization_access.role='owner' THEN 'owner' ELSE excluded.role END;
-- Only platform team access belongs in the management console. Ordinary learners stay in business memberships.
DELETE FROM organization_access WHERE role='partner' AND organization_id IN (SELECT id FROM organizations WHERE kind='platform') AND user_id NOT IN (SELECT u.id FROM users u JOIN team_members t ON t.email=lower(u.email));
UPDATE organization_access SET role='owner' WHERE role='admin' AND user_id=(SELECT a.user_id FROM organization_access a JOIN users u ON u.id=a.user_id WHERE a.organization_id=organization_access.organization_id AND a.role='admin' ORDER BY CASE WHEN EXISTS(SELECT 1 FROM team_members t WHERE t.email=lower(u.email) AND t.role='admin') THEN 0 ELSE 1 END,a.created_at,a.user_id LIMIT 1) AND organization_id NOT IN (SELECT organization_id FROM organization_access WHERE role='owner');
UPDATE organizations SET owner_id=(SELECT user_id FROM organization_access a WHERE a.organization_id=organizations.id AND a.role='owner') WHERE owner_id IS NULL;
ALTER TABLE auth_sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'email' CHECK(auth_method IN ('email','password'));
DELETE FROM auth_sessions WHERE user_id IN (SELECT a.user_id FROM organization_access a JOIN organizations o ON o.id=a.organization_id WHERE o.kind='platform');
ALTER TABLE member_applications ADD COLUMN organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001';
ALTER TABLE team_tasks ADD COLUMN organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001';
ALTER TABLE suggestions ADD COLUMN organization_id TEXT NOT NULL DEFAULT '10000000-0000-4000-8000-000000001001';
CREATE INDEX applications_team_scope ON member_applications(organization_id,created);
CREATE INDEX tasks_team_scope ON team_tasks(organization_id,created);
CREATE INDEX suggestions_team_scope ON suggestions(organization_id,created);
CREATE TABLE organization_hosts (organization_id TEXT NOT NULL REFERENCES organizations(id),email TEXT NOT NULL,name TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(organization_id,email));
INSERT INTO organization_hosts SELECT '10000000-0000-4000-8000-000000001001',email,name,created FROM pilot_hosts;
CREATE TABLE organization_audit (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL,
 actor_name TEXT NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
 result TEXT NOT NULL CHECK(result IN ('success','denied','failed')), status INTEGER NOT NULL,
 details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX organization_audit_recent ON organization_audit(organization_id,created_at,id);
CREATE INDEX organization_audit_actor ON organization_audit(organization_id,actor_id,created_at);
