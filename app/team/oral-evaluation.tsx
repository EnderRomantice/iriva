'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import {useLocale} from '../../components/locale-provider';
import './oral-evaluation.css';

/** Old reports may contain escaped newlines; keep those readable too. */
function reportBlocks(text:string){
 return text.replace(/\\r\\n|\\n/g,'\n').replace(/\r\n/g,'\n').trim().split(/\n\s*\n/).filter(Boolean).map(block=>{
  const [heading,...lines]=block.split('\n');
  const grade=/^AI 建议等级[：:]\s*(.+)$/.exec(heading);
  if(grade)return {kind:'grade' as const,title:'AI 建议等级',grade:grade[1],body:lines.join('\n')};
  const dimension=/^(发音清晰度|流利度与连贯性|词汇丰富度与准确性|语法与句式控制)\s*·\s*(.+)$/.exec(heading);
  if(dimension)return {kind:'dimension' as const,title:dimension[1],grade:dimension[2],body:lines.join('\n')};
  if(['综合评级理由','更高等级还需要什么','评估局限'].includes(heading))return {kind:'summary' as const,title:heading,grade:'',body:lines.join('\n')};
  return {kind:'paragraph' as const,title:'',grade:'',body:block};
 });
}
function Evidence({text}:{text:string}){
 const {t}=useLocale();
 return text.split(/\n(?=(?:录音依据|判断理由)[：:])/).filter(Boolean).map((part,index)=>{
  const match=/^(录音依据|判断理由)[：:]\s*([\s\S]*)$/.exec(part);
  if(!match)return <p key={index}>{part}</p>;
  return <div className="team-ai-evidence" key={index}><span>{t(match[1])}</span>{match[1]==='录音依据'?<blockquote>{match[2]}</blockquote>:<p>{match[2]}</p>}</div>;
 });
}
export default function OralEvaluation({text,loading,generation}:{text:string;loading:boolean;generation:number}){
 const {t}=useLocale(),inner=useRef<HTMLDivElement>(null),report=useRef<HTMLDivElement>(null);
 const [height,setHeight]=useState<number>();
 useLayoutEffect(()=>{
  const element=inner.current;if(!element)return;
  const measure=()=>setHeight(Math.ceil(element.getBoundingClientRect().height));
  measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[]);
 useLayoutEffect(()=>{
  const block=report.current;if(!block)return;
  if(generation===0){block.classList.add('is-shown');return;}
  block.classList.remove('is-shown');
  void block.offsetHeight;
  const frame=requestAnimationFrame(()=>block.classList.add('is-shown'));
  return()=>cancelAnimationFrame(frame);
 },[text,generation]);
 const blocks=text?reportBlocks(text):[];
 return <section className="team-ai-evaluation" aria-label={t('IRIVA AI 评价')} aria-busy={loading}>
  <div className="team-ai-heading"><h3>{t('IRIVA AI 评价')}</h3><span>{t(loading?'正在识别':'多维度口语评估')}</span></div>
  <div className="team-ai-resize t-resize" style={{height}}><div ref={inner}>
   {blocks.length?<div ref={report} className={`team-ai-report t-stagger${generation===0?' is-shown':''}`}>
    {blocks.map((block,index)=><article key={index} className={`team-ai-block team-ai-block--${block.kind} t-stagger-line`} style={{transitionDelay:`calc(var(--stagger-stagger) * ${Math.min(index,7)})`}}>
     {block.title&&<div className="team-ai-block-heading"><h4>{t(block.title)}</h4>{block.grade&&<span className="team-ai-grade">{block.grade}</span>}</div>}
     {block.kind==='dimension'?<Evidence text={block.body}/>:block.body&&<p>{block.body}</p>}
    </article>)}
    <small className="team-ai-footnote t-stagger-line" style={{transitionDelay:'calc(var(--stagger-stagger) * 7)'}}>{t('以上为 AI 建议及依据，最终等级以人工确认后保存的结果为准。')}</small>
   </div>:<div className="team-ai-empty"><p>{t(loading?'正在听取录音，整理各维度的依据与评价。':'手动启动 AI 识别与评分后，这里将展示各维度依据与综合评级理由。')}</p>{loading&&<div className="team-ai-placeholder" aria-hidden="true"><span/><span/><span/></div>}</div>}
  </div></div>
 </section>;
}
