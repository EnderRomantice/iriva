import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { localDb, enqueue, projectSnapshot, saveDraft } from "../local/database";
import type { Snapshot } from "../domain/models";
import type { Command } from "../domain/commands";
const snapshot: Snapshot = { organizations: [], organizationMemberships: [], channels: [], channelParticipants: [], messages: [], actor: { role: "learn", userId: randomUUID() }, serverTime: new Date().toISOString(), users: [], terms: [], households: [], memberships: [], sessions: [], assignments: [], submissions: [], feedback: [], applications: [], enrollments: [] };

test("durable outbox keeps ordering, overlays changes and survives reopen without corrupting server snapshot", async () => {
  await localDb.delete(); await localDb.open();
  await localDb.snapshots.put({ role: "learn", data: snapshot });
  const command: Command = { kind: "submission.save", id: randomUUID(), entityId: randomUUID(), baseVersion: 0, payload: { assignmentId: randomUUID(), body: "First draft", completed: false, status: "draft" } };
  await enqueue("learn", command);
  await enqueue("learn", { ...command, id: randomUUID(), payload: { ...command.payload, body: "Next draft" } });
  const operations = await localDb.outbox.where("role").equals("learn").sortBy("seq");
  assert.equal(operations.length, 2);
  assert.equal(operations[1].command.baseVersion, 1);
  assert.equal(projectSnapshot(snapshot, operations).submissions[0].body, "Next draft");
  assert.equal(snapshot.submissions.length, 0);
  await saveDraft("learn", "assignment-test", "unsent text");
  localDb.close(); await localDb.open();
  assert.equal(await localDb.outbox.count(), 2);
  assert.equal((await localDb.drafts.get("learn:assignment-test"))?.body, "unsent text");
  assert.equal((await localDb.outbox.where("role").equals("host").toArray()).length, 0);
  await localDb.outbox.update(operations[0].seq!, { status: "conflict" });
  await assert.rejects(enqueue("learn", { ...command, id: randomUUID() }));
  await localDb.outbox.clear();
  await enqueue("learn", command);
  await enqueue("learn", { ...command, id: randomUUID(), entityId: randomUUID() });
  const rapid = await localDb.outbox.where("role").equals("learn").sortBy("seq");
  assert.equal(rapid[0].entityId, rapid[1].entityId, "rapid creation must share a logical submission");
  await localDb.outbox.clear();
  const changed = projectSnapshot(snapshot, [rapid[0]]);
  changed.submissions[0].version = 9;
  await localDb.snapshots.put({ role: "learn", data: changed });
  await enqueue("learn", command);
  assert.equal((await localDb.outbox.toArray())[0].command.baseVersion, 0, "never silently rebase an old editor onto a newer server version");
  const other = "learn:second-workspace" as const;
  await localDb.snapshots.put({ role: other, data: snapshot });
  await saveDraft(other, "assignment-test", "Other organization draft");
  await enqueue(other, { ...command, id: randomUUID() });
  assert.equal((await localDb.drafts.get("learn:assignment-test"))?.body, "unsent text");
  assert.equal((await localDb.drafts.get(`${other}:assignment-test`))?.body, "Other organization draft");
  assert.equal((await localDb.outbox.where("role").equals(other).toArray()).length, 1);
  assert.equal((await localDb.outbox.where("role").equals("learn").toArray()).length, 1);
  await localDb.delete();
});

test("offline chat messages remain separate, retain timestamps and survive reload", async () => {
  await localDb.delete(); await localDb.open();
  await localDb.snapshots.put({ role: "learn", data:snapshot });
  const command: Command = { id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:"message.send",payload:{channelId:randomUUID(),body:"First hello"} };
  await enqueue("learn",command);
  await enqueue("learn",{...command,id:randomUUID(),entityId:randomUUID(),payload:{...command.payload,body:"Second hello"}});
  await saveDraft("learn",`message-${command.payload.channelId}`,"Still writing");
  localDb.close(); await localDb.open();
  const pending = await localDb.outbox.where("role").equals("learn").sortBy("seq");
  const optimistic = projectSnapshot(snapshot,pending);
  assert.equal(optimistic.messages.length,2);
  assert.notEqual(optimistic.messages[0].id,optimistic.messages[1].id);
  assert.equal(optimistic.messages[0].createdAt,pending[0].queuedAt);
  assert.equal(optimistic.messages[0].authorId,snapshot.actor.userId);
  assert.equal(snapshot.messages.length,0);
  assert.equal((await localDb.drafts.get(`learn:message-${command.payload.channelId}`))?.body,"Still writing");
  assert.equal((await localDb.outbox.where("role").equals("host").toArray()).length,0);
  const oldCache = { ...snapshot } as Partial<Snapshot>;
  delete oldCache.channels; delete oldCache.channelParticipants; delete oldCache.messages;
  assert.deepEqual(projectSnapshot(oldCache as Snapshot,[]).channels,[]);
  await localDb.delete();
});

