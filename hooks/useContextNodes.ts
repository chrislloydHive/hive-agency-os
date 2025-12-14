// hooks/useContextNodes.ts
// Real-time sync hook for Context Nodes
//
// Uses SWR for caching and revalidation.
// Invalidates on context updates, accepts, rejects.

'use client';

import useSWR, { mutate } from 'swr';
import type { BindingValueType } from '@/lib/os/strategy/strategyContextBindings';
import type { StrategySection } from '@/lib/contextGraph/unifiedRegistry';

// ============================================================================
// Types (Serialized versions for API responses)
// ============================================================================

/**
 * Serialized binding (without functions)
 * Matches what the API returns
 */
export interface SerializedBinding {
  strategyInputId: string;
  contextKey: string;
  zone: string;
  required: boolean;
  type: BindingValueType;
  label: string;
  shortLabel?: string;
  section: StrategySection;
  strategyField: string;
  emptyStateCTA: string;
  aiProposable: boolean;
  readinessWeight: number;
}

/**
 * Resolved binding with value and status (serialized)
 */
export interface ResolvedBinding {
  binding: SerializedBinding;
  value: unknown;
  status: 'confirmed' | 'proposed' | 'missing';
  source: string | null;
  confidence: number | null;
  updatedAt: string | null;
}

/**
 * Response from the context nodes API
 */
export interface ContextNodesResponse {
  companyId: string;
  resolvedBindings: ResolvedBinding[];
  readiness: {
    readinessPercent: number;
    confirmedRequiredCount: number;
    proposedRequiredCount: number;
    missingRequiredCount: number;
    totalRequiredCount: number;
    canSynthesize: boolean;
    synthesizeBlockReason: string | null;
  };
  recommendedNext: {
    strategyInputId: string;
    contextKey: string;
    label: string;
    route: string;
  } | null;
  timestamp: string;
}

/**
 * Hook return type
 */
export interface UseContextNodesResult {
  data: ContextNodesResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => Promise<ContextNodesResponse | undefined>;
}

// ============================================================================
// Cache Keys
// ============================================================================

/**
 * Get the cache key for context nodes
 */
export function getContextNodesCacheKey(companyId: string): string {
  return `contextNodes:${companyId}`;
}

/**
 * Get the cache key for strategy inputs
 * This derives from context nodes
 */
export function getStrategyInputsCacheKey(companyId: string): string {
  return `strategyInputs:${companyId}`;
}

// ============================================================================
// Fetcher
// ============================================================================

/**
 * Fetch context nodes for strategy bindings
 */
async function fetchContextNodes(url: string): Promise<ContextNodesResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
    throw new Error(error.error || 'Failed to fetch context nodes');
  }

  return response.json();
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to fetch and cache context nodes for Strategy page
 *
 * Features:
 * - Real-time sync with SWR
 * - Automatic revalidation on focus
 * - Returns resolved bindings with status/source
 * - Returns readiness computation
 * - Returns recommended next field
 *
 * @param companyId - Company ID
 * @param keys - Optional: specific context keys to fetch (defaults to all bindings)
 */
export function useContextNodes(
  companyId: string | null | undefined,
  keys?: string[]
): UseContextNodesResult {
  const keysParam = keys?.join(',') || '';
  const url = companyId
    ? `/api/os/context/strategy-nodes?companyId=${encodeURIComponent(companyId)}${keysParam ? `&keys=${encodeURIComponent(keysParam)}` : ''}`
    : null;

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<ContextNodesResponse>(
    url,
    fetchContextNodes,
    {
      // Revalidate on focus (user switches back to tab)
      revalidateOnFocus: true,
      // Revalidate on reconnect (user comes back online)
      revalidateOnReconnect: true,
      // Refresh every 30 seconds (for proposal updates)
      refreshInterval: 30000,
      // Dedupe requests within 2 seconds
      dedupingInterval: 2000,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Don't retry on error
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => swrMutate(),
  };
}

// ============================================================================
// Mutation Helpers
// ============================================================================

/**
 * Invalidate context nodes cache for a company
 * Call this after context updates, accepts, rejects
 */
export function invalidateContextNodes(companyId: string): void {
  const cacheKey = getContextNodesCacheKey(companyId);
  mutate((key) => typeof key === 'string' && key.includes(`companyId=${companyId}`));
}

/**
 * Invalidate both context nodes and strategy inputs caches
 */
export function invalidateStrategyData(companyId: string): void {
  invalidateContextNodes(companyId);
  // Also invalidate any derived caches
  mutate((key) => typeof key === 'string' && key.includes(`strategyInputs:${companyId}`));
}

/**
 * Update a single context node value optimistically
 *
 * @param companyId - Company ID
 * @param contextKey - Context key being updated
 * @param value - New value
 * @param source - Source of update ('user' for direct edits)
 */
export async function updateContextNode(
  companyId: string,
  contextKey: string,
  value: unknown,
  source: 'user' | 'ai' = 'user'
): Promise<{ success: boolean; revisionId?: string; error?: string }> {
  try {
    const response = await fetch('/api/os/context/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        nodeKey: contextKey,
        value,
        source,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // Invalidate cache to trigger refetch
      invalidateContextNodes(companyId);
      return { success: true, revisionId: result.revisionId };
    }

    return { success: false, error: result.error || 'Update failed' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Create AI proposals for missing context fields
 *
 * @param companyId - Company ID
 * @param keys - Context keys to propose values for
 * @param strategyContext - Optional additional context from strategy
 */
export async function proposeContextValues(
  companyId: string,
  keys: string[],
  strategyContext?: {
    objectives?: string[];
    constraints?: string[];
    insights?: string[];
  }
): Promise<{
  success: boolean;
  batchId?: string;
  proposalCount?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/os/context/propose-from-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        mode: 'ai',
        keys,
        strategyContext,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // Invalidate cache to show new proposals
      invalidateContextNodes(companyId);
      return {
        success: true,
        batchId: result.batchId,
        proposalCount: result.proposalCount || result.proposals?.length || 0,
      };
    }

    return { success: false, error: result.error || 'Proposal failed' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// Derived Hooks
// ============================================================================

/**
 * Hook for just the readiness state
 */
export function useStrategyReadiness(companyId: string | null | undefined) {
  const { data, error, isLoading } = useContextNodes(companyId);

  return {
    readiness: data?.readiness ?? null,
    recommendedNext: data?.recommendedNext ?? null,
    error,
    isLoading,
  };
}

/**
 * Hook for a single binding value
 */
export function useBindingValue(
  companyId: string | null | undefined,
  contextKey: string
) {
  const { data, error, isLoading } = useContextNodes(companyId, [contextKey]);

  const binding = data?.resolvedBindings?.find(
    (rb) => rb.binding.contextKey === contextKey
  );

  return {
    value: binding?.value ?? null,
    status: binding?.status ?? 'missing',
    source: binding?.source ?? null,
    confidence: binding?.confidence ?? null,
    error,
    isLoading,
  };
}
