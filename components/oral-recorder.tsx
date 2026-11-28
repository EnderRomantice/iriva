'use client';
import {useEffect,useRef,useState} from 'react';
import {recordingMaxBytes,recordingMaxSeconds,type OralRecording} from '../lib/oral-recording';

type Props={value:OralRecording|undefined;onChange:(value:OralRecording|undefined)=>void;onBusyChange:(busy:boolean)=>void;saved?:string;disabled?:boolean};
export default function OralRecorder({value,onChange,onBusyChange,saved,disabled}:Props){
 const [phase,setPhase]=useState<'idle'|'requesting'|'recording'|'processing'>('idle'),[seconds,setSeconds]=useState(0),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),mounted=useRef(true);
 const busy=phase!=='idle';
 useEffect(()=>{onBusyChange(busy)},[busy,onBusyChange]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearInterval(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 function stop(){if(recorder.current?.state==='recording')recorder.current.stop();if(timer.current)clearInterval(timer.current);stream.current?.getTracks().forEach(t=>t.stop())}
 async function start(){
  setError('');
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('此浏览器暂不支持录音，请使用新版 Safari 或 Chrome，或先提交资料由团队联系补录。');return}
  setPhase('requesting');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!mounted.current){media.getTracks().forEach(t=>t.stop());return}
   stream.current=media;
   const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   if(!type)throw new Error('此浏览器没有可用的录音格式，请换用 Safari 或 Chrome。');
   const r=new MediaRecorder(media,{mimeType:type,audioBitsPerSecond:64000});recorder.current=r;
   const chunks:Blob[]=[];let total=0,failed=false;const started=Date.now();
   r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);total+=e.data.size;if(total>recordingMaxBytes){failed=true;setError('录音超过 2MB，请缩短内容后重录。');stop()}}};
   r.onerror=()=>{failed=true;setError('录音中断，请检查麦克风后重试。');stop();setPhase('idle')};
   r.onstop=async()=>{
    if(timer.current)clearInterval(timer.current);media.getTracks().forEach(t=>t.stop());
    if(!mounted.current)return;
    if(failed){setPhase('idle');return}
    setPhase('processing');
    try{
     const blob=new Blob(chunks,{type:r.mimeType.split(';')[0]});
     if(blob.size<12||blob.size>recordingMaxBytes)throw new Error('没有录到有效音频，请重试。');
     const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('录音读取失败，请重试。'));reader.readAsDataURL(blob)});
     if(mounted.current)onChange({data,type:blob.type,duration:Math.min(recordingMaxSeconds,Math.max(1,Math.round((Date.now()-started)/1000)))});
    }catch(e){if(mounted.current)setError((e as Error).message)}finally{if(mounted.current)setPhase('idle')}
   };
   r.start(1000);setSeconds(0);setPhase('recording');
   timer.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-started)/1000);setSeconds(elapsed);if(elapsed>=recordingMaxSeconds)stop()},250);
  }catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(mounted.current){setPhase('idle');setError((e as Error).name==='NotAllowedError'?'麦克风权限未开启。请在浏览器设置中允许麦克风后重试，也可以先提交资料。':(e as Error).name==='NotFoundError'?'没有检测到麦克风，请连接后重试。':(e as Error).message)}}
 }
 const src=value?`data:${value.type};base64,${value.data}`:saved?`/api/apply/recording?v=${encodeURIComponent(saved)}`:undefined;
 return <fieldset className="apply-oral"><legend>英文口语录音</legend><p><strong>Please introduce yourself in English.</strong><br/>请用英文介绍一下自己，再回答下面两到三个问题。</p><ol><li>What do you do, and where do you live?<small>你平时学习或做什么工作？住在哪个城市？</small></li><li>What do you enjoy doing in your free time, and why?<small>空闲时喜欢做什么？为什么？</small></li><li>Why do you want to improve your English?<small>为什么想提高英语？最希望在哪些场景用到？</small></li></ol><p className="apply-note">建议 1–2 分钟，最多 2 分钟。按自己的水平自然表达即可，不必准备完美答案。录音随资料提交，仅供你本人和青鸟团队试听、人工评估，不向其他学员公开。暂时不方便录音，也可以先提交资料。</p>
 {src&&<div><audio controls preload="metadata" src={src} aria-label="试听口语录音"/><p className="apply-note">{value?'新录音尚未提交，离开页面不会保存在草稿中。':'已提交的口语录音。'}重录后需提交资料才会替换原录音。</p></div>}
 <div className="apply-actions">{phase==='recording'?<button type="button" className="apply-button" onClick={stop}>停止录音 · {seconds} / 120 秒</button>:<button type="button" className="apply-secondary" disabled={busy||disabled} onClick={start}>{phase==='requesting'?'正在请求麦克风…':phase==='processing'?'正在处理录音…':src?'重新录制':'开始录音'}</button>}{value&&!busy&&<button type="button" className="apply-secondary" disabled={disabled} onClick={()=>onChange(undefined)}>撤销本次录音</button>}</div>
 <p role="status" className="apply-note">{phase==='recording'?'正在录音，请说话；完成后点击停止。':''}</p>{error&&<p role="alert" className="apply-error">{error}</p>}</fieldset>
}
