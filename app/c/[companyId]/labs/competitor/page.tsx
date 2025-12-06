// app/c/[companyId]/labs/competitor/page.tsx
// Competitor Lab Page - Server Component
//
// Competitive analysis, positioning map, and market intelligence

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadCompetitorLabContext } from './loadCompetitorLab';
import { CompetitorLabClient } from './CompetitorLabClient';
import { checkCriticalFieldsForFlow } from '@/lib/contextGraph/diagnostics';
import { LabGatingBanner } from '@/components/os/ContextHealthPanel';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CompetitorLabPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Check critical fields
  const criticalCheck = await checkCriticalFieldsForFlow(companyId, 'BrandLab'); // Uses BrandLab check as baseline

  // Load Competitor Lab context
  const labContext = await loadCompetitorLabContext(companyId, company.name);

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            &larr; Back to Blueprint
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Competitor Lab
          </span>
        </div>
      </div>

      {/* Gating Banner */}
      {criticalCheck.gatingLevel !== 'none' && (
        <div className="mx-auto max-w-7xl px-6 py-4">
          <LabGatingBanner
            flowId="CompetitorLab"
            gatingLevel={criticalCheck.gatingLevel}
            warningMessage={criticalCheck.warningMessage}
            missingFields={criticalCheck.missingFields.map(f => ({ label: f.label, path: f.path }))}
            companyId={companyId}
          />
        </div>
      )}

      {/* Main Content */}
      {criticalCheck.gatingLevel !== 'hard' ? (
        <CompetitorLabClient
          companyId={companyId}
          companyName={company.name}
          labContext={labContext}
        />
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-12 text-center">
          <p className="text-slate-400">
            Complete the required fields in Setup to use Competitor Lab.
          </p>
        </div>
      )}
    </div>
  );
}
