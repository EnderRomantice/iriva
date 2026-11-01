import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteRepository } from "../server/repositories/sqlite-repository";
import { WorkspaceService } from "../server/services/workspace-service";
import { seedDemo, seedId } from "../server/db/seed";
import { demoActors } from "../domain/models";
import { commandSchema, type Command } from "../domain/commands";
import { householdSnapshot } from "../features/space/content-scope";
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
  assert.equal(second.read().users.length, 12);
  assert.deepEqual(second.db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal((second.db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get() as { n: number }).n, 11);
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


test("city migration preserves existing users and accepts old rows without city", t => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "iriva-city-migration-"));
  const filename = path.join(folder, "legacy.sqlite");
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const legacy = new Database(filename);
  legacy.exec(readFileSync("server/db/migrations/001_initial.sql", "utf8"));
  legacy.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES (1, '2026-10-30T00:00:00Z')");
  legacy.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)").run("legacy-user", "Existing member", "member@example.test", "Asia/Shanghai", "blue", 3, "2026-10-30T00:00:00Z", "2026-10-30T00:00:00Z");
  legacy.close();
  const repo = new SqliteRepository(filename);
  try {
    const user = repo.read().users[0];
    assert.equal(user.city, "");
    assert.equal(user.timezone, "Asia/Shanghai");
    assert.equal(user.version, 3);
    const { city: _city, ...oldRow } = user;
    repo.put("users", { ...oldRow, id: "imported-v1", email: "imported@example.test" });
    assert.equal(repo.read().users.find(u => u.id === "imported-v1")?.city, "");
    repo.saveUser({ ...user, city: "北京" });
    assert.equal(repo.read().users.find(u => u.id === user.id)?.city, "北京");
  } finally { repo.db.close(); }
});

test("organizations isolate snapshots and reject cross-workspace mutations for every role", async t => {
  const { service, repo } = fixture(t);
  const secondId = seedId(1002);
  const secondLearner = { ...demoActors.learn, organizationId: secondId };
  const first = await service.snapshot(demoActors.learn);
  const second = await service.snapshot(secondLearner);
  assert.equal(first.organizations.length, 2);
  assert.deepEqual(second.households.map(h => h.name), ["City Stories"]);
  assert.ok(!second.assignments.some(a => first.assignments.some(old => old.id === a.id)));
  const secondMemberIds = repo.read().organizationMemberships.filter(m => m.organizationId === secondId).map(m => m.userId);
  assert.deepEqual(second.users.map(u => u.id).sort(), secondMemberIds.sort());
  assert.ok(second.users.filter(u => u.id !== secondLearner.userId).every(u => u.email === ""));
  await assert.rejects(service.execute(secondLearner, submissionCommand()), { status: 403 });
  await assert.rejects(service.snapshot({ ...demoActors.learn, organizationId: randomUUID() }), { status: 403 });
  const secondOps = { ...demoActors.ops, organizationId: secondId };
  assert.deepEqual((await service.snapshot(secondOps)).applications, []);
  await assert.rejects(service.execute(secondOps, { id: randomUUID(), kind: "application.contact", entityId: seedId(701), baseVersion: 1, payload: {} }), { status: 403 });
  // A colliding entity UUID cannot overwrite a record in another organization.
  await assert.rejects(service.execute(secondLearner, { ...submissionCommand(), kind: "submission.save", payload: { assignmentId: seedId(1401), body: "Collision", completed: false, status: "draft" } }), { status: 403 });
  assert.equal(repo.read().submissions.find(s => s.id === seedId(502))?.body, "There is a little bookshop near my home. I like going there on Sunday mornings…");
});

test("public applications are attached only to the selected institution", async t => {
  const { service } = fixture(t);
  const application = await service.apply({ name: "New member", email: "new-institution@example.test", goal: "Practice together", availability: "Weekends" }, seedId(1002));
  assert.ok(!(await service.snapshot(demoActors.ops)).applications.some(a => a.id === application.id));
  assert.ok((await service.snapshot({ ...demoActors.ops, organizationId: seedId(1002) })).applications.some(a => a.id === application.id));
});

