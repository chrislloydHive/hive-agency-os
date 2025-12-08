// app/c/[companyId]/diagnostics/[toolSlug]/[runId]/page.tsx
// Run Detail Page - Shows full details of a specific diagnostic run
//
// Uses the unified ToolReportLayout component with tool-specific data adapters.

import { notFound } from 'next/navigation';
import { getDiagnosticRun, isValidToolId, type DiagnosticToolId, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapIaRunById } from '@/lib/airtable/gapIaRuns';
import { getGapPlanRunById } from '@/lib/airtable/gapPlanRuns';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { extractReportData } from '@/lib/os/diagnostics/adapters';
import { ToolReportLayout, type ReportSection } from '@/components/tools/ToolReportLayout';
import { countWorkItemsForRun } from '@/lib/airtable/workItems';

// Map URL slugs to tool IDs
const slugToToolId: Record<string, DiagnosticToolId> = {
  'gap-snapshot': 'gapSnapshot',
  'gapSnapshot': 'gapSnapshot',
  'gap-ia': 'gapSnapshot', // Alias for gap-snapshot
  'gapIa': 'gapSnapshot',
  'gap-plan': 'gapPlan',
  'gapPlan': 'gapPlan',
  'gap-heavy': 'gapHeavy',
  'gapHeavy': 'gapHeavy',
  'website-lab': 'websiteLab',
  'websiteLab': 'websiteLab',
  'website': 'websiteLab',
  'brand-lab': 'brandLab',
  'brandLab': 'brandLab',
  'brand': 'brandLab',
  'content-lab': 'contentLab',
  'contentLab': 'contentLab',
  'content': 'contentLab',
  'seo-lab': 'seoLab',
  'seoLab': 'seoLab',
  'seo': 'seoLab',
  'seo-heavy': 'seoLab', // Redirect old slug to seoLab
  'demand-lab': 'demandLab',
  'demandLab': 'demandLab',
  'demand': 'demandLab',
  'ops-lab': 'opsLab',
  'opsLab': 'opsLab',
  'ops': 'opsLab',
};

interface Props {
  params: Promise<{
    companyId: string;
    toolSlug: string;
    runId: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function RunDetailPage({ params }: Props) {
  const { companyId, toolSlug, runId } = await params;

  console.log('[RunDetail] Loading page:', { companyId, toolSlug, runId });

  // Resolve slug to tool ID
  const toolId = slugToToolId[toolSlug];
  console.log('[RunDetail] Resolved toolId:', toolId);
  if (!toolId || !isValidToolId(toolId)) {
    console.log('[RunDetail] Invalid toolId, returning 404');
    notFound();
  }

  // Get tool config
  const tool = getToolConfig(toolId);
  if (!tool) {
    notFound();
  }

  // Fetch company and run in parallel
  const [company, diagnosticRun, workItemCount] = await Promise.all([
    getCompanyById(companyId),
    getDiagnosticRun(runId),
    countWorkItemsForRun(runId),
  ]);

  if (!company) {
    notFound();
  }

  // Try to use the diagnostic run from the unified table
  let run: DiagnosticRun | null = diagnosticRun;

  // Check if unified table result is valid (has matching companyId)
  const unifiedRunValid = diagnosticRun && diagnosticRun.companyId === companyId;

  // If not found or companyId doesn't match, and this is a GAP IA (gapSnapshot), try legacy GAP IA Runs table
  if (!unifiedRunValid && toolId === 'gapSnapshot') {
    console.log('[RunDetail] Trying legacy GAP IA Runs table for:', runId);
    const gapIaRun = await getGapIaRunById(runId);
    console.log('[RunDetail] Legacy GAP IA run result:', gapIaRun ? { id: gapIaRun.id, status: gapIaRun.status } : 'null');
    if (gapIaRun) {
      // Convert GapIaRun to DiagnosticRun format
      run = {
        id: gapIaRun.id,
        companyId: companyId, // Use the companyId from the URL since legacy runs may not have it
        toolId: 'gapSnapshot',
        status: gapIaRun.status === 'completed' ? 'complete' : gapIaRun.status as any,
        createdAt: gapIaRun.createdAt,
        updatedAt: gapIaRun.updatedAt,
        score: gapIaRun.overallScore ?? null,
        summary: gapIaRun.core?.quickSummary ?? null,
        rawJson: gapIaRun as any,
      };
    }
  }

  // If not found or companyId doesn't match, and this is a GAP Plan, try GAP Plan Runs table
  if (!unifiedRunValid && !run && toolId === 'gapPlan') {
    console.log('[RunDetail] Trying GAP Plan Runs table for:', runId);
    const gapPlanRun = await getGapPlanRunById(runId);
    console.log('[RunDetail] GAP Plan run result:', gapPlanRun ? { id: gapPlanRun.id, status: gapPlanRun.status } : 'null');
    if (gapPlanRun) {
      // Convert GapPlanRun to DiagnosticRun format
      run = {
        id: gapPlanRun.id,
        companyId: companyId,
        toolId: 'gapPlan',
        status: gapPlanRun.status === 'completed' ? 'complete' : gapPlanRun.status as any,
        createdAt: gapPlanRun.createdAt,
        updatedAt: gapPlanRun.completedAt || gapPlanRun.createdAt,
        score: gapPlanRun.overallScore ?? null,
        summary: gapPlanRun.maturityStage
          ? `${gapPlanRun.maturityStage} maturity stage`
          : 'Comprehensive marketing assessment',
        rawJson: gapPlanRun as any,
      };
    }
  }

  // If unified run exists but has wrong companyId, and we didn't find a legacy run, 404
  if (diagnosticRun && !unifiedRunValid && !run) {
    console.log('[RunDetail] Company ID mismatch and no legacy run found, returning 404:', {
      diagnosticRunCompanyId: diagnosticRun.companyId,
      urlCompanyId: companyId
    });
    notFound();
  }

  if (!run) {
    console.log('[RunDetail] No run found at all, returning 404');
    notFound();
  }

  console.log('[RunDetail] Run found, rendering report:', { runId: run.id, toolId: run.toolId, status: run.status });

  // Extract report data using tool-specific adapter
  const reportData = extractReportData(run);

  return (
    <ToolReportLayout
      tool={tool}
      company={company}
      run={run}
      scores={reportData.scores}
      keyFindings={reportData.keyFindings}
      opportunities={reportData.opportunities}
      sections={reportData.sections as ReportSection[]}
      workItemCount={workItemCount}
    />
  );
}
