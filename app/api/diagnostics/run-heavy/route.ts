// app/api/os/diagnostics/run-heavy/route.ts
// API route for running Heavy Worker V4 diagnostics

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runHeavyWorkerV4 } from '@/lib/gap-heavy/orchestratorV4';
import type { DiagnosticModuleKey } from '@/lib/gap-heavy/types';
import { z } from 'zod';

// ============================================================================
// Request Schema
// ============================================================================

const RunHeavyRequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  modules: z
    .array(
      z.enum(['seo', 'content', 'website', 'brand', 'demand', 'ops'])
    )
    .optional(),
});

type RunHeavyRequest = z.infer<typeof RunHeavyRequestSchema>;

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/os/diagnostics/run-heavy
 *
 * Run Heavy Worker V4 diagnostics with selected modules
 *
 * Request Body:
 * {
 *   "companyId": "recXXXXXXXXXXXXXX",  // Required: Airtable Company record ID
 *   "modules": ["seo", "demand"]        // Optional: defaults to all modules
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "runId": "recYYYYYYYYYYYYYY",
 *   "status": "completed",
 *   "modulesRequested": ["seo", "demand"],
 *   "modulesCompleted": ["seo", "demand"],
 *   "results": {
 *     "seo": { score: 72, summary: "...", ... },
 *     "demand": { score: undefined, summary: "...", ... }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. Parse and Validate Request Body
    // ========================================================================

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[run-heavy] Failed to parse request body:', jsonError);
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details: jsonError instanceof Error ? jsonError.message : 'Failed to parse JSON',
        },
        { status: 400 }
      );
    }

    const validation = RunHeavyRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { companyId, modules } = validation.data;

    console.log('[run-heavy] Running Heavy Worker V4:', {
      companyId,
      requestedModules: modules || 'all',
    });

    // ========================================================================
    // 2. Look Up Company Record
    // ========================================================================

    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        {
          error: 'Company not found',
          companyId,
        },
        { status: 404 }
      );
    }

    if (!company.website) {
      return NextResponse.json(
        {
          error: 'Company does not have a website URL configured',
          companyId,
          companyName: company.name,
        },
        { status: 400 }
      );
    }

    console.log('[run-heavy] Found company:', {
      id: company.id,
      name: company.name,
      website: company.website,
    });

    // ========================================================================
    // 3. Run Heavy Worker V4
    // ========================================================================

    const startTime = Date.now();

    const result = await runHeavyWorkerV4({
      companyId: company.id,
      websiteUrl: company.website,
      requestedModules: modules as DiagnosticModuleKey[] | undefined,
      enableWebsiteLabV4: true, // Enable V4/V5 multi-page UX lab with consultant report
    });

    const duration = Date.now() - startTime;

    console.log('[run-heavy] Heavy Worker V4 completed:', {
      runId: result.runId,
      status: result.state.status,
      modulesCompleted: result.modulesCompleted.length,
      duration: `${duration}ms`,
    });

    // ========================================================================
    // 4. Build Response
    // ========================================================================

    // Extract module results from evidence pack
    const moduleResults: Record<string, {
      score?: number;
      summary?: string;
      status: string;
      issues?: string[];
      recommendations?: string[];
    }> = {};

    for (const moduleResult of result.evidencePack.modules) {
      moduleResults[moduleResult.module] = {
        status: moduleResult.status,
        score: moduleResult.score,
        summary: moduleResult.summary,
        issues: moduleResult.issues,
        recommendations: moduleResult.recommendations,
      };
    }

    return NextResponse.json(
      {
        success: true,
        runId: result.runId,
        status: result.state.status,
        companyId: company.id,
        companyName: company.name,
        websiteUrl: company.website,
        modulesRequested: result.modulesRequested,
        modulesCompleted: result.modulesCompleted,
        results: moduleResults,
        duration,
        createdAt: result.state.createdAt,
        completedAt: result.state.updatedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    // ========================================================================
    // Error Handling
    // ========================================================================

    console.error('[run-heavy] Error running Heavy Worker V4:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Check for specific error types
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Resource not found',
          message: errorMessage,
        },
        { status: 404 }
      );
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        {
          error: 'Request timeout',
          message: 'Heavy Worker V4 took too long to complete. The run may still be processing in the background.',
        },
        { status: 504 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler (Optional - for checking status)
// ============================================================================

/**
 * GET /api/os/diagnostics/run-heavy?runId=recXXXX
 *
 * Check status of a Heavy Worker V4 run
 *
 * Query Parameters:
 * - runId: Airtable GAP-Heavy Run record ID
 *
 * Response:
 * {
 *   "runId": "recXXXXXXXXXXXXXX",
 *   "status": "running" | "completed" | "error",
 *   "modulesRequested": ["seo", "demand"],
 *   "modulesCompleted": ["seo"],
 *   "currentStep": "seo",
 *   ...
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        {
          error: 'Missing runId query parameter',
        },
        { status: 400 }
      );
    }

    // Import here to avoid circular dependencies
    const { getHeavyGapRunById } = await import('@/lib/airtable/gapHeavyRuns');

    const state = await getHeavyGapRunById(runId);

    if (!state) {
      return NextResponse.json(
        {
          error: 'Heavy run not found',
          runId,
        },
        { status: 404 }
      );
    }

    // Build module results if evidence pack exists
    const moduleResults: Record<string, {
      score?: number;
      summary?: string;
      status: string;
    }> = {};

    if (state.evidencePack?.modules) {
      for (const moduleResult of state.evidencePack.modules) {
        moduleResults[moduleResult.module] = {
          status: moduleResult.status,
          score: moduleResult.score,
          summary: moduleResult.summary,
        };
      }
    }

    return NextResponse.json(
      {
        runId: state.id,
        status: state.status,
        workerVersion: state.workerVersion,
        modulesRequested: state.modulesRequested || [],
        modulesCompleted: state.modulesCompleted || [],
        results: moduleResults,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        errorMessage: state.errorMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[run-heavy] Error fetching Heavy run status:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
