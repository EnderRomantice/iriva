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
