'use client';
import {Bell,BookOpen,CalendarDays,Check,Home,MessageCircle} from 'lucide-react';
import WorkspaceSidebar from '../../components/workspace/sidebar';
import Bluebird from './bluebird';

/** What the learner sidebar last showed. Kept in memory across client-side navigation
 *  (学习空间 ⇄ 个人信息) so the skeleton and the other page draw the same sidebar instead of
 *  reshuffling while data loads. A full page load starts empty. */
export type LearnSidebarState={title:string;subtitle:string;avatar:string|null;household:boolean;host:boolean;badge:number};
let last:LearnSidebarState|null=null;
export const rememberLearnSidebar=(s:LearnSidebarState)=>{last=s};
export const lastLearnSidebar=()=>last;

/** The learner sidebar shared by /learn, /about and their loading skeletons. */
export default function LearnSidebar({state,active,onSelect,teamAccess=false}:{state:LearnSidebarState;active:string;onSelect:(id:string)=>void;teamAccess?:boolean}){
 return <WorkspaceSidebar kind="learn" identityId={state.household?'Household':undefined} avatar={state.avatar} title={state.title} subtitle={state.subtitle} active={active} onSelect={onSelect} teamAccess={teamAccess} sections={[
  {items:[{id:'Notifications',label:'通知',icon:Bell,badge:state.badge}]},
  {label:'我的小组',items:[{id:'Home',label:'我的家',icon:Home},{id:'Conversations',label:'小组交流',icon:MessageCircle},{id:'Schedule',label:'相见日程',icon:CalendarDays}]},
  {label:'练习与成长',items:[{id:'Partner practice',label:'伙伴练习',icon:BookOpen},{id:'My coach',label:'AI 准备 · Beta',icon:Bluebird},{id:'Reviews',label:state.host?'活动观察':'活动复盘',icon:Check}]}]}/>;
}
