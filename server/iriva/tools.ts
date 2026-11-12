import { authorize,collectionPage, type PageOptions } from '../services/workspace-queries';
import { hydratePage } from '../services/workspace-relations';
import { one, exists,type Table } from '../repositories/queries';
import { accountPage } from '../services/account-pages';
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
  const read=async(table:Table,options:PageOptions={})=>{await authorize(repo,actor);const page=await collectionPage(repo,actor,table,options);return {...page,...await hydratePage(repo,actor,table,page.items)};};
  const paged=z.object({after:z.string().max(1000).optional(),query:z.string().max(200).optional()});
  const org = actor.organizationId || defaultOrganizationId;
  const empty = z.object({});
  const sentMessages = new Set<string>();
  const tools: Record<string, Tool[]> = {};
  function group(name: string, ...items: Tool[]) {
    tools[name] = items;
  }
  group(
    "日程",
    capability("schedule", "查询工作区可见日程", paged, async args => read("sessions",args)),
  );
  group(
    "作业",
    capability("assignments", "查询可见练习、提交和反馈", paged, async args => read("assignments",args)),
  );
  if (actor.role !== "learn") {
    group(
      "约谈",
      capability("bookings", "分页查询工作区约谈，Host 仅看自己收到的预约", paged, async args => accountPage(repo,actor,'bookings',args)),
    );
    group(
      "小组",
      capability("homes", "分页查询可见小组与关联成员", paged, async args => read('households',args)),
    );
  }
  if (actor.role === "ops") {
    group(
      "招生",
      capability("admissions", "分页查询报名，支持搜索", paged, async args => read('applications',args)),
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
  group(
    "联系人",
    capability("members", "分页搜索工作区成员", paged, async args=>read('users',args)),
    capability("contacts", "查询自己的好友及备注，最多 50 条，使用 after 翻页", paged, async ({after}) => repo.db.prepare("SELECT c.peer_id,c.note,u.name FROM iriva_contacts c JOIN users u ON u.id=c.peer_id WHERE c.owner_id=? AND c.organization_id=? AND c.peer_id>? AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id=c.peer_id AND m.organization_id=c.organization_id) ORDER BY c.peer_id LIMIT 50").all(actor.userId,org,after||'')),
    capability(
      "save_contact",
      "添加好友或更新自己对该好友的备注",
      z.object({ userId: z.string(), note: z.string().max(500) }),
      async ({ userId, note }) => {
        if(userId===actor.userId||!await exists(repo,'SELECT 1 FROM organization_memberships WHERE organization_id=? AND user_id=?',[org,userId])) throw new Error("请选择当前工作区的其他成员。");
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
    capability("channels", "分页查询可见频道和私聊对象", paged, async args=>read('channels',args)),
    capability("read_messages", "分页读取指定对话的消息，query 搜索全部可见历史，nextCursor 可读取更早消息", paged.extend({channelId:z.string()}), async args=>{
      const channel=await collectionPage(repo,actor,'channels',{ids:[args.channelId]});
      if(!channel.items.length)throw new Error('无法访问这个频道。');
      return read('messages',args);
    }),
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
            const existing=await exists(repo,"SELECT 1 FROM channels c JOIN channel_participants p ON p.channel_id=c.id WHERE c.organization_id=? AND c.kind='direct' AND p.user_id=? AND EXISTS (SELECT 1 FROM channel_participants self WHERE self.channel_id=c.id AND self.user_id=?)",[org,id,actor.userId]);
            const isGroup=(await one(repo,'organizations','t.id=?',[org]))?.kind==='host';
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
