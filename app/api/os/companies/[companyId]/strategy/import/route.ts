// app/api/os/companies/[companyId]/strategy/import/route.ts
// POST to import an approved strategy (bypasses labs/context requirements)

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { createDraftStrategy, getStrategiesForCompany, setActiveStrategy } from '@/lib/os/strategy';
import type { StrategyFrame } from '@/lib/types/strategy';

interface ImportStrategyRequest {
  name: string;
  status?: 'approved' | 'active' | 'draft';
  intent?: string;
  constraints?: string;
  optimizationScope?: string;
}

/**
 * POST /api/os/companies/[companyId]/strategy/import
 *
 * Creates a new strategy with origin='imported'.
 * This bypasses the normal labs/context flow for pre-approved strategies.
 *
 * Idempotency: If a strategy with the same name and origin='imported' exists,
 * returns the existing strategy instead of creating a new one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
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

    // Parse request body
    const body = (await request.json()) as ImportStrategyRequest;

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Strategy name is required' },
        { status: 400 }
      );
    }

    const strategyName = body.name.trim();

    // Idempotency check: look for existing imported strategy with same name
    const existingStrategies = await getStrategiesForCompany(companyId);
    const existingImported = existingStrategies.find(
      s => s.origin === 'imported' && s.title === strategyName
    );

    if (existingImported) {
      console.log('[Import Strategy] Found existing imported strategy:', existingImported.id);
      return NextResponse.json({
        status: 'ok',
        strategyId: existingImported.id,
        existing: true,
      });
    }

    // Build strategy frame with imported strategy fields
    const strategyFrame: StrategyFrame = {};

    if (body.intent) {
      strategyFrame.intent = body.intent.trim();
    }

    if (body.constraints) {
      strategyFrame.constraints = body.constraints.trim();
    }

    if (body.optimizationScope) {
      strategyFrame.optimizationScope = body.optimizationScope.trim();
    }

    // Map status to our internal values
    // 'approved' and 'active' both map to 'finalized' (ready for execution)
    const internalStatus = body.status === 'draft' ? 'draft' : 'finalized';

    // Create the imported strategy
    const strategy = await createDraftStrategy({
      companyId,
      title: strategyName,
      summary: body.intent || `Imported strategy for ${company.name}`,
      origin: 'imported',
      status: internalStatus,
      strategyFrame: Object.keys(strategyFrame).length > 0 ? strategyFrame : undefined,
      objectives: [],
      pillars: [],
    });

    // Ensure this strategy is active (unsets others)
    await setActiveStrategy(companyId, strategy.id);

    console.log('[Import Strategy] Created imported strategy:', {
      strategyId: strategy.id,
      companyId,
      status: internalStatus,
    });

    return NextResponse.json({
      status: 'ok',
      strategyId: strategy.id,
      existing: false,
    });
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/import] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import strategy' },
      { status: 500 }
    );
  }
}
