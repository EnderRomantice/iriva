import BrandSite from '../components/brand-site';
import {siteLocale} from '../lib/site-locale';
export default async function Home() { return <BrandSite locale={await siteLocale()}/>; }
