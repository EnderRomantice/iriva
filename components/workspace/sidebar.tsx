'use client';
import {useLocale} from '../locale-provider';
import type { KeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Bell, BookOpen, CalendarDays, Check, Home, MessageCircle, ClipboardList, Leaf, Users, MessageSquare, ListChecks, History } from 'lucide-react';
import { avatarInitial } from '../../domain/initial';
import {workspaceNavigation} from '../../domain/workspace-navigation';
import type {WorkspaceRole} from '../../domain/workspace-access';
import Bluebird from '../../app/app/bluebird';
const icons={bell:Bell,book:BookOpen,calendar:CalendarDays,check:Check,home:Home,messages:MessageCircle,clipboard:ClipboardList,leaf:Leaf,users:Users,feedback:MessageSquare,tasks:ListChecks,history:History,bird:Bluebird};
/** Up/Down (and Left/Right in the mobile row) move focus between nav items; Home/End jump to the ends. */
function moveFocus(e:KeyboardEvent<HTMLElement>){
 const keys:Record<string,number>={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};
 if(!(e.key in keys)&&e.key!=='Home'&&e.key!=='End')return;
 const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')],at=items.indexOf(document.activeElement as HTMLButtonElement);
 if(at<0)return;e.preventDefault();
 const next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+keys[e.key]+items.length)%items.length;
 items[next].focus();items[next].scrollIntoView({block:'nearest',inline:'nearest'});
}
export default function WorkspaceSidebar({role,title,subtitle,active,onSelect,avatar=null,identityId,identity,organizationId,badge=0,loading=false,beforeLeave}:{role:WorkspaceRole|null;title:string;subtitle:string;active:string;onSelect:(id:string)=>void;avatar?:string|null;identityId?:string;identity?:ReactNode;organizationId?:string;badge?:number;loading?:boolean;beforeLeave?:()=>boolean}){const {t:tr}=useLocale();
 const sections=workspaceNavigation(role);

 const mark=<span className={`workspace-mark${avatar?' has-image':''}`} aria-hidden="true">{avatar?<img src={avatar} alt="" width={36} height={36}/>:avatarInitial(title)}</span>,label=<div><b>{title}</b><small>{subtitle}</small></div>;
 return <aside className="workspace-sidebar" aria-busy={loading||undefined}>
  {loading?<div className="p-skeleton-side">{Array.from({length:7},(_,i)=><div key={i} className="sk sk-line"/>)}</div>:<>{identity??(identityId?<button type="button" className={`workspace-identity${active===identityId?' active':''}`} aria-current={active===identityId?'page':undefined} title={tr('{title} · 查看家庭详情',{title})} onClick={()=>onSelect(identityId)}>{mark}{label}<ChevronRight size={15} className="workspace-identity-chevron" aria-hidden="true"/></button>:<div className="workspace-identity">{mark}{label}</div>)}
  <nav aria-label={tr('工作空间导航')} onKeyDown={moveFocus}>{sections.map((section,i)=><div className={`workspace-nav-group${section.label?'':' is-standalone'}`} key={section.label||`top-${i}`}>{section.label&&<small>{tr(section.label)}</small>}{section.items.map(({id,label,icon})=>{const Icon=icons[icon],unread=id==='Notifications'?badge:0;return <button key={id} type="button" aria-current={active===id?'page':undefined} className={active===id?'active':''} onClick={()=>onSelect(id)} aria-label={unread?tr('{label}，{count} 条未读',{label:tr(label),count:unread}):undefined}><Icon size={17}/><span>{tr(label)}</span>{!!unread&&<b className="workspace-nav-badge" aria-hidden="true">{unread>99?'99+':unread}</b>}</button>})}</div>)}</nav>
  <div className="workspace-sidebar-bottom"><Link onClick={e=>{if(beforeLeave&&!beforeLeave())e.preventDefault()}} href={'/about'+(organizationId?'?org='+encodeURIComponent(organizationId):'')} aria-current={active==='about'?'page':undefined}>{tr("个人信息")}<ArrowUpRight size={14}/></Link><Link href="/feedback" onClick={e=>{if(beforeLeave&&!beforeLeave())e.preventDefault()}}>{tr("给青鸟的建议")}<ArrowUpRight size={14}/></Link></div></>}
 </aside>;
}
