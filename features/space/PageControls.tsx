'use client';
export function PageControls({page}:{page:{busy:boolean;error:string;hasMore:boolean;loadMore:()=>Promise<void>;retry:()=>Promise<void>}}){
 return <div className="sp-page-controls">{page.error&&<p role="alert">{page.error}<button onClick={()=>void page.retry()}>重试</button></p>}{page.hasMore&&<button disabled={page.busy} onClick={()=>void page.loadMore()}>{page.busy?'读取中…':'加载更多'}</button>}</div>;
}
