import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLocale,translate} from '../lib/locale';
import {english} from '../lib/translations';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

test('locale defaults, interpolation, and unknown text preserve user input',()=>{
 assert.equal(normalizeLocale('en'),'en');
 assert.equal(normalizeLocale('invalid'),'zh');
 assert.equal(translate('en','移除 {name}',{name:'青鸟 Emma'}),'Remove 青鸟 Emma');
 assert.equal(translate('zh','移除 {name}',{name:'Emma'}),'移除 Emma');
 assert.equal(translate('en','原始用户内容'),'原始用户内容');
});

test('every literal UI translation in the team workspace has an English entry',()=>{
 const paths=['app/team/team.tsx','app/team/organization-switcher.tsx','app/team/sidebar.tsx','app/team/hosts.tsx','app/team/organization-panel.tsx','app/team/audit-log.tsx','components/reviews/workspace.tsx','components/workspace/sidebar.tsx','app/signin/form.tsx','app/team/page.tsx'];
 for(const path of paths){
  const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node:ts.Node){
   if(ts.isCallExpression(node)&&['tr','t'].includes(node.expression.getText(source))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
    const key=node.arguments[0].text;
    if(/[\p{Script=Han}]/u.test(key))assert.ok(english[key],`${path}: missing ${key}`);
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
});
