'use client';
import {useEffect,useRef,useState} from 'react';
import {Play,Pause,Volume2,VolumeX} from 'lucide-react';
import {useLocale} from './locale-provider';
import './oral-audio-player.css';

type Props={src:string;label:string};
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export default function OralAudioPlayer(props:Props){return <Player key={props.src} {...props}/>}
function Player({src,label}:Props){
 const {t}=useLocale(),audio=useRef<HTMLAudioElement>(null),intent=useRef(false),attempt=useRef(0);
 const [loading,setLoading]=useState(false),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const el=audio.current;return()=>{intent.current=false;attempt.current++;el?.pause()}},[]);
 function stop(){intent.current=false;attempt.current++;audio.current?.pause();setPlaying(false);setLoading(false)}
 function fail(){stop();setError(t('录音加载失败，请点击播放重试。'))}
 async function toggle(){
  const el=audio.current;if(!el)return;
  if(intent.current){stop();return}
  intent.current=true;const current=++attempt.current;setError('');setLoading(true);
  try{
   if(el.error)el.load();
   // Start in the click gesture: the browser resolves play() once buffered,
   // preserving autoplay permission even when loading takes several seconds.
   await el.play();
   if(current!==attempt.current)return;
   setPlaying(true);setLoading(false);
  }catch(e){if(current!==attempt.current)return;stop();setError(t((e as Error).name==='NotAllowedError'?'请再次点击播放录音。':'录音加载失败，请点击播放重试。'))}
 }
 return <div className="oral-audio-player" role="group" aria-label={label}>
  <audio ref={audio} src={src} preload="none" onLoadedMetadata={e=>{const d=e.currentTarget.duration;if(Number.isFinite(d))setDuration(d)}} onDurationChange={e=>{const d=e.currentTarget.duration;if(Number.isFinite(d))setDuration(d)}} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onWaiting={()=>{if(intent.current)setLoading(true)}} onPlaying={()=>{if(!intent.current){audio.current?.pause();return}setPlaying(true);setLoading(false)}} onPause={()=>{if(audio.current?.ended)return;intent.current=false;setPlaying(false);setLoading(false)}} onEnded={()=>{intent.current=false;setPlaying(false);setLoading(false)}} onError={fail}/>
  <div className="oral-audio-controls">
   <button type="button" className="oral-audio-toggle" onClick={toggle} aria-label={t(loading?'正在加载录音，点击取消':playing?'暂停录音':'播放录音')} aria-busy={loading}>{loading?<span className="oral-audio-spinner" aria-hidden="true"/>:playing?<Pause size={17} fill="currentColor" aria-hidden="true"/>:<Play size={17} fill="currentColor" aria-hidden="true"/>}</button>
   <div className="oral-audio-progress"><input type="range" aria-label={t('录音播放进度')} min={0} max={duration||1} step={0.1} value={Math.min(position,duration||1)} disabled={!duration} onChange={e=>{if(audio.current){audio.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value))}}}/><span>{time(position)} / {duration?time(duration):'--:--'}</span></div>
   <button type="button" className="oral-audio-mute" aria-label={t(muted?'取消静音':'静音')} onClick={()=>{if(audio.current){audio.current.muted=!muted;setMuted(!muted)}}}>{muted?<VolumeX size={17} aria-hidden="true"/>:<Volume2 size={17} aria-hidden="true"/>}</button>
  </div>
  <span className="oral-audio-status" role="status">{error||(loading?t('正在加载，完成后自动播放。'):'')}</span>
 </div>;
}
