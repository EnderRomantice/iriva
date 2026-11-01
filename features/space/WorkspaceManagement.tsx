"use client";
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { accountRequest, type Account, type WorkspaceManagement as Management } from './account-client';

type Request = Management['requests'][number];
const statusLabels: Record<Request['status'], string> = { pending: '待审批', approved: '已批准', rejected: '已拒绝' };

/** Feedback is tied to the form that produced it, so the message appears where the person acted. */
type Notice = { scope: string; kind: 'status' | 'error'; text: string };

export function WorkspaceManagement({ account, onRefresh }: { account: Account; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<Notice>();
  const lock = useRef(false);
  const data = account.management;
  if (!data) return null;

  async function perform(scope: string, body: object, success: (result: { pending?: boolean }) => string, form?: HTMLFormElement) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice(undefined);
    try {
      const result = await accountRequest(body);
      form?.reset();
      setNotice({ scope, kind: 'status', text: success(result) });
      await onRefresh();
    } catch (e) {
      setNotice({ scope, kind: 'error', text: e instanceof Error ? e.message : '没有保存成功，请重试。' });
    } finally { lock.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>, action: string, success: (result: { pending?: boolean }) => string) {
    event.preventDefault();
    const form = event.currentTarget;
    void perform(action, { action, ...Object.fromEntries(new FormData(form)) }, success, form);
  }
  const feedback = (scope: string) => notice?.scope === scope
    ? <p className={notice.kind === 'error' ? 'sp-error' : 'sp-manage-status'} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>
    : null;

  const pending = data.requests.filter(r => r.status === 'pending');
  const handled = data.requests.filter(r => r.status !== 'pending');

  if (data.canManageHosts) return <div className="sp-manage">
    <p className="sp-manage-intro">开通 Host 后，对方会得到一个自己的小组空间；Host 申请更多小组时，在这里审批。</p>

    <Section title="待审批的开组申请" count={pending.length}>
      {pending.length ? pending.map(r => <article key={r.id} className="sp-manage-request">
        <div className="sp-manage-request-head"><strong>{r.name}</strong><span>{r.host_name} 申请</span></div>
        <p>{r.reason}</p>
        <form onSubmit={e => {
          e.preventDefault();
          const form = e.currentTarget;
          const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
          if (decision) void perform(`review:${r.id}`, { action: 'group.review', id: r.id, decision, note: new FormData(form).get('note') }, () => decision === 'approved' ? `已批准，${r.name} 小组已创建。` : '已拒绝这个申请。', form);
        }}>
          <label>给 Host 的说明（可选）<input name="note" maxLength={1000} placeholder="例如：时间段和现有小组重叠" /></label>
          <div className="sp-manage-actions"><button type="submit" value="rejected" disabled={busy}>拒绝</button><button type="submit" value="approved" className="sp-primary" disabled={busy}>批准并创建小组</button></div>
          {feedback(`review:${r.id}`)}
        </form>
      </article>) : <p className="sp-manage-empty">没有等待处理的申请。</p>}
    </Section>

    <Section title="添加 Host">
      <form className="sp-manage-inline" onSubmit={e => submit(e, 'host.add', r => r.pending ? '已添加。对方用这个邮箱首次登录时，会自动成为 Host。' : '已开通 Host。')}>
        <label>邮箱<input name="email" type="email" required maxLength={200} placeholder="host@example.com" autoComplete="off" /></label>
        <button className="sp-primary" disabled={busy}>添加 Host</button>
      </form>
      <p className="sp-manage-hint">已注册的账号立即开通；还没注册的，用这个邮箱首次登录时自动开通。</p>
      {feedback('host.add')}
    </Section>

    <Section title="已添加的 Host" count={data.grants.length}>
      {data.grants.length ? <ul className="sp-manage-list">{data.grants.map(g => <li key={g.email}><span>{g.email}</span><small data-state={g.user_id ? 'active' : 'waiting'}>{g.user_id ? '已开通' : '等待首次登录'}</small></li>)}</ul> : <p className="sp-manage-empty">还没有添加 Host。</p>}
    </Section>

    {handled.length > 0 && <Section title="已处理的申请" count={handled.length}><RequestList requests={handled} /></Section>}
  </div>;

  // Host inside their own group.
  return <div className="sp-manage">
    {data.canAddMembers && <Section title="添加成员">
      <form className="sp-manage-inline" onSubmit={e => submit(e, 'group.member.add', () => '已加入本组。')}>
        <label>成员邮箱<input name="email" type="email" required maxLength={200} placeholder="member@example.com" autoComplete="off" /></label>
        <button className="sp-primary" disabled={busy}>加入本组</button>
      </form>
      <p className="sp-manage-hint">对方需要先用这个邮箱登录过 IRIVA。</p>
      {feedback('group.member.add')}
    </Section>}

    {account.role === 'host' && <Section title="申请新小组">
      {pending.length
        ? <p className="sp-manage-hint">“{pending[0].name}”正在等待运营审批，处理后才能再次申请。</p>
        : <form className="sp-manage-form" onSubmit={e => submit(e, 'group.request', () => '已提交，等待运营审批。')}>
          <label>小组名称<input name="name" required maxLength={80} placeholder="例如：周末城市漫步" /></label>
          <label>为什么需要这个小组<textarea name="reason" required minLength={4} maxLength={1000} placeholder="想带哪些学员、什么时间、和现有小组有什么不同" /></label>
          <button className="sp-primary" disabled={busy}>提交申请</button>
        </form>}
      {feedback('group.request')}
      {data.requests.length > 0 && <RequestList requests={data.requests} />}
    </Section>}
  </div>;
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return <section className="sp-manage-section"><h2>{title}{count ? <span>{count}</span> : null}</h2>{children}</section>;
}

function RequestList({ requests }: { requests: Request[] }) {
  return <ul className="sp-manage-list">{requests.map(r => <li key={r.id}>
    <span><strong>{r.name}</strong><small>{r.host_name}</small>{r.review_note && <small>运营说明：{r.review_note}</small>}</span>
    <small data-state={r.status}>{statusLabels[r.status]}</small>
  </li>)}</ul>;
}
