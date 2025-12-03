// app/c/[companyId]/analytics/page.tsx
// Analytics page with view support
// - Default: redirects to deep-dive
// - ?view=media: shows Media Analytics

import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getMediaLabSummary } from '@/lib/mediaLab';
import { MediaAnalyticsTab } from '@/components/os/MediaAnalyticsTab';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CompanyAnalyticsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { view } = await searchParams;

  // If no view specified, redirect to deep-dive
  if (!view) {
    redirect(`/c/${companyId}/analytics/deep-dive`);
  }

  // Media Analytics view
  if (view === 'media') {
    const company = await getCompanyById(companyId);
    if (!company) {
      return notFound();
    }

    const mediaLabSummary = await getMediaLabSummary(companyId).catch(() => null);
    const hasMediaPlans = (mediaLabSummary?.activePlanCount || 0) > 0 || mediaLabSummary?.hasMediaProgram === true;

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
          <Link
            href={`/c/${companyId}/analytics/deep-dive`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            Analytics
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200">Media</span>
        </div>

        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-100">Media Analytics</h1>
              <p className="text-sm text-slate-400 mt-1">
                Performance and insights for {company.name}'s media program
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/c/${companyId}/analytics/deep-dive`}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Full Analytics
              </Link>
              <Link
                href={`/c/${companyId}/diagnostics/media`}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
              >
                Media Lab
              </Link>
            </div>
          </div>
        </div>

        {/* Media Analytics Tab */}
        <MediaAnalyticsTab
          companyId={companyId}
          companyName={company.name}
          hasMediaPlans={hasMediaPlans}
        />
      </div>
    );
  }

  // Unknown view, redirect to deep-dive
  redirect(`/c/${companyId}/analytics/deep-dive`);
}
