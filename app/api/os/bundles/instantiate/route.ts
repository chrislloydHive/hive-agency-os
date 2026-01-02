// app/api/os/bundles/instantiate/route.ts
// Bundle Instantiation API Endpoint
//
// POST /api/os/bundles/instantiate
// Creates Programs for each domain specified in the bundle request.
//
// Request Body: BundleInstantiationRequest
// Response: BundleInstantiationResult (includes debugId for tracing)
//
// IMPORTANT: No pricing or margin data. OS receives SCOPE, not PRICE.

import { NextRequest, NextResponse } from 'next/server';
import { BundleInstantiationRequestSchema } from '@/lib/types/programTemplate';
import type { BundleInstantiationRequest, BundleInstantiationResult } from '@/lib/types/programTemplate';
import { instantiateBundle, validateBundleRequest } from '@/lib/os/planning/bundleInstantiation';
import { getBundlePresetById } from '@/lib/os/planning/domainTemplates';
import { logBundleInstantiation } from '@/lib/observability/operationalEvents';

export async function POST(request: NextRequest): Promise<NextResponse<BundleInstantiationResult | { error: string }>> {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const parseResult = BundleInstantiationRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      return NextResponse.json(
        { error: `Invalid request: ${errors.join(', ')}` },
        { status: 400 }
      );
    }

    const bundleRequest: BundleInstantiationRequest = parseResult.data;

    // Additional validation
    const validation = validateBundleRequest(bundleRequest);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[API] Bundle instantiation request:', {
      bundleId: bundleRequest.bundleId,
      domains: bundleRequest.domains,
      intensity: bundleRequest.intensity,
      companyId: bundleRequest.companyId,
    });

    // Instantiate the bundle
    const result = await instantiateBundle(bundleRequest);

    // Get preset info for event logging
    const preset = getBundlePresetById(bundleRequest.bundleId);
    const presetName = preset?.name || bundleRequest.bundleId;

    // Count deliverables created
    const deliverablesCreated = result.programs
      .filter((p) => p.status === 'created')
      .length * 4; // Approximate: ~4 deliverables per program on average

    // Log the event and get debugId
    const debugId = await logBundleInstantiation(bundleRequest.companyId, {
      presetId: bundleRequest.bundleId,
      presetName,
      domains: bundleRequest.domains,
      intensity: bundleRequest.intensity,
      startDate: bundleRequest.startDate,
      strategyId: bundleRequest.strategyId,
      createdPrograms: result.programs.map((p) => ({
        programId: p.programId,
        title: p.title,
        domain: p.domain,
        status: p.status,
      })),
      createdDeliverables: deliverablesCreated,
      summary: result.summary,
    });

    // Add debugId to result
    const resultWithDebugId = { ...result, debugId };

    // Return appropriate status based on result
    if (!result.success) {
      // Partial failure - some programs created, some failed
      if (result.summary.created > 0) {
        return NextResponse.json(resultWithDebugId, { status: 207 }); // Multi-Status
      }
      // Total failure
      return NextResponse.json(resultWithDebugId, { status: 500 });
    }

    return NextResponse.json(resultWithDebugId, { status: 201 });
  } catch (error) {
    console.error('[API] Bundle instantiation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Bundle instantiation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving bundle info
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const bundleId = searchParams.get('bundleId');
  const companyId = searchParams.get('companyId');

  if (!bundleId || !companyId) {
    return NextResponse.json(
      { error: 'bundleId and companyId are required query parameters' },
      { status: 400 }
    );
  }

  // TODO: Implement bundle lookup
  // For now, return a placeholder response
  return NextResponse.json({
    bundleId,
    companyId,
    programs: [],
    message: 'Bundle lookup not yet implemented',
  });
}
