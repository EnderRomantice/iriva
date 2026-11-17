/** First visible character of a name, upper-cased: "晨光 Household" → "晨", "daniel" → "D". */
export function avatarInitial(name: string) {
  const first = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name.trim())][0]?.segment ?? '';
  return first.toLocaleUpperCase() || '·';
}
