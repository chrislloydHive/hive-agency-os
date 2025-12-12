// app/c/[companyId]/media/qbr/page.tsx
// Media QBR Generator Page
//
// Allows users to generate AI-powered quarterly business reviews
// for media programs.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getAnalyticsSnapshot } from '@/lib/analytics/getAnalyticsSnapshot';
import { MediaQbrClient } from './MediaQbrClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function MediaQbrPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Check if company has media program
  const hasMediaProgram = companyHasMediaProgram(company);

  // Fetch analytics snapshot for AnalyticsQbrSection
  const analyticsResult = await getAnalyticsSnapshot({
    companyId,
    range: '28d',
    includeTrends: false,
  }).catch(() => ({ snapshot: null, trends: null }));

  const analyticsSnapshot = analyticsResult.snapshot;
  const hasAnalytics = analyticsSnapshot
    ? analyticsSnapshot.hasGa4 || analyticsSnapshot.hasGsc || analyticsSnapshot.hasGbp || analyticsSnapshot.hasMedia
    : false;

  return (
    <div className="space-y-6">
      <MediaQbrClient
        companyId={companyId}
        companyName={company.name}
        hasMediaProgram={hasMediaProgram}
        hasAnalytics={hasAnalytics}
        analyticsSnapshot={analyticsSnapshot ?? undefined}
      />
    </div>
  );
}
