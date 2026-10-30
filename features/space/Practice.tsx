"use client";
import { useEffect, useRef, useState } from "react";
import type { Assignment, Role, Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import { localDb, saveDraft } from "@/local/database";
import { workspaceScope } from "@/domain/workspace";
import { Avatar } from "./primitives";

interface Props { data: Snapshot; role: Role; assignment: Assignment; submissionId?: string; mutate: (command: Command) => Promise<void>; onSaved: () => void; notify: (message: string) => void }
export function Practice({ data, role, assignment, submissionId, mutate, onSaved, notify }: Props) {
  const host = role === "host";
  const scope = workspaceScope(role, data.actor.organizationId);
  const submission = submissionId ? data.submissions.find(s => s.id === submissionId) : data.submissions.find(s => s.assignmentId === assignment.id && s.learnerId === data.actor.userId);
  const feedback = data.feedback.find(f => f.submissionId === submission?.id);
  const existing = host ? feedback : submission;
  const key = host ? `feedback-${submissionId}` : `assignment-${assignment.id}`;
  const [id, setId] = useState(() => existing?.id || crypto.randomUUID());
  const [version, setVersion] = useState(existing?.version ?? 0);
  const [body, setBody] = useState(existing?.body || "");
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const writes = useRef(Promise.resolve());
  const editSequence = useRef(0);
  useEffect(() => {
    let active = true;
    void localDb.drafts.get(`${scope}:${key}`).then(draft => {
      if (!active) return;
      if (draft) { try { const value = JSON.parse(draft.body); setBody(value.body); if (typeof value.baseVersion === "number") setVersion(value.baseVersion); if (!existing && value.id) setId(value.id); } catch { setBody(draft.body); } setSaved(true); }
      setReady(true);
    }).catch(() => { if (active) setError("无法读取本机草稿，请检查浏览器存储权限后重新打开。"); });
    return () => { active = false; };
    // An open editor owns its revision. Polling must not replace the draft or base version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, key]);
  const change = (value: string) => {
    setBody(value); setSaved(false); const sequence = ++editSequence.current;
    writes.current = writes.current.catch(() => {}).then(() => saveDraft(scope, key, JSON.stringify({ id, body: value, baseVersion: version })));
    void writes.current.then(() => { if (editSequence.current === sequence) { setSaved(true); setError(""); } }).catch(() => setError("本机保存失败，请复制你的内容后重试。"));
  };
  const submit = async (publish: boolean) => {
    setBusy(true); setError("");
    try {
      await writes.current;
      if (!publish && (existing?.status === "submitted" || existing?.status === "published")) {
        await saveDraft(scope, key, JSON.stringify({ id, body, baseVersion: version }));
        setSaved(true); notify("修改已存为本机草稿。"); return;
      }
      const base = { id: crypto.randomUUID(), entityId: id, baseVersion: version };
      const command: Command = host
        ? { ...base, kind: "feedback.save", payload: { submissionId: submission!.id, body, status: publish ? "published" : "draft" } }
        : { ...base, kind: "submission.save", payload: { assignmentId: assignment.id, body, completed: publish || submission?.completed || false, status: publish ? "submitted" : "draft" } };
      await mutate(command);
      await localDb.drafts.delete(`${scope}:${key}`);
      notify(publish ? "已存本机，同步后送达。" : "草稿已加入同步队列。");
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "无法保存，请重试。"); }
    finally { setBusy(false); }
  };
  const author = data.users.find(u => u.id === (host ? submission?.learnerId : data.households.find(h => h.id === assignment.householdId)?.hostId));
  return <section className="sp-practice">
    <div className="sp-practice-context"><p>{host ? "学员提交" : `第 ${assignment.week} 周练习`}</p><h3>{assignment.title}</h3><p>{assignment.description}</p></div>
    {host && <blockquote className="sp-response"><div className="sp-person"><Avatar user={author} /><strong>{author?.name}</strong></div><p>{submission?.body}</p></blockquote>}
    <form className="sp-composer" onSubmit={event => { event.preventDefault(); void submit(true); }}>
      <label htmlFor={`body-${assignment.id}`}>{host ? "给学员的反馈" : "我的练习"}</label>
      <textarea id={`body-${assignment.id}`} value={body} onChange={event => change(event.target.value)} disabled={!ready || busy} maxLength={12000} placeholder={host ? "告诉对方做得好的地方，再给一个具体建议。" : "从一句话开始…"} />
      <div className="sp-composer-footer"><span aria-live="polite">{!ready ? "读取草稿…" : saved ? "已存本机" : "支持离线编辑"}</span><button type="button" disabled={!ready || busy} onClick={() => void submit(false)}>存草稿</button><button className="sp-primary" disabled={!ready || busy || !body.trim()}>{busy ? "保存中…" : host ? "发布反馈" : "提交练习"}</button></div>
    </form>
    {error && <p className="sp-error" role="alert">{error}</p>}
    {!host && feedback?.status === "published" && <div className="sp-response"><div className="sp-person"><Avatar user={author} /><strong>{author?.name}</strong><small>Host 反馈</small></div><p>{feedback.body}</p></div>}
  </section>;
}
