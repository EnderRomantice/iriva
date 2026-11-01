import { sessionActor, sameOrigin } from "./auth";
import { ZodError } from "zod";
import { demoActors, type Actor, type Role } from "../domain/models";
import { DomainError } from "../domain/commands";

/** Explicit loopback-only development identity. Replace with session adapter for deployment. */
export function requireLocalDemo(request: Request) {
  const url = new URL(request.url);
  // Next's development server may normalize request.url to localhost even when
  // the browser used 127.0.0.1. Validate the incoming Host, not that internal URL.
  const incoming = new URL(`${url.protocol}//${request.headers.get("host") || url.host}`);
  const host = incoming.hostname;
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(host)) throw new DomainError(403, "演示身份仅在本地开发环境可用。部署前请接入正式登录。");
  const origin = request.headers.get("origin");
  if (origin && origin !== incoming.origin) throw new DomainError(403, "不接受跨站请求。");
}
export function actorFromRequest(request: Request): Actor {
  sameOrigin(request);
  const session = sessionActor(request);
  const expected = request.headers.get("x-account-id");
  if (expected && expected !== session?.userId) throw new DomainError(401, "账号已切换，请重新打开工作区。");
  if (session) return session;
  requireLocalDemo(request);
  const role = request.headers.get("x-demo-role") as Role;
  if (!Object.hasOwn(demoActors, role ?? "")) throw new DomainError(401, "请选择一个本地演示身份。");
  const organizationId = request.headers.get("x-workspace-id");
  return organizationId ? { ...demoActors[role], organizationId } : demoActors[role];
}
export function errorResponse(error: unknown) {
  if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "提交的数据格式不正确。" }, { status: 400 });
  console.error(error);
  return Response.json({ error: "暂时无法保存，请稍后重试。" }, { status: 500 });
}
