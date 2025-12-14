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
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { getProgramsForCompany } from '@/lib/airtable/programs';
import { WebsiteNarrativeReport } from '@/components/website/WebsiteNarrativeReport';
import { buildWebsiteActionPlan } from '@/lib/gap-heavy/modules/websiteActionPlanBuilder';
import type { DiagnosticModuleResult } from '@/lib/gap-heavy/types';
import type {
  WebsiteUXAssessmentV4,
  WebsiteUXLabResultV4,
} from '@/lib/gap-heavy/modules/websiteLab';
import { ArrowRight, Sparkles } from 'lucide-react';

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

  // First check for standalone Website Lab run from Diagnostic Runs table
  const diagnosticRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');

  // Extract Website module result
  let websiteModuleResult: DiagnosticModuleResult | null = null;
  let labResultV4: WebsiteUXLabResultV4 | null = null;
  let assessment: WebsiteUXAssessmentV4 | null = null;
  let runId: string | null = null;

  // Check Diagnostic Runs table first (new standalone runs)
  if (diagnosticRun?.status === 'complete' && diagnosticRun.rawJson) {
    const raw = diagnosticRun.rawJson as any;
    // The rawJson from Website Lab engine is the DiagnosticModuleResult
    // which contains rawEvidence.labResultV4.siteAssessment
    // Check all possible paths where siteAssessment might be stored
    if (raw.rawEvidence?.labResultV4?.siteAssessment) {
      // Standard V4 structure from DiagnosticModuleResult
      assessment = raw.rawEvidence.labResultV4.siteAssessment as WebsiteUXAssessmentV4;
      labResultV4 = raw.rawEvidence.labResultV4 as WebsiteUXLabResultV4;
      runId = diagnosticRun.id;
      console.log('[Website Page] Found data in rawEvidence.labResultV4.siteAssessment');
    } else if (raw.siteAssessment) {
      // Direct siteAssessment (truncated format)
      assessment = raw.siteAssessment as WebsiteUXAssessmentV4;
      labResultV4 = { siteAssessment: assessment } as WebsiteUXLabResultV4;
      runId = diagnosticRun.id;
      console.log('[Website Page] Found data in siteAssessment');
    } else if (raw.rawEvidence?.siteAssessment) {
      // Alternative truncated format
      assessment = raw.rawEvidence.siteAssessment as WebsiteUXAssessmentV4;
      labResultV4 = { siteAssessment: assessment } as WebsiteUXLabResultV4;
      runId = diagnosticRun.id;
      console.log('[Website Page] Found data in rawEvidence.siteAssessment');
    } else {
      console.log('[Website Page] Diagnostic run found but no siteAssessment:', {
        runId: diagnosticRun.id,
        rawJsonKeys: Object.keys(raw),
        hasRawEvidence: !!raw.rawEvidence,
        rawEvidenceKeys: raw.rawEvidence ? Object.keys(raw.rawEvidence) : [],
      });
    }
  }

  // Fallback to Heavy GAP Runs if no standalone run found
  if (!assessment || !labResultV4) {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
    const latestHeavyRun = heavyRuns[0] || null;

    if (latestHeavyRun?.evidencePack) {
      // Check for V4 lab result
      labResultV4 = latestHeavyRun.evidencePack.websiteLabV4 || null;
      if (labResultV4) {
        assessment = labResultV4.siteAssessment;
        runId = latestHeavyRun.id;
      }

      // Also extract module result for status tracking
      const websiteModule = latestHeavyRun.evidencePack.modules?.find(
        (m) => m.module === 'website'
      );
      if (websiteModule) {
        websiteModuleResult = websiteModule;
      }
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
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
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

  // Check if Website Program already exists
  const programs = await getProgramsForCompany(companyId, 'website');
  const hasWebsiteProgram = programs.some(p => p.status !== 'archived');

  // Build action plan from lab result
  const actionPlan = buildWebsiteActionPlan(labResultV4);
  const displayUrl = company.website?.replace(/^https?:\/\//, '') || '';

  // Map to generic Action Board format
  const { mapWebsiteToActionBoard } = await import('@/lib/diagnostics/mappers/websiteMapper');
  const actionBoard = mapWebsiteToActionBoard(actionPlan, companyId, {
    labResult: labResultV4,
    companyName: company.name,
    companyUrl: displayUrl,
    runId: runId || 'unknown',
  });

  // Dynamic import of Action Board component
  const { DiagnosticActionBoard } = await import('@/components/os/diagnostics/DiagnosticActionBoard');

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Website Diagnostic Tool (Internal)
          </span>
        </div>
      </div>

      {/* PRIMARY VIEW: Action Board (Generic, Reusable) */}
      <DiagnosticActionBoard board={actionBoard} />

      {/* CTA: Create Website Program (show only if no program exists) */}
      {!hasWebsiteProgram && (
        <div className="border-t border-slate-800 bg-gradient-to-r from-amber-500/5 via-cyan-500/5 to-blue-500/5">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-slate-900/50 p-5">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-amber-500/20 p-3">
                  <Sparkles className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                      Recommended Next
                    </span>
                  </div>
                  <p className="text-lg font-medium text-white">Create Website Program</p>
                  <p className="text-sm text-slate-400">
                    Turn these findings into a prioritized execution plan
                  </p>
                </div>
              </div>
              <Link
                href={`/c/${companyId}/programs`}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400"
              >
                Go to Programs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

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
