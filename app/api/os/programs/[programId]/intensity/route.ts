// app/api/os/programs/[programId]/intensity/route.ts
// Program Intensity Change API
//
// POST: Change program intensity level (with governance logging)

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  recordIntensityChange,
  validateIntensityChange,
  getIntensityMultiplierChange,
} from '@/lib/os/programs/governanceLog';
import { generateDebugId } from '@/lib/types/operationalEvent';
import type { IntensityLevel } from '@/lib/types/programTemplate';

interface RouteContext {
  params: Promise<{ programId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { programId } = await context.params;
    const body = await request.json();

    const { intensity, reason, actorId } = body;

    // Validate intensity value
    const validIntensities: IntensityLevel[] = ['Core', 'Standard', 'Aggressive'];
    if (!validIntensities.includes(intensity)) {
      return NextResponse.json(
        { success: false, error: 'Invalid intensity. Must be Core, Standard, or Aggressive' },
        { status: 400 }
      );
    }

    // Get current program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, error: 'Program not found' },
        { status: 404 }
      );
    }

    // Validate the change
    const validation = validateIntensityChange(program, intensity);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const fromIntensity = program.intensity || 'Standard';
    const toIntensity = intensity as IntensityLevel;

    // Calculate impact
    const multiplierChange = getIntensityMultiplierChange(fromIntensity, toIntensity);

    // Update the program
    const debugId = generateDebugId();
    await updatePlanningProgram(programId, {
      intensity: toIntensity,
    });

    // Record the governance change
    const changeRecord = recordIntensityChange(
      program,
      fromIntensity,
      toIntensity,
      {
        reason,
        actorId,
        debugId,
      }
    );

    return NextResponse.json({
      success: true,
      debugId,
      programId,
      fromIntensity,
      toIntensity,
      multiplierChange,
      changeRecord,
      message: `Intensity changed from ${fromIntensity} to ${toIntensity}`,
      note: 'This change only affects future deliverable generation. Existing deliverables are unchanged.',
    });
  } catch (error) {
    console.error('[Program Intensity POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
