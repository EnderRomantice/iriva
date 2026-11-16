/**
 * Layout-matched loading placeholders for the signed-in workspaces.
 * They fade in after a short delay (see .ws-skeleton in workspace-theme.css),
 * so fast loads never flash a skeleton.
 */
import type { CSSProperties } from 'react';

const bar = (width: CSSProperties['width'], height: number, extra?: CSSProperties) => ({ width, height, ...extra });

/** Group chat: header, a few message rows, composer. */
export function ChatSkeleton() {
  const widths = ['62%', '38%', '74%', '46%', '58%'];
  return <div className="ws-skeleton ws-sk-chat" aria-busy="true" aria-label="正在加载小组交流">
    <div className="ws-sk-chat-head">
      <div><div className="sk" style={bar(120, 20)}/><div className="sk" style={bar(220, 12, { marginTop: 8 })}/></div>
      <div className="sk" style={bar(240, 32)}/>
    </div>
    <div className="ws-sk-chat-stream">
      {widths.map((w, i) => <div className="ws-sk-msg" key={i}>
        <div className="sk ws-sk-avatar"/>
        <div><div className="sk" style={bar(88, 12)}/><div className="sk" style={bar(w, 12, { marginTop: 10 })}/></div>
      </div>)}
    </div>
    <div className="ws-sk-chat-compose"><div className="sk" style={bar('100%', 112)}/></div>
  </div>;
}

/** Activity reviews: stats strip, toolbar, grouped queue + detail. */
export function QueueSkeleton() {
  return <div className="ws-skeleton" aria-busy="true" aria-label="正在加载活动记录">
    <div className="sk" style={bar('100%', 64, { borderRadius: 12 })}/>
    <div className="ws-sk-toolbar"><div className="sk" style={bar(220, 34)}/><div className="sk" style={bar(80, 34)}/></div>
    <div className="ws-sk-split">
      <div className="ws-sk-queue">
        {[4, 2, 3].map((rows, g) => <div className="ws-sk-group" key={g}>
          <div className="sk" style={bar('70%', 14)}/><div className="sk" style={bar('50%', 10, { marginTop: 8 })}/>
          {Array.from({ length: rows }, (_, i) => <div className="ws-sk-row" key={i}><div className="sk" style={bar(56, 12)}/><div className="sk" style={bar(48, 18, { borderRadius: 999 })}/></div>)}
        </div>)}
      </div>
      <div className="ws-sk-detail">
        <div className="sk" style={bar('36%', 12)}/>
        <div className="sk" style={bar('52%', 22, { marginTop: 12 })}/>
        <div className="sk" style={bar('100%', 88, { marginTop: 28 })}/>
        <div className="sk" style={bar('100%', 88, { marginTop: 16 })}/>
      </div>
    </div>
  </div>;
}

/** Generic list page: filter row and list rows. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="ws-skeleton" aria-busy="true" aria-label="正在加载">
    <div className="ws-sk-toolbar"><div className="sk" style={bar('100%', 38)}/></div>
    {Array.from({ length: rows }, (_, i) => <div className="ws-sk-card" key={i}>
      <div><div className="sk" style={bar(90, 10)}/><div className="sk" style={bar(160, 16, { marginTop: 10 })}/><div className="sk" style={bar('60%', 12, { marginTop: 10 })}/></div>
      <div className="sk" style={bar(96, 32)}/>
    </div>)}
  </div>;
}