test("organization migration preserves populated households and restores FK enforcement", t => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "iriva-organization-migration-"));
  const filename = path.join(folder, "legacy.sqlite");
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const legacy = new Database(filename);
  legacy.exec(readFileSync("server/db/migrations/001_initial.sql", "utf8"));
  legacy.exec(readFileSync("server/db/migrations/002_user_city.sql", "utf8"));
  legacy.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES (1,'2026-10-30'),(2,'2026-10-30')");
  legacy.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)").run("legacy-host", "Host", "host@sample.test", "Europe/London", "blue", 1, "2026-10-30", "2026-10-30", "London");
  legacy.exec("INSERT INTO terms VALUES ('term','Existing term','2026-10-30','2026-12-01',1,'2026-10-30','2026-10-30'); INSERT INTO households VALUES ('household','Existing group','term','legacy-host','Europe/London',4,'Existing theme',1,'2026-10-30','2026-10-30')");
  legacy.close();
  const repo = new SqliteRepository(filename);
  try {
    assert.equal(repo.read().households[0].organizationId, seedId(1001));
    assert.equal(repo.read().households[0].name, "Existing group");
    assert.equal(repo.db.pragma("foreign_keys", { simple: true }), 1);
    assert.deepEqual(repo.db.pragma("foreign_key_check"), []);
    assert.throws(() => repo.put("households", { ...repo.read().households[0], organizationId: "missing" }));
  } finally { repo.db.close(); }
});


test("group content narrows every role without falling back to the first group", async t => {
  const { service } = fixture(t);
  for (const role of ["host", "ops", "learn"] as const) {
    const organization = await service.snapshot(demoActors[role]);
    assert.equal(householdSnapshot(organization, ""), organization);
    assert.equal(householdSnapshot(organization, "missing-group"), undefined);
    if (role !== "learn") assert.equal(organization.households.length, 2);
    for (const household of organization.households) {
      const group = householdSnapshot(organization, household.id)!;
      assert.deepEqual(group.households.map(h => h.id), [household.id]);
      assert.deepEqual(group.terms.map(t => t.id), [household.termId]);
      assert.deepEqual(group.sessions, organization.sessions.filter(s => s.householdId === household.id));
      assert.deepEqual(group.assignments, organization.assignments.filter(a => a.householdId === household.id));
      assert.deepEqual(group.memberships, organization.memberships.filter(m => m.householdId === household.id));
      assert.deepEqual(group.enrollments, organization.enrollments.filter(e => e.householdId === household.id));
      assert.deepEqual(group.submissions, organization.submissions.filter(s => group.assignments.some(a => a.id === s.assignmentId)));
      assert.deepEqual(group.feedback, organization.feedback.filter(f => group.submissions.some(s => s.id === f.submissionId)));
      assert.deepEqual(group.applications, []);
    }
  }
});

test("create menu commands persist tasks, sessions and groups with role and organization boundaries", async t => {
  const { service, file } = fixture(t);
  const future = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
  const task: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "assignment.create", payload: { householdId: seedId(201), title: "A new story", description: "Share a memory", category: "practice", dueAt: future(72), week: 3 } };
  const session: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "session.create", payload: { householdId: seedId(201), title: "A new roundtable", description: "Meet together", startsAt: future(240), endsAt: future(242) } };
  const group: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "household.create", payload: { name: "New Household", theme: "Daily stories", hostId: seedId(5), termId: seedId(101), capacity: 4 } };
  for (const command of [task, session, group]) {
    assert.equal(commandSchema.safeParse(command).success, true);
    await assert.rejects(service.execute(demoActors.learn, command), { status: 403 });
  }
  await assert.rejects(service.execute(demoActors.ops, task), { status: 403 });
  await assert.rejects(service.execute(demoActors.host, group), { status: 403 });
  await assert.rejects(service.execute({ ...demoActors.host, organizationId: seedId(1002) }, task), { status: 403 });
  await assert.rejects(service.execute({ ...demoActors.host, organizationId: seedId(1002) }, session), { status: 403 });
  await assert.rejects(service.execute({ ...demoActors.ops, organizationId: seedId(1002) }, group), { status: 422 });
  assert.deepEqual(await service.execute(demoActors.host, task), { version: 1 });
  assert.deepEqual(await service.execute(demoActors.host, task), { version: 1 });
  await service.execute(demoActors.host, session);
  await service.execute(demoActors.ops, group);
  await service.execute(demoActors.ops, group);
  assert.ok((await service.snapshot(demoActors.learn)).assignments.some(a => a.id === task.entityId));
  assert.ok(!(await service.snapshot({ ...demoActors.learn, organizationId: seedId(1002) })).assignments.some(a => a.id === task.entityId));
  const reopened = new SqliteRepository(file);
  const host = await new WorkspaceService(reopened).snapshot(demoActors.host);
  assert.equal(host.assignments.filter(a => a.id === task.entityId).length, 1);
  assert.ok(host.sessions.some(s => s.id === session.entityId && s.status === "scheduled"));
  assert.ok(host.households.some(h => h.id === group.entityId));
  assert.equal(host.memberships.filter(m => m.householdId === group.entityId && m.userId === seedId(5)).length, 1);
  reopened.db.close();
});

