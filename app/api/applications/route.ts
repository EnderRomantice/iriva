import { workspaceService } from "@/server/container";
import { requireLocalDemo, errorResponse } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { requireLocalDemo(request); return Response.json(await (await workspaceService()).apply(await request.json(), request.headers.get("x-workspace-id") || undefined), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
