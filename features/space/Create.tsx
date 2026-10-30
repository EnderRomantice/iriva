"use client";
import { useEffect, useRef, useState } from "react";
import type { Assignment, Snapshot } from "@/domain/models";
import { commandSchema, type Command } from "@/domain/commands";
import { workspaceScope } from "@/domain/workspace";
import { localDb, saveDraft } from "@/local/database";
import { Sheet, Empty } from "./primitives";

export type CreateKind = "practice" | "assignment" | "session" | "household";
export const createLabels: Record<CreateKind, string> = { practice: "写练习", assignment: "建立任务", session: "安排圆桌", household: "建立小组" };
interface Props {
  kind: CreateKind; data: Snapshot; householdId: string; onClose: () => void;
  openPractice: (assignment: Assignment) => void; save: (command: Command) => Promise<void>;
  onCreated: (kind: CreateKind, householdId: string) => void;
}
export function Create(props: Props) {
  if (props.kind === "practice") return <PracticePicker {...props} />;
  return <CreateForm {...props} />;
}
function PracticePicker({ data, householdId, openPractice, onClose }: Props) {
  const [group, setGroup] = useState(householdId);
  const assignments = data.assignments.filter(a => !group || a.householdId === group);
  return <Sheet title="写练习" onClose={onClose}>
    <p className="sp-caption">选择一项任务，开始写或继续本机草稿。</p>
    <label className="sp-field">小组<select value={group} onChange={e => setGroup(e.target.value)}><option value="">所有小组</option>{data.households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
    <div className="sp-list">{assignments.map(a => <button className="sp-create-task" key={a.id} onClick={() => openPractice(a)}><strong>{a.title}</strong><small>{data.households.find(h => h.id === a.householdId)?.name} / 第 {a.week} 周</small></button>)}</div>
    {!assignments.length && <Empty>Host 还没有发布任务。</Empty>}
  </Sheet>;
}
type Fields = { householdId: string; title: string; description: string; category: string; week: string; dueAt: string; startsAt: string; endsAt: string; name: string; theme: string; hostId: string; termId: string; capacity: string };
function CreateForm({ kind, data, householdId, onClose, save, onCreated }: Props) {
  const scope = workspaceScope(data.actor.role, data.actor.organizationId);
  const draftKey = `create-${kind}`;
  const [form, setForm] = useState<Fields>(() => ({ householdId: householdId || data.households[0]?.id || "", title: "", description: "", category: "prepare", week: "1", dueAt: "", startsAt: "", endsAt: "", name: "", theme: "", hostId: data.organizationMemberships.find(m => m.role === "host")?.userId || "", termId: data.terms[0]?.id || "", capacity: "4" }));
  const [identity, setIdentity] = useState(() => ({ id: crypto.randomUUID() as string, entityId: crypto.randomUUID() as string }));
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  const writes = useRef(Promise.resolve());
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    void localDb.drafts.get(`${scope}:${draftKey}`).then(draft => {
      if (!active) return;
      if (draft) {
        const value = JSON.parse(draft.body);
        if (value.form && typeof value.id === "string" && typeof value.entityId === "string") {
          setForm(previous => Object.fromEntries(Object.entries(previous).map(([key, fallback]) => [key, typeof value.form[key] === "string" ? value.form[key] : fallback])) as Fields);
          setIdentity({ id: value.id, entityId: value.entityId }); setSaved(true);
        }
      }
      setReady(true);
    }).catch(() => { if (active) setError("无法读取本机草稿，请关闭后重试。"); });
    return () => { active = false; };
  }, [scope, draftKey]);
  function change(key: keyof Fields, value: string) {
    const next = { ...form, [key]: value }, ids = { ...identity, id: crypto.randomUUID() };
    setForm(next); setIdentity(ids); setSaved(false);
    const revision = ++sequence.current;
    writes.current = writes.current.catch(() => {}).then(() => saveDraft(scope, draftKey, JSON.stringify({ ...ids, form: next })));
    void writes.current.then(() => { if (revision === sequence.current) { setSaved(true); setError(""); } }).catch(() => setError("本机草稿保存失败，请保留输入后重试。"));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await writes.current;
      const utc = (value: string) => new Date(`${value}:00+08:00`).toISOString();
      const base = { ...identity, baseVersion: 0 };
      const command = commandSchema.parse(kind === "household" ? { ...base, kind: "household.create", payload: { name: form.name, theme: form.theme, termId: form.termId, hostId: form.hostId, capacity: Number(form.capacity) } } : kind === "assignment" ? { ...base, kind: "assignment.create", payload: { householdId: form.householdId, title: form.title, description: form.description, category: form.category, week: Number(form.week), dueAt: utc(form.dueAt) } } : { ...base, kind: "session.create", payload: { householdId: form.householdId, title: form.title, description: form.description, startsAt: utc(form.startsAt), endsAt: utc(form.endsAt) } });
      await save(command);
      await localDb.drafts.delete(`${scope}:${draftKey}`);
      onCreated(kind, kind === "household" ? identity.entityId : form.householdId);
    } catch (e) { setError(e instanceof Error ? e.message : "未能建立，输入已保留。"); }
    finally { setBusy(false); }
  }
  return <Sheet title={createLabels[kind]} onClose={() => { if (!busy) onClose(); }}>
    <form className="sp-form" onSubmit={event => void submit(event)}><fieldset className="sp-create-fields" disabled={!ready || busy}>
      {kind === "household" ? <>
        <label>小组名称<input required maxLength={80} value={form.name} onChange={e => change("name", e.target.value)} /></label>
        <label>小组主题<textarea required maxLength={1000} value={form.theme} onChange={e => change("theme", e.target.value)} /></label>
        <label>学期<select required value={form.termId} onChange={e => change("termId", e.target.value)}><option value="">选择学期</option>{data.terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Host<select required value={form.hostId} onChange={e => change("hostId", e.target.value)}><option value="">选择 Host</option>{data.users.filter(u => data.organizationMemberships.some(m => m.userId === u.id && m.role === "host")).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label>学员人数上限<input required type="number" min={1} max={12} value={form.capacity} onChange={e => change("capacity", e.target.value)} /></label>
      </> : <>
        <label>小组<select required value={form.householdId} onChange={e => change("householdId", e.target.value)}><option value="">选择小组</option>{data.households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>{kind === "assignment" ? "任务名称" : "圆桌主题"}<input required maxLength={120} value={form.title} onChange={e => change("title", e.target.value)} /></label>
        <label>{kind === "assignment" ? "任务说明" : "圆桌说明"}<textarea required={kind === "assignment"} maxLength={4000} value={form.description} onChange={e => change("description", e.target.value)} /></label>
        {kind === "assignment" ? <>
          <label>类型<select value={form.category} onChange={e => change("category", e.target.value)}><option value="prepare">课前准备</option><option value="practice">日常练习</option><option value="reflect">课后回顾</option></select></label>
          <label>第几周<input type="number" required min={1} max={6} value={form.week} onChange={e => change("week", e.target.value)} /></label>
          <label>截止时间（北京时间）<input required type="datetime-local" value={form.dueAt} onInput={e => change("dueAt", e.currentTarget.value)} /></label>
        </> : <>
          <label>开始时间（北京时间）<input required type="datetime-local" value={form.startsAt} onInput={e => change("startsAt", e.currentTarget.value)} /></label>
          <label>结束时间（北京时间）<input required type="datetime-local" value={form.endsAt} onInput={e => change("endsAt", e.currentTarget.value)} /></label>
        </>}
      </>}
      <p className="sp-caption" aria-live="polite">{!ready ? "读取草稿…" : saved ? "草稿已存本机，联网后可提交。" : "填写内容会自动保存在本机。"}</p>
      <button className="sp-primary" type="submit">{busy ? "正在建立…" : createLabels[kind]}</button>
    </fieldset>{error && <p className="sp-error" role="alert">{error}</p>}</form>
  </Sheet>;
}
