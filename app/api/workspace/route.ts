import { workspaceService } from "@/server/container";
import { actorFromRequest, errorResponse } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const actor = await actorFromRequest(request); return Response.json(await (await workspaceService()).snapshot(actor), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}
