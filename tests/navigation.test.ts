import { test } from "node:test";
import assert from "node:assert/strict";
import { appendVisit, rememberVisit, readRoute, routeHref, viewRoute } from "../features/space/navigation";
import { defaultOrganizationId, demoOrganizationId, workspaceScope, scopeIdentity } from "../domain/workspace";
test("history routes restore organization, household and view together", () => {
  const route = { organizationId: demoOrganizationId, householdId: "group-2", view: "household" as const };
  assert.deepEqual(readRoute(routeHref("learn", route), "learn"), route);
  assert.equal(readRoute("/learn?view=applications", "learn").view, "overview");
  assert.equal(readRoute("/ops?view=tasks", "ops").view, "overview");
});
test("navigation after going back discards the old forward branch", () => {
  const a = { href:"/learn", title:"A", at:1 }, b = { href:"/learn?view=tasks", title:"B", at:2 }, c = { href:"/learn?view=calendar", title:"C", at:3 };
  const state = { entries:[a,b], index:0 };
  assert.deepEqual(appendVisit(state,c), { entries:[a,c], index:1 });
  assert.equal(appendVisit(state,a), state);
});
test("organization cache keys preserve old drafts and isolate new workspaces", () => {
  assert.equal(workspaceScope("learn", defaultOrganizationId), "learn");
  assert.notEqual(workspaceScope("learn", demoOrganizationId), "learn");
  assert.deepEqual(scopeIdentity(workspaceScope("host",demoOrganizationId)), { role:"host", organizationId:demoOrganizationId });
});

test("recent history retains visited pages after branching and deduplicates revisits", () => {
  const a = { href:"/learn", title:"A", at:1 }, b = { href:"/learn?view=tasks", title:"B", at:2 }, c = { href:"/learn?view=calendar", title:"C", at:3 };
  assert.deepEqual(rememberVisit([b,a], c).map(v => v.title), ["C","B","A"]);
  assert.deepEqual(rememberVisit([c,b,a], a).map(v => v.title), ["A","C","B"]);
});


test("organization navigation leaves a group while group tabs retain their scope", () => {
  const group = { organizationId: demoOrganizationId, householdId: "group-2", view: "overview" as const };
  assert.equal(viewRoute(group, "calendar", "organization").householdId, "");
  assert.equal(viewRoute(group, "calendar", "household").householdId, "group-2");
  assert.equal(viewRoute(group, "applications", "household").householdId, "");
  assert.equal(viewRoute(group, "overview", "organization").organizationId, demoOrganizationId);
  assert.equal(readRoute("/host?view=journey", "host").view, "overview");
  assert.equal(readRoute("/ops?household=group-2&view=applications", "ops").householdId, "");
  assert.notEqual(routeHref("host", viewRoute(group, "calendar", "organization")), routeHref("host", viewRoute(group, "calendar", "household")));
});

test("chat history restores channel and organization, then exits cleanly to groups", () => {
  const route = {organizationId:demoOrganizationId,householdId:"",channelId:"dm-1",view:"direct" as const};
  assert.deepEqual(readRoute(routeHref("learn",route),"learn"),route);
  assert.equal(viewRoute(route,"calendar","organization").channelId,undefined);
  assert.equal(readRoute("/learn?view=channels&channel=room-1&household=group-2","learn").householdId,"");
});