test("creation rejects stale IDs, expired deadlines, overlapping sessions and invalid group ownership", async t => {
  const { service } = fixture(t);
  const state = await service.snapshot(demoActors.ops);
  const scheduled = state.sessions.find(s => s.status === "scheduled")!;
  const task: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "assignment.create", payload: { householdId: seedId(201), title: "Story", description: "Share", category: "practice", dueAt: "2000-01-01T00:00:00.000Z", week: 1 } };
  await assert.rejects(service.execute(demoActors.host, task), { status: 422 });
  await assert.rejects(service.execute(demoActors.host, { ...task, entityId: seedId(401) }), { status: 409 });
  const session: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "session.create", payload: { householdId: seedId(202), title: "Overlap", description: "", startsAt: scheduled.startsAt, endsAt: scheduled.endsAt } };
  await assert.rejects(service.execute(demoActors.host, session), { status: 409 });
  await assert.rejects(service.execute(demoActors.host, { ...session, payload: { ...session.payload, endsAt: session.payload.startsAt } }), { status: 422 });
  const group: Command = { id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "household.create", payload: { name: "Other", theme: "Stories", hostId: seedId(1), termId: seedId(101), capacity: 4 } };
  await assert.rejects(service.execute(demoActors.ops, group), { status: 422 });
  await assert.rejects(service.execute(demoActors.ops, { ...group, payload: { ...group.payload, hostId: seedId(5), name: "The Sunday Club" } }), { status: 409 });
  assert.equal(commandSchema.safeParse({ ...group, payload: { ...group.payload, capacity: 0 } }).success, false);
  assert.equal(commandSchema.safeParse({ ...task, payload: { ...task.payload, title: "   " } }).success, false);
});

const createChannel = (kind: "public" | "private", name = "Coffee chat"): Command => ({ id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "channel.create", payload: { name, description: "Just a conversation", kind } });
const sendMessage = (channelId: string, body = " Hello there! "): Command => ({ id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "message.send", payload: { channelId, body } });
const openDM = (userId: string): Command => ({ id: randomUUID(), entityId: randomUUID(), baseVersion: 0, kind: "conversation.open", payload: { userId } });

