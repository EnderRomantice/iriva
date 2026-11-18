'use client';
/** 页面切换与首次读取时的骨架屏，形状与学习空间一致，避免内容跳动。 */
export function MainSkeleton(){
  return <div className="p-skeleton" aria-busy="true" aria-label="正在加载">
    <div className="sk sk-title"/><div className="sk sk-line w60"/>
    <div className="sk-grid"><div className="sk sk-card tall"/><div className="sk sk-card tall"/></div>
    <div className="sk-grid"><div className="sk sk-card"/><div className="sk sk-card"/></div>
    <div className="sk sk-card"/>
  </div>;
}

export default function PortalSkeleton(){
  return <div className="portal workspace-ui">
    <aside className="p-sidebar"><span className="workspace-brand">iriva <span>青鸟</span></span>
      <div className="p-skeleton-side">{Array.from({length:7},(_,i)=><div key={i} className={`sk sk-line${i===0?' tall':''}`}/>)}</div>
    </aside>
    <div className="p-work"><div className="p-top"><div className="sk sk-line w30"/><div className="sk sk-avatar"/></div>
      <div className="p-panel"><main className="p-main"><MainSkeleton/></main></div>
    </div>
  </div>;
}
