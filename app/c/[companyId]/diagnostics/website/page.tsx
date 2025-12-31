// app/c/[companyId]/diagnostics/website/page.tsx
// Website UX Diagnostics - V5 Primary, V4 Fallback
//
// PRIMARY VIEW: V5 Results (Page Observations, Persona Journeys, Blocking Issues, etc.)
// FALLBACK VIEW: V4 Action Board (only when V5 is not available)

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { WebsiteNarrativeReport } from '@/components/website/WebsiteNarrativeReport';
import { buildWebsiteActionPlan } from '@/lib/gap-heavy/modules/websiteActionPlanBuilder';
import { V5ResultsPanel, type V5DiagnosticData } from '@/components/website/v5';
import type { DiagnosticModuleResult } from '@/lib/gap-heavy/types';
import type {
  WebsiteUXAssessmentV4,
  WebsiteUXLabResultV4,
} from '@/lib/gap-heavy/modules/websiteLab';
import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

// ============================================================================
// V5 DATA EXTRACTION
// ============================================================================

/**
 * Extract V5 diagnostic data from various possible locations in raw data
 */
function extractV5Diagnostic(raw: Record<string, unknown>): V5DiagnosticOutput | null {
  // Path 1: Direct v5Diagnostic in rawEvidence.labResultV4
  if (raw.rawEvidence && typeof raw.rawEvidence === 'object') {
    const rawEvidence = raw.rawEvidence as Record<string, unknown>;
    if (rawEvidence.labResultV4 && typeof rawEvidence.labResultV4 === 'object') {
      const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
      if (labResult.v5Diagnostic) {
        console.log('[Website Page] Found v5Diagnostic in rawEvidence.labResultV4');
        return labResult.v5Diagnostic as V5DiagnosticOutput;
      }
    }
  }

  // Path 2: Direct v5Diagnostic at root (some serialization formats)
  if (raw.v5Diagnostic) {
    console.log('[Website Page] Found v5Diagnostic at root');
    return raw.v5Diagnostic as V5DiagnosticOutput;
  }

  // Path 3: In siteGraph (unlikely but check)
  if (raw.siteGraph && typeof raw.siteGraph === 'object') {
    const siteGraph = raw.siteGraph as Record<string, unknown>;
    if (siteGraph.v5Diagnostic) {
      console.log('[Website Page] Found v5Diagnostic in siteGraph');
      return siteGraph.v5Diagnostic as V5DiagnosticOutput;
    }
  }

  return null;
}

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
  let v5Diagnostic: V5DiagnosticOutput | null = null;
  let runId: string | null = null;
  let pagesAnalyzed = 0;

  // Check Diagnostic Runs table first (new standalone runs)
  if (diagnosticRun?.status === 'complete' && diagnosticRun.rawJson) {
    const raw = diagnosticRun.rawJson as Record<string, unknown>;
    runId = diagnosticRun.id;

    // Extract V5 diagnostic first (preferred)
    v5Diagnostic = extractV5Diagnostic(raw);

    // Also extract V4 data for fallback
    if (raw.rawEvidence && typeof raw.rawEvidence === 'object') {
      const rawEvidence = raw.rawEvidence as Record<string, unknown>;
      if (rawEvidence.labResultV4 && typeof rawEvidence.labResultV4 === 'object') {
        labResultV4 = rawEvidence.labResultV4 as WebsiteUXLabResultV4;
        assessment = labResultV4.siteAssessment;
        pagesAnalyzed = labResultV4.siteGraph?.pages?.length || 0;
        console.log('[Website Page] Found V4 data in rawEvidence.labResultV4');
      }
    }

    // Fallback paths for V4 assessment
    if (!assessment) {
      if (raw.siteAssessment) {
        assessment = raw.siteAssessment as WebsiteUXAssessmentV4;
        labResultV4 = { siteAssessment: assessment } as WebsiteUXLabResultV4;
      } else if (raw.rawEvidence && typeof raw.rawEvidence === 'object') {
        const rawEvidence = raw.rawEvidence as Record<string, unknown>;
        if (rawEvidence.siteAssessment) {
          assessment = rawEvidence.siteAssessment as WebsiteUXAssessmentV4;
          labResultV4 = { siteAssessment: assessment } as WebsiteUXLabResultV4;
        }
      }
    }

    // V5 GUARD: Log ERROR if V5 is missing when pages were analyzed
    if (!v5Diagnostic && pagesAnalyzed > 0) {
      console.error('[Website Page] ERROR: V5 diagnostic missing despite pages analyzed', {
        runId,
        companyId,
        pagesAnalyzed,
        hasV4: !!assessment,
        rawJsonKeys: Object.keys(raw),
      });
    }
  }

  // Fallback to Heavy GAP Runs if no standalone run found
  if (!assessment && !labResultV4 && !v5Diagnostic) {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
    const latestHeavyRun = heavyRuns[0] || null;

    if (latestHeavyRun?.evidencePack) {
      // Check for V4 lab result
      labResultV4 = latestHeavyRun.evidencePack.websiteLabV4 || null;
      if (labResultV4) {
        assessment = labResultV4.siteAssessment;
        runId = latestHeavyRun.id;
        pagesAnalyzed = labResultV4.siteGraph?.pages?.length || 0;

        // Check for V5 in the lab result
        if (labResultV4.v5Diagnostic) {
          v5Diagnostic = labResultV4.v5Diagnostic as unknown as V5DiagnosticOutput;
        }
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
  if (!assessment && !labResultV4 && !v5Diagnostic) {
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

  const displayUrl = company.website?.replace(/^https?:\/\//, '') || '';

  // ============================================================================
  // V5 PRIMARY VIEW
  // ============================================================================
  if (v5Diagnostic) {
    // Map V5DiagnosticOutput to V5DiagnosticData for component
    const v5Data: V5DiagnosticData = {
      observations: v5Diagnostic.observations,
      personaJourneys: v5Diagnostic.personaJourneys,
      blockingIssues: v5Diagnostic.blockingIssues,
      quickWins: v5Diagnostic.quickWins,
      structuralChanges: v5Diagnostic.structuralChanges,
      score: v5Diagnostic.score,
      scoreJustification: v5Diagnostic.scoreJustification,
    };

    return (
      <div className="min-h-screen bg-[#050509]">
        {/* Header Navigation */}
        <div className="border-b border-slate-800 bg-slate-900/50">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/c/${companyId}/blueprint`}
                className="text-sm text-slate-400 hover:text-slate-300"
              >
                ← Back to Blueprint
              </Link>
              <span className="text-slate-600">|</span>
              <span className="text-sm text-slate-500">{displayUrl}</span>
            </div>
            <span className="text-xs font-medium text-amber-400/80 bg-amber-500/10 px-2 py-1 rounded">
              V5 Diagnostic
            </span>
          </div>
        </div>

        {/* V5 Results Panel */}
        <div className="mx-auto max-w-7xl px-6 py-8">
          <V5ResultsPanel
            data={v5Data}
            companyId={companyId}
            runId={runId || undefined}
          />
        </div>

        {/* SECONDARY VIEW: Full Narrative Report (Collapsible) - if V4 data available */}
        {assessment && labResultV4 && (
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
                    <span className="text-sm text-slate-500">(Legacy V4 Output)</span>
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
        )}
      </div>
    );
  }

  // ============================================================================
  // V4 FALLBACK VIEW (when V5 is not available)
  // ============================================================================

  // Build action plan from lab result
  const actionPlan = buildWebsiteActionPlan(labResultV4!);

  // Map to generic Action Board format
  const { mapWebsiteToActionBoard } = await import('@/lib/diagnostics/mappers/websiteMapper');
  const actionBoard = mapWebsiteToActionBoard(actionPlan, companyId, {
    labResult: labResultV4!,
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
            Website Diagnostic Tool (Legacy V4)
          </span>
        </div>
      </div>

      {/* V5 Unavailable Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <p className="text-sm text-amber-300">
            V5 diagnostic data unavailable for this run. Showing legacy V4 output.
            <Link href={`/c/${companyId}/diagnostics/website`} className="underline ml-2">
              Run a new diagnostic
            </Link> to get V5 results.
          </p>
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
                assessment={assessment!}
                labResult={labResultV4!}
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