test("only Hosts create public channels; every member in that organization can chat", async t => {
  const { service, repo, file } = fixture(t);
  const channel = createChannel("public");
  await assert.rejects(service.execute(demoActors.learn, channel), { status:403 });
  await assert.rejects(service.execute(demoActors.ops, channel), { status:403 });
  await service.execute(demoActors.host, channel);
  assert.ok((await service.snapshot(demoActors.learn)).channels.some(c => c.id === channel.entityId));
  const message = sendMessage(channel.entityId);
  await service.execute(demoActors.learn, message);
  await service.execute(demoActors.learn, message);
  assert.equal(repo.read().messages.filter(m => m.id === message.entityId).length, 1);
  const received = (await service.snapshot(demoActors.host)).messages.find(m => m.id === message.entityId)!;
  assert.equal(received.body, "Hello there!");
  assert.equal(received.authorId, demoActors.learn.userId);
  assert.equal(repo.read().submissions.length, 3, "chat must never create a practice submission");
  await assert.rejects(service.execute(demoActors.learn, sendMessage(channel.entityId, "  ")), { status:422 });
  await assert.rejects(service.execute(demoActors.learn, sendMessage(channel.entityId, "x".repeat(12001))), { status:422 });
  await assert.rejects(service.execute(demoActors.host, createChannel("public")), { status:409 });
  const second = { ...demoActors.learn, organizationId:seedId(1002) };
  assert.ok(!(await service.snapshot(second)).channels.some(c => c.id === channel.entityId));
  await assert.rejects(service.execute(second, sendMessage(channel.entityId)), { status:403 });
  await assert.rejects(service.execute(second, { ...createChannel("private"), entityId:channel.entityId }), { status:403 });
  const reopened = new SqliteRepository(file);
  assert.equal((await new WorkspaceService(reopened).snapshot(demoActors.host)).messages.find(m => m.id === message.entityId)?.body, "Hello there!");
  reopened.db.close();
});

test("personal channels and their messages stay private even from Hosts and ops", async t => {
  const { service } = fixture(t);
  for (const owner of Object.values(demoActors)) {
    const channel = createChannel("private", `${owner.role} notes`);
    await service.execute(owner, channel);
    const message = sendMessage(channel.entityId, "Private thought");
    await service.execute(owner, message);
    assert.ok((await service.snapshot(owner)).messages.some(m => m.id === message.entityId));
    for (const outsider of Object.values(demoActors).filter(a => a.userId !== owner.userId)) {
      const snapshot = await service.snapshot(outsider);
      assert.ok(!snapshot.channels.some(c => c.id === channel.entityId));
      assert.ok(!snapshot.messages.some(m => m.id === message.entityId));
      await assert.rejects(service.execute(outsider, sendMessage(channel.entityId)), { status:403 });
      await assert.rejects(service.execute(outsider, { ...createChannel("private"), entityId:channel.entityId }), { status:403 });
    }
  }
});

test("DMs deduplicate both directions and isolate both participants from every outsider", async t => {
  const { service, repo } = fixture(t);
  const command = openDM(demoActors.host.userId);
  const opened = await service.execute(demoActors.learn, command);
  assert.ok(opened.entityId);
  assert.deepEqual(await service.execute(demoActors.learn, command), opened);
  assert.deepEqual(await service.execute(demoActors.host, openDM(demoActors.learn.userId)), opened);
  const participants = repo.read().channelParticipants.filter(p => p.channelId === opened.entityId);
  assert.deepEqual(participants.map(p => p.userId).sort(), [demoActors.learn.userId,demoActors.host.userId].sort());
  await service.execute(demoActors.learn, sendMessage(opened.entityId!, "A question"));
  await service.execute(demoActors.host, sendMessage(opened.entityId!, "A reply"));
  for (const actor of [demoActors.learn,demoActors.host]) assert.equal((await service.snapshot(actor)).messages.filter(m => m.channelId === opened.entityId).length, 2);
  const outside = await service.snapshot(demoActors.ops);
  assert.ok(!outside.channels.some(c => c.id === opened.entityId));
  assert.ok(!outside.channelParticipants.some(p => p.channelId === opened.entityId));
  assert.ok(!outside.messages.some(m => m.channelId === opened.entityId));
  await assert.rejects(service.execute(demoActors.ops, sendMessage(opened.entityId!)), { status:403 });
  await assert.rejects(service.execute(demoActors.learn, openDM(demoActors.learn.userId)), { status:422 });
  await assert.rejects(service.execute(demoActors.learn, openDM(randomUUID())), { status:422 });
  const second = { ...demoActors.learn, organizationId:seedId(1002) };
  await assert.rejects(service.execute(second, openDM(seedId(2))), { status:422 });
  const otherOrg = await service.execute(second, openDM(demoActors.host.userId));
  assert.notEqual(otherOrg.entityId, opened.entityId);
  assert.equal((await service.snapshot(second)).messages.length, 0);
});

