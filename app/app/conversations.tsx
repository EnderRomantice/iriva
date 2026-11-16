'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, Bold, Code, Hash, Italic, Leaf, Link2, List, LockKeyhole, MessageSquare, Search, SmilePlus, Smile, Strikethrough, Users, X } from 'lucide-react';
import { beijingTime, timezoneLabel } from '../../lib/timezones';
import { canonicalEmoji, toggleReaction, type MessageReaction } from '../../domain/household-reactions';
import EmojiPicker from '../../components/chat/emoji-picker';
import MessageMarkdown from '../../components/chat/markdown';
import { emojiInfo, frequentEmoji, preloadEmoji, rememberEmoji } from '../../components/chat/emoji-data';
import Avatar from '../../components/workspace/avatar';
import './conversations.css';

export type GroupMessage={id:string;author:string;name:string;body:string;created:string;reactions?:MessageReaction[]};
type Person={user:string;name:string;role:string;timezone:string;avatar?:string|null};
type Props={household:{id:string;name:string;topic:string;week:number};user:{id?:string;name:string};people:Person[];messages:GroupMessage[];onSent:()=>void};
type Picker={kind:'compose'}|{kind:'react';message:string;anchor:HTMLElement};
const LIMIT=2000;
const day=(date:string)=>beijingTime(date,{year:'numeric',month:'long',day:'numeric'});
const clock=(date:string)=>beijingTime(date,{hour:'2-digit',minute:'2-digit'});

/** "你、Alex 和 Sophie" — Slack-style list of who reacted. */
function whoReacted(users:string[],me:string|undefined,names:Map<string,string>){
 const list=[...users].sort((a,b)=>a===me?-1:b===me?1:0).map(u=>u===me?'你':names.get(u)||'一位成员');
 if(list.length>6)return `${list.slice(0,5).join('、')} 等 ${list.length} 人`;
 return list.length<2?list[0]:`${list.slice(0,-1).join('、')}和${list.at(-1)}`;
}
const label=(emoji:string)=>{const info=emojiInfo(emoji);return info?.codes[0]?`:${info.codes[0]}:`:info?.zh||emoji;};

type RowProps={m:GroupMessage;compact:boolean;newDay:boolean;host:boolean;tone:number;avatar?:string|null;search:string;me?:string;names:Map<string,string>;reactions:MessageReaction[];quick:string[];picking:boolean;touched:boolean;onToggle:(m:string,emoji:string)=>void;onPick:(m:string,anchor:HTMLElement)=>void;onTouch:(m:string)=>void};

/** One message: Markdown body, hover action bar, reaction pills. */
const MessageRow=memo(function MessageRow({m,compact,newDay,host,tone,avatar,search,me,names,reactions,quick,picking,touched,onToggle,onPick,onTouch}:RowProps){
 const touch=(e:MouseEvent)=>{if(window.matchMedia('(hover: none)').matches&&!(e.target as HTMLElement).closest('a,button'))onTouch(m.id);};
 return <div>
  {newDay&&<div className="chat-date"><span>{day(m.created)}</span></div>}
  <article className={`chat-message${compact?' continued':''}${picking?' is-picking':''}${touched?' is-touched':''}`} onClick={touch}>
   {compact?<div className="chat-message-avatar" aria-hidden="true"><small>{clock(m.created)}</small></div>:<Avatar name={m.name} src={avatar} className={`chat-message-avatar chat-tone-${tone}`} size={35}/>}
   <div className="chat-message-content">
    {!compact&&<div className="chat-message-meta"><b>{m.name}</b>{host&&<em>Host</em>}<time dateTime={m.created} title={`${day(m.created)} · 北京时间`}>{clock(m.created)}</time></div>}
    <MessageMarkdown text={m.body} highlight={search}/>
    {reactions.length>0&&<div className="chat-reactions">
     {reactions.map(r=>{const on=!!me&&r.users.includes(me),who=whoReacted(r.users,me,names);return <button type="button" key={r.emoji} className={`chat-reaction${on?' is-mine':''}`} aria-pressed={on} aria-label={`${r.emoji} ${r.users.length}，${who} 回应了。${on?'点击取消你的回应':'点击一起回应'}`} onClick={()=>onToggle(m.id,r.emoji)}>
      <span className="chat-reaction-emoji">{r.emoji}</span><span className="chat-reaction-count">{r.users.length}</span>
      <span className="chat-tip" role="tooltip"><span className="chat-tip-emoji">{r.emoji}</span><span>{who} 回应了 <b>{label(r.emoji)}</b></span></span>
     </button>;})}
     <button type="button" className="chat-reaction chat-reaction-add" aria-label="添加表情回应" title="添加表情回应" onClick={e=>onPick(m.id,e.currentTarget)}><SmilePlus size={15}/></button>
    </div>}
   </div>
   <div className="chat-actions" role="toolbar" aria-label="消息操作">
    {quick.map(emoji=><button type="button" key={emoji} aria-label={`用 ${emoji} 回应`} title={`用 ${label(emoji)} 回应`} onClick={()=>onToggle(m.id,emoji)}>{emoji}</button>)}
    <span aria-hidden="true"/>
    <button type="button" aria-label="添加表情回应" title="添加表情回应" aria-expanded={picking} onClick={e=>onPick(m.id,e.currentTarget)}><SmilePlus size={17}/></button>
   </div>
  </article>
 </div>;
});

