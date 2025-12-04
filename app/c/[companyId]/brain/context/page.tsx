// app/c/[companyId]/brain/context/page.tsx
// Company Context Graph Viewer - Server Component (nested under Brain workspace)
//
// Comprehensive viewer for the Company Context Graph showing:
// - All domains and fields with values and provenance
// - Context health score and needs-refresh flags
// - Snapshot timeline and diffs between versions
// - Force-directed graph visualization (via ?view=explorer)

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph, calculateDomainCoverage, calculateCompleteness } from '@/lib/contextGraph/companyContextGraph';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { checkContextGraphHealth } from '@/lib/contextGraph/health';
import {
  computeContextHealthScoreFromCompleteness,
  convertNeedsRefreshReport,
} from '@/lib/contextGraph/contextHealth';
import { listContextGraphSnapshots, listSnapshotSummaries, type ContextGraphSnapshot } from '@/lib/contextGraph/history';
import {
  flattenGraphToFields,
  diffGraphs,
  type GraphFieldUi,
  type GraphDiffItem,
} from '@/lib/contextGraph/uiHelpers';
import { ContextGraphViewer } from './ContextGraphViewer';
import { ContextExplorerClient } from './ContextExplorerClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ view?: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Context',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function CompanyContextGraphPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { view } = await searchParams;

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

  // If using explorer view (force-directed graph), show that
  if (view === 'explorer') {
    // Calculate health and domain coverage
    const health = checkContextGraphHealth(graph);
    const domainCoverage = calculateDomainCoverage(graph);

    // Get refresh report
    let refreshReport = null;
    if (!isNewGraph) {
      try {
        refreshReport = getNeedsRefreshReport(graph);
      } catch (e) {
        console.warn('[ContextPage] Could not compute refresh report:', e);
      }
    }

    // Flatten fields
    const fields = flattenGraphToFields(graph);

    // Get snapshot summaries for selector
    let snapshotInfos: Array<{ id: string; label: string; createdAt: string; reason?: string }> = [];
    try {
      const summaries = await listSnapshotSummaries(companyId);
      snapshotInfos = summaries.slice(0, 20).map(s => ({
        id: s.versionId,
        label: s.description || formatSnapshotDate(s.versionAt),
        createdAt: s.versionAt,
        reason: s.changeReason,
      }));
    } catch (e) {
      console.warn('[ContextPage] Could not load snapshots:', e);
    }

    return (
      <ContextExplorerClient
        companyId={companyId}
        companyName={company.name}
        initialGraph={graph}
        isNewGraph={isNewGraph}
        health={health}
        domainCoverage={domainCoverage}
        refreshReport={refreshReport}
        fields={fields}
        snapshots={snapshotInfos}
      />
    );
  }

  // Default view: existing ContextGraphViewer
  if (isNewGraph) {
    return (
      <ContextGraphViewer
        companyId={companyId}
        companyName={company.name}
        graph={null}
        fields={[]}
        needsRefresh={[]}
        contextHealthScore={0}
        snapshots={[]}
        diff={[]}
      />
    );
  }

  // Flatten graph to UI fields
  const fields = flattenGraphToFields(graph);

  // Calculate completeness-based health score
  const completenessScore = calculateCompleteness(graph);
  const contextHealthScore = computeContextHealthScoreFromCompleteness(completenessScore);

  // Get needs-refresh report for detailed freshness info
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);

  // Load snapshots
  const snapshots = await listContextGraphSnapshots(companyId, 5);

  // Compute diff between latest and previous snapshot
  let diff: GraphDiffItem[] = [];
  if (snapshots.length >= 2) {
    const latestSnapshot = snapshots[0];
    const previousSnapshot = snapshots[1];
    if (latestSnapshot.graph && previousSnapshot.graph) {
      diff = diffGraphs(previousSnapshot.graph, latestSnapshot.graph);
    }
  }

  return (
    <ContextGraphViewer
      companyId={companyId}
      companyName={company.name}
      graph={graph}
      fields={fields}
      needsRefresh={needsRefresh}
      contextHealthScore={contextHealthScore}
      snapshots={snapshots}
      diff={diff}
      coveragePercent={completenessScore}
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
