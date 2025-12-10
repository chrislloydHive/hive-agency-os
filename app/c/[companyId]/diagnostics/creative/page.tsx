// app/c/[companyId]/diagnostics/creative/page.tsx
// Creative Lab - Canonical diagnostic route
//
// Generates messaging architecture, creative territories, and campaign concepts
// using Brain-First context from the Context Graph.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadCreativeLabContext } from '@/app/c/[companyId]/labs/creative/loadCreativeLab';
import { CreativeLabClient } from '@/app/c/[companyId]/labs/creative/CreativeLabClient';
import { checkCriticalFieldsForFlow } from '@/lib/contextGraph/diagnostics';
import { LabGatingBanner } from '@/components/os/ContextHealthPanel';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function CreativeLabPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Check critical fields for Creative Lab
  const criticalCheck = await checkCriticalFieldsForFlow(companyId, 'CreativeLab');

  // Load Creative Lab context from Context Graph
  const labContext = await loadCreativeLabContext(companyId);

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
            <Link href={`/c/${companyId}/blueprint`} className="hover:text-slate-300 transition-colors">
              Diagnostics
            </Link>
            <span>/</span>
            <span className="text-slate-300">Creative Lab</span>
          </nav>
        </div>
      </div>

      {/* Gating Banner */}
      {criticalCheck.gatingLevel !== 'none' && (
        <div className="mx-auto max-w-7xl px-6 py-4">
          <LabGatingBanner
            flowId="CreativeLab"
            gatingLevel={criticalCheck.gatingLevel}
            warningMessage={criticalCheck.warningMessage}
            missingFields={criticalCheck.missingFields.map(f => ({ label: f.label, path: f.path }))}
            companyId={companyId}
          />
        </div>
      )}

      {/* Main Content - only show if not hard gated */}
      {criticalCheck.gatingLevel !== 'hard' ? (
        <CreativeLabClient
          companyId={companyId}
          companyName={company.name}
          labContext={labContext}
        />
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-12 text-center">
          <p className="text-slate-400">
            Complete the required fields in Context to use Creative Lab.
          </p>
        </div>
      )}
    </div>
  );
}
