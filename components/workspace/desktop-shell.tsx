'use client';

import {useEffect,useRef,useState, type CSSProperties} from 'react';
import {Bell,BookOpen,CalendarDays,Check,Home,MessageCircle,ClipboardList,Leaf,Users,MessageSquare,ListChecks,History,LayoutGrid,Search,RefreshCw,Sparkles} from 'lucide-react';
import {LocaleSwitcher,useLocale} from '../locale-provider';
import {workspaceNavigation,workspaceDesktopNavigation} from '../../domain/workspace-navigation';
import {isTeamRole} from '../../domain/workspace-access';
import AccountMenu from './account-menu';
import SpotlightCard from '../react-bits/SpotlightCard';
import Dock from '../react-bits/Dock';
import type {WorkspaceShellProps} from './shell';
import './desktop.css';

const icons={bell:Bell,book:BookOpen,calendar:CalendarDays,check:Check,home:Home,messages:MessageCircle,clipboard:ClipboardList,leaf:Leaf,users:Users,feedback:MessageSquare,tasks:ListChecks,history:History,bird:Sparkles};
const descriptions:Record<string,[string,string]>={
 Home:['看看伙伴，准备下一次相见','Meet your people. Get ready for what’s next.'],
 Conversations:['让对话在相见之外继续','Keep the conversation going.'],
 Schedule:['每一次相见，都安排在这里','Make time for your next conversation.'],
 'Partner practice':['找一位伙伴，一起开口','A little practice, together.'],
 'My coach':['带上想法，自信地开始','Find your words before you begin.'],
 Reviews:['留住收获，也看见成长','Reflect on the moments that matter.'],
 Notifications:['不错过与你有关的消息','Updates that matter to you.'],
 '活动复盘':['看见每场活动的收获与下一步','Turn each session into a next step.'],
 Households:['每一个小组，都在好好相见','Keep every household connected.'],
 '申请与筛选':['从认识一个新伙伴开始','Get to know your next members.'],
 '组一个家':['让合适的人，在这里遇见','Bring the right people together.'],
 'Host 管理':['陪伴每一位对话的引导者','Support the people leading the way.'],
 '青鸟建议':['听见反馈，让青鸟更好一点','Listen, learn, and make things better.'],
 '运营待办':['把接下来要做的事，理清楚','A clear place for your next steps.'],
 '操作日志':['每一步协作，都有迹可循','A shared record of what changed.'],
};

const dockGlassStyle = {
 '--dock-panel':'rgba(249, 253, 248, 0.38)',
 '--dock-panel-edge':'rgba(70, 95, 75, 0.09)',
 '--dock-panel-highlight':'rgba(255, 255, 255, 0.65)',
 '--dock-panel-shadow':'0 16px 36px -22px rgba(35, 60, 42, 0.22), 0 4px 12px -8px rgba(35, 60, 42, 0.12)',
 '--dock-tile':'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(246,250,245,0.48))',
 '--dock-tile-shadow':'0 4px 10px -6px rgba(35,60,42,0.2)',
} as CSSProperties;

