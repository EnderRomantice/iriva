'use client';
import {useLocale} from '../../components/locale-provider';
import {workspaceFetch as fetch} from '../../lib/workspace-fetch';
import type {WorkspaceAccess} from '../../domain/workspace-access';
import OrganizationSwitcher from '../team/organization-switcher';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FormEvent,useMemo,useState} from 'react';
import {ArrowUpRight,Check} from 'lucide-react';
import WorkspaceShell from '../../components/workspace/shell';
import {isTeamRole} from '../../domain/workspace-access';
import AvatarUpload,{postAvatar} from '../../components/workspace/avatar-upload';
import {standardTimezones,timezoneLabel,timezoneOptions} from '../../lib/timezones';

type Profile={name:string;location:string;age_band:string;life_stage:string;mbti:string;contact_preference:string;contact:string};
const mbtis=['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
const statusText:Record<string,string>={awaiting_payment:'资料已保存，请选择套餐并付款',pending:'已付款，正在等待匹配',new:'资料已收到，团队会跟进',interest:'意向已登记',contacted:'正在了解你的学习需要',shortlist:'正在为你安排伙伴',hold:'正在协调后续安排',declined:'本期暂无合适安排',assigned:'已加入小组'};

export default function AboutProfile({access,avatar=null,email,teamAccess,role,household,profile,hasApplication,status}:{access?:WorkspaceAccess;avatar?:string|null;email:string;teamAccess:boolean;role:string|null;household:{name:string;timezone:string;avatar?:string|null}|null;profile:Profile;hasApplication:boolean;status:string|null}){const {t:tr,locale}=useLocale();const zones=useMemo(()=>timezoneOptions(new Date(),locale),[locale]);
  const router=useRouter();const home='/app?org='+encodeURIComponent(access?.organization.id||'');
  const [f,setF]=useState(profile),[timezone,setTimezone]=useState(()=>standardTimezones.find(z=>`UTC${z.value}`===timezoneLabel(household?.timezone||''))?.value||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const edit=(k:keyof Profile,v:string)=>{setF(p=>({...p,[k]:v}));setSaved(false)};
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setSaved(false);
    try{const r=await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,timezone})});const d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error);setSaved(true);router.refresh()}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const sidebar={subtitle:household?tr("我的小组"):tr("从认识彼此开始"),household:!!household,host:role==='host',badge:0,title:household?.name||tr("我的 Household"),avatar:household?.avatar||null};
  const subtitle=role==='host'?'Host':household?tr("学习者"):tr("新伙伴");
  async function switchOrganization(organizationId:string){setBusy(true);try{const r=await fetch('/api/organizations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId})});const d=await r.json();if(!r.ok)throw new Error(d.error);location.assign('/app?org='+encodeURIComponent(organizationId))}catch(e){setError((e as Error).message);setBusy(false)}}
  const workspaceRole=access?.organization.role||(role==='host'?'host':'learner');
  const team=isTeamRole(workspaceRole);
  return <WorkspaceShell role={workspaceRole} sidebar={{organizationId:access?.organization.id,title:team?access?.organization.name||tr('当前组织'):sidebar.title,subtitle:team?'':sidebar.subtitle,avatar:sidebar.avatar,identityId:!team&&sidebar.household?'Household':undefined,identity:access&&(team||access.canSwitch)?<OrganizationSwitcher current={!team&&household?{...access.organization,name:household.name,avatar:household.avatar}:access.organization} organizations={access.organizations} busy={busy} onSwitch={switchOrganization} settingsAvailable={team||!!household} onSettings={()=>router.push(home+'&tab='+encodeURIComponent(team?'团队权限':'Household'))}/>:undefined}} active="about" onSelect={id=>router.push(home+'&tab='+encodeURIComponent(id))} breadcrumb={<><a href={home}>{team?access?.organization.name:household?.name||tr('我的 Household')}</a><span aria-hidden="true">/</span><b aria-current="page">{tr('个人信息')}</b></>} account={{organizationId:access?.organization.id,avatar,name:f.name,subtitle:team?undefined:subtitle,current:'about'}} contentClassName="p-main p-about">
        <div className="p-welcome"><div><h1>{tr("个人信息")}</h1><p>{tr("伙伴看到的称呼、你的时区和联系方式，都可以在这里更新。")}</p></div></div>
        <form onSubmit={submit}>
          <section className="p-card"><h2>{tr("基本信息")}</h2><p>{tr("保存后，小组里显示的名字会同步更新。")}</p>
            <div className="p-about-avatar"><span className="p-about-avatar-label">{tr("头像")}<small>{tr("显示在小组交流和成员列表里。未设置时显示名字首字。")}</small></span><AvatarUpload name={f.name||email} avatar={avatar} save={image=>postAvatar('/api/profile/avatar',{image})} onSaved={()=>router.refresh()}/></div>
            <label>{tr("伙伴怎么称呼你")}<input required maxLength={50} value={f.name} onChange={e=>edit('name',e.target.value)} autoComplete="nickname"/></label>
            <label>{tr("登录邮箱")}<input value={email} readOnly/></label>
            {household&&<label>{tr("我的时区")}<select value={timezone} onChange={e=>{setTimezone(e.target.value);setSaved(false)}}><option value="">{tr("请选择当前 UTC 时区")}</option>{zones.map(z=><option key={z.value} value={z.value} suppressHydrationWarning>{z.label}</option>)}</select><small className="p-muted">{tr("供本组伙伴约时间时参考；本期日程仍统一按北京时间显示。")}</small></label>}
            {hasApplication&&<>
              <label>{tr("所在国家或地区")}<input required maxLength={80} value={f.location} onChange={e=>edit('location',e.target.value)} placeholder={tr("例如：中国上海")}/></label>
              <div className="p-about-row">
                <label>{tr("年龄段")}<select required value={f.age_band} onChange={e=>edit('age_band',e.target.value)}><option value="">{tr("请选择")}</option><option value="under18">{tr("18 岁以下")}</option><option value="18-24">{tr("18–24 岁")}</option><option value="25-34">{tr("25–34 岁")}</option><option value="35-44">{tr("35–44 岁")}</option><option value="45-54">{tr("45–54 岁")}</option><option value="55plus">{tr("55 岁及以上")}</option><option value="private">{tr("暂不透露")}</option></select></label>
                <label>{tr("学习或工作阶段")}<select required value={f.life_stage} onChange={e=>edit('life_stage',e.target.value)}><option value="">{tr("请选择")}</option><option value="school">{tr("中小学阶段")}</option><option value="university">{tr("大学 / 研究生阶段")}</option><option value="working">{tr("在职")}</option><option value="entrepreneur">{tr("创业 / 自由职业")}</option><option value="other">{tr("其他阶段")}</option><option value="private">{tr("暂不透露")}</option></select></label>
              </div>
              <label>{tr("MBTI（选填）")}<select value={f.mbti} onChange={e=>edit('mbti',e.target.value)}><option value="">{tr("不了解 / 不填写")}</option>{mbtis.map(t=><option key={t}>{t}</option>)}</select></label>
            </>}
          </section>
          {hasApplication&&<section className="p-card"><h2>{tr("联系方式")}</h2><p>{tr("团队跟进安排时使用，不会展示给其他成员。")}</p>
            <label>{tr("微信号（必填）")}<input required maxLength={200} value={f.contact_preference==='wechat'?f.contact:''} onChange={e=>{setF(p=>({...p,contact_preference:'wechat',contact:e.target.value}));setSaved(false)}} aria-describedby="profile-wechat-help"/><small id="profile-wechat-help">{tr("方便客服人员添加，确保服务质量。")}</small></label>
          </section>}
          {error&&<div className="p-error" role="alert">{tr(error)}</div>}
          {saved&&<div className="p-notice" role="status"><Check size={15}/>{tr("已保存。")}</div>}
          <div className="p-about-actions"><button className="p-button" disabled={busy}>{busy?tr("正在保存…"):tr("保存个人信息")} <Check size={15}/></button></div>
        </form>
        {!team&&role!=='host'&&<section className="p-card" style={{marginTop:28}}><h2>{tr("学习资料")}</h2>
          {hasApplication?<><p>{status?tr(statusText[status]||'团队正在跟进'):''}{household?tr("。学习需要与可用时间的变更，请通过“给青鸟的建议”联系团队。"):tr("。学习目标、兴趣和可用时间可在加入资料中补充。")}</p><Link className="p-outline" href="/apply">{tr("查看我的加入资料 ")}<ArrowUpRight size={14}/></Link></>
          :<><p>{tr("还没有填写加入资料。先让青鸟团队认识你，再为你安排合适的小组。")}</p><Link className="p-button" href="/apply">{tr("填写加入资料 ")}<ArrowUpRight size={15}/></Link></>}
        </section>}
  </WorkspaceShell>;
}
