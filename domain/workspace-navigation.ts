import {isTeamRole, type WorkspaceRole} from './workspace-access';

// Navigation is presentation policy. APIs still enforce organization permissions.
export type WorkspaceNavItem = {id:string; label:string; icon:'home'|'messages'|'calendar'|'tasks'|'bell'|'book'|'bird'|'check'|'leaf'|'clipboard'|'users'|'feedback'|'history'};
export type WorkspaceNavSection = {label?:string; items:WorkspaceNavItem[]};
const group:WorkspaceNavSection = {label:'我的小组',items:[
  {id:'Home',label:'我的家',icon:'home'},
  {id:'Conversations',label:'小组交流',icon:'messages'},
  {id:'Schedule',label:'相见日程',icon:'calendar'},
]};
const collaboration:WorkspaceNavItem = {id:'运营待办',label:'运营待办',icon:'tasks'};
const households:WorkspaceNavItem = {id:'Households',label:'Households',icon:'home'};

export function workspaceNavigation(role:WorkspaceRole|null):WorkspaceNavSection[] {
  if (!role) return [];
  if (!isTeamRole(role)) return [
    {items:[{id:'Notifications',label:'通知',icon:'bell'}]},
    group,
    {label:'练习与成长',items:[
      {id:'Partner practice',label:'伙伴练习',icon:'book'},
      {id:'My coach',label:'AI 准备 · Beta',icon:'bird'},
      {id:'Reviews',label:role==='host'?'活动观察':'活动复盘',icon:'check'},
    ]},
  ];
  if (role==='partner') return [{label:'团队协作',items:[households,collaboration]}];
  return [
    {label:'活动与成长',items:[{id:'活动复盘',label:'活动复盘',icon:'leaf'},households]},
    {label:'认识与匹配',items:[
      {id:'申请与筛选',label:'申请与筛选',icon:'clipboard'},
      {id:'组一个家',label:'组一个家',icon:'users'},
      {id:'Host 管理',label:'Host 管理',icon:'users'},
    ]},
    {label:'团队协作',items:[{id:'青鸟建议',label:'青鸟建议',icon:'feedback'},collaboration]},
    {label:'设置',items:[{id:'操作日志',label:'操作日志',icon:'history'}]},
  ];
}

export function workspaceTabAllowed(role:WorkspaceRole,tab:string) {
  if(tab==='Household') return !isTeamRole(role);
  if(tab==='团队权限') return role==='owner'||role==='admin';
  return workspaceNavigation(role).some(section=>section.items.some(item=>item.id===tab));
}

export function workspaceInitialTab(role:WorkspaceRole,tab?:string) {
  if(tab&&workspaceTabAllowed(role,tab)) return tab;
  return isTeamRole(role)?role==='partner'?'运营待办':'活动复盘':'Home';
}

/** Temporarily hide these apps from the desktop without deleting existing content or deep links. */
export function workspaceDesktopNavigation(role:WorkspaceRole|null):WorkspaceNavItem[] {
  const hidden=new Set(['Reviews','My coach','Partner practice']);
  return workspaceNavigation(role).flatMap(section=>section.items).filter(item=>!hidden.has(item.id));
}