const reactTo = (entityId: string, active = true, emoji: '👍' | '❤️' = '👍'): Command => ({ id: randomUUID(), entityId, baseVersion: 1, kind: 'message.react', payload: { emoji, active } });

test('message reactions merge across participants, are idempotent, and survive reopening', async t => {
  const { service, repo, file } = fixture(t);
  const dm = await service.execute(demoActors.learn, openDM(demoActors.host.userId));
  const message = sendMessage(dm.entityId!);
  await service.execute(demoActors.learn, message);
  const learnerReaction = reactTo(message.entityId);
  await Promise.all([service.execute(demoActors.learn, learnerReaction), service.execute(demoActors.host, reactTo(message.entityId))]);
  const row = () => repo.read().messages.find(m => m.id === message.entityId)!;
  assert.equal(row().reactions?.length, 2);
  assert.equal(row().version, 3);
  // Both a repeated receipt and a second request with the same desired state are safe.
  await service.execute(demoActors.learn, learnerReaction);
  await service.execute(demoActors.learn, reactTo(message.entityId));
  assert.equal(row().reactions?.length, 2);
  assert.equal(row().version, 3);
  await service.execute(demoActors.learn, reactTo(message.entityId, true, '❤️'));
  const remove = reactTo(message.entityId, false);
  await service.execute(demoActors.learn, remove);
  await service.execute(demoActors.learn, remove);
  await service.execute(demoActors.learn, reactTo(message.entityId, false));
  assert.deepEqual(row().reactions, [{ userId:demoActors.host.userId, emoji:'👍' }, { userId:demoActors.learn.userId, emoji:'❤️' }]);
  assert.equal(row().version, 5);
  const reopened = new SqliteRepository(file);
  try {
    for (const actor of [demoActors.learn, demoActors.host]) assert.deepEqual((await new WorkspaceService(reopened).snapshot(actor)).messages.find(m => m.id === message.entityId)?.reactions, row().reactions);
  } finally { reopened.db.close(); }
});

test('reaction permissions follow public, private, DM and organization boundaries', async t => {
  const { service, repo } = fixture(t);
  const dm = await service.execute(demoActors.learn, openDM(demoActors.host.userId));
  const directMessage = sendMessage(dm.entityId!);
  await service.execute(demoActors.learn, directMessage);
  await assert.rejects(service.execute(demoActors.ops, reactTo(directMessage.entityId)), { status:403 });
  await assert.rejects(service.execute({ ...demoActors.learn, organizationId:seedId(1002) }, reactTo(directMessage.entityId)), { status:403 });
  await assert.rejects(service.execute(demoActors.learn, reactTo(randomUUID())), { status:403 });
  const privateChannel = createChannel('private');
  await service.execute(demoActors.learn, privateChannel);
  const privateMessage = sendMessage(privateChannel.entityId);
  await service.execute(demoActors.learn, privateMessage);
  await service.execute(demoActors.learn, reactTo(privateMessage.entityId));
  for (const outsider of [demoActors.host, demoActors.ops]) await assert.rejects(service.execute(outsider, reactTo(privateMessage.entityId)), { status:403 });
  const publicChannel = createChannel('public');
  await service.execute(demoActors.host, publicChannel);
  const publicMessage = sendMessage(publicChannel.entityId);
  await service.execute(demoActors.host, publicMessage);
  for (const actor of Object.values(demoActors)) await service.execute(actor, reactTo(publicMessage.entityId));
  assert.equal(repo.read().messages.find(m => m.id === publicMessage.entityId)?.reactions?.length, 3);
  assert.ok(!(await service.snapshot(demoActors.ops)).messages.some(m => m.id === privateMessage.entityId || m.id === directMessage.entityId));
});

test('reaction input cannot forge another user or send unsupported emoji', () => {
  const command = reactTo(randomUUID());
  assert.equal(commandSchema.safeParse(command).success, true);
  assert.equal(commandSchema.safeParse({ ...command, payload:{ emoji:'arbitrary', active:true } }).success, false);
  assert.equal(commandSchema.safeParse({ ...command, payload:{ emoji:'👍', active:true, userId:demoActors.host.userId } }).success, false);
  assert.equal(commandSchema.safeParse({ ...command, payload:{ emoji:'👍' } }).success, false);
});

