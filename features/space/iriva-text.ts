export function irivaDisplayText(text: string, kind: "answer" | "progress" | "error") {
  // Only tool progress gets a UI-generated icon; reply content stays untouched.
  if (kind !== "progress") return text;
  const trimmed = text.trimStart();
  // Keep an emoji chosen by the model, including flags and keycap emoji.
  if (/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u.test(trimmed)) return text;
  const emoji = /已返回结果|已完成|已保存|已更新/.test(trimmed) ? "✅"
    : /联系人|好友|备注/.test(trimmed) ? "👥"
    : /日程|日历|预约|时间安排/.test(trimmed) ? "📅"
    : /作业|练习|学习/.test(trimmed) ? "📚"
    : /报名|招生|入组/.test(trimmed) ? "📋"
    : /记忆|记住|偏好/.test(trimmed) ? "🧠"
    : /消息|聊天|通知/.test(trimmed) ? "💬"
    : /小组|成员/.test(trimmed) ? "👥"
    : "🔎";
  return `${emoji} ${text}`;
}

export function irivaTextSegments(text: string) {
  return Array.from(new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text), (part) => part.segment);
}

export function irivaRevealDuration(text: string) {
  return Math.min(1800, Math.max(400, irivaTextSegments(text).length * 28));
}
