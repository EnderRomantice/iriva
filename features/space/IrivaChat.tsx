"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookmarkCheck, Sparkles } from "lucide-react";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import type { Role } from "@/domain/models";
import { irivaRevealDuration, irivaTextSegments } from "./iriva-text";
import "./iriva.css";

type Entry = { kind: "user" | "answer" | "progress" | "memory" | "error"; text: string; revealAt?: number };
// Only entries received in this mounted conversation carry a reveal time.
function IrivaText({ entry }: { entry: Entry }) {
  const text = entry.text;
  const [visible, setVisible] = useState(entry.revealAt === undefined ? text : "");
  const [started, setStarted] = useState(entry.revealAt === undefined);
  useEffect(() => {
    if (entry.revealAt === undefined) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const segments = irivaTextSegments(text);
    const duration = irivaRevealDuration(text);
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      setStarted(true);
      setVisible(text);
    };
    const tick = (now: number) => {
      if (motion.matches) { finish(); return; }
      const elapsed = now - entry.revealAt!;
      if (elapsed >= 0) {
        setStarted(true);
        const count = Math.min(segments.length, Math.ceil(segments.length * elapsed / duration));
        setVisible(segments.slice(0, count).join(""));
      }
      if (elapsed < duration) frame = requestAnimationFrame(tick);
    };
    const onMotionChange = () => { if (motion.matches) finish(); };
    motion.addEventListener("change", onMotionChange);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [entry.revealAt, text]);
  return (
    <div hidden={!started} className={`iriva-entry iriva-${entry.kind}${entry.revealAt === undefined ? "" : ` t-stagger${started ? " is-shown" : ""}`}`}>
      {entry.kind === "answer" && <strong>Iriva</strong>}
      {/* Announce each complete message once, rather than every revealed character. */}
      <span className="iriva-sr-only">{text}</span>
      <span aria-hidden="true" className={entry.revealAt === undefined ? undefined : "t-stagger-line"}>{visible}</span>
    </div>
  );
}

const prompts = {
  learn: ["我接下来有什么日程？", "有哪些作业还没完成？", "查看我的好友"],
  host: ["查看我负责的小组", "汇总学生的作业提交情况", "我接下来有什么日程？"],
  ops: ["汇总当前报名情况", "查看各小组的入组名单", "查看工作区日程"],
};

export function IrivaChat({
  role,
  organizationId,
  accountId,
  offline,
  onChange,
}: {
  role: Role;
  organizationId: string;
  accountId?: string;
  offline: boolean;
  onChange: () => void;
}) {
  const key = JSON.stringify(["iriva-chat", role, organizationId, accountId]);
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "[]").filter(
        (e: Entry) => e && typeof e.text === "string",
      ).map(({ kind, text }: Entry) => ({ kind, text }));
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const revealUntil = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(entries.slice(-160).map(({ kind, text }) => ({ kind, text }))));
    } catch {}
  }, [key, entries]);
  async function send() {
    const message = draft.trim();
    if (!message || active.current || offline) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    const append = (entry: Entry) => {
      if (entry.kind === "progress" || entry.kind === "answer" || entry.kind === "error") {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const revealAt = reducedMotion ? performance.now() : Math.max(performance.now(), revealUntil.current);
        revealUntil.current = reducedMotion ? revealAt : revealAt + irivaRevealDuration(entry.text) + 80;
        entry = { ...entry, revealAt };
      }
      setEntries((previous) => [...previous, entry]);
    };
    append({ kind: "user", text: message });
    setDraft("");
    let finished = false;
    try {
      const history = entries
        .filter((e) => e.kind === "user" || e.kind === "answer")
        .slice(-12)
        .map((e) => ({
          role: e.kind === "user" ? "user" : "assistant",
          text: e.text.slice(0, 8000),
        }));
      const res = await fetch("/api/iriva", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": organizationId,
          ...(accountId ? { "x-account-id": accountId } : { "x-demo-role": role }),
        },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "无法连接 Iriva。");
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = (buffer + value).split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          const entry: Entry = JSON.parse(line);
          append(entry);
          if (entry.kind === "answer" || entry.kind === "error") finished = true;
        }
      }
      if (!finished) throw new Error("连接中断，请核对操作进度。");
    } catch (e) {
      if (!controller.signal.aborted) {
        append({ kind: "error", text: e instanceof Error ? e.message : "无法连接 Iriva。" });
        setDraft((previous) => previous || message);
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        onChange();
      }
    }
  }
  return (
    <section className="iriva-chat" aria-label="Iriva 对话">
      {!entries.length ? (
        <div className="iriva-welcome">
          <Sparkles aria-hidden />
          <h2>想让 Iriva 帮你做什么？</h2>
          <div>
            {prompts[role].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setDraft(p);
                  input.current?.focus();
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Conversation className="iriva-log" aria-label="对话记录">
          <ConversationContent className="iriva-entries" scrollClassName="iriva-scroll">
            {entries.map((e, i) => (
              e.kind === "progress" || e.kind === "answer" || e.kind === "error" ? (
                <IrivaText key={i} entry={e} />
              ) : <div key={i} className={"iriva-entry iriva-" + e.kind}>
                {e.kind === "memory" ? (
                  <details>
                    <summary>
                      <BookmarkCheck /> 个人记忆已更新
                    </summary>
                    <p>{e.text}</p>
                  </details>
                ) : (
                  e.text
                )}
              </div>
            ))}
            {busy && <small role="status">Iriva 处理中…</small>}
          </ConversationContent>
        </Conversation>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="iriva-composer"
      >
        <textarea
          ref={input}
          rows={2}
          maxLength={4000}
          aria-label="给 Iriva 发消息"
          placeholder={offline ? "恢复网络后即可继续对话" : "给 Iriva 发消息…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" aria-label="发送消息" disabled={busy || offline || !draft.trim()}>
          <ArrowUp />
        </button>
      </form>
    </section>
  );
}
