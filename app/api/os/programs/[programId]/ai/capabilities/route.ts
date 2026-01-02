// app/api/os/programs/[programId]/ai/capabilities/route.ts
// AI Capabilities Endpoint
//
// GET /api/os/programs/[programId]/ai/capabilities
// Returns the AI capability boundaries for this program.
//
// Response: {
//   capabilities: AICapability[]
//   programScope: {...}
//   instructions: string
// }

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  toAICapabilityList,
  getCapabilitySummary,
  generateCapabilityInstructions,
  canPerformActionOnProgram,
} from '@/lib/os/programs/aiCapabilities';
import { getScopeSummary, performScopeCheck } from '@/lib/os/programs/scopeGuard';

interface RouteParams {
  params: Promise<{ programId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { programId } = await params;

    // Get the program
    const program = await getPlanningProgram(programId);

    if (!program) {
      return NextResponse.json(
        { error: `Program ${programId} not found` },
        { status: 404 }
      );
    }

    // Get capabilities list
    const capabilities = toAICapabilityList();

    // Get capability summary
    const summary = getCapabilitySummary();

    // Get scope summary for this program
    const scopeSummary = getScopeSummary(program);

    // Generate instructions for AI prompts
    const instructions = generateCapabilityInstructions();

    return NextResponse.json({
      programId: program.id,
      programTitle: program.title,
      capabilities,
      summary,
      scope: scopeSummary,
      instructions,
    });
  } catch (error) {
    console.error('[API] AI capabilities error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Failed to get capabilities: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// POST to check if a specific action is allowed
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { programId } = await params;
    const body = await request.json();

    const { capabilityId, workstream, activeWorkCount } = body;

    if (!capabilityId) {
      return NextResponse.json(
        { error: 'capabilityId is required' },
        { status: 400 }
      );
    }

    // Get the program
    const program = await getPlanningProgram(programId);

    if (!program) {
      return NextResponse.json(
        { error: `Program ${programId} not found` },
        { status: 404 }
      );
    }

    // Check if the action is allowed on this program
    const actionValidation = canPerformActionOnProgram(capabilityId, program);

    // If workstream provided, also check scope
    let scopeCheck = null;
    if (workstream || activeWorkCount !== undefined) {
      scopeCheck = performScopeCheck({
        program,
        proposedWorkstream: workstream,
        currentActiveWorkCount: activeWorkCount,
      });
    }

    return NextResponse.json({
      programId: program.id,
      capabilityId,
      action: actionValidation,
      scope: scopeCheck,
      allowed: actionValidation.allowed && (scopeCheck?.allowed ?? true),
    });
  } catch (error) {
    console.error('[API] AI capability check error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Failed to check capability: ${errorMessage}` },
      { status: 500 }
    );
  }
}
