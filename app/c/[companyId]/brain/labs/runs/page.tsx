// app/c/[companyId]/brain/labs/runs/page.tsx
// Lab Runs History - Diagnostic reports and documents
//
// Part of Labs under the Brain 4-tab IA. Shows all diagnostic runs,
// reports, and uploaded documents for the company.
//
// Canonical route: /c/[companyId]/brain/labs/runs
// Redirects from: /c/[companyId]/brain/library

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import {
  listDiagnosticRunsForCompany,
  getToolLabel,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { LibraryClient, type ReportItem } from '../../library/LibraryClient';

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
  title: 'Brain - Lab Runs',
};

// ============================================================================
// Helper: Map DiagnosticRun to ReportItem
// ============================================================================

function diagnosticRunToReportItem(run: DiagnosticRun, companyId: string): ReportItem {
  // Map toolId to type (partial - not all tools have dedicated report types)
  // NOTE: gapSnapshot is the canonical diagnostic type for GAP IA runs
  const typeMap: Partial<Record<DiagnosticToolId, ReportItem['type']>> = {
    gapSnapshot: 'gap-snapshot',  // Displayed as "GAP IA"
    gapPlan: 'gap-plan',
    gapHeavy: 'gap-heavy',
    websiteLab: 'website-lab',
    brandLab: 'brand-lab',
    audienceLab: 'brand-lab',
    mediaLab: 'demand-lab',
    contentLab: 'content-lab',
    seoLab: 'seo-lab',
    demandLab: 'demand-lab',
    opsLab: 'ops-lab',
    creativeLab: 'creative-lab',
    competitorLab: 'brand-lab',
    competitionLab: 'brand-lab',
  };

  // Map status
  const statusMap: Record<string, ReportItem['status']> = {
    complete: 'completed',
    completed: 'completed',
    running: 'running',
    pending: 'pending',
    failed: 'failed',
    error: 'failed',
  };

  // Generate URL based on tool type
  // Route format: /c/[companyId]/diagnostics/[toolSlug]/[runId]
  // NOTE: Use kebab-case slugs (e.g., brand-lab not brand) to avoid
  // conflicts with static folders like diagnostics/brand/page.tsx
  let url: string | undefined;
  const isComplete = run.status === 'complete' || (run.status as string) === 'completed';
  if (isComplete) {
    switch (run.toolId) {
      case 'gapHeavy':
        url = `/c/${companyId}/diagnostics/gap-heavy/${run.id}`;
        break;
      case 'websiteLab':
        url = `/c/${companyId}/diagnostics/website-lab/${run.id}`;
        break;
      case 'brandLab':
        url = `/c/${companyId}/diagnostics/brand-lab/${run.id}`;
        break;
      case 'seoLab':
        url = `/c/${companyId}/diagnostics/seo-lab/${run.id}`;
        break;
      case 'contentLab':
        url = `/c/${companyId}/diagnostics/content-lab/${run.id}`;
        break;
      case 'gapSnapshot':
        url = `/c/${companyId}/diagnostics/gap-ia/${run.id}`;
        break;
      case 'demandLab':
        url = `/c/${companyId}/diagnostics/demand-lab/${run.id}`;
        break;
      case 'opsLab':
        url = `/c/${companyId}/diagnostics/ops-lab/${run.id}`;
        break;
      case 'creativeLab':
        url = `/c/${companyId}/labs/creative`;
        break;
      default:
        url = `/c/${companyId}/diagnostics/gap-heavy/${run.id}`;
    }
  }

  return {
    id: run.id,
    type: typeMap[run.toolId] || 'gap-heavy',
    title: getToolLabel(run.toolId),
    description: run.summary || `${getToolLabel(run.toolId)} diagnostic run`,
    status: statusMap[run.status] || 'pending',
    createdAt: run.createdAt,
    url,
    score: run.score ?? undefined,
  };
}

// ============================================================================
// Page Component
// ============================================================================

export default async function LabRunsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  const domain = company.domain || company.website || '';

  // Collect all reports
  const reports: ReportItem[] = [];
  const seenIds = new Set<string>();

  // 1. Load from unified Diagnostic Runs table (primary source)
  try {
    const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, { limit: 100 });
    for (const run of diagnosticRuns) {
      if (!seenIds.has(run.id)) {
        seenIds.add(run.id);
        reports.push(diagnosticRunToReportItem(run, companyId));
      }
    }
  } catch (error) {
    console.error('[LabRuns] Error loading diagnostic runs:', error);
  }

  // 2. Load GAP Heavy runs (legacy)
  try {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 50);
    for (const run of heavyRuns) {
      if (seenIds.has(run.id)) continue;
      seenIds.add(run.id);

      const modules: string[] = [];
      if (run.evidencePack?.websiteLabV4) modules.push('Website Lab');
      if (run.evidencePack?.brandLab) modules.push('Brand Lab');
      if (run.evidencePack?.modules?.length) {
        const completedModules = run.evidencePack.modules
          .filter(m => m.status === 'completed')
          .map(m => m.module);
        if (completedModules.includes('seo')) modules.push('SEO');
        if (completedModules.includes('content')) modules.push('Content');
        if (completedModules.includes('demand')) modules.push('Demand');
        if (completedModules.includes('ops')) modules.push('Ops');
      }

      reports.push({
        id: run.id,
        type: 'gap-heavy',
        title: 'GAP Heavy Analysis',
        description: modules.length > 0
          ? `Includes: ${modules.join(', ')}`
          : 'Comprehensive diagnostic analysis',
        status: run.status === 'completed' ? 'completed'
          : run.status === 'paused' ? 'completed'
          : run.status === 'running' ? 'running'
          : run.status === 'error' ? 'failed'
          : run.status === 'cancelled' ? 'failed'
          : 'pending',
        createdAt: run.createdAt,
        url: `/c/${companyId}/diagnostics?runId=${run.id}`,
        modules,
      });
    }
  } catch (error) {
    console.error('[LabRuns] Error loading GAP Heavy runs:', error);
  }

  // 3. Load GAP-IA runs (legacy)
  try {
    const iaRuns = await getGapIaRunsForCompanyOrDomain(companyId, domain, 50);
    for (const run of iaRuns) {
      if (seenIds.has(run.id)) continue;
      seenIds.add(run.id);

      const isComplete = run.status === 'completed' || run.status === 'complete';
      reports.push({
        id: run.id,
        type: 'gap-snapshot',
        title: 'GAP IA',
        description: run.core?.quickSummary || 'Quick marketing health check',
        status: isComplete ? 'completed'
          : run.status === 'running' ? 'running'
          : run.status === 'failed' || run.status === 'error' ? 'failed'
          : 'pending',
        createdAt: run.createdAt,
        url: isComplete ? `/c/${companyId}/diagnostics/gap-ia/${run.id}` : undefined,
        score: run.overallScore ?? undefined,
      });
    }
  } catch (error) {
    console.error('[LabRuns] Error loading GAP-IA runs:', error);
  }

  // Sort by date, newest first
  reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Debug: log reports with their URLs and statuses
  console.log('[LabRuns] Reports:', reports.map(r => ({ id: r.id, title: r.title, status: r.status, url: r.url })));

  return (
    <LibraryClient
      companyId={companyId}
      companyName={company.name}
      reports={reports}
    />
  );
}
