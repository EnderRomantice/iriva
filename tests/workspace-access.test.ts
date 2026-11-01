import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessWorkspaceView, canManageSubscription, workspaceViewRoles, workspaceHomeHref } from '../domain/workspace-access';
import { normalizeRoute, readRoute, routeHref } from '../features/space/navigation';
import { viewLabels } from '../features/space/preferences';
import { defaultOrganizationId } from '../domain/workspace';

test('navigation and role policies cover every workspace view', () => {
  assert.deepEqual(Object.keys(workspaceViewRoles).sort(),Object.keys(viewLabels).sort());
  for(const role of ['learn','host','ops'] as const) {
    for(const view of ['overview','channels','direct','profile','household','calendar']) assert.equal(canAccessWorkspaceView(role,view),true);
    assert.equal(canManageSubscription(role),role==='learn');
    assert.equal(canAccessWorkspaceView(role,'hosts'),role==='learn');
    assert.equal(canAccessWorkspaceView(role,'applications'),role!=='learn');
    assert.equal(canAccessWorkspaceView(role,'tasks'),role!=='ops');
    assert.equal(canAccessWorkspaceView(role,'unknown'),false);
  }
});
test('restricted links cannot keep stale group, conversation or profile-return parameters', () => {
  for(const role of ['host','ops'] as const) {
    assert.deepEqual(readRoute(`/${role}?view=hosts&household=old&channel=secret&return=hosts&tab=bookings`,role),{organizationId:defaultOrganizationId,householdId:'',view:'overview'});
    assert.equal(routeHref(role,{organizationId:defaultOrganizationId,householdId:'old',view:'hosts'}),`/${role}`);
    assert.equal(readRoute(`/${role}?view=profile&return=hosts`,role).profileReturn,undefined);
  }
  const route=normalizeRoute('learn',{organizationId:defaultOrganizationId,householdId:'old',view:'direct',channelId:'dm',applicationTab:'bookings',profileReturn:'hosts'});
  assert.deepEqual(route,{organizationId:defaultOrganizationId,householdId:'',view:'direct',channelId:'dm'});
  assert.equal(workspaceHomeHref('ops','org&view=hosts'),'/ops?org=org%26view%3Dhosts');
});
