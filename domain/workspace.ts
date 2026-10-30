import type { Role } from "./models";
export const defaultOrganizationId = "10000000-0000-4000-8000-000000001001";
export const demoOrganizationId = "10000000-0000-4000-8000-000000001002";
export type WorkspaceScope = Role | `${Role}:${string}`;
// Preserve the original workspace's existing offline drafts and outbox keys.
export function workspaceScope(role: Role, organizationId = defaultOrganizationId): WorkspaceScope {
  return organizationId === defaultOrganizationId ? role : `${role}:${organizationId}`;
}
export function scopeIdentity(scope: WorkspaceScope) {
  const [role, organizationId = defaultOrganizationId] = scope.split(":");
  return { role: role as Role, organizationId };
}
