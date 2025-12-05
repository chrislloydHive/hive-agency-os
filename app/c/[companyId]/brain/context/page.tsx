// app/c/[companyId]/brain/context/page.tsx
// Company Context Graph Viewer - Server Component (nested under Brain workspace)
//
// Comprehensive viewer for the Company Context Graph showing:
// - All domains and fields with values and provenance
// - Context health score and needs-refresh flags
// - Snapshot timeline and diffs between versions
// - Force-directed graph visualization (via ?view=explorer)
// - "What AI Sees" toggle for AI-scoped view
// - Interactive provenance and diagnostics drawers

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph, calculateDomainCoverage, calculateCompleteness } from '@/lib/contextGraph/companyContextGraph';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import {
  checkContextGraphHealth,
  computeContextHealthScore,
  getSeverityLabel,
  type ContextHealthScore,
} from '@/lib/contextGraph/health';
import {
  computeContextHealthScoreFromCompleteness,
  convertNeedsRefreshReport,
} from '@/lib/contextGraph/contextHealth';
import { listContextGraphSnapshots, listSnapshotSummaries } from '@/lib/contextGraph/history';
import {
  flattenGraphToFields,
  diffGraphs,
  type GraphDiffItem,
} from '@/lib/contextGraph/uiHelpers';
import { collectGraphSanityReport } from '@/lib/contextGraph/diagnostics';
import { getAllContext } from '@/lib/contextGraph/contextGateway';
import { ContextGraphViewer } from './ContextGraphViewer';
import { ContextExplorerClient } from './ContextExplorerClient';
import { getCompanyContextHealth } from '@/lib/contextGraph/diagnostics';
import { ContextHealthPanel } from '@/components/os/ContextHealthPanel';
import { ContextHealthHeader } from './ContextHealthHeader';
import { ContextEditorClient } from './ContextEditorClient';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ view?: string; mode?: string }>;
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
  const { view, mode } = await searchParams;

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
    // Calculate comprehensive health score (same as main view)
    const healthScore = await computeContextHealthScore(companyId);
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
        healthScore={healthScore}
        domainCoverage={domainCoverage}
        refreshReport={refreshReport}
        fields={fields}
        snapshots={snapshotInfos}
      />
    );
  }

  // Compute comprehensive context health score
  const healthScore = await computeContextHealthScore(companyId);

  // Get context health from diagnostics (for legacy panel)
  const contextHealth = await getCompanyContextHealth(companyId);

  // Flatten graph to UI fields (needed for both editor and default views)
  const fields = flattenGraphToFields(graph);

  // Get needs-refresh report for detailed freshness info
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);

  // If using editor mode, show the new Context Editor
  if (mode === 'editor' && !isNewGraph) {
    // Collect diagnostics for the editor
    let diagnostics = null;
    try {
      diagnostics = collectGraphSanityReport();
    } catch (e) {
      console.warn('[ContextPage] Could not collect diagnostics:', e);
    }

    // Get AI-scoped context view
    let aiContextData = null;
    try {
      aiContextData = await getAllContext(companyId, {
        minConfidence: 0.4,
        minFreshness: 0.3,
      });
    } catch (e) {
      console.warn('[ContextPage] Could not load AI context:', e);
    }

    return (
      <ContextEditorClient
        companyId={companyId}
        companyName={company.name}
        graph={graph}
        fields={fields}
        needsRefresh={needsRefresh}
        healthScore={healthScore}
        diagnostics={diagnostics}
        aiContextData={aiContextData}
      />
    );
  }

  // Default view: existing ContextGraphViewer
  if (isNewGraph) {
    return (
      <div className="space-y-6 p-6">
        {/* Compact Context Health Header */}
        <ContextHealthHeader
          healthScore={healthScore}
          companyId={companyId}
        />
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
      </div>
    );
  }

  // Calculate completeness for auto-complete banner
  const completenessScore = calculateCompleteness(graph);

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
    <div className="space-y-6">
      {/* Compact Context Health Header at top */}
      <div className="px-6 pt-6">
        <ContextHealthHeader
          healthScore={healthScore}
          companyId={companyId}
        />
      </div>
      <ContextGraphViewer
        companyId={companyId}
        companyName={company.name}
        graph={graph}
        fields={fields}
        needsRefresh={needsRefresh}
        contextHealthScore={healthScore.overallScore}
        snapshots={snapshots}
        diff={diff}
        coveragePercent={completenessScore}
      />
    </div>
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
