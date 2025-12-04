// app/api/os/companies/[companyId]/context-rebuild/route.ts
// Context Graph Rebuild API endpoint
//
// POST /api/os/companies/[companyId]/context-rebuild
// Triggers a full rebuild of the company's context graph

import { NextRequest, NextResponse } from 'next/server';
import { runFusion } from '@/lib/contextGraph/fusion';

export const maxDuration = 60; // Allow up to 1 minute for fusion

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Context rebuild request for company:', companyId);

    // Parse optional options from body
    let forceRebuild = false;
    try {
      const body = await request.json();
      if (body.forceRebuild !== undefined) {
        forceRebuild = body.forceRebuild;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Run fusion
    const result = await runFusion(companyId, {
      forceRebuild,
      snapshotReason: 'manual_rebuild',
      snapshotDescription: 'Manual rebuild via API',
    });

    console.log('[API] Context rebuild complete:', {
      companyId,
      success: result.success,
      fieldsUpdated: result.fieldsUpdated,
      sourcesUsed: result.sourcesUsed,
      versionId: result.versionId,
    });

    return NextResponse.json({
      ok: true,
      success: result.success,
      fieldsUpdated: result.fieldsUpdated,
      sourcesUsed: result.sourcesUsed,
      versionId: result.versionId,
      errors: result.errors,
      durationMs: result.durationMs,
      graph: {
        meta: {
          completenessScore: result.graph.meta.completenessScore,
          updatedAt: result.graph.meta.updatedAt,
          lastFusionAt: result.graph.meta.lastFusionAt,
          domainCoverage: result.graph.meta.domainCoverage,
        },
      },
    });
  } catch (error) {
    console.error('[API] Context rebuild error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
