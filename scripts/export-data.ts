import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SqliteRepository } from "../server/repositories/sqlite-repository";

const filename = process.env.SQLITE_PATH || path.join(process.cwd(), "data/iriva.sqlite");
const repo = new SqliteRepository(filename);
// One consistent read transaction, including idempotency and audit history.
const backup = repo.atomic(() => ({
  format: "iriva-portable-v1",
  schemaVersion: 4,
  exportedAt: new Date().toISOString(),
  data: repo.read(),
  mutationReceipts: repo.db.prepare("SELECT * FROM mutation_receipts").all(),
  auditEvents: repo.db.prepare("SELECT * FROM audit_events").all(),
}));
const destination = process.argv[2] || path.join(process.cwd(), "data/exports", `iriva-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(backup, null, 2), { mode: 0o600 });
repo.db.close();
console.log(`Exported IRIVA schema v4 to ${destination}`);
