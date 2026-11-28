/** Learning language is independent of the interface locale. */
export const learningLanguages = [
  { value: 'English', label: '英语', en: 'English' },
  { value: 'Chinese', label: '中文', en: 'Chinese' },
] as const;
export function isLearningLanguage(value: unknown): value is typeof learningLanguages[number]['value'] {
  return learningLanguages.some(language => language.value === value);
}
export function applicationStatus(plan: string) { return plan === 'native' ? 'new' : 'interest'; }
export function matchingLanguage(candidates: {language: unknown}[]): string | null {
  const language = candidates[0]?.language;
  return isLearningLanguage(language) && candidates.every(candidate => candidate.language === language) ? language : null;
}
