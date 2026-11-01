"use client";
import { useState } from 'react';
import { accountRequest, type Account, type Booking } from './account-client';
import { Avatar, Empty } from './primitives';
import type { Snapshot } from '@/domain/models';

export const bookingLabels = { pending:'待约谈', accepted:'已确定加入 · 等待运营', rejected:'已拒绝' };
export function Bookings({account,data,query,onRefresh,contact}:{account:Account;data:Snapshot;query:string;onRefresh:()=>Promise<void>;contact:(booking:Booking)=>void}) {
  const [filter,setFilter]=useState('all'),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
  const rows=account.bookings.filter(b => (filter==='all'||b.status===filter) && `${b.learner_name} ${b.host_name}`.toLowerCase().includes(query.toLowerCase()));
  async function update(booking:Booking,status:'accepted'|'rejected') {
    if(busy)return; setBusy(booking.id);setMessage('');setError('');
    try{await accountRequest({action:'booking',id:booking.id,status});await onRefresh();setMessage('约谈结论已保存。');}
    catch(e){setError(e instanceof Error?e.message:'操作失败，请重试。');}finally{setBusy('');}
  }
  return <section className="sp-page-section sp-bookings-page" aria-label="报名约谈管理">
    <div className="sp-section-head"><h2>约谈</h2><span className="sp-caption">{account.bookings.length} 条记录</span></div>
    <p className="sp-caption">{account.role==='host'?'记录学生的约谈结论，入组由运营安排。':'跟进 Host 约谈结论，确认后在报名详情中安排入组。'}</p>
    <div className="sp-filters sp-filters-space" aria-label="约谈状态筛选">{[{value:'all',label:'全部'},...Object.entries(bookingLabels).map(([value,label])=>({value,label}))].map(item=><button key={item.value} aria-pressed={filter===item.value} onClick={()=>setFilter(item.value)}>{item.label}</button>)}</div>
    {message&&<p className="sp-notice" role="status">{message}</p>}{error&&<p className="sp-error" role="alert">{error}</p>}
    <div className="sp-list">{rows.map(b=><article className="sp-booking" key={b.id}><Avatar user={data.users.find(u=>u.id===b.learner_id)}/><div className="sp-booking-person"><strong>{b.learner_name}</strong><small>Host：{b.host_name}</small></div><span className={`sp-booking-state is-${b.status}`}>{bookingLabels[b.status]}</span><div className="sp-booking-actions"><button onClick={()=>contact(b)}>联系学生</button>{account.role==='host'&&<><button disabled={!!busy||b.status==='accepted'} onClick={()=>void update(b,'accepted')}>{busy===b.id?'保存中…':'已确定加入'}</button><button disabled={!!busy||b.status==='rejected'} onClick={()=>void update(b,'rejected')}>拒绝</button></>}</div></article>)}{!rows.length&&<Empty>{query?'没有匹配的约谈。':'暂无此状态的约谈。'}</Empty>}</div>
  </section>;
}
