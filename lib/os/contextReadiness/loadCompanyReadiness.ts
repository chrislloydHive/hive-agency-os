// lib/os/contextReadiness/loadCompanyReadiness.ts
// Data Access Layer for Context Readiness
//
// Single server-side loader that fetches everything needed for readiness computation.
// Composes existing loaders rather than duplicating logic.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { getLabRunStatusesFromArtifacts } from '@/lib/os/diagnostics/labRunStatus';
import type {
  RequiredForFeature,
  ReadinessInput,
  ReadinessSummary,
  ContextDomainKey,
  ContextGraphSnapshot,
  LabRunSummary,
} from './types';
import { computeReadiness } from './compute';
import { DOMAIN_CONFIGS } from './rules';

// ============================================================================
// Context Graph Snapshot Extraction
// ============================================================================

/**
 * Extract a snapshot of relevant fields from the context graph
 * Only extracts fields needed for readiness checks
 */
function extractContextSnapshot(graph: CompanyContextGraph | null): ContextGraphSnapshot {
  if (!graph) {
    return {};
  }

  // Helper to safely extract a field
  const extractField = <T>(
    domain: Record<string, unknown> | undefined,
    field: string
  ): { value: T | null; confirmed?: boolean } | undefined => {
    if (!domain) return undefined;
    const fieldData = domain[field] as { value?: T; provenance?: unknown[] } | undefined;
    if (!fieldData) return undefined;
    return {
      value: fieldData.value ?? null,
      // Check if confirmed from provenance (simplified check)
      confirmed: Array.isArray(fieldData.provenance) && fieldData.provenance.length > 0,
    };
  };

  return {
    audience: graph.audience ? {
      primaryAudience: extractField<string>(graph.audience as Record<string, unknown>, 'primaryAudience'),
      icpDescription: extractField<string>(graph.audience as Record<string, unknown>, 'icpDescription'),
      segments: extractField<unknown[]>(graph.audience as Record<string, unknown>, 'segments'),
      primarySegments: extractField<unknown[]>(graph.audience as Record<string, unknown>, 'primarySegments'),
    } : undefined,
    competitive: graph.competitive ? {
      competitors: extractField<unknown[]>(graph.competitive as Record<string, unknown>, 'competitors'),
      primaryCompetitors: extractField<unknown[]>(graph.competitive as Record<string, unknown>, 'primaryCompetitors'),
      competitiveModality: extractField<string>(graph.competitive as Record<string, unknown>, 'competitiveModality'),
      positionSummary: extractField<string>(graph.competitive as Record<string, unknown>, 'positionSummary'),
    } : undefined,
    brand: graph.brand ? {
      positioning: extractField<string>(graph.brand as Record<string, unknown>, 'positioning'),
      valueProps: extractField<unknown[]>(graph.brand as Record<string, unknown>, 'valueProps'),
      differentiators: extractField<unknown[]>(graph.brand as Record<string, unknown>, 'differentiators'),
    } : undefined,
    productOffer: graph.productOffer ? {
      valueProposition: extractField<string>(graph.productOffer as Record<string, unknown>, 'valueProposition'),
      primaryProducts: extractField<unknown[]>(graph.productOffer as Record<string, unknown>, 'primaryProducts'),
    } : undefined,
    website: graph.website ? {
      websiteScore: extractField<number>(graph.website as Record<string, unknown>, 'websiteScore'),
      conversionBlocks: extractField<unknown[]>(graph.website as Record<string, unknown>, 'conversionBlocks'),
      quickWins: extractField<unknown[]>(graph.website as Record<string, unknown>, 'quickWins'),
    } : undefined,
    seo: graph.seo ? {
      seoScore: extractField<number>(graph.seo as Record<string, unknown>, 'seoScore'),
      technicalIssues: extractField<unknown[]>(graph.seo as Record<string, unknown>, 'technicalIssues'),
    } : undefined,
  };
}

// ============================================================================
// Lab Run Summary Loading
// ============================================================================

/**
 * Load lab run summaries from artifacts
 */
async function loadLabRunSummaries(companyId: string): Promise<Map<string, LabRunSummary>> {
  const summaries = new Map<string, LabRunSummary>();

  try {
    const artifacts = await getArtifactsForCompany(companyId);
    const labStatuses = getLabRunStatusesFromArtifacts(artifacts);

    for (const [labSlug, status] of labStatuses.entries()) {
      summaries.set(labSlug, {
        labSlug,
        hasRun: status.hasRun,
        latestRunDate: status.latestRunDate,
        qualityScore: status.latestScore,
      });
    }
  } catch (error) {
    console.error('[ContextReadiness] Failed to load lab run summaries:', error);
  }

  return summaries;
}

// ============================================================================
// Pending Proposals Loading
// ============================================================================

/**
 * Count pending proposals per domain
 *
 * Note: This is a simplified implementation. In production, you might want
 * to query proposals storage directly for more accurate counts.
 */
async function loadPendingProposalsByDomain(
  _companyId: string,
  _graph: CompanyContextGraph | null
): Promise<Record<ContextDomainKey, number>> {
  // Initialize all domains with 0
  const counts: Record<ContextDomainKey, number> = {
    audience: 0,
    competitiveLandscape: 0,
    brand: 0,
    website: 0,
    seo: 0,
    media: 0,
    creative: 0,
  };

  // TODO: If you have a proposals storage layer, query it here
  // For now, we return 0 counts (no pending proposals)
  // This can be enhanced when the Review Queue is fully implemented

  return counts;
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load all readiness inputs for a company
 */
export async function loadReadinessInputs(
  companyId: string,
  requiredFor: RequiredForFeature
): Promise<ReadinessInput> {
  // Load in parallel for performance
  const [graph, labRuns] = await Promise.all([
    loadContextGraph(companyId),
    loadLabRunSummaries(companyId),
  ]);

  // Load proposals (depends on graph for some logic)
  const pendingProposalsByDomain = await loadPendingProposalsByDomain(companyId, graph);

  // Extract snapshot
  const contextGraph = extractContextSnapshot(graph);

  return {
    companyId,
    requiredFor,
    contextGraph,
    pendingProposalsByDomain,
    labRuns,
  };
}

/**
 * Load and compute readiness summary for a company
 * This is the main entry point for the readiness system
 */
export async function loadCompanyReadiness(
  companyId: string,
  requiredFor: RequiredForFeature
): Promise<ReadinessSummary> {
  const input = await loadReadinessInputs(companyId, requiredFor);
  return computeReadiness(input);
}

// ============================================================================
// Cached Loader (for API routes)
// ============================================================================

// Simple in-memory cache with TTL
const cache = new Map<string, { data: ReadinessSummary; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Load readiness with caching
 */
export async function loadCompanyReadinessCached(
  companyId: string,
  requiredFor: RequiredForFeature
): Promise<ReadinessSummary> {
  const cacheKey = `${companyId}:${requiredFor}`;
  const now = Date.now();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Load fresh
  const data = await loadCompanyReadiness(companyId, requiredFor);

  // Cache result
  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });

  return data;
}

/**
 * Invalidate cache for a company
 */
export function invalidateReadinessCache(companyId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(companyId)) {
      cache.delete(key);
    }
  }
}
