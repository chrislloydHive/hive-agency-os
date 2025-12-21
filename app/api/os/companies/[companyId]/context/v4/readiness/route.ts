// app/api/os/companies/[companyId]/context/v4/readiness/route.ts
// Context V4 Readiness Gate API
//
// Returns context readiness score for Strategy generation.
// Strategy should respect readiness (warn/block below threshold).

import { NextRequest, NextResponse } from 'next/server';
import { loadContextFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  REQUIRED_STRATEGY_KEYS_V4,
  type ContextReadinessV4,
} from '@/lib/types/contextField';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/** Default readiness threshold (60%) */
const DEFAULT_THRESHOLD = 60;

/**
 * GET /api/os/companies/[companyId]/context/v4/readiness
 *
 * Returns context readiness for strategy generation.
 *
 * Query params:
 * - threshold: number (default 60) - readiness threshold for "ready" flag
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check feature flag
  if (!isContextV4Enabled()) {
    return NextResponse.json({
      ok: false,
      error: 'Context V4 is not enabled',
    }, { status: 404 });
  }

  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const threshold = parseInt(searchParams.get('threshold') || String(DEFAULT_THRESHOLD), 10);

    // Load V4 store
    const store = await loadContextFieldsV4(companyId);

    // Calculate counts
    let confirmedCount = 0;
    let proposedCount = 0;

    const confirmedKeys = new Set<string>();
    const proposedKeys = new Set<string>();

    if (store) {
      for (const field of Object.values(store.fields)) {
        if (field.status === 'confirmed') {
          confirmedCount++;
          confirmedKeys.add(field.key);
        } else if (field.status === 'proposed') {
          proposedCount++;
          proposedKeys.add(field.key);
        }
      }
    }

    // Calculate required key status
    const requiredKeysConfirmed: string[] = [];
    const requiredKeysProposed: string[] = [];
    const requiredKeysMissing: string[] = [];

    for (const key of REQUIRED_STRATEGY_KEYS_V4) {
      if (confirmedKeys.has(key)) {
        requiredKeysConfirmed.push(key);
      } else if (proposedKeys.has(key)) {
        requiredKeysProposed.push(key);
      } else {
        requiredKeysMissing.push(key);
      }
    }

    // Calculate readiness score
    // Formula: (confirmed required / total required) * 100
    // Proposed count for half credit
    const totalRequired = REQUIRED_STRATEGY_KEYS_V4.length;
    const confirmedWeight = requiredKeysConfirmed.length;
    const proposedWeight = requiredKeysProposed.length * 0.5; // Half credit for proposed
    const readinessScore = totalRequired > 0
      ? Math.round(((confirmedWeight + proposedWeight) / totalRequired) * 100)
      : 0;

    const ready = readinessScore >= threshold;

    // Check for error state (we'd need to check recent lab runs)
    // For now, use a simple heuristic - no error state if we have any confirmed fields
    const hasErrorState = false; // TODO: Check recent lab runs for error state

    const readiness: ContextReadinessV4 = {
      readinessScore,
      ready,
      threshold,
      requiredKeysMissing,
      requiredKeysConfirmed,
      requiredKeysProposed,
      confirmedCount,
      proposedCount,
      hasErrorState,
    };

    return NextResponse.json({
      ok: true,
      companyId,
      ...readiness,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 Readiness] Error:', errorMessage);

    return NextResponse.json({
      ok: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
