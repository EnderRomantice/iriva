'use client';
import './style.css';
import {useEffect,useRef,useState} from 'react';
import {supportGroup,supportGroupExpired} from '../../lib/support-group';

export default function SupportGroup({account}:{account:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [expired,setExpired]=useState(false);
  const key=`iriva-support-group:${account}:${supportGroup.version}`;
  useEffect(()=>{
    setExpired(supportGroupExpired());
    let seen=false;try{seen=localStorage.getItem(key)==='seen'}catch{}
    if(!seen)dialog.current?.showModal();
  },[key]);
  function close(){try{localStorage.setItem(key,'seen')}catch{}dialog.current?.close()}
  return <>
    <button type="button" className="apply-link" onClick={()=>{setExpired(supportGroupExpired());dialog.current?.showModal()}}>加入官方售后 / 交流群</button>
    <dialog className="support-group-dialog" ref={dialog} aria-labelledby="support-group-title" onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close()}}>
      <div className="support-group-content">
        <button type="button" className="support-group-close" onClick={close} aria-label="关闭入群二维码">×</button>
        <h2 id="support-group-title">付款成功，已加入待匹配队列</h2>
        <p>扫码加入官方售后/交流群，查询分组进度。</p>
        {expired?<div className="apply-card"><p>群二维码已过期，请联系客服获取最新入群方式。</p><a className="apply-link" href="/feedback">联系客服</a></div>:<img src={supportGroup.image} alt="IRIVA 青鸟官方售后及交流群微信二维码" width={720} height={1088}/>}
        {!expired&&<a className="apply-link" href={supportGroup.image} download="IRIVA官方售后交流群.png">保存二维码</a>}<p className="apply-note">手机上可保存二维码，使用微信扫一扫识别图片。无法入群时，可通过「给青鸟留言」联系客服。</p>
        <button type="button" className="apply-button" onClick={close}>知道了，查看匹配进度</button>
      </div>
    </dialog>
  </>;
}
