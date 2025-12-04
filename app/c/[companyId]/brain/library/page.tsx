// app/c/[companyId]/brain/library/page.tsx
// Brain Library - Reports, documents, and uploaded files
//
// Shows all diagnostic runs from the unified Diagnostic Runs table,
// plus legacy GAP Heavy and GAP-IA runs for backward compatibility.

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
import { LibraryClient, type ReportItem } from './LibraryClient';

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
  title: 'Brain - Library',
};

// ============================================================================
// Helper: Map DiagnosticRun to ReportItem
// ============================================================================

function diagnosticRunToReportItem(run: DiagnosticRun, companyId: string): ReportItem {
  // Map toolId to type
  const typeMap: Record<DiagnosticToolId, ReportItem['type']> = {
    gapSnapshot: 'gap-snapshot',
    gapPlan: 'gap-plan',
    gapHeavy: 'gap-heavy',
    websiteLab: 'website-lab',
    brandLab: 'brand-lab',
    contentLab: 'content-lab',
    seoLab: 'seo-lab',
    demandLab: 'demand-lab',
    opsLab: 'ops-lab',
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
  let url: string | undefined;
  if (run.status === 'complete') {
    // Different tools may have different view pages
    switch (run.toolId) {
      case 'gapHeavy':
        url = `/c/${companyId}/diagnostics?runId=${run.id}`;
        break;
      case 'websiteLab':
        url = `/c/${companyId}/diagnostics/website?runId=${run.id}`;
        break;
      case 'brandLab':
        url = `/c/${companyId}/diagnostics/brand?runId=${run.id}`;
        break;
      case 'seoLab':
        url = `/c/${companyId}/diagnostics/seo?runId=${run.id}`;
        break;
      case 'contentLab':
        url = `/c/${companyId}/diagnostics/content?runId=${run.id}`;
        break;
      case 'gapSnapshot':
        url = `/c/${companyId}/diagnostics/gap-ia?runId=${run.id}`;
        break;
      default:
        url = `/c/${companyId}/diagnostics?runId=${run.id}`;
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

export default async function BrainLibraryPage({ params }: PageProps) {
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
    console.log(`[BrainLibrary] Found ${diagnosticRuns.length} diagnostic runs from unified table`);

    for (const run of diagnosticRuns) {
      if (!seenIds.has(run.id)) {
        seenIds.add(run.id);
        reports.push(diagnosticRunToReportItem(run, companyId));
      }
    }
  } catch (error) {
    console.error('[BrainLibrary] Error loading diagnostic runs:', error);
  }

  // 2. Load GAP Heavy runs (legacy - may not be in unified table yet)
  try {
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 50);
    console.log(`[BrainLibrary] Found ${heavyRuns.length} GAP Heavy runs`);

    for (const run of heavyRuns) {
      if (seenIds.has(run.id)) continue;
      seenIds.add(run.id);

      // Check what labs are available
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
    console.error('[BrainLibrary] Error loading GAP Heavy runs:', error);
  }

  // 3. Load GAP-IA runs (legacy - may not be in unified table yet)
  try {
    const iaRuns = await getGapIaRunsForCompanyOrDomain(companyId, domain, 50);
    console.log(`[BrainLibrary] Found ${iaRuns.length} GAP-IA runs`);

    for (const run of iaRuns) {
      if (seenIds.has(run.id)) continue;
      seenIds.add(run.id);

      reports.push({
        id: run.id,
        type: 'gap-snapshot',
        title: 'GAP Snapshot',
        description: run.core?.quickSummary || 'Quick marketing health check',
        status: run.status === 'completed' || run.status === 'complete' ? 'completed'
          : run.status === 'running' ? 'running'
          : run.status === 'failed' || run.status === 'error' ? 'failed'
          : 'pending',
        createdAt: run.createdAt,
        score: run.overallScore ?? undefined,
      });
    }
  } catch (error) {
    console.error('[BrainLibrary] Error loading GAP-IA runs:', error);
  }

  // Sort by date, newest first
  reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log(`[BrainLibrary] Total reports: ${reports.length}`);

  return (
    <LibraryClient
      companyId={companyId}
      companyName={company.name}
      reports={reports}
    />
  );
}
