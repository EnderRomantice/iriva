import type { Role } from './models';

export const workspaceViewRoles = {
  overview:['learn','host','ops'], channels:['learn','host','ops'], direct:['learn','host','ops'],
  tasks:['learn','host'], applications:['host','ops'], hosts:['learn'], manage:['host','ops'],
  calendar:['learn','host','ops'], household:['learn','host','ops'], journey:['learn','host','ops'], profile:['learn','host','ops'],
} as const satisfies Record<string,readonly Role[]>;
export type WorkspaceView = keyof typeof workspaceViewRoles;
export function canAccessWorkspaceView(role:Role,view:string):view is WorkspaceView {
  return Object.hasOwn(workspaceViewRoles,view) && (workspaceViewRoles[view as WorkspaceView] as readonly Role[]).includes(role);
}
/** Host management is a rail entry for ops; Hosts reach it as a tab inside their group. */
export function isRailView(role:Role,view:string) { return canAccessWorkspaceView(role,view) && !(view === 'manage' && role !== 'ops'); }
export function canManageSubscription(role:Role) { return role === 'learn'; }
export function workspaceHomeHref(role:Role,organizationId?:string) {
  const query = new URLSearchParams();
  if(organizationId) query.set('org',organizationId);
  return `/${role}${query.size ? `?${query}` : ''}`;
}
