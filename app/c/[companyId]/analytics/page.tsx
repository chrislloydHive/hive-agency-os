// app/c/[companyId]/analytics/page.tsx
// Company Analytics page - Shows GA4 + Search Console data with AI insights

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { CompanyAnalyticsTab } from '@/components/os/CompanyAnalyticsTab';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyAnalyticsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company data
  const company = await getCompanyById(companyId);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <CompanyAnalyticsTab
        companyId={companyId}
        companyName={company.name}
        ga4PropertyId={company.ga4PropertyId}
        searchConsoleSiteUrl={company.searchConsoleSiteUrl}
        analyticsBlueprint={company.analyticsBlueprint}
      />
    </div>
  );
}
