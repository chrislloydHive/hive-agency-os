// app/c/[companyId]/brain/context/page.tsx
// Context Graph Page - Revamped Experience
//
// The Context Graph shows what Hive knows about a company, how fields connect,
// and where the gaps are. This is the main entry point for context management.
//
// Three-Tab Layout:
// - Coverage View (default): Cluster circles showing field completeness by domain
// - Relationship View: Dependency graph showing how fields connect and derive
// - Form View: Structured editor for direct field editing
//
// URL Parameters:
// - ?view=coverage|relationships|form - Which view to show (default: coverage)
// - ?domain=<domainSlug> - Filter to specific domain (default: all)
// - ?nodeId=<field.path> - Deep link to a specific field (e.g., "identity.industry")
//
// Legacy params (auto-redirected):
// - ?view=overview → coverage
// - ?view=graph → relationships
// - ?section=<domain> → ?domain=<domain>
// - ?view=explorer|strategic → redirects to /brain/explorer

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
import { loadCoverageGraph, loadRelationshipGraph } from '@/lib/os/context';
import { ContextHealthHeader } from './ContextHealthHeader';
import { ContextPageClient } from './ContextPageClient';

// ============================================================================
// Dynamic Rendering
// ============================================================================

// Force dynamic rendering to ensure fresh data after promotion
export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    view?: string;      // coverage | relationships | form (default: coverage)
    domain?: string;    // Domain filter (default: all)
    section?: string;   // Legacy: redirects to ?domain=
    mode?: string;      // Legacy: ignored
    panel?: string;     // Right panel tab to open
    nodeId?: string;    // Field path to deep-link to (e.g., "identity.industry")
  }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Context Graph',
};

// ============================================================================
// Legacy View Mapping
// ============================================================================

function mapLegacyView(view: string | undefined): string | undefined {
  if (view === 'overview') return 'coverage';
  if (view === 'graph') return 'relationships';
  return view;
}

// ============================================================================
// Page Component
// ============================================================================

export default async function ContextPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { view: rawView, domain, section, panel, nodeId } = await searchParams;

  // Map legacy view names
  const view = mapLegacyView(rawView);

  // Legacy redirects: explorer and strategic views now live at /brain/explorer
  if (rawView === 'explorer' || rawView === 'strategic') {
    redirect(`/c/${companyId}/brain/explorer`);
  }

  // Legacy redirect: ?section= → ?domain=
  if (section && !domain) {
    const params = new URLSearchParams();
    params.set('domain', section);
    if (view) params.set('view', view);
    if (panel) params.set('panel', panel);
    if (nodeId) params.set('nodeId', nodeId);
    redirect(`/c/${companyId}/brain/context?${params.toString()}`);
  }

  // Redirect legacy view params to new names
  if (rawView === 'overview' || rawView === 'graph') {
    const params = new URLSearchParams();
    params.set('view', view!);
    if (domain) params.set('domain', domain);
    if (panel) params.set('panel', panel);
    if (nodeId) params.set('nodeId', nodeId);
    redirect(`/c/${companyId}/brain/context?${params.toString()}`);
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

  // Load coverage and relationship data in parallel
  const [coverageData, relationshipData] = await Promise.all([
    loadCoverageGraph(companyId),
    loadRelationshipGraph(companyId),
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Compact Context Health Header at top */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-800">
        <ContextHealthHeader
          healthScore={healthScore}
          companyId={companyId}
          baselineInitializedAt={baselineInitializedAt}
          autoFillReadiness={autoFillReadiness}
        />
      </div>

      {/* Main content with new 3-tab layout */}
      <ContextPageClient
        companyId={companyId}
        companyName={company.name}
        graph={isNewGraph ? null : graph}
        fields={fields}
        needsRefresh={needsRefresh}
        healthScore={healthScore}
        snapshots={snapshots}
        diff={diff}
        coveragePercent={completenessScore}
        initialView={view}
        initialDomain={domain}
        initialNodeId={nodeId}
        initialPanel={panel}
        coverageData={coverageData}
        relationshipData={relationshipData}
      />
    </div>
  );
}
