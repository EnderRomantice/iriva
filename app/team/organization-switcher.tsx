'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {Check,ChevronsUpDown,Settings} from 'lucide-react';
import Avatar from '../../components/workspace/avatar';
import {useLocale} from '../../components/locale-provider';
import type {WorkspaceOrganization} from '../../domain/workspace-access';
import './organization-switcher.css';

export default function OrganizationSwitcher({current,organizations,busy,onSwitch,onSettings,settingsAvailable=true}:{current?:WorkspaceOrganization;organizations:WorkspaceOrganization[];busy:boolean;onSwitch:(id:string)=>Promise<void>;onSettings:()=>void;settingsAvailable?:boolean}) {
 const {t}=useLocale();
 const [state,setState]=useState<'closed'|'open'|'closing'>('closed');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const id=useId(),open=state==='open';
 const role=(value:string)=>t(value==='owner'?'组织所有者':value==='admin'?'管理员':value==='host'?'Host':'协作成员');
 function close(restoreFocus=false){setState('closing');if(restoreFocus)trigger.current?.focus();}
 useEffect(()=>{
  if(state!=='closing')return;
  const duration=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur'))||150;
  const timer=setTimeout(()=>setState('closed'),duration);return()=>clearTimeout(timer);
 },[state]);
 useEffect(()=>{
  if(!open)return;
  menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setState('closing');};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 function keyboard(e:KeyboardEvent){
  if(e.key==='Escape'){e.preventDefault();close(true);return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();
  const items=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"], [role="menuitem"]')||[]);
  if(!items.length)return;
  const index=items.indexOf(document.activeElement as HTMLButtonElement);
  items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
 }
 return <div className="team-organization" ref={root} onBlur={e=>{if(open&&!e.currentTarget.contains(e.relatedTarget))close();}}>
  <button ref={trigger} className="team-organization-trigger" type="button" disabled={!current||busy} aria-label={t('组织切换与设置')} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={()=>open?close():setState('open')} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setState('open');}}}>
   <Avatar className="workspace-mark" name={current?.name||''} src={current?.avatar}/><span className="team-organization-name"><b>{current?.name||t('加载组织…')}</b><small>{current?role(current.role):t('当前组织')}</small></span><ChevronsUpDown size={15} aria-hidden="true"/>
  </button>
  <div ref={menu} id={id} role="menu" aria-label={t('组织切换与设置')} aria-hidden={!open} inert={!open} className={`team-organization-menu t-dropdown${open?' is-open':state==='closing'?' is-closing':''}`} data-origin="top-left" onKeyDown={keyboard}>
   <p>{t('切换组织')}</p>
   {organizations.map(option=>{const org=option.id===current?.id?current:option;return <button key={org.id} type="button" role="menuitemradio" aria-checked={org.id===current?.id} disabled={busy} onClick={()=>{close(true);if(org.id!==current?.id)void onSwitch(org.id);}}><Avatar className="workspace-mark" name={org.name} src={org.avatar}/><span className="team-organization-name"><b>{org.name}</b><small>{role(org.role)}</small></span>{org.id===current?.id&&<Check size={16} aria-hidden="true"/>}</button>})}
   {current&&settingsAvailable&&(current.role==='owner'||current.role==='admin'||current.role==='host')&&<>
    <div className="team-organization-divider" role="separator"/>
    <button type="button" role="menuitem" className="team-organization-settings" disabled={busy} onClick={()=>{close(true);onSettings();}}><Settings size={16} aria-hidden="true"/><span>{t(current.role==='host'?'小组设置':'组织设置')}</span></button>
   </>}
  </div>
 </div>;
}
