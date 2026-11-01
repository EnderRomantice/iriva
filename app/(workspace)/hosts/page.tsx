import { redirect } from 'next/navigation';
import { billingHref } from '@/features/space/billing-navigation';
export default async function HostsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  redirect(billingHref('hosts', org));
}
