"use client";
import { Applications, type ViewProps } from './views';
import { Bookings } from './Bookings';
import type { Account, Booking } from './account-client';

export function AdmissionsPage({account,tab,setTab,query,onRefresh,contact,...props}:ViewProps & {account:Account;tab?:'bookings';setTab:(tab?:'bookings')=>void;query:string;onRefresh:()=>Promise<void>;contact:(booking:Booking)=>void}) {
  const showBookings=props.role==='host'||tab==='bookings';
  return <div className="sp-admissions-page">
    {props.role==='ops'&&<nav className="sp-admissions-tabs" aria-label="报名管理内容"><button aria-current={!showBookings?'page':undefined} onClick={()=>setTab()}>报名与组班</button><button aria-current={showBookings?'page':undefined} onClick={()=>setTab('bookings')}>约谈 <span>{account.bookings.filter(b=>b.status==='pending').length}</span></button></nav>}
    {showBookings?<Bookings account={account} data={props.data} query={query} onRefresh={onRefresh} contact={contact}/>:<Applications {...props} query={query} bookings={account.bookings}/>}
  </div>;
}
