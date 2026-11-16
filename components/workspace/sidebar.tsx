'use client';
import type { ComponentType, KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Leaf } from 'lucide-react';
import { avatarInitial } from '../../domain/initial';
export type NavSection={label:string;items:{id:string;label:string;icon:ComponentType<{size?:number}>}[]};
/** Up/Down (and Left/Right in the mobile row) move focus between nav items; Home/End jump to the ends. */
function moveFocus(e:KeyboardEvent<HTMLElement>){
 const keys:Record<string,number>={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};
 if(!(e.key in keys)&&e.key!=='Home'&&e.key!=='End')return;
 const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')],at=items.indexOf(document.activeElement as HTMLButtonElement);
 if(at<0)return;e.preventDefault();
 const next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+keys[e.key]+items.length)%items.length;
 items[next].focus();items[next].scrollIntoView({block:'nearest',inline:'nearest'});
}
export default function WorkspaceSidebar({kind,title,subtitle,sections,active,onSelect,teamAccess=false,avatar=null}:{kind:'learn'|'team';title:string;subtitle:string;sections:NavSection[];active:string;onSelect:(id:string)=>void;teamAccess?:boolean;avatar?:string|null}){
 return <aside className={`workspace-sidebar ${kind==='team'?'team-sidebar':'p-sidebar'}`}>
  <Link className="workspace-brand" href="/">iriva <span>青鸟</span></Link>
  {kind==='team'&&<div className="workspace-label"><span/>TEAM WORKSPACE</div>}
  <div className="workspace-identity"><span className={`workspace-mark${avatar?' has-image':''}`} aria-hidden="true">{avatar?<img src={avatar} alt="" width={36} height={36}/>:avatarInitial(title)}</span><div><b>{title}</b><small>{subtitle}</small></div></div>
  <nav aria-label={kind==='team'?'运营导航':'学习空间导航'} onKeyDown={moveFocus}>{sections.map(section=><div className="workspace-nav-group" key={section.label}><small>{section.label}</small>{section.items.map(({id,label,icon:Icon})=><button key={id} type="button" aria-current={active===id?'page':undefined} className={active===id?'active':''} onClick={()=>onSelect(id)}><Icon size={17}/><span>{label}</span></button>)}</div>)}</nav>
  <div className="workspace-sidebar-bottom"><Leaf size={21}/><p>让每一次相见，<br/>都有被记得的时刻。</p>{kind==='team'?<Link href="/learn">进入学习空间 <ArrowUpRight size={14}/></Link>:<><Link href="/about">关于我 · 个人信息 <ArrowUpRight size={14}/></Link><Link href="/feedback">给青鸟的建议 <ArrowUpRight size={14}/></Link>{teamAccess&&<Link href="/team">团队工作台 <ArrowUpRight size={14}/></Link>}</>}</div>
 </aside>;
}
