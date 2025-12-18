// app/c/[companyId]/reports/page.tsx
// Reports Hub - Dashboard for Strategic Reports and Diagnostics
//
// Features a tabbed layout:
// - All: Shows both Strategic Reports and Diagnostics sections
// - Strategic: Annual Plan + QBR cards only
// - Diagnostics: Filterable table of diagnostic runs only

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestReportByType } from '@/lib/reports/store';
import {
  listDiagnosticRunsForCompany,
  getToolLabel,
  type DiagnosticRun,
} from '@/lib/os/diagnostics/runs';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import { getGapPlanRunsForCompanyOrDomain } from '@/lib/airtable/gapPlanRuns';
import { ReportsHubClient } from './ReportsHubClient';
import type { DiagnosticRunSummary } from '@/components/reports/DiagnosticsSection';

export const metadata: Metadata = {
  title: 'Reports',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Helper: Convert DiagnosticRun to DiagnosticRunSummary
// ============================================================================

function diagnosticRunToSummary(
  run: DiagnosticRun,
  companyId: string
): DiagnosticRunSummary {
  // Map status
  const statusMap: Record<string, DiagnosticRunSummary['status']> = {
    complete: 'success',
    completed: 'success',
    running: 'running',
    pending: 'pending',
    failed: 'failed',
    error: 'failed',
  };

  // Generate URL based on tool type
  // NOTE: Use kebab-case slugs (e.g., brand-lab not brand) to avoid
  // conflicts with static folders like diagnostics/brand/page.tsx
  let link: string | undefined;
  const isComplete = run.status === 'complete';
  if (isComplete) {
    switch (run.toolId) {
      case 'gapHeavy':
        link = `/c/${companyId}/diagnostics/gap-heavy/${run.id}`;
        break;
      case 'websiteLab':
        link = `/c/${companyId}/diagnostics/website-lab/${run.id}`;
        break;
      case 'brandLab':
        link = `/c/${companyId}/diagnostics/brand-lab/${run.id}`;
        break;
      case 'seoLab':
        link = `/c/${companyId}/diagnostics/seo-lab/${run.id}`;
        break;
      case 'contentLab':
        link = `/c/${companyId}/diagnostics/content-lab/${run.id}`;
        break;
      case 'gapSnapshot':
        link = `/c/${companyId}/diagnostics/gap-ia/${run.id}`;
        break;
      case 'demandLab':
        link = `/c/${companyId}/diagnostics/demand-lab/${run.id}`;
        break;
      case 'opsLab':
        link = `/c/${companyId}/diagnostics/ops-lab/${run.id}`;
        break;
      case 'creativeLab':
        link = `/c/${companyId}/labs/creative`;
        break;
      case 'competitorLab':
      case 'competitionLab':
        link = `/c/${companyId}/brain/labs/competition`;
        break;
      default:
        link = `/c/${companyId}/diagnostics/gap-heavy/${run.id}`;
    }
  }

  // Build score summary if available
  let scoreSummary: string | undefined;
  if (run.score !== null && run.score !== undefined) {
    scoreSummary = `Score: ${run.score}`;
  }

  return {
    id: run.id,
    type: getToolLabel(run.toolId),
    label: run.summary || `${getToolLabel(run.toolId)} diagnostic run`,
    createdAt: run.createdAt,
    status: statusMap[run.status] || 'pending',
    scoreSummary,
    link,
  };
}

// ============================================================================
// Page Component
// ============================================================================

export default async function ReportsPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Fetch latest reports for each type
  const [latestAnnual, latestQbr] = await Promise.all([
    getLatestReportByType(companyId, 'annual'),
    getLatestReportByType(companyId, 'qbr'),
  ]);

  const domain = company.domain || company.website || '';

  // Collect all diagnostic runs from multiple sources with deduplication
  // Use a Map to track by ID and prefer versions with more complete data
  const runMap = new Map<string, DiagnosticRunSummary>();

  // 1. Load from unified Diagnostic Runs table (primary source)
  try {
    const runs = await listDiagnosticRunsForCompany(companyId, { limit: 100 });
    for (const run of runs) {
      runMap.set(run.id, diagnosticRunToSummary(run, companyId));
    }
  } catch (error) {
    console.error('[ReportsPage] Error loading diagnostic runs:', error);
  }

  // 2. Load GAP Heavy runs (legacy) - only add if not already present
  try {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 50);
    for (const run of heavyRuns) {
      if (runMap.has(run.id)) continue;

      const modules: string[] = [];
      if (run.evidencePack?.websiteLabV4) modules.push('Website');
      if (run.evidencePack?.brandLab) modules.push('Brand');
      if (run.evidencePack?.modules?.length) {
        const completedModules = run.evidencePack.modules
          .filter((m: any) => m.status === 'completed')
          .map((m: any) => m.module);
        if (completedModules.includes('seo')) modules.push('SEO');
        if (completedModules.includes('content')) modules.push('Content');
        if (completedModules.includes('demand')) modules.push('Demand');
        if (completedModules.includes('ops')) modules.push('Ops');
      }

      runMap.set(run.id, {
        id: run.id,
        type: 'GAP Heavy',
        label: modules.length > 0
          ? `Comprehensive analysis (${modules.join(', ')})`
          : 'Comprehensive diagnostic analysis',
        createdAt: run.createdAt,
        status: run.status === 'completed' || run.status === 'paused' ? 'success'
          : run.status === 'running' ? 'running'
          : run.status === 'error' || run.status === 'cancelled' ? 'failed'
          : 'pending',
        link: `/c/${companyId}/diagnostics/gap-heavy/${run.id}`,
      });
    }
  } catch (error) {
    console.error('[ReportsPage] Error loading GAP Heavy runs:', error);
  }

  // 3. Load GAP-IA runs (legacy) - only add if not already present
  try {
    const iaRuns = await getGapIaRunsForCompanyOrDomain(companyId, domain, 50);
    for (const run of iaRuns) {
      if (runMap.has(run.id)) continue;

      const isComplete = run.status === 'completed' || run.status === 'complete';
      runMap.set(run.id, {
        id: run.id,
        type: 'GAP IA',
        label: run.core?.quickSummary || 'Quick marketing health check',
        createdAt: run.createdAt,
        status: isComplete ? 'success'
          : run.status === 'running' ? 'running'
          : run.status === 'failed' || run.status === 'error' ? 'failed'
          : 'pending',
        scoreSummary: run.overallScore ? `Score: ${run.overallScore}` : undefined,
        link: isComplete ? `/c/${companyId}/diagnostics/gap-ia/${run.id}` : undefined,
      });
    }
  } catch (error) {
    console.error('[ReportsPage] Error loading GAP-IA runs:', error);
  }

  // 4. Load GAP Plan runs (Full GAP) - only add if not already present
  try {
    const planRuns = await getGapPlanRunsForCompanyOrDomain(companyId, domain, 50);
    for (const run of planRuns) {
      if (runMap.has(run.id)) continue;

      const isComplete = run.status === 'completed';
      const scores: string[] = [];
      if (run.overallScore) scores.push(`Overall: ${run.overallScore}`);
      if (run.websiteScore) scores.push(`Website: ${run.websiteScore}`);
      if (run.brandScore) scores.push(`Brand: ${run.brandScore}`);

      runMap.set(run.id, {
        id: run.id,
        type: 'Full GAP',
        label: run.maturityStage
          ? `${run.maturityStage} maturity - comprehensive analysis`
          : 'Comprehensive marketing assessment',
        createdAt: run.createdAt,
        status: isComplete ? 'success'
          : run.status === 'processing' ? 'running'
          : run.status === 'error' ? 'failed'
          : 'pending',
        scoreSummary: scores.length > 0 ? scores.join(' / ') : undefined,
        link: isComplete ? `/c/${companyId}/diagnostics/gap-plan/${run.id}` : undefined,
      });
    }
  } catch (error) {
    console.error('[ReportsPage] Error loading GAP Plan runs:', error);
  }

  // Convert map to array
  const diagnosticRuns = Array.from(runMap.values());

  // Sort by date, newest first
  diagnosticRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <ReportsHubClient
      companyId={companyId}
      companyName={company.name}
      latestAnnual={latestAnnual}
      latestQbr={latestQbr}
      diagnosticRuns={diagnosticRuns}
    />
  );
}
