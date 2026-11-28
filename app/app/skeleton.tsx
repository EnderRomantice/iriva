'use client';
import {useLocale} from '../../components/locale-provider';
import WorkspaceShell from '../../components/workspace/shell';
/** 页面切换与首次读取时的骨架屏，形状与学习空间一致，避免内容跳动。 */
export function MainSkeleton(){const {t:tr}=useLocale();
  return <div className="p-skeleton" aria-busy="true" aria-label={tr("正在加载")}>
    <div className="sk sk-title"/><div className="sk sk-line w60"/>
    <div className="sk-grid"><div className="sk sk-card tall"/><div className="sk sk-card tall"/></div>
    <div className="sk-grid"><div className="sk sk-card"/><div className="sk sk-card"/></div>
    <div className="sk sk-card"/>
  </div>;
}

export default function PortalSkeleton({active='Home'}:{active?:string}){
  return <WorkspaceShell role={null} sidebar={{title:'',subtitle:'',loading:true}} active={active} onSelect={()=>{}} breadcrumb={<span className="sk sk-line w30"/>} contentClassName="p-main"><MainSkeleton/></WorkspaceShell>;
}
