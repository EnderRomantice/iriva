'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,LogOut,UserRound,Home,Briefcase} from 'lucide-react';

/** 右上角头像：点击展开账户菜单（关于我 / 学习空间 / 退出登录）。 */
export default function AccountMenu({name,subtitle,teamAccess=false,current}:{name:string;subtitle?:string;teamAccess?:boolean;current?:'learn'|'about'}){
  const [open,setOpen]=useState(false),ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;
    const away=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false)};
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);ref.current?.querySelector<HTMLButtonElement>('button')?.focus()}};
    document.addEventListener('pointerdown',away);document.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',esc)}},[open]);
  const initial=(name||'Y').trim()[0]?.toUpperCase()||'Y';
  return <div className="p-account" ref={ref}>
    <button type="button" className="p-account-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={`账户菜单：${name||'我'}`} onClick={()=>setOpen(o=>!o)}>
      <span className="p-you">{initial}</span>
      <span className="p-account-name">{name||'Welcome'}{subtitle&&<small>{subtitle}</small>}</span>
      <ChevronDown size={15} className="p-account-chevron"/>
    </button>
    {open&&<div className="p-account-menu" role="menu">
      <div className="p-account-head"><span className="p-you">{initial}</span><div><b>{name||'Welcome'}</b>{subtitle&&<small>{subtitle}</small>}</div></div>
      {current!=='about'&&<Link role="menuitem" href="/about" onClick={()=>setOpen(false)}><UserRound size={16}/>关于我 · 个人信息</Link>}
      {current!=='learn'&&<Link role="menuitem" href="/learn" onClick={()=>setOpen(false)}><Home size={16}/>返回学习空间</Link>}
      {teamAccess&&<Link role="menuitem" href="/team" onClick={()=>setOpen(false)}><Briefcase size={16}/>运营工作台</Link>}
      <hr/>
      <a role="menuitem" href="/signout?return_to=%2F"><LogOut size={16}/>退出登录</a>
    </div>}
  </div>;
}
