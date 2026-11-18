'use client';
import type {ReactNode} from 'react';
import {useLocale} from '../../components/locale-provider';
import { ClipboardList, Leaf, Users, House, MessageSquare, ListChecks, History } from 'lucide-react';
import WorkspaceSidebar, {type NavSection} from '../../components/workspace/sidebar';
const sections:NavSection[]=[
 {label:'活动与成长',items:[{id:'活动复盘',label:'活动复盘',icon:Leaf},{id:'Households',label:'Households',icon:House}]},
 {label:'认识与匹配',items:[{id:'申请与筛选',label:'申请与筛选',icon:ClipboardList},{id:'组一个家',label:'组一个家',icon:Users},{id:'Host 管理',label:'Host 管理',icon:Users}]},
 {label:'团队协作',items:[{id:'青鸟建议',label:'青鸟建议',icon:MessageSquare},{id:'运营待办',label:'运营待办',icon:ListChecks}]},
];
export default function TeamSidebar({tab,setTab,admin,organizationName,organizationSwitcher}:{tab:string;setTab:(tab:string)=>void;admin:boolean;organizationName?:string;organizationSwitcher:ReactNode}){const {t:tr}=useLocale();
 return <WorkspaceSidebar identity={organizationSwitcher} kind="team" title={organizationName||tr('当前组织')} subtitle="" sections={(admin?[...sections,{label:tr('设置'),items:[{id:'操作日志',label:tr('操作日志'),icon:History}]}]:[{label:tr('团队协作'),items:[{id:'Households',label:'Households',icon:House},{id:'运营待办',label:tr('运营待办'),icon:ListChecks}]}]).map(section=>({...section,label:section.label?tr(section.label):undefined,items:section.items.map(item=>({...item,label:tr(item.label)}))}))} active={tab} onSelect={setTab}/>;
}
