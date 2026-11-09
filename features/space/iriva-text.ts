export function irivaTextSegments(text: string) {
  return Array.from(new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text), (part) => part.segment);
}

export function irivaRevealDuration(text: string) {
  return Math.min(1800, Math.max(400, irivaTextSegments(text).length * 28));
}
