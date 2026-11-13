import type {CSSProperties} from 'react';

/** The same transparent bluebird used beneath the Iris rainbow. */
export default function Bluebird({size=20,className='',style}:{size?:number;className?:string;style?:CSSProperties;strokeWidth?:number}) {
  return <img src="/bluebird-transparent.png" alt="" aria-hidden="true" width={size} height={size} className={`iriva-ai-bird ${className}`} style={{width:size,height:size,objectFit:'contain',display:'inline-block',flexShrink:0,verticalAlign:'middle',...style}}/>;
}
