// app/api/internal/testing/run-golden/route.ts
// Golden Test Runner API
//
// POST /api/internal/testing/run-golden
// Runs diagnostics for all golden test companies and returns validation results
//
// Optional body:
// - goldenIds: string[] - specific golden company IDs to test
// - parallel: boolean - run tests in parallel (default: false)

import { NextRequest, NextResponse } from 'next/server';
import {
  runGoldenDiagnostics,
  formatGoldenSummary,
} from '@/lib/testing/runGoldenDiagnostics';
import { GOLDEN_COMPANIES } from '@/lib/testing/goldenCompanies';

// Long timeout for full test run (5 minutes)
export const maxDuration = 300;

// ============================================================================
// GET - List golden companies
// ============================================================================

export async function GET() {
  return NextResponse.json({
    description: 'Golden Test Set for Diagnostics Validation',
    usage: {
      list: 'GET /api/internal/testing/run-golden',
      runAll: 'POST /api/internal/testing/run-golden',
      runSpecific: 'POST /api/internal/testing/run-golden { goldenIds: ["golden-marketplace-fitness"] }',
    },
    companies: GOLDEN_COMPANIES.map(c => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      expectedVertical: c.expectedVertical,
      expectedArchetype: c.expectedArchetype,
      validates: c.validates,
    })),
  });
}

// ============================================================================
// POST - Run golden tests
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[golden-api] Received request to run golden tests');

  try {
    // Parse request body
    let body: { goldenIds?: string[]; parallel?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine - run all tests
    }

    const { goldenIds, parallel = false } = body;

    // Validate goldenIds if provided
    if (goldenIds && goldenIds.length > 0) {
      const validIds = GOLDEN_COMPANIES.map(c => c.id);
      const invalidIds = goldenIds.filter(id => !validIds.includes(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Invalid golden IDs',
            invalidIds,
            validIds,
          },
          { status: 400 }
        );
      }
    }

    // Run the tests
    console.log(`[golden-api] Running tests for: ${goldenIds?.join(', ') || 'all companies'}`);
    const summary = await runGoldenDiagnostics({ goldenIds, parallel });

    // Generate formatted output for logs
    const formattedSummary = formatGoldenSummary(summary);
    console.log('\n' + formattedSummary + '\n');

    // Return concise response
    return NextResponse.json({
      status: summary.overallStatus,
      summary: {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        errored: summary.errored,
        durationMs: summary.totalDurationMs,
      },
      results: summary.results.map(r => ({
        company: r.company,
        status: r.status,
        archetype: r.archetype,
        expectedArchetype: r.expectedArchetype,
        archetypeMatch: r.archetypeMatch,
        vertical: r.vertical,
        expectedVertical: r.expectedVertical,
        verticalMatch: r.verticalMatch,
        topCompetitors: r.topCompetitors.slice(0, 5),
        agencyCompetitorCount: r.agencyCompetitorCount,
        contextSummaryPresent: r.contextSummaryPresent,
        durationMs: r.durationMs,
        failureReasons: r.failureReasons,
        error: r.error,
      })),
      failures: summary.failureSummary,
    });
  } catch (error) {
    console.error('[golden-api] Error running golden tests:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      },
      { status: 500 }
    );
  }
}
