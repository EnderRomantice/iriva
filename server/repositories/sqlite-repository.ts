import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { State, Submission, Feedback, Application, Session, Membership, Enrollment, User } from "../../domain/models";
import type { WorkspaceRepository, WorkspaceUnitOfWork } from "./workspace-repository";

export const tables = ["users", "terms", "households", "memberships", "sessions", "assignments", "submissions", "feedback", "applications", "enrollments"] as const;
const snake = (key: string) => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export class SqliteRepository implements WorkspaceRepository, WorkspaceUnitOfWork {
  readonly db: Database.Database;
  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const [index, file] of ["001_initial.sql", "002_user_city.sql"].entries()) {
      const version = index + 1;
      if (this.db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(version)) continue;
      this.atomic(() => {
        this.db.exec(readFileSync(path.join(process.cwd(), "server/db/migrations", file), "utf8"));
        this.db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(version, new Date().toISOString());
      });
    }
  }
  atomic<T>(work: () => T): T { return this.db.transaction(work).immediate(); }
  async snapshot(): Promise<State> { return this.read(); }
  async transaction<T>(work: (tx: WorkspaceUnitOfWork) => T): Promise<T> { return this.atomic(() => work(this)); }
  read(): State {
    return Object.fromEntries(tables.map(table => [table, this.db.prepare(`SELECT * FROM ${table}`).all().map(row => Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [camel(key), key === "completed" ? Boolean(value) : value])))])) as unknown as State;
  }
  /** Table names and entity fields come only from trusted domain code, never requests. */
  put(table: typeof tables[number], value: object) {
    const entries = Object.entries(value);
    const names = entries.map(([key]) => snake(key));
    this.db.prepare(`INSERT INTO ${table} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${names.filter(n => n !== "id").map(n => `${n}=excluded.${n}`).join(",")}`).run(...entries.map(([, value]) => typeof value === "boolean" ? Number(value) : value));
  }
  receipt(actorId: string, commandId: string) { return this.db.prepare("SELECT version FROM mutation_receipts WHERE actor_id=? AND command_id=?").get(actorId, commandId) as { version: number } | undefined; }
  acknowledge(actorId: string, commandId: string, version: number) { this.db.prepare("INSERT INTO mutation_receipts VALUES (?,?,?,?)").run(actorId, commandId, version, new Date().toISOString()); }
  audit(actorId: string, kind: string, entityId: string) { this.db.prepare("INSERT INTO audit_events VALUES (?,?,?,?,?)").run(randomUUID(), actorId, kind, entityId, new Date().toISOString()); }
  saveSubmission(v: Submission) { this.put("submissions", v); }
  saveFeedback(v: Feedback) { this.put("feedback", v); }
  saveApplication(v: Application) { this.put("applications", v); }
  saveSession(v: Session) { this.put("sessions", v); }
  saveMembership(v: Membership) { this.put("memberships", v); }
  saveEnrollment(v: Enrollment) { this.put("enrollments", v); }
  saveUser(v: User) { this.put("users", v); }
}