export default function Conversations({household,user,people,messages,onSent}:Props){
 const storageKey=`iriva:group-draft:v1:${user.id}:${household.id}`;
 const [draft,setDraft]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[storageError,setStorageError]=useState(false),[query,setQuery]=useState(''),[membersOpen,setMembersOpen]=useState(false),[fresh,setFresh]=useState(false),[delivered,setDelivered]=useState<GroupMessage[]>([]);
 const [picker,setPicker]=useState<Picker|null>(null),[local,setLocal]=useState<Record<string,MessageReaction[]>>({}),[touched,setTouched]=useState(''),[recentVersion,setRecentVersion]=useState(0),[reactError,setReactError]=useState('');
 const input=useRef<HTMLTextAreaElement>(null),emojiButton=useRef<HTMLButtonElement>(null),scroller=useRef<HTMLDivElement>(null),nearBottom=useRef(true),first=useRef(true),sending=useRef(false),composing=useRef(false),request=useRef<{id:string;body:string}|null>(null),pending=useRef<Record<string,number>>({});
 const merged=useMemo(()=>[...messages,...delivered.filter(m=>!messages.some(item=>item.id===m.id))].sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id)).slice(-100),[messages,delivered]);
 const search=query.trim(),shown=search?merged.filter(m=>`${m.name} ${m.body}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())):merged;
 const names=useMemo(()=>new Map(people.map(p=>[p.user,p.name])),[people]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 const quick=useMemo(()=>frequentEmoji(3),[recentVersion]);
 const reactionsOf=useCallback((m:GroupMessage)=>local[m.id]??m.reactions??[],[local]);

 useEffect(()=>{preloadEmoji();},[]);
 useEffect(()=>{try{const raw=sessionStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw);if(typeof saved.body==='string'&&saved.body.length<=LIMIT){setDraft(saved.body);if(typeof saved.id==='string')request.current={id:saved.id,body:saved.body};}}}catch{setStorageError(true);}setReady(true);},[storageKey]);
 useEffect(()=>{if(!ready)return;try{if(draft)sessionStorage.setItem(storageKey,JSON.stringify({body:draft,id:request.current?.body===draft?request.current.id:undefined}));else sessionStorage.removeItem(storageKey);}catch{setStorageError(true);}},[draft,ready,storageKey]);
 // Fresh server data wins, except for messages whose reaction request is still in flight.
 useEffect(()=>{setLocal(l=>Object.fromEntries(Object.entries(l).filter(([id])=>(pending.current[id]||0)>0)));},[messages]);
 const latest=merged.at(-1)?.id;
 useEffect(()=>{if(search)return;const el=scroller.current;if(!el)return;if(first.current||nearBottom.current){el.scrollTop=el.scrollHeight;first.current=false;setFresh(false);}else setFresh(true);},[latest,search]);
 useEffect(()=>{const el=scroller.current;if(!el)return;const observer=new ResizeObserver(()=>{if(nearBottom.current&&!search)el.scrollTop=el.scrollHeight;});observer.observe(el);return()=>observer.disconnect();},[search]);
 useEffect(()=>{if(input.current){input.current.style.height='auto';input.current.style.height=`${Math.min(220,Math.max(44,input.current.scrollHeight))}px`;}},[draft]);
 useEffect(()=>{if(!reactError)return;const t=setTimeout(()=>setReactError(''),4000);return()=>clearTimeout(t);},[reactError]);

 async function send(e?:FormEvent){
  e?.preventDefault();if(sending.current||!draft.trim()||!ready)return;
  const body=draft.trim();if(request.current?.body!==body)request.current={id:crypto.randomUUID(),body};const attempt=request.current;
  sending.current=true;setBusy(true);setError('');
  try{try{sessionStorage.setItem(storageKey,JSON.stringify(attempt));}catch{setStorageError(true);}
   const r=await fetch('/api/household',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'message',body:attempt.body,id:attempt.id})}),result=await r.json();
   if(!r.ok)throw new Error(result.error||'发送失败，请重试。');
   setDelivered(items=>[...items.filter(m=>m.id!==result.message.id),result.message].slice(-100));setDraft('');request.current=null;nearBottom.current=true;setPicker(null);onSent();
  }catch(e){setError(e instanceof TypeError?'网络连接暂时中断，可以重试发送。':(e as Error).message||'发送失败，请稍后重试。');}finally{sending.current=false;setBusy(false);input.current?.focus();}
 }

 const toggle=useCallback(async(messageId:string,picked:string)=>{
  if(!user.id)return;const emoji=canonicalEmoji(picked);
  const message=merged.find(m=>m.id===messageId);if(!message)return;
  const before=reactionsOf(message),on=!before.find(r=>r.emoji===emoji)?.users.includes(user.id);
  if(on){rememberEmoji(emoji);setRecentVersion(v=>v+1);}
  setLocal(l=>({...l,[messageId]:toggleReaction(before,emoji,user.id!,on)}));setPicker(null);setTouched('');
  pending.current[messageId]=(pending.current[messageId]||0)+1;
  try{const r=await fetch('/api/household',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'react',message:messageId,emoji,on})}),d=await r.json();
   if(!r.ok)throw new Error(d.error||'回应没有成功，请重试。');
   if(pending.current[messageId]===1)setLocal(l=>({...l,[messageId]:d.reactions}));
  }catch(e){setLocal(l=>({...l,[messageId]:before}));setReactError(e instanceof TypeError?'网络连接暂时中断，回应没有保存。':(e as Error).message);}
  finally{pending.current[messageId]-=1;}
 },[merged,reactionsOf,user.id]);
 const pickFor=useCallback((message:string,anchor:HTMLElement)=>setPicker(p=>p?.kind==='react'&&p.message===message?null:{kind:'react',message,anchor}),[]);
 const touch=useCallback((message:string)=>setTouched(t=>t===message?'':message),[]);

 /** Replace the current selection, keeping focus and a sensible caret. */
 function replaceSelection(make:(selected:string)=>{text:string;select?:[number,number]}){
  const el=input.current;if(!el||busy)return;
  const start=el.selectionStart,end=el.selectionEnd,{text,select}=make(draft.slice(start,end));
  const next=draft.slice(0,start)+text+draft.slice(end);if(next.length>LIMIT)return;
  setDraft(next);
  requestAnimationFrame(()=>{el.focus();const [a,b]=select?[start+select[0],start+select[1]]:[start+text.length,start+text.length];el.setSelectionRange(a,b);});
 }
 const wrap=(marker:string,placeholder:string)=>replaceSelection(s=>{const body=s||placeholder;return {text:`${marker}${body}${marker}`,select:[marker.length,marker.length+body.length]};});
 const link=()=>replaceSelection(s=>{const textPart=s||'链接文字',url='https://';return {text:`[${textPart}](${url})`,select:[textPart.length+3,textPart.length+3+url.length]};});
 const list=()=>replaceSelection(s=>{const body=(s||'列表项').split('\n').map(line=>line.startsWith('- ')?line:`- ${line}`).join('\n');return {text:body,select:[0,body.length]};});
 function insertEmoji(emoji:string){replaceSelection(()=>({text:emoji}));setPicker(null);}
 function keys(e:ReactKeyboardEvent<HTMLTextAreaElement>){
  const mod=e.metaKey||e.ctrlKey,k=e.key.toLowerCase();
  if(mod&&!e.shiftKey&&k==='b'){e.preventDefault();wrap('**','粗体');return;}
  if(mod&&!e.shiftKey&&k==='i'){e.preventDefault();wrap('*','斜体');return;}
  if(mod&&e.shiftKey&&k==='x'){e.preventDefault();wrap('~~','删除线');return;}
  if(mod&&e.shiftKey&&k==='c'){e.preventDefault();wrap('`','代码');return;}
  if(mod&&e.shiftKey&&k==='u'){e.preventDefault();link();return;}
  if(e.key==='Enter'&&!e.shiftKey&&!composing.current&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();void send();}
 }
 function bottom(){const el=scroller.current;if(el)el.scrollTop=el.scrollHeight;nearBottom.current=true;setFresh(false);}
 const remaining=LIMIT-draft.length,canSend=ready&&!busy&&!!draft.trim();
 const tools:[string,string,typeof Bold,()=>void][]=[['粗体','⌘B',Bold,()=>wrap('**','粗体')],['斜体','⌘I',Italic,()=>wrap('*','斜体')],['删除线','⌘⇧X',Strikethrough,()=>wrap('~~','删除线')],['代码','⌘⇧C',Code,()=>wrap('`','代码')],['链接','⌘⇧U',Link2,link],['列表','',List,list]];

 return <section className={`group-chat${membersOpen?' has-members':''}`} aria-label="小组交流">
  <div className="chat-main"><div className="chat-heading"><div><h1><Hash size={20}/>小组客厅</h1><p>{household.name} · 第 {household.week} 周<span className="chat-private"><LockKeyhole size={11}/> 仅本组成员可见</span></p></div><div className="chat-heading-tools"><label className="chat-search"><Search size={15}/><input type="search" aria-label="搜索小组消息" placeholder="搜索最近 100 条消息" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="chat-members-toggle" aria-expanded={membersOpen} aria-controls="chat-member-panel" onClick={()=>setMembersOpen(v=>!v)}><span className="chat-mini-avatars">{people.slice(0,3).map((p,i)=><Avatar key={p.user} name={p.name} src={p.avatar} className={`chat-tone-${i%4}`} size={24}/>)}</span><Users size={15}/><span>{people.length}</span><span className="p-sr">小组成员</span></button></div></div>
   <div className="chat-message-region"><div className="chat-stream" ref={scroller} role="log" aria-label="小组消息" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=scroller.current;if(el){nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;if(nearBottom.current)setFresh(false);}if(picker?.kind==='react')setPicker(null);}}>
    {!search&&<div className="chat-channel-intro"><span><Hash size={28}/></span><h2>欢迎来到小组客厅</h2><p>分享一件小事，接着上次的话题，或留一个下次想问的问题。</p><div><Leaf size={14}/><b>本周话题</b><span>{household.topic}</span></div></div>}
    {search&&<p className="chat-search-result">找到 {shown.length} 条消息 · 仅搜索已加载的最近 100 条</p>}
    {search&&!shown.length&&<div className="chat-empty"><MessageSquare size={24}/><h3>还没有找到这条消息</h3><p>换个词试试，或清除搜索回到对话。</p><button onClick={()=>setQuery('')}>清除搜索</button></div>}
    {shown.map((m,i)=>{const previous=shown[i-1],newDay=!previous||day(previous.created)!==day(m.created),compact=!search&&!newDay&&previous.author===m.author&&Date.parse(m.created)-Date.parse(previous.created)<300000,person=people.find(p=>p.user===m.author);
     return <MessageRow key={m.id} m={m} compact={compact} newDay={newDay} host={person?.role==='host'} avatar={person?.avatar} tone={Math.max(0,people.findIndex(p=>p.user===m.author))%4} search={search} me={user.id} names={names} reactions={reactionsOf(m)} quick={quick} picking={picker?.kind==='react'&&picker.message===m.id} touched={touched===m.id} onToggle={toggle} onPick={pickFor} onTouch={touch}/>;})}
   </div>
   {fresh&&!search&&<button className="chat-new-messages" onClick={bottom}><ArrowDown size={14}/> 有新消息 · 回到底部</button>}
   {reactError&&<p className="chat-toast" role="alert">{reactError}</p>}
   </div>
   <form className="chat-compose" onSubmit={send}>
    <div className={`chat-editor${busy?' is-busy':''}`} onClick={e=>{if(e.target===e.currentTarget)input.current?.focus();}}>
     <label className="p-sr" htmlFor="household-message">发消息到小组客厅</label>
     <textarea id="household-message" ref={input} readOnly={busy||!ready} value={draft} maxLength={LIMIT} rows={1} placeholder="发消息到 #小组客厅" onChange={e=>setDraft(e.target.value)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={keys}/>
     {(error||storageError)&&<p className="chat-editor-note" role="alert">{error?`${error} 文字已保留，可以再次发送。`:'本次无法暂存草稿，请保持页面打开。'}</p>}
     <div className="chat-compose-tools">
      <div className="chat-format" role="toolbar" aria-label="文本格式">
       {tools.map(([name,shortcut,Icon,run])=><button type="button" key={name} aria-label={name} title={shortcut?`${name}（${shortcut}）`:name} onMouseDown={e=>e.preventDefault()} onClick={run}><Icon size={15}/></button>)}
       <span aria-hidden="true"/>
       <button type="button" ref={emojiButton} aria-label="插入表情" title="插入表情" aria-expanded={picker?.kind==='compose'} onMouseDown={e=>e.preventDefault()} onClick={()=>setPicker(p=>p?.kind==='compose'?null:{kind:'compose'})}><Smile size={16}/></button>
      </div>
      <div className="chat-send-group">
       {remaining<=200&&<span className={`chat-count${remaining<0?' is-over':''}`}>{remaining}</span>}
       {draft&&<span className="chat-hint"><kbd>Shift</kbd>+<kbd>Enter</kbd> 换行</span>}
       <button className="chat-send" type="submit" disabled={!canSend} aria-label={error?'重试发送消息':'发送消息'} title="发送（Enter）"><ArrowUp size={16} strokeWidth={2.4}/></button>
      </div>
     </div>
    </div>
   </form>
  </div>
  {picker?.kind==='compose'&&<EmojiPicker anchor={emojiButton.current} label="插入表情" onSelect={insertEmoji} onClose={()=>setPicker(null)}/>}
  {picker?.kind==='react'&&<EmojiPicker anchor={picker.anchor} align="end" label="添加表情回应" onSelect={emoji=>void toggle(picker.message,emoji)} onClose={()=>setPicker(null)}/>}
  {membersOpen&&<aside id="chat-member-panel" className="chat-members"><div className="chat-member-heading"><h2>小组成员 <span>{people.length}</span></h2><button aria-label="关闭成员列表" onClick={()=>setMembersOpen(false)}><X size={18}/></button></div><p>在这里认识彼此，把交流留在小组里。</p>{people.map((p,i)=><div className="chat-person" key={p.user}><Avatar name={p.name} src={p.avatar} className={`chat-person-avatar chat-tone-${i%4}`} size={34}/><div><b>{p.name}{p.user===user.id?'（你）':''}</b><small>{p.role==='host'?'Host':'学习伙伴'} · {p.timezone?timezoneLabel(p.timezone):'时区待确认'}</small></div></div>)}<div className="chat-member-note"><LockKeyhole size={16}/><p>本页不展示私人联系方式。安排与反馈通过平台处理。</p></div></aside>}
 </section>;
}
