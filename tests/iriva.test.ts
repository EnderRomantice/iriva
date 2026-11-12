import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelClient } from "wayline-agent-runtime";
import { SqliteRepository } from "../server/repositories/sqlite-repository";
import { asyncSqliteRepository } from "../server/repositories/async-sqlite-repository";
import { seedDemo } from "../server/db/seed";
import { runIriva } from "../server/iriva/agent";
import { demoActors } from "../domain/models";
import { workerTools } from "../server/iriva/tools";

test("Wayline delegates memory to an isolated worker and reports the committed change", async (t) => {
  const sqlite = new SqliteRepository(":memory:");
  seedDemo(sqlite);
  const repo = asyncSqliteRepository(sqlite);
  t.after(() => sqlite.db.close());
  const notices: string[] = [];
  const model: ModelClient = {
    async complete({ tools, messages }) {
      const names = tools.map((tool) => tool.name);
      const results = messages.filter((m) => m.role === "tool");
      if (names.includes("create_agent")) {
        assert.deepEqual(names, ["create_agent", "ask_agent"]);
        if (results.length) return { content: "记住了" };
        return {
          toolCalls: [
            { id: "delegate", name: "create_agent", arguments: { specialty: "记忆", task: "记住偏好" } },
          ],
        };
      }
      assert.deepEqual(names, ["read_memory", "update_memory"]);
      if (!results.length) return { toolCalls: [{ id: "read", name: "read_memory", arguments: {} }] };
      if (results.length === 1)
        return {
          toolCalls: [{ id: "save", name: "update_memory", arguments: { version: 0, content: "喜欢晨读" } }],
        };
      return { content: "已保存" };
    },
  };
  const text = await runIriva(
    model,
    repo,
    demoActors.learn,
    { message: "记住我喜欢晨读", history: [] },
    new AbortController().signal,
    (kind, text) => notices.push(kind + text),
  );
  assert.equal(text, "记住了");
  assert.ok(notices.includes("memory喜欢晨读"));
  assert.deepEqual(sqlite.db.prepare("SELECT * FROM iriva_memory").all(), [
    { user_id: demoActors.learn.userId, content: "喜欢晨读", version: 1 },
  ]);
  for (const actor of Object.values(demoActors)) {
    const groups = workerTools(repo, actor, () => {});
    assert.equal("小组" in groups, actor.role !== "learn");
    assert.equal("招生" in groups, actor.role === "ops");
  }
});

test("worker writes stay scoped to the user, contact list and accessible channels", async (t) => {
  const sqlite = new SqliteRepository(":memory:");
  seedDemo(sqlite);
  t.after(() => sqlite.db.close());
  const repo = asyncSqliteRepository(sqlite);
  const toolsFor = (actor: typeof demoActors.learn) =>
    Object.values(workerTools(repo, actor, () => {})).flat();
  const call = (actor: typeof demoActors.learn, name: string, args: Record<string, unknown> = {}) => {
    const tool = toolsFor(actor).find((tool) => tool.name === name)!;
    return tool.execute(args, {
      session: { id: "test", metadata: {}, messages: [] },
      requestApproval: async () => false,
    });
  };
  const { learn, host, ops } = demoActors;
  await call(learn, "update_memory", { version: 0, content: "目标一" });
  await assert.rejects(call(learn, "update_memory", { version: 0, content: "并发修改" }));
  assert.deepEqual(await call(host, "read_memory"), { content: "", version: 0 });
  await call(learn, "save_contact", { userId: ops.userId, note: "运营" });
  await call(learn, "save_contact", { userId: ops.userId, note: "报名联系人" });
  const contacts = (await call(learn, "contacts")) as { peer_id: string; note: string }[];
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].note, "报名联系人");
  assert.deepEqual(await call(host, "contacts"), []);
  const dm = (await call(learn, "send_message", {
    target: "person",
    id: ops.userId,
    body: "请问报名进度？",
  })) as { channelId: string };
  const messages = (await call(ops, "read_messages", { channelId: dm.channelId })) as { items:{ body: string }[] };
  assert.equal(messages.items.at(-1)?.body, "请问报名进度？");
  await assert.rejects(call(host, "read_messages", { channelId: dm.channelId }));
  await assert.rejects(call(host, "send_message", { target: "channel", id: dm.channelId, body: "不能发送" }));
});
