// app/os/[companyId]/diagnostics/website/page.tsx
// Website UX Diagnostics - Action-First View
//
// This page displays Website diagnostics as an action-first diagnostic tool.
// PRIMARY VIEW: What to do (Now / Next / Later)
// SECONDARY VIEW: Full narrative report (collapsible)

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { WebsiteNarrativeReport } from '@/components/website/WebsiteNarrativeReport';
import { buildWebsiteActionPlan } from '@/lib/gap-heavy/modules/websiteActionPlanBuilder';
import type { DiagnosticModuleResult } from '@/lib/gap-heavy/types';
import type {
  WebsiteUXAssessmentV4,
  WebsiteUXLabResultV4,
} from '@/lib/gap-heavy/modules/websiteLab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function WebsiteDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch most recent Heavy Run
  const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
  const latestHeavyRun = heavyRuns[0] || null;

  // Extract Website module result
  let websiteModuleResult: DiagnosticModuleResult | null = null;
  let labResultV4: WebsiteUXLabResultV4 | null = null;
  let assessment: WebsiteUXAssessmentV4 | null = null;

  if (latestHeavyRun?.evidencePack) {
    // Check for V4 lab result
    labResultV4 = latestHeavyRun.evidencePack.websiteLabV4 || null;
    if (labResultV4) {
      assessment = labResultV4.siteAssessment;
    }

    // Also extract module result for status tracking
    const websiteModule = latestHeavyRun.evidencePack.modules?.find(
      (m) => m.module === 'website'
    );
    if (websiteModule) {
      websiteModuleResult = websiteModule;
    }
  }

  // If no Website diagnostics run yet, show runner
  if (!assessment || !labResultV4) {
    // Dynamic import of client component
    const { WebsiteDiagnosticRunner } = await import('@/components/website/WebsiteDiagnosticRunner');

    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="mb-6">
          <Link
            href={`/os/${companyId}/diagnostics`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Diagnostics
          </Link>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-100">
            Website UX Diagnostics
          </h1>
          <WebsiteDiagnosticRunner
            companyId={companyId}
            initialStatus={websiteModuleResult?.status === 'running' ? 'running' : 'not_started'}
          />
        </div>
      </div>
    );
  }

  // Build action plan from lab result
  const actionPlan = buildWebsiteActionPlan(labResultV4);
  const displayUrl = company.website?.replace(/^https?:\/\//, '') || '';

  // Map to generic Action Board format
  const { mapWebsiteToActionBoard } = await import('@/lib/diagnostics/mappers/websiteMapper');
  const actionBoard = mapWebsiteToActionBoard(actionPlan, companyId, {
    labResult: labResultV4,
    companyName: company.name,
    companyUrl: displayUrl,
    runId: latestHeavyRun.id,
  });

  // Dynamic import of Action Board component
  const { DiagnosticActionBoard } = await import('@/components/os/diagnostics/DiagnosticActionBoard');

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/os/${companyId}/diagnostics`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Diagnostics
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Website Diagnostic Tool (Internal)
          </span>
        </div>
      </div>

      {/* PRIMARY VIEW: Action Board (Generic, Reusable) */}
      <DiagnosticActionBoard board={actionBoard} />

      {/* SECONDARY VIEW: Full Narrative Report (Collapsible) */}
      <div className="border-t border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  View Full Narrative Report
                </h2>
                <span className="text-sm text-slate-500">(Supporting Context)</span>
              </div>
            </summary>
            <div className="mt-6">
              <WebsiteNarrativeReport
                assessment={assessment}
                labResult={labResultV4}
                companyName={company.name}
                companyUrl={displayUrl}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
