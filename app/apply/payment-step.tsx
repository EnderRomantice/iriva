'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {applicationPlans} from '../../lib/application-plans';
export default function PaymentStep({needsWechat}:{needsWechat:boolean}) {
  const [plan,setPlan]=useState('native'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checkoutUrl,setCheckoutUrl]=useState('');
  const router=useRouter();
  async function checkout(){
    setBusy(true);setError('');
    const paymentWindow=window.open('about:blank','_blank');
    if(paymentWindow)paymentWindow.opener=null;
    try{
      const r=await fetch('/api/apply/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'暂时无法打开付款页面。');
      if(paymentWindow)paymentWindow.location.href=d.url;else setCheckoutUrl(d.url);
      setBusy(false);router.refresh();
    }catch(e){paymentWindow?.close();setError((e as Error).message);setBusy(false)}
  }
  return <section className="apply-payment" aria-labelledby="payment-title">
    <h2 id="payment-title">选择套餐，完成付款</h2>
    <p>资料已保存。付款成功后才会加入待匹配队列，由团队安排 Host 和学习伙伴。</p>
    <fieldset className="apply-plan-options"><legend>学习套餐</legend>{applicationPlans.map(p=><label key={p.id} className="apply-plan-option" data-unavailable={!p.available||undefined}>
      <input type="radio" name="payment-plan" value={p.id} checked={plan===p.id} disabled={!p.available||busy} onChange={()=>setPlan(p.id)}/>
      <span><b>{p.name}{p.available?' · 英语 · 四周':''}</b><span>{p.amountMinor?`¥${(p.amountMinor/100).toLocaleString('zh-CN')} / 人`:'暂未开放'}</span><small>{p.description}</small></span>
    </label>)}</fieldset>
    {needsWechat&&<p className="apply-error">请先点击「补充或修改资料」填写微信号，再付款。</p>}
    {error&&<p role="alert" className="apply-error">{error}</p>}
    {checkoutUrl&&<a className="apply-link" href={checkoutUrl} target="_blank" rel="noreferrer">打开安全付款页面</a>}<div className="apply-actions"><button type="button" className="apply-button" disabled={busy||needsWechat} onClick={checkout}>{busy?'正在前往付款…':'确认套餐并付款 · ¥1,980'}</button><button type="button" className="apply-link" onClick={()=>router.refresh()}>已完成付款，刷新状态</button></div>
    <p className="apply-note">付款将在新页面打开。完成后返回本页，确认到账后会自动显示入群二维码。付款结果以实际到账为准。若取消付款或尚未到账，资料会保留，不会进入匹配队列。已付款但状态未更新时，请稍后刷新，避免重复付款。</p>
  </section>;
}
