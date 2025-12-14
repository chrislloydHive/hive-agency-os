// app/api/os/context/ensure-required/route.ts
// Ensure Required Context Keys API
//
// Creates ghost nodes for any required context keys that are missing.
// This makes blockers visible and clickable in the Context Map.
//
// POST /api/os/context/ensure-required
// Body: { companyId: string }
//
// Returns:
// - createdKeys: Keys that were created as ghost nodes
// - existingKeys: Keys that already existed
// - blockedByKeys: All keys that are still blocking (missing or not confirmed)

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createGhostNode } from '@/lib/contextGraph/nodes/types';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import {
  REQUIRED_CONTEXT_KEYS,
  type RequiredContextKey,
} from '@/lib/os/context/requiredContextKeys';
import {
  auditContextCoverage,
  type ContextCoverageAudit,
} from '@/lib/os/context/auditContextCoverage';

// ============================================================================
// Types
// ============================================================================

interface EnsureRequiredRequest {
  companyId: string;
}

interface EnsureRequiredResponse {
  success: boolean;
  companyId: string;
  /** Keys that were newly created as ghost nodes */
  createdKeys: string[];
  /** Keys that already existed with values */
  existingKeys: string[];
  /** All keys that are still blocking strategy */
  blockedByKeys: string[];
  /** Ghost nodes created for the UI to render */
  ghostNodes: HydratedContextNode[];
  /** Full audit result for detailed info */
  audit: ContextCoverageAudit;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a hydrated ghost node from a required key definition
 */
function createHydratedGhostNode(requiredKey: RequiredContextKey): HydratedContextNode {
  const baseNode = createGhostNode(
    requiredKey.key,
    requiredKey.domain,
    requiredKey.label,
    requiredKey.reason
  );

  return {
    ...baseNode,
    // Additional fields for HydratedContextNode
    label: requiredKey.label,
    zoneId: requiredKey.zoneId,
    domain: requiredKey.domain,
    fieldPath: requiredKey.key,
    valueType: requiredKey.type,
    // Ghost-specific fields
    isGhost: true,
    ghostReason: requiredKey.reason,
    ghostDescription: requiredKey.description,
    // Required for display
    shortLabel: requiredKey.shortLabel,
    description: requiredKey.description,
    requiredFor: requiredKey.requiredFor,
  } as HydratedContextNode & {
    isGhost: boolean;
    ghostReason: string;
    ghostDescription?: string;
  };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EnsureRequiredRequest;
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[EnsureRequired] Processing request for company ${companyId}`);

    // Load the context graph
    const graph = await loadContextGraph(companyId);

    if (!graph) {
      // No graph exists - all keys are missing, create all ghost nodes
      console.log(`[EnsureRequired] No graph found for ${companyId}, creating all ghost nodes`);

      const ghostNodes = REQUIRED_CONTEXT_KEYS.map(createHydratedGhostNode);
      const createdKeys = REQUIRED_CONTEXT_KEYS.map(k => k.key);

      return NextResponse.json({
        success: true,
        companyId,
        createdKeys,
        existingKeys: [],
        blockedByKeys: createdKeys,
        ghostNodes,
        audit: {
          companyId,
          presentKeys: [],
          missingKeys: REQUIRED_CONTEXT_KEYS.map(k => ({
            requiredKey: k,
            checkedKeys: [k.key, ...(k.alternatives || [])],
          })),
          blockedByKeys: REQUIRED_CONTEXT_KEYS.map(k => ({
            requiredKey: k,
            reason: 'missing' as const,
          })),
          mismatchedKeys: [],
          stats: {
            totalRequired: REQUIRED_CONTEXT_KEYS.length,
            presentCount: 0,
            missingCount: REQUIRED_CONTEXT_KEYS.length,
            blockedCount: REQUIRED_CONTEXT_KEYS.length,
            completenessPercent: 0,
          },
          auditedAt: new Date().toISOString(),
        },
      } satisfies EnsureRequiredResponse);
    }

    // Audit the context coverage
    const audit = auditContextCoverage(companyId, graph);

    // Create ghost nodes for missing keys
    const ghostNodes = audit.missingKeys.map(missing =>
      createHydratedGhostNode(missing.requiredKey)
    );

    const createdKeys = audit.missingKeys.map(m => m.requiredKey.key);
    const existingKeys = audit.presentKeys.map(p => p.requiredKey.key);
    const blockedByKeys = audit.blockedByKeys.map(b => b.requiredKey.key);

    console.log(`[EnsureRequired] Company ${companyId}:`, {
      created: createdKeys.length,
      existing: existingKeys.length,
      blocked: blockedByKeys.length,
    });

    return NextResponse.json({
      success: true,
      companyId,
      createdKeys,
      existingKeys,
      blockedByKeys,
      ghostNodes,
      audit,
    } satisfies EnsureRequiredResponse);
  } catch (error) {
    console.error('[EnsureRequired] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler (for debugging)
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId query param is required' },
      { status: 400 }
    );
  }

  // Use POST handler logic
  const body = { companyId };
  const syntheticRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return POST(syntheticRequest);
}
