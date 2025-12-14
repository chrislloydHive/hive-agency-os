// app/api/os/companies/[companyId]/strategy/promote/route.ts
// API route for promoting artifacts to canonical strategy
//
// POST - Promote artifact(s) to canonical strategy
//
// GUARDRAIL: This is the only way to create/update canonical strategy
// from artifacts. Ensures traceability and immutability.

import { NextResponse } from 'next/server';
import {
  getArtifactById,
} from '@/lib/os/strategy/artifacts';
import {
  promoteArtifactAsStrategy,
  promoteMultipleArtifacts,
} from '@/lib/os/strategy/promotion';
import {
  assertCanPromoteArtifact,
  StrategyGuardrailError,
} from '@/lib/os/strategy/guardrails';

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

// POST /api/os/companies/[companyId]/strategy/promote
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    // Support both single and multiple artifact promotion
    const artifactIds: string[] = body.artifactIds || (body.artifactId ? [body.artifactId] : []);

    if (artifactIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one artifact ID is required' },
        { status: 400 }
      );
    }

    // Single artifact promotion
    if (artifactIds.length === 1) {
      const artifact = await getArtifactById(artifactIds[0]);
      if (!artifact) {
        return NextResponse.json(
          { error: 'Artifact not found' },
          { status: 404 }
        );
      }

      // GUARDRAIL: Check if artifact can be promoted
      try {
        assertCanPromoteArtifact(artifact);
      } catch (err) {
        if (err instanceof StrategyGuardrailError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: 400 }
          );
        }
        throw err;
      }

      // Use artifact content to build strategy
      const result = await promoteArtifactAsStrategy({
        artifactId: artifactIds[0],
        companyId,
        title: body.title || artifact.title,
        summary: body.summary || artifact.content.slice(0, 500),
        objectives: body.objectives,
        pillars: body.pillars,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Promotion failed' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        artifact: result.artifact,
        strategy: result.strategy,
      });
    }

    // Multiple artifact promotion
    const result = await promoteMultipleArtifacts(
      companyId,
      artifactIds,
      {
        title: body.title || 'Strategy from Artifacts',
        summary: body.summary || '',
        objectives: body.objectives,
        pillars: body.pillars,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Promotion failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      artifact: result.artifact,
      strategy: result.strategy,
    });
  } catch (error) {
    console.error('[strategy/promote/route] POST error:', error);
    if (error instanceof StrategyGuardrailError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to promote artifact' },
      { status: 500 }
    );
  }
}
