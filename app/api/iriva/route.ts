import { OpenRouterModelClient } from "wayline-agent-runtime/provider";
import { actorFromRequest, errorResponse } from "@/server/http";
import { workspaceRepository } from "@/server/container";
import { authorize } from "@/server/services/workspace-queries";
import { runIriva, turnSchema } from "@/server/iriva/agent";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const actor = await actorFromRequest(request);
    const turn = turnSchema.parse(await request.json());
    const repo = await workspaceRepository();
    await authorize(repo,actor);
    if (!process.env.OPENROUTER_API_KEY)
      return Response.json(
        { error: "Iriva 尚未连接模型，请联系管理员配置 OPENROUTER_API_KEY。" },
        { status: 503 },
      );
    const model = OpenRouterModelClient.fromEnv({
      appName: "Iriva",
      model: process.env.OPENROUTER_MODEL || undefined,
    });
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, request.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function emit(kind: string, text: string) {
          if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify({ kind, text }) + "\n"));
        }
        try {
          emit("answer", await runIriva(model, repo, actor, turn, signal, emit));
        } catch {
          emit("error", "本次对话中断。已完成的操作会保留，请先核对后再试。");
        } finally {
          if (!abort.signal.aborted) controller.close();
        }
      },
      cancel() {
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
