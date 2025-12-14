// app/c/[companyId]/context/page.tsx
// Context Workspace Page
//
// Displays context in two view modes:
// - Map View (default): Visual node diagram with AI-first workflow
// - Form View: Traditional editable form
//
// Node Hydration:
// 1. Load nodes from CompanyContextGraph (new graph structure)
// 2. Hydrate nodes from legacy CompanyContext (form fields)
// 3. Merge and deduplicate to ensure every form field appears
//
// Three states handled by useDraftableResource hook:
// A) No prereqs + no saved → shows "Run Diagnostics" button
// B) Prereqs ready + no saved → auto-generates draft, shows form
// C) Saved exists → shows form with "Regenerate from diagnostics" link

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCompanyContext,
  getBaselineSignalsForCompany,
  getContextDraft,
} from '@/lib/os/context';
import { getDiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { hydrateContextGraph, type HydratedContextNode } from '@/lib/contextGraph/nodes/hydration';
import { hydrateLegacyContext, mergeNodes, verifyFieldCoverage, mergeNodesWithGhosts } from '@/lib/contextMap';
import { filterCanonicalNodes, logFilterSummary } from '@/lib/contextGraph/canonicalFilter';
import type { CompanyContext } from '@/lib/types/context';
import type { DraftableState, DraftSource } from '@/lib/os/draft/types';
import { ContextWorkspaceClient } from './ContextWorkspaceClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ContextPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company, context, baseline signals, draft, debug info, and context graph in parallel
  console.log(`[ContextPage] Loading data for company ${companyId} at ${new Date().toISOString()}`);

  const [company, savedContext, baselineSignals, contextDraft, debugInfo, contextGraph] = await Promise.all([
    getCompanyById(companyId),
    getCompanyContext(companyId),
    getBaselineSignalsForCompany(companyId),
    getContextDraft(companyId),
    getDiagnosticsDebugInfo(companyId),
    loadContextGraph(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Debug: Log what we got from the context graph
  if (contextGraph) {
    // Sample a field to verify data is fresh
    const sampleField = (contextGraph as any).identity?.businessModel;
    console.log(`[ContextPage] Context graph loaded:`, {
      companyId: contextGraph.companyId,
      updatedAt: contextGraph.meta?.updatedAt,
      sampleFieldValue: JSON.stringify(sampleField?.value ?? null)?.slice(0, 50),
      sampleFieldUpdatedAt: sampleField?.provenance?.[0]?.updatedAt,
    });
  }

  // ============================================================================
  // Node Hydration: Ensure every form field appears as a node
  // ============================================================================

  // Step 1: Hydrate nodes from CompanyContextGraph (if exists)
  let graphNodes: HydratedContextNode[] = [];
  if (contextGraph) {
    console.log(`[ContextPage] Loaded context graph for ${companyId}:`, {
      companyId: contextGraph.companyId,
      companyName: contextGraph.companyName,
      updatedAt: contextGraph.meta?.updatedAt,
    });
    try {
      const nodeMap = await hydrateContextGraph(contextGraph);
      graphNodes = Array.from(nodeMap.values());
      // Log a sample of confirmed nodes
      const confirmedNodes = graphNodes.filter(n => n.status === 'confirmed');
      console.log(`[ContextPage] Hydrated ${graphNodes.length} nodes (${confirmedNodes.length} confirmed)`);
    } catch (error) {
      console.error('[ContextPage] Failed to hydrate context graph:', error);
    }
  } else {
    console.log(`[ContextPage] No context graph found for ${companyId}`);
  }

  // Step 2: Determine the active context (saved or draft)
  const activeContext = savedContext || contextDraft?.context;

  // Step 3: Hydrate nodes from legacy CompanyContext (form fields)
  let legacyNodes: HydratedContextNode[] = [];
  if (activeContext) {
    try {
      const legacyResult = hydrateLegacyContext(activeContext, {
        existingNodes: graphNodes,
      });
      legacyNodes = legacyResult.nodes;

      // Log warnings for debugging
      if (legacyResult.warnings.length > 0) {
        console.warn('[ContextPage] Legacy hydration warnings:', legacyResult.warnings);
      }

      console.log('[ContextPage] Hydration stats:', {
        graphNodes: graphNodes.length,
        legacyNodes: legacyNodes.length,
        populatedFormFields: legacyResult.populatedCount,
        emptyFormFields: legacyResult.emptyCount,
      });
    } catch (error) {
      console.error('[ContextPage] Failed to hydrate legacy context:', error);
    }
  }

  // Step 4: Merge nodes (graph nodes take priority, then legacy nodes)
  const mergedNodes = mergeNodes(graphNodes, legacyNodes);

  // Step 5: Add ghost nodes for missing required fields
  // This ensures blockers are visible and actionable in the Context Map
  const nodesWithGhosts = mergeNodesWithGhosts(mergedNodes);

  // Log ghost node stats
  const ghostNodes = nodesWithGhosts.filter(n => n.status === 'missing');
  if (ghostNodes.length > 0) {
    console.log(`[ContextPage] Added ${ghostNodes.length} ghost nodes for missing required fields:`,
      ghostNodes.map(n => n.key)
    );
  }

  // Step 6: CANONICAL FILTERING (final filter before UI)
  // This ensures only canonical nodes reach the client - no objectives, no scores, no deprecated domains
  const hydratedNodes = filterCanonicalNodes(nodesWithGhosts);

  // Log what was filtered (dev only)
  if (process.env.NODE_ENV === 'development') {
    const filteredCount = nodesWithGhosts.length - hydratedNodes.length;
    if (filteredCount > 0) {
      console.log(`[ContextPage] CANONICAL FILTER: Removed ${filteredCount} non-canonical nodes`);
      logFilterSummary(nodesWithGhosts, 'ContextPage');
    }
  }

  // Step 7: Verify coverage (for debugging)
  if (activeContext && hydratedNodes.length > 0) {
    const coverage = verifyFieldCoverage(activeContext, hydratedNodes);
    if (coverage.missing.length > 0) {
      console.warn('[ContextPage] Missing fields in nodes:', coverage.missing);
    }
    if (coverage.extra.length > 0) {
      console.log('[ContextPage] Extra nodes not in registry:', coverage.extra);
    }
  }

  // Determine if we have meaningful saved context (more than just companyId)
  const hasSavedContext = savedContext && (
    savedContext.businessModel ||
    savedContext.primaryAudience ||
    (savedContext.objectives && savedContext.objectives.length > 0)
  );

  // Determine if we have baseline data
  const hasBaseline = baselineSignals && (
    baselineSignals.hasLabRuns ||
    baselineSignals.hasFullGap ||
    baselineSignals.hasCompetition ||
    baselineSignals.hasWebsiteMetadata
  );

  // Build DraftableState for the hook
  const draftSource: DraftSource = hasSavedContext ? 'user_saved' :
    contextDraft ? 'ai_draft' : 'system_default';

  const initialState: DraftableState<CompanyContext> = {
    saved: hasSavedContext ? savedContext : null,
    draft: contextDraft?.context ?? null,
    source: draftSource,
    prereqsReady: !!hasBaseline,
  };

  return (
    <div className="space-y-6">
      <ContextWorkspaceClient
        companyId={companyId}
        companyName={company.name}
        initialState={initialState}
        debugInfo={debugInfo}
        hydratedNodes={hydratedNodes}
      />
    </div>
  );
}
