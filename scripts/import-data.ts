import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { SqliteRepository, tables } from "../server/repositories/sqlite-repository";
import type { State } from "../domain/models";

const source = process.argv[2];
const destination = process.argv[3];
if (!source || !destination) throw new Error("Usage: npm run db:import -- export.json new.sqlite");
if (existsSync(destination)) throw new Error("Restore only into a new database file; existing databases are never overwritten.");
const backup = JSON.parse(readFileSync(source, "utf8"));
if (backup.format !== "iriva-portable-v1" || ![1, 2, 3, 4, 11].includes(backup.schemaVersion)) throw new Error("Unsupported export format");
mkdirSync(path.dirname(destination), { recursive: true });
const repo = new SqliteRepository(destination);
try {
  repo.atomic(() => {
    repo.db.pragma("defer_foreign_keys = ON");
    for (const table of tables) {
      if (backup.schemaVersion < 4 && ["channels", "channelParticipants", "messages"].includes(table)) continue;
      if (backup.schemaVersion < 3 && ["organizations", "organizationMemberships"].includes(table)) continue;
      if (!Array.isArray(backup.data?.[table])) throw new Error(`Missing table ${table}`);
      for (const row of (backup.data as State)[table]) repo.put(table, row);
    }
    if (backup.schemaVersion < 3) repo.db.exec("INSERT OR IGNORE INTO organization_memberships SELECT 'org-' || id, '10000000-0000-4000-8000-000000001001',id,CASE WHEN id='10000000-0000-4000-8000-000000000006' THEN 'ops' WHEN id IN (SELECT host_id FROM households) THEN 'host' ELSE 'learn' END,1,created_at,updated_at FROM users");
    for (const row of backup.hostGrants || []) repo.db.prepare('INSERT INTO host_grants VALUES (?,?,?,?,?,?)').run(row.id,row.platform_id,row.email,row.user_id,row.created_by,row.created_at);
    for (const row of backup.groupRequests || []) repo.db.prepare('INSERT INTO group_requests VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(row.id,row.platform_id,row.host_id,row.name,row.reason,row.status,row.workspace_id,row.reviewed_by,row.review_note,row.created_at,row.reviewed_at);
    for (const row of backup.mutationReceipts || []) repo.db.prepare("INSERT INTO mutation_receipts VALUES (?,?,?,?)").run(row.actor_id, row.command_id, row.version, row.created_at);
    for (const row of backup.auditEvents || []) repo.db.prepare("INSERT INTO audit_events VALUES (?,?,?,?,?)").run(row.id, row.actor_id, row.kind, row.entity_id, row.created_at);
    if (repo.db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Foreign key validation failed");
  });
  console.log(`Restored schema v11 to ${destination}`);
} finally { repo.db.close(); }
