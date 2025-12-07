// app/c/[companyId]/brain/context/page.tsx
// Context Editor - Field-level inspector for company context
//
// Part of the 4-tab Brain IA:
// - Explorer: Explore mode - visual map for discovery (at /brain/explorer)
// - Context (this): Inspect mode - field-level editor for data entry
// - Insights: Understand mode - AI-generated analysis
// - Labs: Improve mode - diagnostic tools that refine context
//
// This page shows the ContextGraphViewer with field cards, inline editing,
// and provenance tracking.
//
// URL Parameters:
// - ?section=<domain> - Focus on specific domain (e.g., identity, audience)
// - ?panel=<details|history|ai> - Open specific right panel tab
// - ?nodeId=<field.path> - Deep link to a specific field (e.g., "identity.industry")
//
// Legacy params (redirected):
// - ?view=explorer → redirects to /brain/explorer
// - ?view=strategic → redirects to /brain/explorer
// - ?mode=editor → ignored (inline editing is always enabled)

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph, calculateCompleteness } from '@/lib/contextGraph/companyContextGraph';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { convertNeedsRefreshReport } from '@/lib/contextGraph/contextHealth';
import { listContextGraphSnapshots } from '@/lib/contextGraph/history';
import {
  flattenGraphToFields,
  diffGraphs,
  type GraphDiffItem,
} from '@/lib/contextGraph/uiHelpers';
import { checkAutoFillReadiness } from '@/lib/contextGraph/readiness';
import { ContextGraphViewer } from './ContextGraphViewer';
import { ContextHealthHeader } from './ContextHealthHeader';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    view?: string;      // Legacy: redirect to explorer
    mode?: string;      // Legacy: ignored
    section?: string;   // Domain to focus on
    panel?: string;     // Drawer to open
    nodeId?: string;    // Field path to deep-link to (e.g., "identity.industry")
  }>;
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

export default async function ContextPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { view, section, panel, nodeId } = await searchParams;

  // Legacy redirects: explorer and strategic views now live at /brain/explorer
  if (view === 'explorer' || view === 'strategic') {
    redirect(`/c/${companyId}/brain/explorer`);
  }

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

  // Compute comprehensive context health score
  const healthScore = await computeContextHealthScore(companyId);

  // Flatten graph to UI fields
  const fields = flattenGraphToFields(graph);

  // Get needs-refresh report for detailed freshness info
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);

  // Get baseline initialization date from graph meta
  const baselineInitializedAt = graph.meta?.contextInitializedAt || null;

  // Compute auto-fill readiness
  const autoFillReadiness = checkAutoFillReadiness(company, graph, companyId);

  // Handle empty/new graph case
  if (isNewGraph) {
    return (
      <div className="space-y-6 p-6">
        <ContextHealthHeader
          healthScore={healthScore}
          companyId={companyId}
          baselineInitializedAt={baselineInitializedAt}
          autoFillReadiness={autoFillReadiness}
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
          initialDomain={section}
          initialPanel={panel}
          initialNodeId={nodeId}
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
          baselineInitializedAt={baselineInitializedAt}
          autoFillReadiness={autoFillReadiness}
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
        initialDomain={section}
        initialPanel={panel}
        initialNodeId={nodeId}
      />
    </div>
  );
}
