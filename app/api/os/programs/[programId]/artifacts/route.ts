// app/api/os/programs/[programId]/artifacts/route.ts
// Manage artifact links for a program
//
// GET: List linked artifacts grouped by linkType
// POST: Link an artifact (idempotent - returns existing if already linked)

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  type ProgramArtifactLink,
  type ProgramArtifactLinkType,
  createProgramArtifactLink,
} from '@/lib/types/program';

interface RouteParams {
  params: Promise<{ programId: string }>;
}

// ============================================================================
// GET /api/os/programs/[programId]/artifacts
// ============================================================================

interface ArtifactsByType {
  outputs: ProgramArtifactLink[];
  inputs: ProgramArtifactLink[];
  references: ProgramArtifactLink[];
}

interface GetArtifactsResponse {
  success: boolean;
  programId: string;
  artifacts: ProgramArtifactLink[];
  byType: ArtifactsByType;
  total: number;
  error?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<GetArtifactsResponse>> {
  try {
    const { programId } = await params;

    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          programId,
          artifacts: [],
          byType: { outputs: [], inputs: [], references: [] },
          total: 0,
          error: 'Program not found',
        },
        { status: 404 }
      );
    }

    const artifacts = program.linkedArtifacts || [];

    // Group by type
    const byType: ArtifactsByType = {
      outputs: artifacts.filter(a => a.linkType === 'output'),
      inputs: artifacts.filter(a => a.linkType === 'input'),
      references: artifacts.filter(a => a.linkType === 'reference'),
    };

    return NextResponse.json({
      success: true,
      programId,
      artifacts,
      byType,
      total: artifacts.length,
    });
  } catch (error) {
    console.error('[Programs/Artifacts] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        programId: '',
        artifacts: [],
        byType: { outputs: [], inputs: [], references: [] },
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/os/programs/[programId]/artifacts
// ============================================================================

interface LinkArtifactRequest {
  artifactId: string;
  artifactTitle: string;
  artifactType: string;
  artifactStatus: 'draft' | 'final' | 'archived';
  linkType?: ProgramArtifactLinkType;
  linkedBy?: string;
}

interface LinkArtifactResponse {
  success: boolean;
  programId: string;
  artifact: ProgramArtifactLink | null;
  created: boolean; // false if artifact was already linked
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<LinkArtifactResponse>> {
  try {
    const { programId } = await params;
    const body = (await request.json()) as LinkArtifactRequest;

    // Validate required fields
    if (!body.artifactId || !body.artifactTitle || !body.artifactType || !body.artifactStatus) {
      return NextResponse.json(
        {
          success: false,
          programId,
          artifact: null,
          created: false,
          error: 'Missing required fields: artifactId, artifactTitle, artifactType, artifactStatus',
        },
        { status: 400 }
      );
    }

    // Get the program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          programId,
          artifact: null,
          created: false,
          error: 'Program not found',
        },
        { status: 404 }
      );
    }

    const existingArtifacts = program.linkedArtifacts || [];

    // Check if artifact is already linked (idempotent)
    const existing = existingArtifacts.find(a => a.artifactId === body.artifactId);
    if (existing) {
      return NextResponse.json({
        success: true,
        programId,
        artifact: existing,
        created: false,
      });
    }

    // Create new artifact link
    const newLink = createProgramArtifactLink(
      body.artifactId,
      body.artifactTitle,
      body.artifactType,
      body.artifactStatus,
      body.linkType || 'output',
      body.linkedBy
    );

    // Update program with new artifact
    const updatedProgram = await updatePlanningProgram(programId, {
      linkedArtifacts: [...existingArtifacts, newLink],
    });

    if (!updatedProgram) {
      return NextResponse.json(
        {
          success: false,
          programId,
          artifact: null,
          created: false,
          error: 'Failed to update program',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      programId,
      artifact: newLink,
      created: true,
    });
  } catch (error) {
    console.error('[Programs/Artifacts] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        programId: '',
        artifact: null,
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