test('card drafts and card-only outbox messages survive local database reopen', async () => {
  await localDb.open();
  const role = 'learn:cards-test';
  const cards = [{version:1 as const,type:'plan' as const,entityId:'pro' as const}];
  await saveDraft(role,'card-draft','A recommendation',cards);
  const command:Command={id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:'message.send',payload:{channelId:randomUUID(),body:'',cards}};
  await enqueue(role,command);
  localDb.close(); await localDb.open();
  assert.deepEqual((await localDb.drafts.get(`${role}:card-draft`))?.cards,cards);
  const operations=await localDb.outbox.where('role').equals(role).toArray();
  assert.equal(operations.length,1);
  assert.deepEqual(projectSnapshot(snapshot,operations).messages.find(m => m.id === command.entityId)?.cards,cards);
});

test("online-only commands project optimistically before the server answers", async () => {
  const { directChannelId } = await import("../local/direct-channel");
  const { createHash } = await import("node:crypto");
  const me = snapshot.actor.userId, peer = randomUUID(), householdId = randomUUID(), messageId = randomUUID();
  const base: Snapshot = { ...snapshot, actor: { ...snapshot.actor, organizationId: "10000000-0000-4000-8000-000000001001" },
    messages: [{ id: messageId, version: 1, createdAt: snapshot.serverTime, updatedAt: snapshot.serverTime, channelId: randomUUID(), authorId: peer, body: "hi", reactions: [] }],
    households: [{ id: householdId, version: 1, createdAt: "", updatedAt: "", name: "A", termId: randomUUID(), hostId: me, timezone: "Asia/Shanghai", capacity: 4, theme: "" }],
    applications: [{ id: randomUUID(), version: 1, createdAt: "", updatedAt: "", userId: peer, goal: "g", availability: "a", status: "new" }],
    sessions: [{ id: randomUUID(), version: 1, createdAt: "", updatedAt: "", householdId, title: "s", description: "", startsAt: "2030-01-01T00:00:00.000Z", endsAt: "2030-01-01T01:00:00.000Z", status: "scheduled", meetingUrl: "" }] };
  const direct = await directChannelId(base.actor.organizationId, me, peer);
  const hash = createHash("sha256").update(`${base.actor.organizationId}:${[me, peer].sort().join(":")}`).digest("hex");
  assert.equal(direct, `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`, "client id must match the server's");
  const op = (command: Command) => ({ command, queuedAt: new Date().toISOString() });
  const channelId = randomUUID(), assignmentId = randomUUID();
  const view = projectSnapshot(base, [
    op({ id: randomUUID(), entityId: messageId, baseVersion: 1, kind: "message.react", payload: { emoji: "👍", active: true } }),
    op({ id: randomUUID(), entityId: channelId, baseVersion: 0, kind: "channel.create", payload: { name: "c", description: "", kind: "private" } }),
    op({ id: randomUUID(), entityId: direct, baseVersion: 0, kind: "conversation.open", payload: { userId: peer } }),
    op({ id: randomUUID(), entityId: assignmentId, baseVersion: 0, kind: "assignment.create", payload: { householdId, title: "t", description: "d", category: "practice", dueAt: "2030-01-01T00:00:00.000Z", week: 1 } }),
    op({ id: randomUUID(), entityId: base.sessions[0].id, baseVersion: 1, kind: "session.reschedule", payload: { startsAt: "2030-02-01T00:00:00.000Z", endsAt: "2030-02-01T01:00:00.000Z" } }),
    op({ id: randomUUID(), entityId: base.applications[0].id, baseVersion: 1, kind: "application.enroll", payload: { householdId } }),
  ]);
  assert.deepEqual(view.messages[0].reactions, [{ userId: me, emoji: "👍" }]);
  assert.ok(view.channels.some(c => c.id === channelId && c.ownerId === me));
  assert.equal(view.channelParticipants.filter(p => p.channelId === direct).length, 2);
  assert.ok(view.assignments.some(a => a.id === assignmentId));
  assert.equal(view.sessions[0].startsAt, "2030-02-01T00:00:00.000Z");
  assert.equal(view.applications[0].status, "enrolled");
  assert.ok(view.memberships.some(m => m.userId === peer && m.householdId === householdId));
  assert.equal(base.channels.length, 0, "projection never mutates the server snapshot");
  const undo = projectSnapshot(view, [op({ id: randomUUID(), entityId: messageId, baseVersion: 2, kind: "message.react", payload: { emoji: "👍", active: false } })]);
  assert.deepEqual(undo.messages[0].reactions, []);
});
