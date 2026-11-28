import {cookies, headers} from 'next/headers';
import {LOCALE_COOKIE, resolveLocale} from './locale';
export async function siteLocale() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, requestHeaders.get('accept-language') || '');
}
