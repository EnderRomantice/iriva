import {notFound} from 'next/navigation';
import BrandSite from '../../../../components/brand-site';
export default async function Course({params}:{params:Promise<{language:string}>}) {
  const {language} = await params;
  if (language !== 'english' && language !== 'chinese') notFound();
  return <BrandSite locale="en" course={language}/>;
}
