// app/os/[companyId]/diagnostics/brand/page.tsx
// Brand Lab - Brand Diagnostic Tool (Action-First View)
//
// This page displays Brand diagnostics as an action-first diagnostic tool.
// PRIMARY VIEW: What to do (Now / Next / Later)
// SECONDARY VIEW: Full narrative report (future: BrandNarrativeReport)

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { buildBrandActionPlan } from '@/lib/gap-heavy/modules/brandActionPlanBuilder';
import type { BrandLabResult } from '@/lib/gap-heavy/modules/brandLab';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function BrandDiagnosticPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch most recent Heavy Run
  const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
  const latestHeavyRun = heavyRuns[0] || null;

  // Extract Brand Lab result from evidence pack
  let brandLabResult: BrandLabResult | null = null;

  if (latestHeavyRun?.evidencePack?.brandLab) {
    brandLabResult = latestHeavyRun.evidencePack.brandLab;
  }

  // Also check for brand module results (from Heavy Worker V4)
  const brandModule = latestHeavyRun?.evidencePack?.modules?.find(
    (m: any) => m.module === 'brand'
  );

  // Debug logging
  console.log('[Brand Page] Latest run:', {
    hasRun: !!latestHeavyRun,
    hasEvidencePack: !!latestHeavyRun?.evidencePack,
    hasBrandLab: !!latestHeavyRun?.evidencePack?.brandLab,
    hasBrandModule: !!brandModule,
    brandModuleScore: brandModule?.score,
    evidencePackKeys: latestHeavyRun?.evidencePack ? Object.keys(latestHeavyRun.evidencePack) : [],
  });

  // If no Brand Lab diagnostics run yet, show runner
  // (But inform user if brand module exists)
  if (!brandLabResult) {
    // Dynamic import of client component
    const { BrandDiagnosticRunner } = await import('./BrandDiagnosticRunner');

    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="mb-6">
          <Link
            href={`/c/${companyId}/diagnostics`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Diagnostics
          </Link>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-100">
            Brand Diagnostics
          </h1>

          {/* Show info if brand module exists but not Brand Lab */}
          {brandModule && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-300 mb-1">
                    Basic Brand Module Results Available
                  </p>
                  <p className="text-xs text-blue-200/80">
                    You have brand module results (Score: {brandModule.score}/100) from Heavy Worker V4.
                    The Brand Lab below provides a more detailed, action-first diagnostic with prioritized work items.
                  </p>
                </div>
              </div>
            </div>
          )}

          <BrandDiagnosticRunner companyId={companyId} />
        </div>
      </div>
    );
  }

  // Build action plan from brand lab result
  const actionPlan = buildBrandActionPlan(brandLabResult.diagnostic);
  const displayUrl = company.website?.replace(/^https?:\/\//, '') || '';

  // Map to generic Action Board format
  const { mapBrandToActionBoard } = await import('@/lib/diagnostics/mappers/brandMapper');
  const actionBoard = mapBrandToActionBoard(actionPlan, companyId, {
    labResult: brandLabResult,
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
            href={`/c/${companyId}/diagnostics`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Diagnostics
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Brand Diagnostic Tool (Internal)
          </span>
        </div>
      </div>

      {/* PRIMARY VIEW: Action Board (Generic, Reusable) */}
      <DiagnosticActionBoard board={actionBoard} />

      {/* SECONDARY VIEW: Full Narrative Report (Future) */}
      {/* TODO: Create BrandNarrativeReport component similar to WebsiteNarrativeReport */}
    </div>
  );
}
