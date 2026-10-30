import { commandSchema } from "@/domain/commands";
import { workspaceService } from "@/server/container";
import { actorFromRequest, errorResponse } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const actor = actorFromRequest(request); const command = commandSchema.parse(await request.json()); return Response.json(await workspaceService().execute(actor, command)); }
  catch (error) { return errorResponse(error); }
}
