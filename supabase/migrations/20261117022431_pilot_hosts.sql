CREATE TABLE iriva.pilot_hosts (email TEXT PRIMARY KEY, name TEXT NOT NULL, created TEXT NOT NULL);
INSERT INTO iriva.pilot_hosts (email,name,created)
SELECT lower(email),name,'2026-11-17T00:00:00.000Z' FROM iriva.placements WHERE role='host'
ON CONFLICT(email) DO NOTHING;
INSERT INTO iriva.pilot_hosts (email,name,created)
SELECT lower(u.email),COALESCE(NULLIF(m.display_name,''),u.name),m.created_at FROM iriva.memberships m JOIN iriva.users u ON u.id=m.user_id WHERE m.role='host'
ON CONFLICT(email) DO NOTHING;

ALTER TABLE iriva.pilot_hosts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON iriva.pilot_hosts TO iriva_runtime;
CREATE POLICY server_access ON iriva.pilot_hosts TO iriva_runtime USING (true) WITH CHECK (true);