export default function DesktopShell({role,className='portal',sidebar,active,onSelect,account,actions,onRefresh,beforeLeave,contentClassName='',contentKey,children,startOnDesktop=true,onDesktopChange}:WorkspaceShellProps){
 const {locale,t}=useLocale();
 const copy=(zh:string,en:string)=>locale==='en'?en:zh;
 const [desktop,setDesktop]=useState(startOnDesktop),[query,setQuery]=useState(''),[compact,setCompact]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(max-width:760px)');const sync=()=>setCompact(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 useEffect(()=>{onDesktopChange?.(desktop);},[desktop,onDesktopChange]);
 const previousActive=useRef(active),contentRef=useRef<HTMLElement>(null),dockRef=useRef<HTMLElement>(null);
 const items=workspaceDesktopNavigation(role);
 // Business modules also navigate internally (e.g. a notification opens a session).
 useEffect(()=>{if(previousActive.current!==active){previousActive.current=active;setDesktop(false);}},[active]);
 useEffect(()=>{if(!desktop)contentRef.current?.focus({preventScroll:true});},[desktop,active]);
 function launch(id:string){onSelect(id);setDesktop(false);window.scrollTo({top:0});}
 function goHome(){setDesktop(true);setQuery('');window.scrollTo({top:0});dockRef.current?.querySelector<HTMLButtonElement>('button')?.focus();}
 const filtered=items.filter(item=>`${t(item.label)} ${descriptions[item.id]?.join(' ')||''}`.toLowerCase().includes(query.trim().toLowerCase()));
 const featured=items.find(item=>item.id===(role&&isTeamRole(role)?'活动复盘':'Home'))?.id||items[0]?.id;
 const ordered=[...filtered].sort((a,b)=>a.id===featured?-1:b.id===featured?1:0);
 const dockItems=items.filter(item=>item.id!=='Notifications');
 const quickItems=compact?dockItems.filter((item,index)=>index<3||(!desktop&&item.id===active)):dockItems;
 const currentLabel=t(workspaceNavigation(role).flatMap(section=>section.items).find(item=>item.id===active)?.label||active);
 return <div className={`workspace-ui workspace-shell desktop-shell ${className}${desktop?' is-desktop-home':''}`}>
  <header className="workspace-header p-top desktop-menubar">
   <div className="desktop-brand"><strong>iriva</strong></div>
   <div className="desktop-space" onClick={event=>{if((event.target as HTMLElement).closest('[role="menuitem"]'))setDesktop(false);}}>{sidebar.identity??<button type="button" onClick={()=>sidebar.identityId&&launch(sidebar.identityId)} disabled={!sidebar.identityId}>{sidebar.title}</button>}</div>
   <div className="workspace-toolbar"><LocaleSwitcher>{actions&&<span className="desktop-actions" onClick={()=>setDesktop(false)}>{actions}</span>}{onRefresh&&<button type="button" aria-label={t('刷新')} onClick={onRefresh}><RefreshCw size={16}/></button>}{account&&<AccountMenu {...account} beforeLeave={beforeLeave}/>}</LocaleSwitcher></div>
  </header>
  {desktop&&<main className="desktop-home">
   <section className="desktop-heading"><div><h1>{account?.name?copy(`${account.name}，欢迎回来。`,`Welcome back, ${account.name}.`):copy('欢迎回到你的空间。','Welcome to your space.')}</h1><p>{copy('从这里，开始今天的相见与成长。','Your conversations, people, and possibilities. All here.')}</p></div><div className="desktop-greeting-art" aria-hidden="true"><Leaf/><span/></div></section>
   <div className="desktop-section-head"><h2>{copy('你的工作空间','Your workspace')}<span>{items.length} {copy('个应用','apps')}</span></h2><label className="desktop-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={copy('查找应用','Find an app')} aria-label={copy('查找应用','Find an app')}/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label={copy('清空搜索','Clear search')}>×</button>}</label></div>
   <div className={`desktop-grid${items.length<=4?' desktop-grid-small':''}`}>{ordered.map((item,index)=>{const Icon=icons[item.icon],hero=item.id===featured;return <SpotlightCard key={item.id} theme="light" spotlightColor={hero?'#b6f6cb':'#98c8bd'} intensity={.35} borderGlow={.3} flare={false} proximity={0} className={`desktop-tile tile-${item.icon}${hero?' desktop-tile-featured':''}`} style={{'--tile-index':index} as CSSProperties}>
    <button type="button" className="desktop-tile-button" onClick={()=>launch(item.id)}><span className="desktop-tile-top"><span className="desktop-app-icon"><Icon size={26} strokeWidth={1.65}/></span>{item.id==='Notifications'&&!!sidebar.badge?<span className="desktop-unread">{sidebar.badge>99?'99+':sidebar.badge} {copy('条未读','unread')}</span>:hero?<span className="desktop-tile-tag">{copy('从这里开始','Start here')}</span>:null}</span><span className="desktop-tile-copy"><strong>{t(item.label)}</strong><span>{descriptions[item.id]?.[locale==='en'?1:0]}</span></span>{hero&&<span className="desktop-tile-art" aria-hidden="true"><span><MessageCircle size={32}/></span><span><Leaf size={38}/></span><span><Users size={29}/></span></span>}</button>
   </SpotlightCard>})}</div>
   {!filtered.length&&<div className="desktop-empty" role="status"><Search size={28}/><p>{copy('没有找到这个应用，换个词试试。','No apps found. Try another word.')}</p><button type="button" onClick={()=>setQuery('')}>{copy('查看全部应用','Show all apps')}</button></div>}
  </main>}
  {/* Keep the active module mounted on the desktop so editors and drafts survive. */}
  <section ref={contentRef} tabIndex={-1} aria-label={currentLabel} hidden={desktop} className="desktop-content">

   <main className={`workspace-content ${contentClassName}`} key={contentKey}>{children}</main>
  </section>
  <nav ref={dockRef} className="desktop-dock-wrap" aria-label={copy('快捷应用','Quick launch')}><Dock theme="light" style={dockGlassStyle} className="desktop-dock" baseItemSize={44} magnification={54} distance={130} gap={8} bounce={false} showLabels showIndicators items={[{icon:<LayoutGrid size={22}/>,label:copy('桌面','Desktop'),active:desktop,onClick:goHome},...quickItems.map(item=>{const Icon=icons[item.icon];return {icon:<Icon size={21}/>,label:t(item.label),active:!desktop&&active===item.id,onClick:()=>launch(item.id)};})]}/></nav>
 </div>;
}
