'use client';
import { ClipboardList, Leaf, Users, House, MessageSquare, ListChecks, ShieldCheck } from 'lucide-react';
import WorkspaceSidebar, {type NavSection} from '../../components/workspace/sidebar';
const sections:NavSection[]=[
 {label:'活动与成长',items:[{id:'活动复盘',label:'活动复盘',icon:Leaf},{id:'Households',label:'Households',icon:House}]},
 {label:'认识与匹配',items:[{id:'申请与筛选',label:'申请与筛选',icon:ClipboardList},{id:'组一个家',label:'组一个家',icon:Users}]},
 {label:'团队协作',items:[{id:'青鸟建议',label:'青鸟建议',icon:MessageSquare},{id:'运营待办',label:'运营待办',icon:ListChecks}]},
];
export default function TeamSidebar({tab,setTab,admin}:{tab:string;setTab:(tab:string)=>void;admin:boolean}){
 return <WorkspaceSidebar kind="team" title="青鸟团队" subtitle="一起照顾每一个小组" sections={admin?[...sections,{label:'设置',items:[{id:'团队权限',label:'团队权限',icon:ShieldCheck}]}]:sections} active={tab} onSelect={setTab}/>;
}