test('reaction migration preserves existing messages and defaults to an empty collection', t => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'iriva-reaction-migration-'));
  const file = path.join(folder, 'old.sqlite');
  t.after(() => rmSync(folder, { recursive:true, force:true }));
  const original = new SqliteRepository(file); seedDemo(original);
  const now = new Date().toISOString(), channelId = randomUUID(), messageId = randomUUID();
  original.saveChannel({ id:channelId, version:1, createdAt:now, updatedAt:now, organizationId:seedId(1001), ownerId:demoActors.host.userId, name:'Existing channel', description:'', kind:'public', directKey:'' });
  original.saveMessage({ id:messageId, version:1, createdAt:now, updatedAt:now, channelId, authorId:demoActors.host.userId, body:'Existing message' });
  original.db.exec('ALTER TABLE messages DROP COLUMN reactions; DELETE FROM schema_migrations WHERE version=9');
  original.db.close();
  const migrated = new SqliteRepository(file);
  try { const message = migrated.read().messages.find(m => m.id === messageId)!; assert.equal(message.body,'Existing message'); assert.deepEqual(message.reactions,[]); }
  finally { migrated.db.close(); }
});

test('all five shared card types persist, support card-only messages and reactions', async t => {
  const { service, repo, file } = fixture(t);
  const channel = createChannel('public'); await service.execute(demoActors.host,channel);
  const view = await service.snapshot(demoActors.learn);
  const types = ['user','task','group','host','plan'] as const;
  const cards = types.map(type => view.cardCatalog!.find(c => c.reference.type === type)!.reference);
  const command: Command = { ...sendMessage(channel.entityId,''), kind:'message.send', payload:{channelId:channel.entityId,body:'',cards} };
  assert.equal(commandSchema.safeParse(command).success,true);
  await service.execute(demoActors.learn,command);
  await service.execute(demoActors.learn,command);
  await service.execute(demoActors.host,reactTo(command.entityId));
  assert.equal(repo.read().messages.filter(m => m.id === command.entityId).length,1);
  const reopened = new SqliteRepository(file);
  try {
    const row = (await new WorkspaceService(reopened).snapshot(demoActors.learn)).messages.find(m => m.id === command.entityId)!;
    assert.equal(row.body,''); assert.deepEqual(row.cards,cards); assert.equal(row.reactions?.length,1);
  } finally { reopened.db.close(); }
  const userCard = view.cardCatalog!.find(c => c.reference.type === 'user')!;
  const user = repo.read().users.find(u => u.id === userCard.reference.entityId)!;
  repo.saveUser({...user,name:'Updated public nickname'});
  assert.equal((await service.snapshot(demoActors.learn)).cardCatalog!.find(c => c.reference.type === 'user' && c.reference.entityId === user.id)!.title,'Updated public nickname');
});

test('card schema rejects forged previews, links, duplicates, unknown versions and empty messages', () => {
  const valid = { version:1,type:'plan',entityId:'pro' };
  const command = (cards:unknown[], body='') => ({...sendMessage(randomUUID()),payload:{channelId:randomUUID(),body,cards}});
  assert.equal(commandSchema.safeParse(command([valid])).success,true);
  for (const cards of [[],[valid,valid],[{...valid,version:2}],[{...valid,type:'html'}],[{...valid,entityId:'enterprise'}],[{...valid,title:'Free lifetime Pro'}],[{...valid,url:'javascript:alert(1)'}],Array.from({length:6},(_,i)=>({version:1,type:'user',entityId:randomUUID()}))]) assert.equal(commandSchema.safeParse(command(cards)).success,false);
  assert.equal(commandSchema.safeParse(command([],'Plain text still works')).success,true);
});

