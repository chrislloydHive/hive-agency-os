// app/c/[companyId]/context/page.tsx
// Context Workspace Page
//
// Loads context from the ContextGraphs Airtable table and hydrates nodes
// for the Map and Table views.
//
// Data sources:
// - ContextGraphs table: Primary source for all context data
// - Hydrated nodes: Converted from ContextGraph for UI rendering
//
// Fallback: Uses DraftableResource for companies still on the legacy system.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCompanyContext,
  getBaselineSignalsForCompany,
  getContextDraft,
} from '@/lib/os/context';
import { getDiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveEngagement } from '@/lib/airtable/engagements';
import { hydrateContextGraph, type HydratedContextNode } from '@/lib/contextGraph/nodes/hydration';
import type { CompanyContext } from '@/lib/types/context';
import type { DraftableState, DraftSource } from '@/lib/os/draft/types';
import { ContextWorkspaceClient } from './ContextWorkspaceClient';
import { isContextV4Enabled } from '@/lib/types/contextField';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ContextPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all data in parallel including the ContextGraph from ContextGraphs table
  const [company, savedContext, baselineSignals, contextDraft, debugInfo, contextGraph, engagement] = await Promise.all([
    getCompanyById(companyId),
    getCompanyContext(companyId),
    getBaselineSignalsForCompany(companyId),
    getContextDraft(companyId),
    getDiagnosticsDebugInfo(companyId),
    loadContextGraph(companyId), // PRIMARY: Load from ContextGraphs table
    getActiveEngagement(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Hydrate context graph into nodes for Map/Table views
  let hydratedNodes: HydratedContextNode[] = [];
  if (contextGraph) {
    try {
      const nodeMap = await hydrateContextGraph(contextGraph);
      hydratedNodes = Array.from(nodeMap.values());
      console.log(`[ContextPage] Loaded ${hydratedNodes.length} nodes from ContextGraphs table`);
    } catch (error) {
      console.error('[ContextPage] Failed to hydrate context graph:', error);
    }
  }

  // Determine if we have meaningful saved context (more than just companyId)
  // Check both legacy Company Context table AND the new ContextGraphs table
  const hasSavedContext = savedContext && (
    savedContext.businessModel ||
    savedContext.primaryAudience ||
    (savedContext.objectives && savedContext.objectives.length > 0)
  );

  // Context graph is the primary data source now
  const hasContextGraph = contextGraph !== null && hydratedNodes.length > 0;

  // Determine if we have baseline data
  const hasBaseline = baselineSignals && (
    baselineSignals.hasLabRuns ||
    baselineSignals.hasFullGap ||
    baselineSignals.hasCompetition ||
    baselineSignals.hasWebsiteMetadata
  );

  // Check if engagement indicates labs have completed (context_approved or in_progress)
  const engagementIndicatesLabsRan = engagement && (
    engagement.status === 'context_approved' ||
    engagement.status === 'in_progress' ||
    engagement.labsCompletedAt !== undefined
  );

  // Build DraftableState for the hook (legacy fallback)
  const draftSource: DraftSource = hasSavedContext ? 'user_saved' :
    contextDraft ? 'ai_draft' : 'system_default';

  const initialState: DraftableState<CompanyContext> = {
    saved: hasSavedContext ? savedContext : null,
    draft: contextDraft?.context ?? null,
    source: draftSource,
    // Prerequisites are ready if we have baseline data, context graph, OR engagement indicates labs ran
    prereqsReady: !!hasBaseline || hasContextGraph || !!engagementIndicatesLabsRan,
  };

  // Check V4 feature flag on server side and pass to client
  const v4Enabled = isContextV4Enabled();

  return (
    <div className="space-y-6">
      <ContextWorkspaceClient
        companyId={companyId}
        companyName={company.name}
        initialState={initialState}
        debugInfo={debugInfo}
        hydratedNodes={hydratedNodes}
        baselineSignals={baselineSignals}
        v4Enabled={v4Enabled}
      />
    </div>
  );
}
