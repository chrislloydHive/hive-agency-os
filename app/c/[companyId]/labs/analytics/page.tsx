// app/c/[companyId]/labs/analytics/page.tsx
// Analytics Lab page
//
// Displays comprehensive analytics from GA4, Search Console, GBP, and paid media
// with AI-powered insights and recommendations.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { AnalyticsLabContainer } from '@/components/labs/analytics';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsLabPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link href={`/c/${companyId}`} className="hover:text-slate-300 transition-colors">
              {company.name}
            </Link>
            <span>/</span>
            <Link href={`/c/${companyId}/diagnostics`} className="hover:text-slate-300 transition-colors">
              Labs
            </Link>
            <span>/</span>
            <span className="text-slate-300">Analytics</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <AnalyticsLabContainer
          companyId={companyId}
          companyName={company.name}
        />
      </div>
    </div>
  );
}
