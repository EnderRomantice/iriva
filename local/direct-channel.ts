import { defaultOrganizationId } from "@/domain/workspace";

/**
 * Mirrors WorkspaceService.execute("conversation.open"): the direct channel id is a
 * deterministic hash of the workspace and the sorted pair, so the client can open the
 * conversation before the server has answered.
 */
export async function directChannelId(organizationId: string | undefined, a: string, b: string) {
  const pair = [a, b].sort().join(":");
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${organizationId || defaultOrganizationId}:${pair}`)));
  const hash = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
