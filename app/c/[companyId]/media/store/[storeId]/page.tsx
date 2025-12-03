// app/c/[companyId]/media/store/[storeId]/page.tsx
// Store-level drilldown page for Media Analytics

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getStoreAnalyticsDetail } from '@/lib/mediaLab/storeAnalytics';
import { StoreDetailClient } from './StoreDetailClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string; storeId: string }>;
};

export default async function StoreDetailPage({ params }: PageProps) {
  const { companyId, storeId } = await params;

  const [company, storeAnalytics] = await Promise.all([
    getCompanyById(companyId),
    getStoreAnalyticsDetail(companyId, storeId),
  ]);

  if (!company) {
    return notFound();
  }

  if (!storeAnalytics) {
    return notFound();
  }

  return (
    <StoreDetailClient
      companyId={companyId}
      companyName={company.name}
      storeAnalytics={storeAnalytics}
    />
  );
}
