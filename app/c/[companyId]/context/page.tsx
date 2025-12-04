// app/c/[companyId]/context/page.tsx
// Company Context Graph Viewer - Server Component
//
// Comprehensive viewer for the Company Context Graph showing:
// - All domains and fields with values and provenance
// - Context health score and needs-refresh flags
// - Snapshot timeline and diffs between versions

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import {
  computeContextHealthScore,
  convertNeedsRefreshReport,
} from '@/lib/contextGraph/contextHealth';
import { listContextGraphSnapshots, type ContextGraphSnapshot } from '@/lib/contextGraph/history';
import {
  flattenGraphToFields,
  diffGraphs,
  type GraphFieldUi,
  type GraphDiffItem,
} from '@/lib/contextGraph/uiHelpers';
import { ContextGraphViewer } from './ContextGraphViewer';

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
  title: 'Company Context Graph',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function CompanyContextGraphPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Load context graph
  const graph = await loadContextGraph(companyId);

  // If no graph exists, show empty state
  if (!graph) {
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

  // Get needs-refresh report and convert to UI format
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);
  const contextHealthScore = computeContextHealthScore(needsRefresh);

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
    />
  );
}
