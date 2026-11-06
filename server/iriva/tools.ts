import { randomUUID } from "node:crypto";
import type { Tool } from "wayline-agent-runtime";
import { z } from "zod";
import type { Actor } from "../../domain/models";
import { defaultOrganizationId } from "../../domain/workspace";
import type { DatabaseRepository } from "../repositories/database-repository";
import { platformId } from "../services/owned-workspaces";
import { WorkspaceService } from "../services/workspace-service";

export type Report = (kind: "progress" | "memory", text: string) => void;

export function capability<S extends z.ZodObject>(
  name: string,
  description: string,
  schema: S,
  perform: (args: z.output<S>, signal?: AbortSignal) => Promise<unknown>,
  write = false,
): Tool {
  return {
    name,
    description,
    inputSchema: z.toJSONSchema(schema, { target: "draft-2020-12" }),
    executionPolicy: write ? "exclusive" : "parallel",
    async execute(args, { signal }) {
      signal?.throwIfAborted();
      return perform(schema.parse(args), signal);
    },
  };
}

export function workerTools(repo: DatabaseRepository, actor: Actor, report: Report) {
  const workspace = new WorkspaceService(repo);
  const snapshot = () => workspace.snapshot(actor);
  const org = actor.organizationId || defaultOrganizationId;
  const empty = z.object({});
  const sentMessages = new Set<string>();
  const tools: Record<string, Tool[]> = {};
  function group(name: string, ...items: Tool[]) {
    tools[name] = items;
  }
  group(
    "日程",
    capability("schedule", "查询工作区可见日程", empty, async () => (await snapshot()).sessions),
  );
  group(
    "作业",
    capability("assignments", "查询可见练习、提交和反馈", empty, async () => {
      const { assignments, submissions, feedback } = await snapshot();
      return { assignments, submissions, feedback };
    }),
  );
  if (actor.role !== "learn") {
    group(
      "约谈",
      capability("bookings", "查询工作区约谈和处理状态，Host 仅看自己收到的预约", empty, async () => {
        const platform = actor.role === "host" ? await platformId(repo, org) : org;
        const filter = actor.role === "host" ? " AND b.host_id=?" : "";
        return repo.db
          .prepare(
            `SELECT b.id,b.status,b.created_at,u.name AS learner,h.name AS host
        FROM bookings b JOIN users u ON u.id=b.learner_id JOIN users h ON h.id=b.host_id
        WHERE b.organization_id=?${filter} ORDER BY b.created_at DESC`,
          )
          .all(...(actor.role === "host" ? [platform, actor.userId] : [platform]));
      }),
    );
    group(
      "小组",
      capability("homes", "查询管理的小组和学生", empty, async () => {
        const { households, memberships, users } = await snapshot();
        return {
          households,
          students: memberships
            .filter((m) => m.role === "learner")
            .map((m) => ({
              householdId: m.householdId,
              userId: m.userId,
              name: users.find((u) => u.id === m.userId)?.name,
            })),
        };
      }),
    );
  }
  if (actor.role === "ops") {
    group(
      "招生",
      capability("admissions", "查询报名、联系状态和入组名单", empty, async () => {
        const { applications, enrollments, users } = await snapshot();
        const named = <T extends { userId: string }>(row: T) => ({
          ...row,
          name: users.find((u) => u.id === row.userId)?.name,
        });
        return { applications: applications.map(named), enrollments: enrollments.map(named) };
      }),
    );
  }
  const readMemory = async () =>
    (await repo.db
      .prepare("SELECT content, version FROM iriva_memory WHERE user_id=?")
      .get(actor.userId)) || { content: "", version: 0 };
  group(
    "记忆",
    capability("read_memory", "读取当前用户唯一的长期记忆和版本", empty, readMemory),
    capability(
      "update_memory",
      "先读取版本，合并重要事实或按要求遗忘，保存整条记录",
      z.object({
        version: z.number().int().nonnegative().describe("必须原样传入 read_memory 返回的当前 version。首次保存传 0，版本由服务端递增。"),
        content: z.string().max(6000),
      }),
      async ({ version, content }) => {
        const result =
          version === 0
            ? await repo.db
                .prepare(
                  "INSERT INTO iriva_memory (user_id,content,version) VALUES (?,?,1) ON CONFLICT(user_id) DO NOTHING",
                )
                .run(actor.userId, content)
            : await repo.db
                .prepare("UPDATE iriva_memory SET content=?, version=version+1 WHERE user_id=? AND version=?")
                .run(content, actor.userId, version);
        if (!result.changes) throw new Error("记忆已更改，请重新读取并合并。");
        report("memory", content || "记忆已清空");
        return { saved: true, version: version + 1 };
      },
      true,
    ),
  );
  const members = async () =>
    (await snapshot()).users.filter((u) => u.id !== actor.userId).map(({ id, name }) => ({ id, name }));
  group(
    "联系人",
    capability("members", "查找工作区成员的姓名与 ID", empty, members),
    capability("contacts", "查询自己的好友及备注", empty, async () => {
      const visible = await members();
      const contacts = await repo.db
        .prepare("SELECT peer_id,note FROM iriva_contacts WHERE owner_id=? AND organization_id=?")
        .all(actor.userId, org);
      return contacts
        .filter((c) => visible.some((u) => u.id === c.peer_id))
        .map((c) => ({ ...c, name: visible.find((u) => u.id === c.peer_id)?.name }));
    }),
    capability(
      "save_contact",
      "添加好友或更新自己对该好友的备注",
      z.object({ userId: z.string(), note: z.string().max(500) }),
      async ({ userId, note }) => {
        if (!(await members()).some((u) => u.id === userId)) throw new Error("请选择当前工作区的其他成员。");
        await repo.db
          .prepare(
            "INSERT INTO iriva_contacts (owner_id,organization_id,peer_id,note) VALUES (?,?,?,?) ON CONFLICT(owner_id,organization_id,peer_id) DO UPDATE SET note=excluded.note",
          )
          .run(actor.userId, org, userId, note);
        return { saved: true };
      },
      true,
    ),
  );
  group(
    "消息",
    capability("channels", "查询可见频道和私聊对象", empty, async () => {
      const { channels, channelParticipants, users } = await snapshot();
      return channels.map(({ id, name, kind }) => ({
        id,
        kind,
        name:
          kind === "direct"
            ? users.find((u) =>
                channelParticipants.some(
                  (p) => p.channelId === id && p.userId === u.id && u.id !== actor.userId,
                ),
              )?.name
            : name,
      }));
    }),
    capability(
      "read_messages",
      "读取指定频道或私聊的最近消息",
      z.object({ channelId: z.string() }),
      async ({ channelId }) => {
        const data = await snapshot();
        if (!data.channels.some((c) => c.id === channelId)) throw new Error("无法访问这个频道。");
        return data.messages
          .filter((m) => m.channelId === channelId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-50)
          .map(({ authorId, body, createdAt }) => ({
            name: data.users.find((u) => u.id === authorId)?.name,
            body,
            createdAt,
          }));
      },
    ),
    capability(
      "send_message",
      "仅按用户明确要求，向指定频道或成员代发消息",
      z.object({
        target: z.enum(["channel", "person"]),
        id: z.string(),
        body: z.string().trim().min(1).max(12000),
      }),
      async ({ target, id, body }, signal) => {
        const command = () => ({ id: randomUUID(), entityId: randomUUID(), baseVersion: 0 });
        let channelId = id;
        if (target === "person") {
          if (actor.role === "learn") {
            const data = await snapshot();
            const existing = data.channels.some(
              (c) =>
                c.kind === "direct" &&
                data.channelParticipants.some((p) => p.channelId === c.id && p.userId === id),
            );
            const isGroup = data.organizations.find((o) => o.id === org)?.kind === "host";
            if (
              !existing &&
              !isGroup &&
              (await repo.db
                .prepare(
                  "SELECT id FROM organization_memberships WHERE organization_id=? AND user_id=? AND role='host'",
                )
                .get(org, id))
            ) {
              throw new Error("首次联系 Host 请先通过「寻找 Host」发起约谈。");
            }
          }
          const opened = await workspace.execute(actor, {
            ...command(),
            kind: "conversation.open",
            payload: { userId: id },
          });
          channelId = opened.entityId!;
        }
        signal?.throwIfAborted();
        const receipt = JSON.stringify([channelId, body]);
        if (!sentMessages.has(receipt)) {
          await workspace.execute(actor, {
            ...command(),
            kind: "message.send",
            payload: { channelId, body },
          });
          sentMessages.add(receipt);
          report("progress", "消息已发送");
        }
        return { sent: true, channelId };
      },
      true,
    ),
  );
  return tools;
}
