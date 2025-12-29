// app/api/os/companies/[companyId]/strategy/[strategyId]/versions/route.ts
// Strategy Versions API
//
// GET - List all versions for a strategy
// POST - Create manual version (snapshot current state)

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/lib/os/strategy';
import {
  listStrategyVersions,
  createStrategyVersion,
  getLatestStrategyVersion,
} from '@/lib/airtable/strategyVersions';
import { createStrategySnapshot } from '@/lib/types/strategyEvolution';
import type { CompanyStrategy } from '@/lib/types/strategy';

// ============================================================================
// GET - List strategy versions
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { strategyId } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    if (!strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    const versions = await listStrategyVersions(strategyId, { limit });
    const latestVersion = versions[0] || null;

    return NextResponse.json({
      versions,
      currentVersion: latestVersion?.versionNumber || 0,
      totalVersions: versions.length,
    });
  } catch (error) {
    console.error('[GET /versions] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list versions' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create manual version (snapshot current state)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    // Load current strategy
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Create snapshot
    const snapshot = createStrategySnapshot(strategy as CompanyStrategy);

    // Create version (idempotent by hash - won't create duplicate)
    const version = await createStrategyVersion({
      companyId,
      strategyId,
      snapshot,
      trigger: 'manual',
    });

    // Check if this was a new version or existing
    const latestVersion = await getLatestStrategyVersion(strategyId);
    const isNew = latestVersion?.id === version.id;

    return NextResponse.json({
      success: true,
      version,
      isNew,
      message: isNew
        ? `Created version ${version.versionNumber}`
        : `Version ${version.versionNumber} already exists with same content`,
    });
  } catch (error) {
    console.error('[POST /versions] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create version' },
      { status: 500 }
    );
  }
}
