import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceNavigation, workspaceDesktopNavigation, workspaceInitialTab, workspaceTabAllowed} from '../domain/workspace-navigation';
import type {WorkspaceRole} from '../domain/workspace-access';

const tabs=(role:WorkspaceRole)=>workspaceNavigation(role).flatMap(section=>section.items.map(item=>item.id));

test('learner and Host share the same navigation, with role-specific review copy',()=>{
  assert.deepEqual(tabs('host'),tabs('learner'));
  for(const role of ['learner','host'] as const){
    assert.equal(workspaceTabAllowed(role,'申请与筛选'),false);
    assert.equal(workspaceTabAllowed(role,'团队权限'),false);
    assert.equal(workspaceTabAllowed(role,'Household'),true);
    const review=workspaceNavigation(role).flatMap(section=>section.items).find(item=>item.id==='Reviews');
    assert.equal(review?.label,role==='host'?'活动观察':'活动复盘');
  }
});

test('organization collaborators never receive administrative tabs',()=>{
  assert.deepEqual(tabs('partner'),['Households','运营待办']);
  for(const tab of ['活动复盘','申请与筛选','Host 管理','操作日志','团队权限','Household']){
    assert.equal(workspaceTabAllowed('partner',tab),false,tab);
  }
  assert.deepEqual(tabs('owner'),tabs('admin'));
  for(const role of ['owner','admin'] as const){
    assert.equal(workspaceTabAllowed(role,'团队权限'),true);
    assert.equal(workspaceTabAllowed(role,'Host 管理'),true);
  }
});

test('deep links and role changes use the same allowed-tab policy',()=>{
  assert.equal(workspaceInitialTab('admin','Host 管理'),'Host 管理');
  assert.equal(workspaceInitialTab('owner','团队权限'),'团队权限');
  assert.equal(workspaceInitialTab('partner','团队权限'),'运营待办');
  assert.equal(workspaceInitialTab('learner','Host 管理'),'Home');
  assert.equal(workspaceInitialTab('host','Reviews'),'Reviews');
  assert.equal(workspaceInitialTab('admin','unknown'),'活动复盘');
  assert.deepEqual(workspaceNavigation(null),[]);
  for(const role of ['learner','host','partner','admin','owner'] as const){
    const ids=tabs(role);
    assert.equal(new Set(ids).size,ids.length);
    for(const id of ids) assert.equal(workspaceInitialTab(role,id),id);
  }
});

test('desktop temporarily hides observation, AI and practice apps while retaining existing deep links',()=>{
 for(const role of ['host','learner'] as const){
  const visible=workspaceDesktopNavigation(role).map(item=>item.id);
  assert.deepEqual(visible,['Notifications','Home','Conversations','Schedule']);
  for(const tab of ['Reviews','My coach','Partner practice'])assert.equal(workspaceTabAllowed(role,tab),true);
 }
 assert.deepEqual(workspaceDesktopNavigation(null),[]);
 assert.deepEqual(workspaceDesktopNavigation('partner').map(item=>item.id),['Households','运营待办']);
});
