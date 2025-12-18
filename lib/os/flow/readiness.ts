// lib/os/flow/readiness.ts
// Flow Readiness Gate (Server-side)
//
// Server-side wrapper that adds Airtable loading and observability logging.
//
// NOTE: This file contains server-only code (Airtable access).
// Client components should import from './readiness.shared' instead.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { logFlowBlockedMissingDomains } from '@/lib/observability/flowEvents';

// Re-export everything from shared module for backwards compatibility
export * from './readiness.shared';

// Import types for internal use
import {
  type FlowType,
  type FlowReadiness,
  checkFlowReadinessFromGraph as checkFlowReadinessFromGraphShared,
  createEmptyReadiness,
} from './readiness.shared';

// ============================================================================
// Server-only Functions
// ============================================================================

/**
 * Check flow readiness for a company (loads graph from Airtable)
 * SERVER-ONLY: Do not import this in client components
 */
export async function checkFlowReadiness(
  companyId: string,
  flow: FlowType
): Promise<FlowReadiness> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    // No graph - all domains missing
    return createEmptyReadiness(flow);
  }

  return checkFlowReadinessFromGraphWithLogging(graph, flow, companyId);
}

/**
 * Check flow readiness from an existing graph with observability logging
 * SERVER-ONLY: Do not import this in client components
 */
export function checkFlowReadinessFromGraphWithLogging(
  graph: Parameters<typeof checkFlowReadinessFromGraphShared>[0],
  flow: FlowType,
  companyId: string
): FlowReadiness {
  const readiness = checkFlowReadinessFromGraphShared(graph, flow, companyId);

  // Log flow blocked event if not ready (server-side observability)
  if (!readiness.isReady) {
    logFlowBlockedMissingDomains(
      companyId,
      flow,
      readiness.missingCritical.map(r => r.domain),
      readiness.labCTAs.filter(c => c.priority === 'critical').map(c => c.labKey)
    );
  }

  return readiness;
}
