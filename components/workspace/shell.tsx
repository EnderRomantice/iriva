'use client';
import type {ComponentProps, ReactNode} from 'react';
import {RefreshCw} from 'lucide-react';
import {LocaleSwitcher, useLocale} from '../locale-provider';
import WorkspaceSidebar from './sidebar';
import DesktopShell from './desktop-shell';
import AccountMenu from './account-menu';
import type {WorkspaceRole} from '../../domain/workspace-access';

export type WorkspaceShellProps = {
  startOnDesktop?:boolean;
  onDesktopChange?:(visible:boolean)=>void;
  role:WorkspaceRole|null;
  /** Legacy business-content styles; never controls shell structure. */
  className?:string;
  sidebar:Omit<ComponentProps<typeof WorkspaceSidebar>,'role'|'active'|'onSelect'|'beforeLeave'>;
  active:string;
  onSelect:(tab:string)=>void;
  breadcrumb:ReactNode;
  account?:ComponentProps<typeof AccountMenu>;
  actions?:ReactNode;
  onRefresh?:()=>void;
  beforeLeave?:()=>boolean;
  contentClassName?:string;
  contentKey?:string;
  children:ReactNode;
};

/** All roles, profile pages and loading states use this exact chrome. */
export default function WorkspaceShell(props:WorkspaceShellProps) {
  return props.startOnDesktop!==undefined?<DesktopShell {...props}/>:<ClassicWorkspaceShell {...props}/>;
}

function ClassicWorkspaceShell({role,className='portal',sidebar,active,onSelect,breadcrumb,account,actions,onRefresh,beforeLeave,contentClassName='',contentKey,children}:WorkspaceShellProps) {
  const {t}=useLocale();
  return <div className={`workspace-ui workspace-shell ${className}`}>
    <WorkspaceSidebar {...sidebar} role={role} active={active} onSelect={onSelect} beforeLeave={beforeLeave}/>
    <div className="workspace-body">
      <header className="workspace-header p-top">
        <nav className="p-crumb" aria-label={t('当前位置')}>{breadcrumb}</nav>
        <div className="workspace-toolbar"><LocaleSwitcher>
          {actions}
          {onRefresh&&<button type="button" aria-label={t('刷新')} onClick={onRefresh}><RefreshCw size={16}/></button>}
          {account&&<AccountMenu {...account} beforeLeave={beforeLeave}/>}
        </LocaleSwitcher></div>
      </header>
      <div className="workspace-panel">
        <main className={`workspace-content ${contentClassName}`} key={contentKey}>{children}</main>
        <footer className="workspace-footer">IRIVA · A World of Voices. A Place to Belong.</footer>
      </div>
    </div>
  </div>;
}
