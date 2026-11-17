'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import LanguageNav from './language-nav';
import { persistLocale, translate, type Locale } from '../lib/locale';
const LocaleContext = createContext<{locale:Locale; setLocale:(locale:Locale)=>void}>({locale:'zh',setLocale:()=>{}});
export function LocaleProvider({initialLocale,children}:{initialLocale:Locale;children:ReactNode}) {
  const [locale,setLocale]=useState(initialLocale);
  useEffect(()=>{document.documentElement.lang=locale==='en'?'en':'zh-CN';},[locale]);
  return <LocaleContext.Provider value={{locale,setLocale(next){persistLocale(next);setLocale(next);}}}>{children}</LocaleContext.Provider>;
}
export function useLocale(){const context=useContext(LocaleContext);return {...context,t:(text:string,values?:Record<string,string|number>)=>translate(context.locale,text,values)};}
export function LocaleSwitcher({children}:{children?:ReactNode}){const {locale,setLocale}=useLocale();return <LanguageNav lang={locale} onChange={setLocale}>{children??<span>{locale==='en'?'English':'简体中文'}</span>}</LanguageNav>;}
