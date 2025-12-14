// app/api/os/context/strategy-nodes/route.ts
// Strategy ↔ Context Nodes API
//
// GET: Resolve context nodes for Strategy page bindings
// Returns resolved values, status, provenance, and readiness computation.
//
// This is the primary data source for the Strategy Inputs UI.
// Real-time sync is achieved via SWR in the useContextNodes hook.

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  STRATEGY_CONTEXT_BINDINGS,
  getBindingByContextKey,
  computeBindingReadiness,
  getRecommendedNextBinding,
  type ResolvedBinding,
  type StrategyContextBinding,
} from '@/lib/os/strategy/strategyContextBindings';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType } from '@/lib/contextGraph/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a nested value from the context graph using dot notation path
 */
function getGraphValue(graph: CompanyContextGraph, path: string): WithMetaType<unknown> | undefined {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  // Check if it's a WithMetaType wrapper
  if (current && typeof current === 'object' && 'value' in current) {
    return current as WithMetaType<unknown>;
  }

  return undefined;
}

/**
 * Extract resolution status from provenance
 */
function extractStatus(
  provenance: Array<{ source: string; confirmedAt?: string }> | undefined
): 'confirmed' | 'proposed' | 'missing' {
  if (!provenance || provenance.length === 0) {
    return 'missing';
  }

  const latest = provenance[0];

  // If there's a confirmedAt timestamp, it's confirmed
  if (latest.confirmedAt) {
    return 'confirmed';
  }

  // User source is always confirmed
  if (latest.source === 'user' || latest.source === 'user_input' || latest.source === 'manual') {
    return 'confirmed';
  }

  // AI or lab sources without confirmation are proposed
  if (latest.source === 'ai' || latest.source === 'lab' || latest.source === 'inferred') {
    return 'proposed';
  }

  // Default to confirmed for known human sources
  return 'confirmed';
}

/**
 * Check if a value is considered "present"
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Resolve a single binding to a value from the context graph
 */
function resolveBinding(
  binding: StrategyContextBinding,
  graph: CompanyContextGraph | null
): ResolvedBinding {
  if (!graph) {
    return {
      binding,
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
    };
  }

  const wrapped = getGraphValue(graph, binding.contextKey);

  if (!wrapped || !hasValue(wrapped.value)) {
    return {
      binding,
      value: null,
      status: 'missing',
      source: null,
      confidence: null,
      updatedAt: null,
    };
  }

  const provenance = wrapped.provenance as Array<{
    source: string;
    updatedAt?: string;
    confidence?: number;
    confirmedAt?: string;
  }> | undefined;

  const latest = provenance?.[0];

  return {
    binding,
    value: wrapped.value,
    status: extractStatus(provenance),
    source: latest?.source || null,
    confidence: latest?.confidence ?? null,
    updatedAt: latest?.updatedAt ?? null,
  };
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const keysParam = searchParams.get('keys');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);

    // Determine which bindings to resolve
    let bindingsToResolve: StrategyContextBinding[];

    if (keysParam) {
      // Resolve specific keys
      const keys = keysParam.split(',').map(k => k.trim());
      bindingsToResolve = keys
        .map(k => getBindingByContextKey(k))
        .filter((b): b is StrategyContextBinding => b !== undefined);
    } else {
      // Resolve all bindings
      bindingsToResolve = STRATEGY_CONTEXT_BINDINGS;
    }

    // Resolve all bindings
    const resolvedBindings = bindingsToResolve.map(binding =>
      resolveBinding(binding, graph)
    );

    // Compute readiness
    const readinessResult = computeBindingReadiness(resolvedBindings);

    // Get recommended next
    const recommendedNextBinding = getRecommendedNextBinding(resolvedBindings);
    const recommendedNext = recommendedNextBinding
      ? {
          strategyInputId: recommendedNextBinding.strategyInputId,
          contextKey: recommendedNextBinding.contextKey,
          label: recommendedNextBinding.shortLabel || recommendedNextBinding.label,
          route: recommendedNextBinding.getRoute(companyId),
        }
      : null;

    // Build response
    const response = {
      companyId,
      resolvedBindings: resolvedBindings.map(rb => ({
        binding: {
          strategyInputId: rb.binding.strategyInputId,
          contextKey: rb.binding.contextKey,
          zone: rb.binding.zone,
          required: rb.binding.required,
          type: rb.binding.type,
          label: rb.binding.label,
          shortLabel: rb.binding.shortLabel,
          section: rb.binding.section,
          strategyField: rb.binding.strategyField,
          emptyStateCTA: rb.binding.emptyStateCTA,
          aiProposable: rb.binding.aiProposable,
          readinessWeight: rb.binding.readinessWeight,
        },
        value: rb.value,
        status: rb.status,
        source: rb.source,
        confidence: rb.confidence,
        updatedAt: rb.updatedAt,
      })),
      readiness: {
        readinessPercent: readinessResult.readinessPercent,
        confirmedRequiredCount: readinessResult.confirmedRequiredCount,
        proposedRequiredCount: readinessResult.proposedRequiredCount,
        missingRequiredCount: readinessResult.missingRequiredCount,
        totalRequiredCount: readinessResult.totalRequiredCount,
        canSynthesize: readinessResult.canSynthesize,
        synthesizeBlockReason: readinessResult.synthesizeBlockReason,
      },
      recommendedNext,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] context/strategy-nodes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load context nodes' },
      { status: 500 }
    );
  }
}
