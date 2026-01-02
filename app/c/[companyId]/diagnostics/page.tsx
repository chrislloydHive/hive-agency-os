// app/c/[companyId]/diagnostics/page.tsx
// Diagnostics Control Center
//
// Clean dashboard for running GAP and Lab diagnostics.
// Shows lab grid, recent runs, and links to Review Queue.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyStrategySnapshot } from '@/lib/os/companies/strategySnapshot';
import { getRecentRunsWithToolCoverage, getToolLabel, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { DiagnosticsControlCenter } from '@/components/os/DiagnosticsControlCenter';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Diagnostics | ${company.name} | Hive OS`,
    description: `Run labs and assessments to uncover issues and opportunities for ${company.name}`,
  };
}

// Tool slug mapping for report paths
const toolIdToSlug: Record<string, string> = {
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

export default async function DiagnosticsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch data in parallel
  const [company, strategySnapshot, recentRuns] = await Promise.all([
    getCompanyById(companyId),
    getCompanyStrategySnapshot(companyId).catch(() => null),
    getRecentRunsWithToolCoverage(companyId, 10).catch(() => []),
  ]);

  if (!company) {
    notFound();
  }

  // Transform recent runs for display
  const recentDiagnostics = recentRuns.map((run: DiagnosticRun) => {
    const slug = toolIdToSlug[run.toolId] || run.toolId;
    const isComplete = run.status === 'complete' || (run.status as string) === 'completed';

    // Extract error from metadata if run failed
    let error: string | null = null;
    if (run.status === 'failed' && run.metadata) {
      error = (run.metadata as { error?: string }).error || null;
    }

    // Competition lab doesn't have per-run pages, just the main lab page
    const reportPath = isComplete
      ? run.toolId === 'competitionLab'
        ? `/c/${companyId}/diagnostics/competition`
        : `/c/${companyId}/diagnostics/${slug}/${run.id}`
      : null;

    return {
      id: run.id,
      toolId: run.toolId,
      toolLabel: getToolLabel(run.toolId),
      status: (isComplete ? 'complete' : run.status) as 'complete' | 'running' | 'failed' | 'pending',
      score: run.score,
      completedAt: isComplete ? run.updatedAt : null,
      reportPath,
      createdAt: run.createdAt,
      error,
    };
  });

  // Try to get open findings count (optional)
  let openFindingsCount = 0;
  try {
    const { getCompanyFindingsCount } = await import('@/lib/os/findings/companyFindings');
    openFindingsCount = await getCompanyFindingsCount(companyId);
  } catch {
    // Findings count not critical
  }

  return (
    <DiagnosticsControlCenter
      company={{
        id: company.id,
        name: company.name,
        website: company.website,
        domain: company.domain,
      }}
      strategySnapshot={strategySnapshot}
      recentDiagnostics={recentDiagnostics}
      openFindingsCount={openFindingsCount}
    />
  );
}
