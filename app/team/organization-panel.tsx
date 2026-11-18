'use client';
import {useLocale} from '../../components/locale-provider';
import {useState,type FormEvent} from 'react';
import type {AccessRole,TeamOrganization} from '../../server/services/organization-access';
export type TeamMember={id:string;email:string;name:string;role:AccessRole};
export default function OrganizationPanel({organization,members,busy,save,reload}:{organization:TeamOrganization;members:TeamMember[];busy:boolean;save:(body:unknown)=>Promise<boolean|undefined>;reload:()=>Promise<void>}){const {t:tr}=useLocale();
 const [editing,setEditing]=useState<TeamMember|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 async function orgAction(body:unknown){setPending(true);setError('');try{const r=await fetch('/api/team/organizations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);await reload();return true;}catch(e){setError((e as Error).message);return false;}finally{setPending(false)}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;if(await save({action:'staff',...Object.fromEntries(new FormData(f))})){setEditing(null);f.reset();}}
 return <div className="org-panel">
  <div className="org-summary"><div><small>{tr("当前组织")}</small><h2>{organization.name}</h2></div><span className="org-role">{organization.role}</span></div>
  <p className="team-help">{tr("Owner 管理组织所有权；admin 管理成员与运营；partner 参与协作，不能管理成员或权限。")}</p>
  <form className="org-member-form" key={editing?.id||'new'} onSubmit={submit}>
   <h2>{editing?tr('修改成员权限'):tr('添加组织成员')}</h2>
   <label>{tr("姓名")}<input name="name" required maxLength={60} defaultValue={editing?.name}/></label>
   <label>{tr("邮箱")}<input name="email" required type="email" maxLength={200} readOnly={!!editing} defaultValue={editing?.email}/></label>
   <label>{tr("角色")}<select name="role" defaultValue={editing?.role||'partner'}><option value="partner">{tr("Partner · 协作成员")}</option><option value="admin">{tr("Admin · 管理员")}</option></select></label>
   {!editing&&<label>{tr("初始密码")}<input name="password" type="password" minLength={8} maxLength={200} autoComplete="new-password"/><small>{tr("新账号至少 8 位；已有密码的账号留空。")}</small></label>}
   <div className="org-form-actions"><button className="team-primary" disabled={busy||pending}>{editing?tr('保存权限'):tr('添加成员')}</button>{editing&&<button type="button" onClick={()=>setEditing(null)}>{tr("取消")}</button>}</div>
  </form>
  <div className="team-table-scroll"><table className="team-table"><thead><tr><th>{tr("成员")}</th><th>{tr("邮箱")}</th><th>{tr("角色")}</th><th>{tr("操作")}</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td><span className="org-role">{m.role}</span></td><td><div className="table-actions">{m.role!=='owner'&&<><button disabled={busy||pending} onClick={()=>setEditing(m)}>{tr("编辑")}</button><button disabled={busy||pending} onClick={()=>{if(confirm(tr('移除 {name} 在本组织的访问权限？',{name:m.name})))save({action:'removeStaff',email:m.email})}}>{tr("移除")}</button></>}{organization.role==='owner'&&m.role==='admin'&&<button disabled={pending||busy} onClick={()=>{if(confirm(tr('将组织所有权转给 {name}？你将成为 admin。',{name:m.name})))orgAction({action:'transfer',userId:m.id})}}>{tr("转移所有权")}</button>}{m.role==='owner'&&<span className="team-help">{tr("组织所有者")}</span>}</div></td></tr>)}</tbody></table></div>
  <form className="org-create" onSubmit={async e=>{e.preventDefault();const f=e.currentTarget;if(await orgAction({action:'create',name:new FormData(f).get('name')}))f.reset();}}><label>{tr("新组织名称")}<input name="name" required maxLength={60} placeholder={tr("例如：青鸟上海团队")}/></label><button className="team-primary" disabled={pending||busy}>{tr("创建组织")}</button></form>
  {error&&<p className="team-error" role="alert">{tr(error)}</p>}
 </div>;
}
