// app/c/[companyId]/analytics/deep-dive/page.tsx
// Analytics Deep Dive - Full analytics dashboard accessed from Blueprint
//
// This page provides the complete analytics experience:
// - Full GA4 charts (traffic, engagement, conversions)
// - Search Console charts (clicks, impressions, CTR, position)
// - Funnel visualization (DMA -> GAP IA -> GAP Full)
// - AI insights with regenerate capability
// - Blueprint recommendations based on analytics

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { CompanyAnalyticsTab } from '@/components/os/CompanyAnalyticsTab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Analytics Deep Dive | ${company.name} | Hive OS`,
    description: `Detailed analytics and AI insights for ${company.name}`,
  };
}

export default async function AnalyticsDeepDivePage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/c/${companyId}/blueprint`}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          Blueprint
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-200">Analytics Deep Dive</span>
      </div>

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Analytics Deep Dive</h1>
            <p className="text-sm text-slate-400 mt-1">
              Full analytics dashboard for {company.name}
            </p>
          </div>
          <Link
            href={`/c/${companyId}/blueprint`}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Back to Blueprint
          </Link>
        </div>
      </div>

      {/* Analytics Tab Component (reused from existing) */}
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
