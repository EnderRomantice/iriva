import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteRepository } from "../server/repositories/sqlite-repository";
import { WorkspaceService } from "../server/services/workspace-service";
import { seedDemo, seedId } from "../server/db/seed";
import { demoActors } from "../domain/models";
import { commandSchema, type Command } from "../domain/commands";
import { actorFromRequest } from "../server/http";

function fixture(t: { after: (fn: () => void) => void }) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "iriva-test-"));
  const file = path.join(folder, "test.sqlite");
  const repo = new SqliteRepository(file); seedDemo(repo);
  t.after(() => { if (repo.db.open) repo.db.close(); rmSync(folder, { recursive: true, force: true }); });
  return { repo, service: new WorkspaceService(repo), file };
}
const submissionCommand = (overrides: Partial<Command> = {}): Command => ({ id: randomUUID(), kind: "submission.save", entityId: seedId(502), baseVersion: 1, payload: { assignmentId: seedId(401), body: "I like my little bookshop.", completed: true, status: "submitted" }, ...overrides } as Command);

test("schema and seed are repeatable; foreign keys are valid", t => {
  const { repo, file } = fixture(t); seedDemo(repo);
  const second = new SqliteRepository(file);
  assert.equal(second.read().users.length, 9);
  assert.deepEqual(second.db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal((second.db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get() as { n: number }).n, 1);
  second.db.close();
});

test("learner sees only their own submissions; peers' email and applications stay private", async t => {
  const { service } = fixture(t);
  const view = await service.snapshot(demoActors.learn);
  assert.ok(view.submissions.every(s => s.learnerId === demoActors.learn.userId));
  assert.equal(view.applications.length, 0);
  assert.equal(view.households.length, 1);
  assert.ok(view.users.filter(u => u.id !== view.actor.userId).every(u => u.email === ""));
});

test("private learner drafts never reach Host", async t => {
  const { service } = fixture(t);
  const view = await service.snapshot(demoActors.host);
  assert.ok(view.submissions.every(s => s.status === "submitted"));
  assert.ok(!view.submissions.some(s => s.id === seedId(502)));
});

test("submission → Host feedback → learner visibility, including persistence", async t => {
  const { service, file } = fixture(t);
  await service.execute(demoActors.learn, submissionCommand());
  assert.ok((await service.snapshot(demoActors.host)).submissions.some(s => s.id === seedId(502)));
  const command: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "feedback.save", payload: { submissionId: seedId(502), body: "A lovely story. Try: one of my favorite places…", status: "draft" } };
  await service.execute(demoActors.host, command);
  assert.ok(!(await service.snapshot(demoActors.learn)).feedback.some(f => f.id === command.entityId));
  await service.execute(demoActors.host, { ...command, id: randomUUID(), baseVersion: 1, payload: { ...command.payload, status: "published" } });
  const reopened = new SqliteRepository(file);
  assert.equal((await new WorkspaceService(reopened).snapshot(demoActors.learn)).feedback.find(f => f.id === command.entityId)?.status, "published");
  reopened.db.close();
});

test("retries are idempotent and stale versions cannot overwrite newer edits", async t => {
  const { service, repo } = fixture(t);
  const command = submissionCommand();
  assert.deepEqual(await service.execute(demoActors.learn, command), { version: 2 });
  assert.deepEqual(await service.execute(demoActors.learn, command), { version: 2 });
  assert.equal(repo.read().submissions.find(s => s.id === seedId(502))?.version, 2);
  await assert.rejects(service.execute(demoActors.learn, { ...command, id: randomUUID() }), { status: 409 });
  assert.equal((repo.db.prepare("SELECT COUNT(*) AS n FROM audit_events").get() as { n: number }).n, 1);
});

test("learners cannot modify others' submissions, publish feedback, or operate on another Household", async t => {
  const { service } = fixture(t);
  await assert.rejects(service.execute(demoActors.learn, submissionCommand({ entityId: seedId(503) })), { status: 403 });
  await assert.rejects(service.execute(demoActors.ops, submissionCommand()), { status: 403 });
  await assert.rejects(service.execute(demoActors.learn, { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "feedback.save", payload: { submissionId: seedId(501), body: "fake", status: "published" } }), { status: 403 });
  await assert.rejects(service.execute({ role: "learn", userId: seedId(7) }, submissionCommand()), { status: 403 });
});

