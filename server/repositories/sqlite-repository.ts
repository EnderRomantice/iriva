import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Channel, ChannelParticipant, Message, Assignment, Household, OrganizationMembership, State, Submission, Feedback, Application, Session, Membership, Enrollment, User } from "../../domain/models";
import type { WorkspaceRepository, WorkspaceUnitOfWork } from "./workspace-repository";

import { tables } from "./tables";
export { tables } from "./tables";
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
    for (const [index, file] of ["001_initial.sql", "002_user_city.sql", "003_organizations.sql", "004_chat.sql", "005_accounts.sql", "006_email_auth.sql", "007_host_directory.sql", "008_host_full_time.sql", "009_message_reactions.sql", "010_message_cards.sql", "011_owned_workspaces.sql"].entries()) {
      const version = index + 1;
      if (this.db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(version)) continue;
      // SQLite requires FK enforcement off while adding a referenced column with
      // a non-null default to populated tables. Validate inside the transaction
      // before committing, then always restore enforcement on this connection.
      if (version === 3) this.db.pragma("foreign_keys = OFF");
      try {
        this.atomic(() => {
          this.db.exec(readFileSync(path.join(process.cwd(), "server/db/migrations", file), "utf8"));
          if ((this.db.pragma("foreign_key_check") as unknown[]).length) throw new Error(`Invalid foreign keys after migration ${version}`);
          this.db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(version, new Date().toISOString());
        });
      } finally { this.db.pragma("foreign_keys = ON"); }
    }
  }
  atomic<T>(work: () => T): T { return this.db.transaction(work).immediate(); }
  async snapshot(): Promise<State> { return this.read(); }
  private queue: Promise<unknown> = Promise.resolve();
  transaction<T>(work: (tx: WorkspaceUnitOfWork) => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      try { const result = await work(this); this.db.exec('COMMIT'); return result; }
      catch(error) { this.db.exec('ROLLBACK'); throw error; }
    });
    this.queue = next.catch(() => {});
    return next;
  }
  read(): State {
    return Object.fromEntries(tables.map(table => [table, this.db.prepare(`SELECT * FROM ${snake(table)}`).all().map(row => Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [camel(key), (key === "host_qualifications" || key === "reactions" || key === "cards") ? JSON.parse(String(value)) : key === "completed" || key === "host_featured" || key === "host_full_time" ? Boolean(value) : value])))])) as unknown as State;
  }
  /** Table names and entity fields come only from trusted domain code, never requests. */
  put(table: string, value: object) {
    if (!(tables as readonly string[]).includes(table)) throw new Error("Unknown domain table");
    const entries = Object.entries(value);
    const names = entries.map(([key]) => snake(key));
    this.db.prepare(`INSERT INTO ${snake(table)} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${names.filter(n => n !== "id").map(n => `${n}=excluded.${n}`).join(",")}`).run(...entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : typeof value === "boolean" ? Number(value) : value));
  }
  receipt(actorId: string, commandId: string) { return this.db.prepare("SELECT version FROM mutation_receipts WHERE actor_id=? AND command_id=?").get(actorId, commandId) as { version: number } | undefined; }
  acknowledge(actorId: string, commandId: string, version: number) { this.db.prepare("INSERT INTO mutation_receipts VALUES (?,?,?,?)").run(actorId, commandId, version, new Date().toISOString()); }
  audit(actorId: string, kind: string, entityId: string) { this.db.prepare("INSERT INTO audit_events VALUES (?,?,?,?,?)").run(randomUUID(), actorId, kind, entityId, new Date().toISOString()); }
  admission(userId: string, organizationId: string, hostId: string) {
    return { registered: !!this.db.prepare('SELECT user_id FROM credentials WHERE user_id=? UNION SELECT user_id FROM email_identities WHERE user_id=?').get(userId,userId), accepted: !!this.db.prepare("SELECT id FROM bookings WHERE learner_id=? AND organization_id=? AND host_id=? AND status='accepted'").get(userId,organizationId,hostId), order: this.db.prepare("SELECT plan, amount_minor AS amountMinor FROM plan_orders WHERE user_id=? AND status='paid' ORDER BY created_at DESC LIMIT 1").get(userId) as {plan:string;amountMinor:number}|undefined };
  }
  saveChannel(v: Channel) { this.put("channels", v); }
  saveChannelParticipant(v: ChannelParticipant) { this.put("channelParticipants", v); }
  saveMessage(v: Message) { this.put("messages", v); }
  saveSubmission(v: Submission) { this.put("submissions", v); }
  saveFeedback(v: Feedback) { this.put("feedback", v); }
  saveApplication(v: Application) { this.put("applications", v); }
  saveAssignment(v: Assignment) { this.put("assignments", v); }
  saveHousehold(v: Household) { this.put("households", v); }
  saveSession(v: Session) { this.put("sessions", v); }
  saveMembership(v: Membership) { this.put("memberships", v); }
  saveEnrollment(v: Enrollment) { this.put("enrollments", v); }
  saveOrganizationMembership(v: OrganizationMembership) { this.put("organizationMemberships", v); }
  saveUser(v: User) { this.put("users", v); }
}