test('shared references respect organization, host role and per-viewer task access', async t => {
  const { service, repo } = fixture(t);
  const channel = createChannel('public'); await service.execute(demoActors.host,channel);
  const send = (type:'task'|'host'|'user'|'group',entityId:string):Command => ({...sendMessage(channel.entityId),kind:'message.send',payload:{channelId:channel.entityId,body:'',cards:[{version:1,type,entityId}]}});
  const learner = await service.snapshot(demoActors.learn);
  const allowedTask = learner.cardCatalog!.find(c => c.reference.type === 'task')!;
  const hiddenTask = repo.read().assignments.find(a => !learner.assignments.some(v => v.id === a.id))!;
  await assert.rejects(service.execute(demoActors.learn,send('task',hiddenTask.id)),{status:403});
  await assert.rejects(service.execute(demoActors.learn,send('host',demoActors.learn.userId)),{status:403});
  await assert.rejects(service.execute(demoActors.learn,send('user',randomUUID())),{status:403});
  const otherGroup = repo.read().households.find(h => h.organizationId === seedId(1002))!;
  await assert.rejects(service.execute(demoActors.learn,send('group',otherGroup.id)),{status:403});
  const message = send('task',allowedTask.reference.entityId);
  await service.execute(demoActors.learn,message);
  const outsider = {role:'learn' as const,userId:seedId(7)};
  const recipient = await service.snapshot(outsider);
  assert.ok(recipient.messages.some(m => m.id === message.entityId));
  assert.ok(!recipient.cardCatalog!.some(c => c.reference.type === 'task' && c.reference.entityId === allowedTask.reference.entityId));
  assert.ok(!recipient.assignments.some(a => a.id === allowedTask.reference.entityId));
  assert.ok(!JSON.stringify(recipient.cardCatalog).includes('xiaoman@example.test'));
  const groupId = learner.assignments.find(a => a.id === allowedTask.reference.entityId)!.householdId;
  assert.ok(!recipient.cardCatalog!.some(c => c.reference.type === 'group' && c.reference.entityId === groupId));
  await service.execute(demoActors.learn,send('group',groupId));
  const afterShare = await service.snapshot(outsider);
  assert.ok(afterShare.cardCatalog!.some(c => c.reference.type === 'group' && c.reference.entityId === groupId));
  assert.ok(!afterShare.households.some(h => h.id === groupId));
  assert.ok(!afterShare.assignments.some(a => a.householdId === groupId));
  await assert.rejects(service.execute({...demoActors.learn,organizationId:seedId(1002)},message),{status:403});
});

test('message card migration retains old text and reaction data', t => {
  const { repo, file } = fixture(t);
  const now = new Date().toISOString(), channelId=randomUUID(),messageId=randomUUID();
  repo.saveChannel({id:channelId,version:1,createdAt:now,updatedAt:now,organizationId:seedId(1001),ownerId:demoActors.host.userId,name:'Legacy',description:'',kind:'public',directKey:''});
  repo.saveMessage({id:messageId,version:2,createdAt:now,updatedAt:now,channelId,authorId:demoActors.host.userId,body:'Keep this message',reactions:[{userId:demoActors.learn.userId,emoji:'❤️'}]});
  repo.db.exec(`CREATE TABLE legacy_messages (id TEXT PRIMARY KEY,channel_id TEXT NOT NULL REFERENCES channels(id),author_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL CHECK(length(trim(body))>0),version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,reactions TEXT NOT NULL DEFAULT '[]');
    INSERT INTO legacy_messages SELECT id,channel_id,author_id,body,version,created_at,updated_at,reactions FROM messages;
    DROP TABLE messages; ALTER TABLE legacy_messages RENAME TO messages; CREATE INDEX messages_channel_time ON messages(channel_id,created_at,id); DELETE FROM schema_migrations WHERE version=10;`);
  repo.db.close();
  const migrated = new SqliteRepository(file);
  try { const row=migrated.read().messages.find(m => m.id === messageId)!; assert.equal(row.body,'Keep this message'); assert.equal(row.reactions![0].emoji,'❤️'); assert.deepEqual(row.cards,[]); assert.deepEqual(migrated.db.prepare('PRAGMA foreign_key_check').all(),[]); }
  finally { migrated.db.close(); }
});