test("blank submissions are rejected; completed personal checklist may remain a draft", async t => {
  const { service } = fixture(t);
  const command = submissionCommand();
  if (command.kind !== "submission.save") throw new Error("unexpected command");
  await assert.rejects(service.execute(demoActors.learn, { ...command, payload: { ...command.payload, body: " " } }), { status: 422 });
  await service.execute(demoActors.learn, { ...command, payload: { ...command.payload, body: "", status: "draft" } });
});

test("duplicate logical submissions return a conflict without duplicate rows", async t => {
  const { service, repo } = fixture(t);
  await assert.rejects(service.execute(demoActors.learn, submissionCommand({ entityId: randomUUID(), baseVersion: 0 })), { status: 409 });
  assert.equal(repo.read().submissions.length, 3);
});

test("application → contact → enrollment creates consistent member and payment records", async t => {
  const { service, repo } = fixture(t);
  const applicant = await service.apply({ name: "测试学员", email: "TEST@EXAMPLE.TEST", goal: "练习自然表达", availability: "周末晚上" });
  const base = { id: randomUUID(), entityId: applicant.id, baseVersion: 1 };
  await service.execute(demoActors.ops, { ...base, kind: "application.contact", payload: {} });
  const command: Command = { ...base, id: randomUUID(), baseVersion: 2, kind: "application.enroll", payload: { householdId: seedId(202) } };
  await service.execute(demoActors.ops, command); await service.execute(demoActors.ops, command);
  const state = repo.read(); const user = state.users.find(u => u.email === "test@example.test")!;
  assert.equal(state.applications.find(a => a.id === applicant.id)?.status, "enrolled");
  assert.equal(state.memberships.filter(m => m.userId === user.id).length, 1);
  assert.equal(state.enrollments.find(e => e.userId === user.id)?.amountMinor, 318000);
  assert.equal(state.enrollments.find(e => e.userId === user.id)?.paymentStatus, "pending");
  await assert.rejects(service.apply({ name: "重复", email: "test@example.test", goal: "练习自然表达", availability: "晚上" }), { status: 409 });
});

test("full Household blocks enrollment atomically", async t => {
  const { service, repo } = fixture(t);
  const before = repo.read();
  await assert.rejects(service.execute(demoActors.ops, { id: randomUUID(), entityId: seedId(701), baseVersion: 1, kind: "application.enroll", payload: { householdId: seedId(201) } }), { status: 409 });
  assert.deepEqual(repo.read(), before);
});

test("reschedule validates host conflicts and future times", async t => {
  const { service, repo } = fixture(t);
  const other = repo.read().sessions.find(s => s.id === seedId(302))!;
  const command: Command = { id: randomUUID(), entityId: seedId(301), baseVersion: 1, kind: "session.reschedule", payload: { startsAt: other.startsAt, endsAt: other.endsAt } };
  await assert.rejects(service.execute(demoActors.host, command), { status: 409 });
  await assert.rejects(service.execute(demoActors.learn, command), { status: 403 });
  const start = new Date(Date.now() + 20 * 86400000).toISOString();
  const end = new Date(Date.parse(start) + 7200000).toISOString();
  await service.execute(demoActors.host, { ...command, payload: { startsAt: start, endsAt: end } });
  assert.equal(repo.read().sessions.find(s => s.id === seedId(301))?.startsAt, start);
});

test("request validation rejects unknown mutations and unexpected fields", () => {
  assert.equal(commandSchema.safeParse({ ...submissionCommand(), kind: "sql.execute" }).success, false);
  assert.equal(commandSchema.safeParse({ ...submissionCommand(), entityId: "1;drop table" }).success, false);
});

test("demo identities are restricted to local same-origin requests", () => {
  assert.equal(actorFromRequest(new Request("http://localhost:3001/api/workspace", { headers: { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001", "x-demo-role": "learn" } })).role, "learn");
  assert.throws(() => actorFromRequest(new Request("http://public.example/api/workspace", { headers: { "x-demo-role": "ops" } })), { status: 403 });
  assert.throws(() => actorFromRequest(new Request("http://localhost/api/workspace", { headers: { "x-demo-role": "ops", origin: "https://foreign.example" } })), { status: 403 });
  assert.throws(() => actorFromRequest(new Request("http://localhost/api/workspace", { headers: { "x-demo-role": "constructor" } })), { status: 401 });
});
