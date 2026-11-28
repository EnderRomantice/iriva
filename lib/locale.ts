import {workspaceEnglish} from './workspace-translations';
import { english } from './translations';
export type Locale = 'zh' | 'en';
export const LOCALE_COOKIE = 'iriva_locale';
export function normalizeLocale(value?: string): Locale { return value === 'en' ? 'en' : 'zh'; }
export function translate(locale: Locale, text: string, values: Record<string, string | number> = {}) {
  const message = locale === 'en' ? english[text] ?? workspaceEnglish[text] ?? text : text;
  return message.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
export function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Explicit preference wins; browser language only chooses the interface, never a course. */
export function resolveLocale(preference?: string, acceptLanguage = ''): Locale {
  if (preference === 'zh' || preference === 'en') return preference;
  const languages = acceptLanguage.split(',').map((part, index) => {
    const [tag, ...params] = part.trim().toLowerCase().split(';');
    const quality = params.find(param => param.trim().startsWith('q='));
    return {tag: tag.split('-')[0], quality: quality ? Number(quality.trim().slice(2)) : 1, index};
  }).filter(item => Number.isFinite(item.quality) && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return languages.find(item => item.tag === 'zh' || item.tag === 'en')?.tag as Locale || 'en';
}
