// app/api/os/companies/[companyId]/strategy/compare/route.ts
// GET /api/os/companies/[companyId]/strategy/compare
//
// Returns existing comparison if hashes match, otherwise returns needs_generation
//
// Query params:
// - strategyIds: comma-separated list of 2-4 strategy IDs

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getStrategiesForCompany, getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import {
  findComparisonByStrategyIds,
  isComparisonStale,
} from '@/lib/os/strategy/comparison';
import {
  hashContext,
  hashObjectives,
  hashStrategy,
} from '@/lib/os/strategy/hashes';
import type { ComparisonBasedOnHashes, ComparisonCheckResponse } from '@/lib/types/strategyComparison';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - Check for existing comparison
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const strategyIdsParam = searchParams.get('strategyIds');

    // Validate strategyIds
    if (!strategyIdsParam) {
      return NextResponse.json(
        { error: 'strategyIds query parameter is required' },
        { status: 400 }
      );
    }

    const strategyIds = strategyIdsParam.split(',').filter(Boolean);

    if (strategyIds.length < 2 || strategyIds.length > 4) {
      return NextResponse.json(
        { error: 'Must provide 2-4 strategy IDs for comparison' },
        { status: 400 }
      );
    }

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Validate all strategies exist and belong to this company
    const allStrategies = await getStrategiesForCompany(companyId);
    const strategyMap = new Map(allStrategies.map(s => [s.id, s]));

    for (const id of strategyIds) {
      if (!strategyMap.has(id)) {
        return NextResponse.json(
          { error: `Strategy ${id} not found or does not belong to this company` },
          { status: 404 }
        );
      }
    }

    // Get context for hash computation
    const context = await getCompanyContext(companyId);
    const activeStrategy = await getActiveStrategy(companyId);

    // Compute current hashes
    const currentHashes: ComparisonBasedOnHashes = {
      contextHash: hashContext(context),
      objectivesHash: hashObjectives(activeStrategy?.objectives || []),
      strategyHashes: {},
    };

    // Hash each strategy being compared
    for (const id of strategyIds) {
      const strategy = strategyMap.get(id)!;
      currentHashes.strategyHashes[id] = hashStrategy({
        title: strategy.title,
        summary: strategy.summary,
        pillars: strategy.pillars,
        strategyFrame: strategy.strategyFrame,
        tradeoffs: strategy.tradeoffs,
      });
    }

    // Check for existing comparison
    const existingComparison = await findComparisonByStrategyIds(companyId, strategyIds);

    if (!existingComparison) {
      // No existing comparison found
      const response: ComparisonCheckResponse = {
        mode: 'needs_generation',
        currentHashes,
      };
      return NextResponse.json(response);
    }

    // Check if existing comparison is stale
    const { isStale, reason } = isComparisonStale(existingComparison, currentHashes);

    if (isStale) {
      const response: ComparisonCheckResponse = {
        mode: 'stale',
        comparison: existingComparison,
        currentHashes,
        staleReason: reason || 'Inputs have changed since comparison was generated',
      };
      return NextResponse.json(response);
    }

    // Return existing comparison
    const response: ComparisonCheckResponse = {
      mode: 'found',
      comparison: existingComparison,
      currentHashes,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /strategy/compare] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check comparison', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
