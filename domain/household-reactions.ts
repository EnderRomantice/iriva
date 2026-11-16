/** Emoji reactions on Household group messages. */
export interface MessageReaction { emoji: string; users: string[] }

/** Distinct emoji a single message may carry (Slack uses a similar cap). */
export const maxReactionKinds = 24;

const graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Accept exactly one emoji grapheme: pictographs, ZWJ sequences, flags, keycaps and skin-tone variants. */
export function isReactionEmoji(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 32) return false;
  if (graphemes && [...graphemes.segment(value)].length !== 1) return false;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(value);
}

/**
 * One spelling per emoji so "👍" and "👍\uFE0F" share a pill: drop VS16 when the base already
 * renders as emoji, add it when a lone pictograph would otherwise render as text (e.g. "❤").
 */
export function canonicalEmoji(value: string) {
  if (/^\p{Emoji_Presentation}\uFE0F$/u.test(value)) return value.slice(0, -1);
  if (/^\p{Extended_Pictographic}$/u.test(value) && !/^\p{Emoji_Presentation}$/u.test(value)) return `${value}\uFE0F`;
  return value;
}

/** Group raw rows (ordered oldest first) into per-message reactions, keeping first-use order like Slack. */
export function groupReactions(rows: { message: string; emoji: string; user: string }[]) {
  const byMessage = new Map<string, MessageReaction[]>();
  for (const row of rows) {
    const list = byMessage.get(row.message) ?? [];
    const entry = list.find(r => r.emoji === row.emoji);
    if (entry) { if (!entry.users.includes(row.user)) entry.users.push(row.user); }
    else list.push({ emoji: row.emoji, users: [row.user] });
    byMessage.set(row.message, list);
  }
  return byMessage;
}

/** Apply one user's toggle to a reaction list without mutating it (used for optimistic updates). */
export function toggleReaction(list: MessageReaction[], emoji: string, user: string, on: boolean): MessageReaction[] {
  const has = list.some(r => r.emoji === emoji);
  if (on && !has) return [...list, { emoji, users: [user] }];
  return list
    .map(r => r.emoji !== emoji ? r : { ...r, users: on ? (r.users.includes(user) ? r.users : [...r.users, user]) : r.users.filter(u => u !== user) })
    .filter(r => r.users.length > 0);
}
