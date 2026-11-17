'use client';
import {useLocale} from '../locale-provider';
import type { ComponentType, KeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { avatarInitial } from '../../domain/initial';
/** A section without a label renders as standalone top-level rows (e.g. 通知). */
export type NavSection={label?:string;items:{id:string;label:string;icon:ComponentType<{size?:number}>;badge?:number}[]};
/** Up/Down (and Left/Right in the mobile row) move focus between nav items; Home/End jump to the ends. */
function moveFocus(e:KeyboardEvent<HTMLElement>){
 const keys:Record<string,number>={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};
 if(!(e.key in keys)&&e.key!=='Home'&&e.key!=='End')return;
 const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')],at=items.indexOf(document.activeElement as HTMLButtonElement);
 if(at<0)return;e.preventDefault();
 const next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+keys[e.key]+items.length)%items.length;
 items[next].focus();items[next].scrollIntoView({block:'nearest',inline:'nearest'});
}
export default function WorkspaceSidebar({kind,title,subtitle,sections,active,onSelect,teamAccess=false,avatar=null,identityId,identity}:{kind:'learn'|'team';title:string;subtitle:string;sections:NavSection[];active:string;onSelect:(id:string)=>void;teamAccess?:boolean;avatar?:string|null;identityId?:string;identity?:ReactNode}){const {t:tr,locale}=useLocale();
 const mark=<span className={`workspace-mark${avatar?' has-image':''}`} aria-hidden="true">{avatar?<img src={avatar} alt="" width={36} height={36}/>:avatarInitial(title)}</span>,label=<div><b>{title}</b><small>{subtitle}</small></div>;
 return <aside className={`workspace-sidebar ${kind==='team'?'team-sidebar':'p-sidebar'}`}>
  <Link className="workspace-brand" href={locale==='en'?'/en':'/'}>iriva <span>{tr("青鸟")}</span></Link>
  
  {identity??(identityId?<button type="button" className={`workspace-identity${active===identityId?' active':''}`} aria-current={active===identityId?'page':undefined} title={tr('{title} · 查看家庭详情',{title})} onClick={()=>onSelect(identityId)}>{mark}{label}<ChevronRight size={15} className="workspace-identity-chevron" aria-hidden="true"/></button>:<div className="workspace-identity">{mark}{label}</div>)}
  <nav aria-label={kind==='team'?tr('运营导航'):tr('学习空间导航')} onKeyDown={moveFocus}>{sections.map((section,i)=><div className={`workspace-nav-group${section.label?'':' is-standalone'}`} key={section.label||`top-${i}`}>{section.label&&<small>{section.label}</small>}{section.items.map(({id,label,icon:Icon,badge})=><button key={id} type="button" aria-current={active===id?'page':undefined} className={active===id?'active':''} onClick={()=>onSelect(id)} aria-label={badge?tr('{label}，{count} 条未读',{label,count:badge}):undefined}><Icon size={17}/><span>{label}</span>{!!badge&&<b className="workspace-nav-badge" aria-hidden="true">{badge>99?'99+':badge}</b>}</button>)}</div>)}</nav>
  <div className="workspace-sidebar-bottom">{kind==='team'?<Link href="/learn">{tr("进入学习空间")}<ArrowUpRight size={14}/></Link>:<><Link href="/about" aria-current={active==='about'?'page':undefined}>{tr("个人信息")}<ArrowUpRight size={14}/></Link><Link href="/feedback">{tr("给青鸟的建议")}<ArrowUpRight size={14}/></Link>{teamAccess&&<Link href="/team">{tr("团队工作台")}<ArrowUpRight size={14}/></Link>}</>}</div>
 </aside>;
}
