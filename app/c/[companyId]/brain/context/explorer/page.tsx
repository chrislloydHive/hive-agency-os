// app/c/[companyId]/brain/context/explorer/page.tsx
// Context Graph Explorer 2.0 - Server Component
//
// Power-user inspector view of the full CompanyContextGraph:
// - Browse all fields by section/domain/field path
// - See current value, completeness, freshness, provenance, conflicts
// - Jump to where a field is used (Labs, GAP, Insights, Work)
// - Field-level history and diff view
// - Read-only with deep links to editing surfaces

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { flattenGraphToFields, groupFieldsByDomain } from '@/lib/contextGraph/uiHelpers';
import { listSnapshotSummaries } from '@/lib/contextGraph/history';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { getInsightsForCompany } from '@/lib/insights/repo';
import { ContextExplorerClient } from './ContextExplorerClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    field?: string;      // Pre-select a specific field path
    domain?: string;     // Pre-expand a domain
    search?: string;     // Initial search term
  }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Context Explorer',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function ContextExplorerPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { field, domain, search } = await searchParams;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Load context graph
  let graph = await loadContextGraph(companyId);
  const isNewGraph = !graph;

  // Create empty graph if none exists
  if (!graph) {
    graph = createEmptyContextGraph(companyId, company.name);
  }

  // Compute health score
  const healthScore = await computeContextHealthScore(companyId);

  // Flatten graph to fields
  const fields = flattenGraphToFields(graph);

  // Group fields by domain
  const fieldsByDomain = groupFieldsByDomain(fields);

  // Get needs-refresh report
  let needsRefreshPaths: string[] = [];
  try {
    const refreshReport = getNeedsRefreshReport(graph);
    // Extract stale field paths from domains and topPriorityFields
    const stalePaths = new Set<string>();
    for (const domain of refreshReport.domains) {
      for (const field of domain.fields) {
        stalePaths.add(`${field.domain}.${field.field}`);
      }
    }
    for (const field of refreshReport.topPriorityFields) {
      stalePaths.add(`${field.domain}.${field.field}`);
    }
    needsRefreshPaths = Array.from(stalePaths);
  } catch (e) {
    console.warn('[Explorer] Could not compute refresh report:', e);
  }

  // Get snapshot summaries for history
  let snapshots: Array<{ id: string; label: string; createdAt: string; reason?: string }> = [];
  try {
    const summaries = await listSnapshotSummaries(companyId);
    snapshots = summaries.slice(0, 30).map(s => ({
      id: s.versionId,
      label: s.description || formatSnapshotDate(s.versionAt),
      createdAt: s.versionAt,
      reason: s.changeReason,
    }));
  } catch (e) {
    console.warn('[Explorer] Could not load snapshots:', e);
  }

  // Get insights for field-insight mapping
  let insights: Array<{
    id: string;
    title: string;
    severity?: string;
    category: string;
    contextPaths?: string[];
  }> = [];
  try {
    const allInsights = await getInsightsForCompany(companyId, { limit: 500 });
    insights = allInsights.map(i => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      category: i.category,
      contextPaths: i.contextPaths,
    }));
  } catch (e) {
    console.warn('[Explorer] Could not load insights:', e);
  }

  return (
    <ContextExplorerClient
      companyId={companyId}
      companyName={company.name}
      fields={fields}
      fieldsByDomain={Object.fromEntries(fieldsByDomain)}
      healthScore={healthScore}
      needsRefreshPaths={needsRefreshPaths}
      snapshots={snapshots}
      insights={insights}
      initialFieldPath={field}
      initialDomain={domain}
      initialSearch={search}
    />
  );
}

function formatSnapshotDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
