// app/c/[companyId]/reports/diagnostics/page.tsx
// Diagnostics History - Simple chronological list of diagnostic runs
//
// Shows all completed and in-progress diagnostic runs for the company.
// Clean, simple list grouped by month with links to full reports.
//
// Canonical route: /c/[companyId]/reports/diagnostics

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getRecentRunsWithToolCoverage,
  getToolLabel,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { DiagnosticsHistoryClient, type DiagnosticHistoryItem } from '@/components/os/DiagnosticsHistoryClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Diagnostics History',
};

export const dynamic = 'force-dynamic';

// ============================================================================
// Helper: Generate report path from toolId
// ============================================================================

function getReportPath(toolId: DiagnosticToolId, runId: string, companyId: string): string | null {
  const slugMap: Partial<Record<DiagnosticToolId, string>> = {
    gapSnapshot: 'gap-ia',
    gapPlan: 'gap-plan',
    gapHeavy: 'gap-heavy',
    websiteLab: 'website-lab',
    brandLab: 'brand-lab',
    contentLab: 'content-lab',
    seoLab: 'seo-lab',
    demandLab: 'demand-lab',
    opsLab: 'ops-lab',
    audienceLab: 'audience',
    competitionLab: 'competition',
  };

  const slug = slugMap[toolId];
  if (!slug) return null;

  return `/c/${companyId}/diagnostics/${slug}/${runId}`;
}

// ============================================================================
// Page Component
// ============================================================================

export default async function DiagnosticsHistoryPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Load all diagnostic runs (recent runs from unified table)
  let diagnosticRuns: DiagnosticRun[] = [];
  try {
    diagnosticRuns = await getRecentRunsWithToolCoverage(companyId, 100);
  } catch (error) {
    console.error('[DiagnosticsHistory] Error loading runs:', error);
  }

  // Transform to history items
  const runs: DiagnosticHistoryItem[] = diagnosticRuns.map((run) => {
    const isComplete = run.status === 'complete' || (run.status as string) === 'completed';
    return {
      id: run.id,
      toolId: run.toolId,
      toolLabel: getToolLabel(run.toolId),
      status: isComplete ? 'complete' : run.status as 'running' | 'failed' | 'pending',
      score: run.score,
      createdAt: run.createdAt,
      reportPath: isComplete ? getReportPath(run.toolId, run.id, companyId) : null,
    };
  });

  return (
    <DiagnosticsHistoryClient
      companyId={companyId}
      runs={runs}
    />
  );
}
