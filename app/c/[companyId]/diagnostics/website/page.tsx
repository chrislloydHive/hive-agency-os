// app/c/[companyId]/diagnostics/website/page.tsx
// Website UX Diagnostics - V5 ONLY (Hard Cutover)
//
// ============================================================================
// HARD CUTOVER: Website Lab V5 is the ONLY authoritative source
// ============================================================================
//
// V4 fallback is REMOVED. If V5 data is missing, we show an error state
// prompting the user to re-run the diagnostic.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { getLatestRunForCompanyAndTool, getDiagnosticRun } from '@/lib/os/diagnostics/runs';
// NOTE: WebsiteNarrativeReport and buildWebsiteActionPlan removed - V5 only (hard cutover)
import { V5ResultsPanel, type V5DiagnosticData } from '@/components/website/v5';
import type { DiagnosticModuleResult } from '@/lib/gap-heavy/types';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ runId?: string }>;
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

export default async function WebsiteDetailPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { runId: requestedRunId } = await searchParams;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch the specific run if runId is provided, otherwise get the latest run
  let diagnosticRun = null;
  if (requestedRunId) {
    console.log('[Website Page] Fetching specific run:', requestedRunId);
    diagnosticRun = await getDiagnosticRun(requestedRunId);
    if (!diagnosticRun) {
      console.warn('[Website Page] Requested run not found, falling back to latest');
    }
  }

  // Fall back to latest run if no specific run or not found
  if (!diagnosticRun) {
    diagnosticRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
  }

  // ============================================================================
  // V5 EXTRACTION - The ONLY authoritative source (hard cutover)
  // ============================================================================
  let websiteModuleResult: DiagnosticModuleResult | null = null;
  let v5Diagnostic: V5DiagnosticOutput | null = null;
  let runId: string | null = null;
  let pagesAnalyzed = 0;

  // Check Diagnostic Runs table first (new standalone runs)
  if (diagnosticRun?.status === 'complete' && diagnosticRun.rawJson) {
    const raw = diagnosticRun.rawJson as Record<string, unknown>;
    runId = diagnosticRun.id;

    // Extract V5 diagnostic - the ONLY path
    v5Diagnostic = extractV5Diagnostic(raw);

    // Extract pages analyzed count from siteGraph
    if (raw.rawEvidence && typeof raw.rawEvidence === 'object') {
      const rawEvidence = raw.rawEvidence as Record<string, unknown>;
      if (rawEvidence.labResultV4 && typeof rawEvidence.labResultV4 === 'object') {
        const labResultV4 = rawEvidence.labResultV4 as WebsiteUXLabResultV4;
        pagesAnalyzed = labResultV4.siteGraph?.pages?.length || 0;
      }
    }

    // HARD CUTOVER: V5 is MANDATORY
    if (!v5Diagnostic && pagesAnalyzed > 0) {
      console.error('[Website Page] V5_MISSING: V5 diagnostic is REQUIRED', {
        runId,
        companyId,
        pagesAnalyzed,
        rawJsonKeys: Object.keys(raw),
      });
    }
  }

  // Fallback to Heavy GAP Runs - V5 only
  if (!v5Diagnostic) {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
    const latestHeavyRun = heavyRuns[0] || null;

    if (latestHeavyRun?.evidencePack) {
      const labResultV4 = latestHeavyRun.evidencePack.websiteLabV4 || null;
      if (labResultV4) {
        runId = latestHeavyRun.id;
        pagesAnalyzed = labResultV4.siteGraph?.pages?.length || 0;

        // Check for V5 in the lab result - the ONLY path
        if (labResultV4.v5Diagnostic) {
          v5Diagnostic = labResultV4.v5Diagnostic as unknown as V5DiagnosticOutput;
        }
      }

      // Extract module result for status tracking
      const websiteModule = latestHeavyRun.evidencePack.modules?.find(
        (m) => m.module === 'website'
      );
      if (websiteModule) {
        websiteModuleResult = websiteModule;
      }
    }
  }

  // If no Website diagnostics run yet, show runner
  if (!v5Diagnostic && !diagnosticRun) {
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
  // V5 MISSING ERROR STATE (hard cutover - no V4 fallback)
  // ============================================================================
  if (!v5Diagnostic) {
    console.error('[Website Page] [WebsiteLab] V5 canonical path active - V5 MISSING', {
      runId,
      companyId,
      pagesAnalyzed,
      hasRun: !!diagnosticRun,
    });

    // Dynamic import of runner
    const { WebsiteDiagnosticRunner } = await import('@/components/website/WebsiteDiagnosticRunner');

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
            <span className="text-xs font-medium text-red-400/80 bg-red-500/10 px-2 py-1 rounded">
              V5 Required
            </span>
          </div>
        </div>

        {/* V5 Missing Error Banner */}
        <div className="bg-red-500/10 border-b border-red-500/20">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <p className="text-sm text-red-300 font-medium">
              Website Lab V5 data is required but missing.
            </p>
            <p className="text-sm text-red-300/70 mt-1">
              This diagnostic was run before the V5 cutover. Please run a new diagnostic to generate V5 results.
            </p>
          </div>
        </div>

        {/* Re-run prompt */}
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-100">
              Website UX Diagnostics
            </h1>
            <WebsiteDiagnosticRunner
              companyId={companyId}
              initialStatus="not_started"
            />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // V5 VIEW (the ONLY view)
  // ============================================================================
  console.log('[Website Page] [WebsiteLab] V5 canonical path active', {
    runId,
    companyId,
    score: v5Diagnostic.score,
    blockingIssuesCount: v5Diagnostic.blockingIssues?.length || 0,
    quickWinsCount: v5Diagnostic.quickWins?.length || 0,
    pagesAnalyzed,
  });

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
          <span className="text-xs font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded">
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
    </div>
  );
}
