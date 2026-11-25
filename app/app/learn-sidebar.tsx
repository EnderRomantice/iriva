'use client';
import {useLocale} from '../../components/locale-provider';
import type {ReactNode} from 'react';
import {Bell,BookOpen,CalendarDays,Check,Home,MessageCircle} from 'lucide-react';
import WorkspaceSidebar from '../../components/workspace/sidebar';
import Bluebird from './bluebird';

export type LearnSidebarState={title:string;subtitle:string;avatar:string|null;household:boolean;host:boolean;badge:number};

/** The learner sidebar shared by /learn, /about and their loading skeletons. */
export default function LearnSidebar({state,active,onSelect,teamAccess=false,identity,organizationId}:{state:LearnSidebarState;active:string;onSelect:(id:string)=>void;teamAccess?:boolean;identity?:ReactNode;organizationId?:string}){const {t:tr}=useLocale();
 return <WorkspaceSidebar organizationId={organizationId} kind="learn" identity={identity} identityId={state.household?'Household':undefined} avatar={state.avatar} title={state.title} subtitle={state.subtitle} active={active} onSelect={onSelect} teamAccess={teamAccess} sections={[
  {items:[{id:'Notifications',label:tr("通知"),icon:Bell,badge:state.badge}]},
  {label:tr("我的小组"),items:[{id:'Home',label:tr("我的家"),icon:Home},{id:'Conversations',label:tr("小组交流"),icon:MessageCircle},{id:'Schedule',label:tr("相见日程"),icon:CalendarDays}]},
  {label:tr("练习与成长"),items:[{id:'Partner practice',label:tr("伙伴练习"),icon:BookOpen},{id:'My coach',label:tr("AI 准备 · Beta"),icon:Bluebird},{id:'Reviews',label:state.host?tr("活动观察"):tr("活动复盘"),icon:Check}]}]}/>;
}
