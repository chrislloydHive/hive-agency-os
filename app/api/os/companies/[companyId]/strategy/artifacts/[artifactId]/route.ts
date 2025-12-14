// app/api/os/companies/[companyId]/strategy/artifacts/[artifactId]/route.ts
// API routes for individual strategy artifact
//
// GET - Get artifact by ID
// PATCH - Update artifact
// DELETE - Delete artifact

import { NextResponse } from 'next/server';
import {
  getArtifactById,
  updateArtifact,
  deleteArtifact,
} from '@/lib/os/strategy/artifacts';
import {
  assertCanEditArtifact,
  StrategyGuardrailError,
} from '@/lib/os/strategy/guardrails';

type RouteParams = {
  params: Promise<{ companyId: string; artifactId: string }>;
};

// GET /api/os/companies/[companyId]/strategy/artifacts/[artifactId]
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { artifactId } = await params;
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error('[artifacts/[artifactId]/route] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifact' },
      { status: 500 }
    );
  }
}

// PATCH /api/os/companies/[companyId]/strategy/artifacts/[artifactId]
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { artifactId } = await params;
    const body = await request.json();

    // Validate that artifact exists
    const existing = await getArtifactById(artifactId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // GUARDRAIL: Check if artifact can be edited
    try {
      assertCanEditArtifact(existing);
    } catch (err) {
      if (err instanceof StrategyGuardrailError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 400 }
        );
      }
      throw err;
    }

    const artifact = await updateArtifact({
      artifactId,
      updates: {
        title: body.title,
        content: body.content,
        status: body.status,
        linkedArtifactIds: body.linkedArtifactIds,
      },
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error('[artifacts/[artifactId]/route] PATCH error:', error);
    if (error instanceof StrategyGuardrailError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update artifact' },
      { status: 500 }
    );
  }
}

// DELETE /api/os/companies/[companyId]/strategy/artifacts/[artifactId]
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { artifactId } = await params;

    // Validate that artifact exists
    const existing = await getArtifactById(artifactId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // GUARDRAIL: Check if artifact can be edited (deleted)
    try {
      assertCanEditArtifact(existing);
    } catch (err) {
      if (err instanceof StrategyGuardrailError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 400 }
        );
      }
      throw err;
    }

    await deleteArtifact(artifactId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[artifacts/[artifactId]/route] DELETE error:', error);
    if (error instanceof StrategyGuardrailError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete artifact' },
      { status: 500 }
    );
  }
}
