// app/api/os/programs/[programId]/artifacts/[artifactId]/route.ts
// Remove an artifact link from a program
//
// DELETE: Unlink an artifact from a program

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';

interface RouteParams {
  params: Promise<{ programId: string; artifactId: string }>;
}

// ============================================================================
// DELETE /api/os/programs/[programId]/artifacts/[artifactId]
// ============================================================================

interface UnlinkArtifactResponse {
  success: boolean;
  programId: string;
  artifactId: string;
  removed: boolean; // true if artifact was actually removed, false if not found
  error?: string;
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<UnlinkArtifactResponse>> {
  try {
    const { programId, artifactId } = await params;

    // Get the program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          programId,
          artifactId,
          removed: false,
          error: 'Program not found',
        },
        { status: 404 }
      );
    }

    const existingArtifacts = program.linkedArtifacts || [];

    // Check if artifact exists
    const artifactIndex = existingArtifacts.findIndex(a => a.artifactId === artifactId);
    if (artifactIndex === -1) {
      // Artifact not linked - idempotent success
      return NextResponse.json({
        success: true,
        programId,
        artifactId,
        removed: false,
      });
    }

    // Remove the artifact
    const updatedArtifacts = [
      ...existingArtifacts.slice(0, artifactIndex),
      ...existingArtifacts.slice(artifactIndex + 1),
    ];

    // Update program
    const updatedProgram = await updatePlanningProgram(programId, {
      linkedArtifacts: updatedArtifacts,
    });

    if (!updatedProgram) {
      return NextResponse.json(
        {
          success: false,
          programId,
          artifactId,
          removed: false,
          error: 'Failed to update program',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      programId,
      artifactId,
      removed: true,
    });
  } catch (error) {
    console.error('[Programs/Artifacts] DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        programId: '',
        artifactId: '',
        removed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
