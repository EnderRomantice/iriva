'use client';
import {useLocale,LocaleSwitcher} from '../../components/locale-provider';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function SignInForm({ returnTo }: { returnTo: string }) {const {t:tr,locale}=useLocale();
 const [email,setEmail]=useState(''),[step,setStep]=useState<'email'|'code'|'password'>('email');
 const [challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 async function call(body:object,url='/api/auth') {
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json() as {error?:string;method?:string;challengeId?:string;delivery?:string};
  if(!r.ok)throw new Error(d.error||tr('暂时无法登录，请稍后重试。'));return d;
 }
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  try{
   if(step==='email'){
    const d=await call({action:'begin',email});
    if(d.method==='password'){setStep('password');return;}
    if(!d.challengeId)throw new Error(tr('暂时无法发送验证码。'));
    setChallenge(d.challengeId);setStep('code');
    setNote(d.delivery==='console'?tr('本地开发：验证码已打印在服务器日志里，也可以直接填 000000。'):tr('验证码已发到 {email}，10 分钟内有效。',{email}));
   }else if(step==='password'){await call({email,password},'/api/auth/password');location.assign('/team');}
   else{await call({action:'verify',challengeId:challenge,code});location.assign(returnTo);}
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function reset(){setStep('email');setPassword('');setCode('');setChallenge('');setError('');setNote('');}
 return <main className="apply-page signin-page">
  <a className="apply-brand" href={locale==='en'?'/en':'/'}>iriva <span>{tr("青鸟")}</span></a>
  <LocaleSwitcher/><div className="apply-heading"><h1>{step==='password'?tr('登录管理空间。'):tr('进入学习空间。')}</h1>{step==='password'&&<p>{tr("输入账号密码以继续。")}</p>}</div>
  <form onSubmit={submit}>
   <label>{tr("邮箱")}<input type="email" required autoComplete="username" readOnly={step!=='email'} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
   {step==='password'&&<label>{tr("密码")}<input key="password" autoFocus type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
   {step==='code'&&<><p className="apply-note" role="status">{tr(note)}</p><label>{tr("验证码")}<input key="code" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder={tr("6 位数字")}/></label></>}
   {error&&<p className="apply-error" role="alert">{tr(error)}</p>}
   <button className="apply-button" disabled={busy}>{busy?tr('请稍候…'):step==='email'?tr('继续'):tr('登录')}<ArrowUpRight size={16}/></button>
   {step!=='email'&&<button type="button" className="apply-back signin-switch" disabled={busy} onClick={reset}>{tr("换一个邮箱")}</button>}
  </form>
  <a className="apply-back" href={locale==='en'?'/en':'/'}>{tr("返回青鸟首页")}</a>
 </main>;
}
