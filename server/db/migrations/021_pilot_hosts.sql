CREATE TABLE pilot_hosts (email TEXT PRIMARY KEY, name TEXT NOT NULL, created TEXT NOT NULL);
INSERT INTO pilot_hosts (email,name,created)
SELECT lower(email),name,'2026-11-17T00:00:00.000Z' FROM placements WHERE role='host'
ON CONFLICT(email) DO NOTHING;
INSERT INTO pilot_hosts (email,name,created)
SELECT lower(u.email),COALESCE(NULLIF(m.display_name,''),u.name),m.created_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.role='host'
ON CONFLICT(email) DO NOTHING;
