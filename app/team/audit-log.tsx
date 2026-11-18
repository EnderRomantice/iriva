'use client';
import {workspaceFetch as fetch} from '../../lib/workspace-fetch';
import {useLocale} from '../../components/locale-provider';
import {useEffect,useState} from 'react';
import {RefreshCw,Search,ChevronLeft,ChevronRight} from 'lucide-react';
type Entry={id:string;actor_name:string;actor_email:string;actor_id:string;action:string;target:string;result:'success'|'denied'|'failed';status:number;created_at:string;details:string};
type Data={items:Entry[];total:number;page:number;pageSize:number;asOf:string;actors:{actor_id:string;actor_name:string;actor_email:string}[];actions:string[]};
const labels:Record<string,string>={host:'添加 Host',review:'跟进申请',feedbackReview:'处理建议',pairLink:'更新会议链接',task:'创建待办',complete:'更新待办',staff:'更新成员权限',removeStaff:'移除成员',match:'组成小组','organization.switch':'切换组织','organization.enter':'进入组织','organization.create':'创建组织','organization.created':'组织已创建','organization.transfer':'转移所有权','household.create':'创建 Household','organization.list':'查看组织列表','auth.login':'密码登录','auth.logout':'退出登录','team.view':'查看运营数据','activity.view':'查看活动复盘','activity.card':'保存 / 发布回顾卡','audit.view':'查看操作日志'};
const empty={q:'',actor:'',action:'',result:'',from:'',to:'',order:'desc'};
export default function AuditLog(){const {t:tr,locale}=useLocale();
 const [draft,setDraft]=useState(empty),[filters,setFilters]=useState(empty),[page,setPage]=useState(0),[asOf,setAsOf]=useState(''),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[expanded,setExpanded]=useState<string|null>(null);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');const params=new URLSearchParams({...filters,page:String(page),...(asOf?{asOf}:{})});
 fetch('/api/team/audit?'+params,{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});return()=>controller.abort();
 },[filters,page,asOf,refresh]);
 const field=(key:keyof typeof empty,value:string)=>setDraft(v=>({...v,[key]:value}));
 function apply(){if(draft.from&&draft.to&&draft.from>draft.to){setError('开始日期不能晚于结束日期。');return;}setFilters({...draft});setPage(0);setAsOf('');setExpanded(null);}
 function turn(next:number){if(data){setAsOf(data.asOf);setPage(next);setExpanded(null);}}
 const pages=Math.max(1,Math.ceil((data?.total||0)/25));
 return <section className="audit-log">
  <form className="audit-filters" onSubmit={e=>{e.preventDefault();apply()}}>
   <label className="audit-search">{tr("搜索")}<input value={draft.q} maxLength={100} placeholder={tr("姓名、邮箱、对象或操作")} onChange={e=>field('q',e.target.value)}/></label>
   <label>{tr("操作者")}<select value={draft.actor} onChange={e=>field('actor',e.target.value)}><option value="">{tr("全部成员")}</option>{data?.actors.map(a=><option key={a.actor_id+a.actor_name} value={a.actor_id}>{a.actor_name} · {a.actor_email}</option>)}</select></label>
   <label>{tr("操作")}<select value={draft.action} onChange={e=>field('action',e.target.value)}><option value="">{tr("全部操作")}</option>{data?.actions.map(a=><option key={a} value={a}>{tr(labels[a]||a)}</option>)}</select></label>
   <label>{tr("结果")}<select value={draft.result} onChange={e=>field('result',e.target.value)}><option value="">{tr("全部结果")}</option><option value="success">{tr("成功")}</option><option value="denied">{tr("被拒绝")}</option><option value="failed">{tr("失败")}</option></select></label>
   <label>{tr("开始日期")}<input type="date" value={draft.from} onChange={e=>field('from',e.target.value)}/></label><label>{tr("结束日期")}<input type="date" value={draft.to} min={draft.from} onChange={e=>field('to',e.target.value)}/></label>
   <label>{tr("排序")}<select value={draft.order} onChange={e=>field('order',e.target.value)}><option value="desc">{tr("最新在前")}</option><option value="asc">{tr("最早在前")}</option></select></label>
   <div className="audit-filter-actions"><button className="team-primary" disabled={busy}><Search size={15}/>{tr("筛选")}</button><button type="button" onClick={()=>{setDraft(empty);setFilters({...empty});setPage(0);setAsOf('');setExpanded(null)}} disabled={busy}>{tr("重置")}</button></div>
  </form>
  <div className="audit-summary"><p aria-live="polite">{busy?tr('正在读取日志…'):tr('共 {count} 条记录',{count:data?.total||0})}<small>{tr("日期与时间按北京时间显示")}</small></p><button type="button" disabled={busy} onClick={()=>{setAsOf('');setPage(0);setRefresh(v=>v+1)}}><RefreshCw size={15}/>{tr("刷新")}</button></div>
  {error&&<p className="team-error" role="alert">{tr(error)}<button onClick={()=>setRefresh(v=>v+1)}>{tr("重试")}</button></p>}
  <div className="team-table-scroll" aria-busy={busy}><table className="team-table audit-table"><thead><tr><th>{tr("时间")}</th><th>{tr("操作者")}</th><th>{tr("操作")}</th><th>{tr("对象")}</th><th>{tr("结果")}</th><th>{tr("详情")}</th></tr></thead><tbody>{!data&&!error?<tr><td colSpan={6}>{tr("正在加载…")}</td></tr>:!data?.items.length?<tr><td colSpan={6} className="audit-empty">{error?tr('暂时无法读取日志。'):tr('没有符合筛选条件的记录。')}</td></tr>:data.items.map(item=><AuditRow key={item.id} item={item} expanded={expanded===item.id} toggle={()=>setExpanded(expanded===item.id?null:item.id)}/>)}</tbody></table></div>
  <nav className="audit-pagination" aria-label={tr("日志分页")}><span>{tr('第 {page} / {pages} 页 · 每页 25 条',{page:page+1,pages})}</span><div><button disabled={busy||page===0} onClick={()=>turn(page-1)}><ChevronLeft size={15}/>{tr("上一页")}</button><button disabled={busy||page+1>=pages} onClick={()=>turn(page+1)}>{tr("下一页")}<ChevronRight size={15}/></button></div></nav>
 </section>;
}
function AuditRow({item,expanded,toggle}:{item:Entry;expanded:boolean;toggle:()=>void}){const {t:tr,locale}=useLocale();return <><tr><td className="audit-time">{new Date(item.created_at).toLocaleString(locale==='en'?'en-US':'zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</td><td><b>{item.actor_name}</b><small>{item.actor_email}</small></td><td>{tr(labels[item.action]||item.action)}</td><td className="audit-target" title={item.target}>{item.target||'—'}</td><td><span className={`audit-result is-${item.result}`}>{{success:tr('成功'),denied:tr('被拒绝'),failed:tr('失败')}[item.result]}</span></td><td><button aria-expanded={expanded} aria-controls={`log-${item.id}`} onClick={toggle}>{expanded?tr('收起'):tr('查看')}</button></td></tr>{expanded&&<tr id={`log-${item.id}`} className="audit-detail"><td colSpan={6}><dl><dt>{tr("记录 ID")}</dt><dd>{item.id}</dd><dt>{tr("操作")}</dt><dd>{item.action}</dd><dt>{tr("对象")}</dt><dd>{item.target||'—'}</dd><dt>{tr("状态码")}</dt><dd>{item.status}</dd>{item.details&&item.details!=='{}'&&<><dt>{tr("变更信息")}</dt><dd>{item.details}</dd></>}</dl></td></tr>}</>}
