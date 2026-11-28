import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLocale,translate} from '../lib/locale';
import ts from 'typescript';
import {workspaceNavigation} from '../domain/workspace-navigation';
import {readFileSync} from 'node:fs';

test('locale defaults, interpolation, and unknown text preserve user input',()=>{
 assert.equal(normalizeLocale('en'),'en');
 assert.equal(normalizeLocale('invalid'),'zh');
 assert.equal(translate('en','移除 {name}',{name:'青鸟 Emma'}),'Remove 青鸟 Emma');
 assert.equal(translate('zh','移除 {name}',{name:'Emma'}),'移除 Emma');
 assert.equal(translate('en','原始用户内容'),'原始用户内容');
});

test('every literal UI translation in the team workspace has an English entry',()=>{
 const paths=['app/team/team.tsx','app/team/oral-evaluation.tsx','components/oral-audio-player.tsx','app/team/organization-switcher.tsx','components/workspace/shell.tsx','app/team/hosts.tsx','app/team/organization-panel.tsx','app/team/audit-log.tsx','components/reviews/workspace.tsx','components/workspace/sidebar.tsx','app/signin/form.tsx','app/team/page.tsx'];
 for(const path of paths){
  const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node:ts.Node){
   if(ts.isCallExpression(node)&&['tr','t'].includes(node.expression.getText(source))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
    const key=node.arguments[0].text;
    if(/[\p{Script=Han}]/u.test(key))assert.notEqual(translate('en',key),key,`${path}: missing ${key}`);
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
});

test('public locale respects explicit preference and browser quality order', async()=>{
 const {resolveLocale}=await import('../lib/locale');
 assert.equal(resolveLocale(undefined,'en-US,en;q=0.9,zh;q=0.8'),'en');
 assert.equal(resolveLocale(undefined,'en;q=0.2,zh-CN;q=0.9'),'zh');
 assert.equal(resolveLocale('zh','en-US'),'zh');
 assert.equal(resolveLocale('en','zh-CN'),'en');
 assert.equal(resolveLocale(undefined,'zh;q=0,en;q=1'),'en');
 assert.equal(resolveLocale(undefined,'fr-FR'),'en');
});

test('shared Host and learner interface copy has English translations',()=>{
 const paths=['app/app/portal.tsx','components/workspace/sidebar.tsx','components/workspace/account-menu.tsx','app/app/partners.tsx','app/app/practice-invites.tsx','app/app/notifications.tsx','app/app/household-avatar.tsx','app/app/skeleton.tsx','app/app/conversations.tsx','app/app/coach.tsx','app/about/profile.tsx','components/workspace/avatar-upload.tsx','components/workspace/skeletons.tsx','components/household/invite-code.tsx','components/chat/emoji-picker.tsx'];
 for(const path of paths){
  const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node:ts.Node){
   if(ts.isCallExpression(node)&&node.expression.getText(source)==='tr'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
    const key=node.arguments[0].text;
    if(/[\p{Script=Han}]/u.test(key))assert.doesNotMatch(translate('en',key),/[\p{Script=Han}]/u,`${path}: missing ${key}`);
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
 assert.equal(translate('en','账户菜单：{name}',{name:'青鸟 Emma'}),'Account menu: 青鸟 Emma');
 assert.equal(translate('en','学习进度 · 第 {week} 周 / 共 {duration} 周',{week:2,duration:4}),'Progress · Week 2 of 4');
});

test('workspace dates and time zone options change language without changing time zones',async()=>{
 const {beijingTime,timezoneOptions}=await import('../lib/timezones');
 const date=new Date('2026-01-01T23:00:00Z');
 assert.match(beijingTime(date.toISOString(),undefined,'en'),/Jan 2, 07:00/);
 assert.match(beijingTime(date.toISOString()),/1月2日.*07:00/);
 const zh=timezoneOptions(date,'zh'),en=timezoneOptions(date,'en');
 assert.deepEqual(en.map(x=>x.value),zh.map(x=>x.value));
 assert.match(en.find(x=>x.value==='+08:00')!.label,/Beijing/);
 assert.ok(en.every(x=>!/[\p{Script=Han}]/u.test(x.label)));
});

 test('all role-based navigation labels are translated',()=>{
 for(const role of ['learner','host','owner','admin','partner'] as const){
  for(const section of workspaceNavigation(role)){
   for(const label of [section.label,...section.items.map(item=>item.label)].filter(Boolean) as string[]){
    assert.doesNotMatch(translate('en',label),/[\p{Script=Han}]/u,label);
   }
  }
 }
});
