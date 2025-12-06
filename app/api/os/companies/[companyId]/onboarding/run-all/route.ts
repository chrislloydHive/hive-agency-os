// app/api/os/companies/[companyId]/onboarding/run-all/route.ts
// "Run Everything Once" Onboarding API
//
// POST - Runs full baseline context build: FCB → Labs → Snapshot
// GET - Returns current onboarding status / eligibility
//
// NOTE: This now delegates to runBaselineContextBuild which is the canonical
// "Run Everything Once" function for initializing company context.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  runBaselineContextBuild,
  getBaselineStatus,
  type BaselineBuildInput,
} from '@/lib/contextGraph/baseline';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { loadContextGraph } from '@/lib/contextGraph/storage';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// GET - Check onboarding/baseline eligibility and status
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get baseline status (includes initialization state and health)
    const baselineStatus = await getBaselineStatus(companyId);

    // Check if graph exists
    const graph = await loadContextGraph(companyId);
    const hasGraph = !!graph;

    // Determine recommendation
    const hasDomain = !!(company.domain || company.website);
    const needsOnboarding = !baselineStatus.initialized || baselineStatus.healthScore < 50;

    return NextResponse.json({
      companyId,
      companyName: company.name,
      hasDomain,
      domain: company.domain || company.website,
      hasExistingContext: hasGraph,
      currentHealth: baselineStatus.healthScore,
      completeness: baselineStatus.completeness,
      severity: baselineStatus.healthScore >= 70 ? 'healthy'
        : baselineStatus.healthScore >= 40 ? 'partial'
        : 'unhealthy',
      initialized: baselineStatus.initialized,
      initializedAt: baselineStatus.initializedAt,
      needsOnboarding,
      recommendation: !baselineStatus.initialized
        ? 'Baseline context build recommended - company not yet initialized'
        : needsOnboarding
          ? 'Context rebuild recommended - health is low'
          : 'Context is healthy, but can still be refreshed if needed',
      canRun: hasDomain,
      blockerReason: !hasDomain ? 'No domain configured for this company' : null,
    });
  } catch (error) {
    console.error('[Onboarding API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check onboarding status' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Run full baseline context build
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let options: Partial<BaselineBuildInput> = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // No body is fine
    }

    console.log(`[Onboarding API] Starting baseline context build for ${company.name}`);

    // Run the canonical baseline context build
    const result = await runBaselineContextBuild({
      companyId,
      force: options.force ?? false,
      dryRun: options.dryRun ?? false,
    });

    // Return result with summary (matching existing response format for compatibility)
    return NextResponse.json({
      success: result.success,
      companyId: result.companyId,
      companyName: result.companyName,
      runId: result.runId,
      durationMs: result.totalDurationMs,
      steps: result.steps,
      summary: result.summary,
      wasNoOp: result.wasNoOp,
      contextHealthBefore: {
        score: result.contextBefore.overallScore,
        severity: result.contextBefore.severity,
      },
      contextHealthAfter: {
        score: result.contextAfter.overallScore,
        severity: result.contextAfter.severity,
      },
      sectionsTouched: result.sectionsTouched,
      snapshotId: result.snapshotId,
      error: result.error,
      // Include full result for debugging
      fullResult: result,
    });
  } catch (error) {
    console.error('[Onboarding API] POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run baseline context build',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
