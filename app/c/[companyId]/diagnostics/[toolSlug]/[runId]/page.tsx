// app/c/[companyId]/diagnostics/[toolSlug]/[runId]/page.tsx
// Run Detail Page - Shows full details of a specific diagnostic run
//
// Uses the unified ToolReportLayout component with tool-specific data adapters.

import { notFound } from 'next/navigation';
import { getDiagnosticRun, isValidToolId, type DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import { getCompanyById } from '@/lib/airtable/companies';
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

  // Resolve slug to tool ID
  const toolId = slugToToolId[toolSlug];
  if (!toolId || !isValidToolId(toolId)) {
    notFound();
  }

  // Get tool config
  const tool = getToolConfig(toolId);
  if (!tool) {
    notFound();
  }

  // Fetch company and run in parallel
  const [company, run, workItemCount] = await Promise.all([
    getCompanyById(companyId),
    getDiagnosticRun(runId),
    countWorkItemsForRun(runId),
  ]);

  if (!company) {
    notFound();
  }

  if (!run || run.companyId !== companyId) {
    notFound();
  }

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
