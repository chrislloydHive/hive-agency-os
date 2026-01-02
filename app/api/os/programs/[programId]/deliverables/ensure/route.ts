// app/api/os/programs/[programId]/deliverables/ensure/route.ts
// POST endpoint to ensure upcoming deliverables exist for a program
//
// This is idempotent - calling multiple times won't create duplicates.
// Creates deliverables based on the program's template and intensity.

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  ensureUpcomingDeliverables,
  type EnsureDeliverablesOptions,
} from '@/lib/os/programs/recurringDeliverables';
import type { CadenceType } from '@/lib/types/programTemplate';

interface RouteContext {
  params: Promise<{ programId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { programId } = await context.params;

    // Parse request body for options
    let options: EnsureDeliverablesOptions = {};
    try {
      const body = await request.json();
      if (body.periodsAhead) options.periodsAhead = body.periodsAhead;
      if (body.cadences) options.cadences = body.cadences as CadenceType[];
      if (body.asOf) options.asOf = new Date(body.asOf);
    } catch {
      // No body or invalid JSON is fine, use defaults
    }

    // Get the program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, error: 'Program not found' },
        { status: 404 }
      );
    }

    // Check if program has a domain (required for template lookup)
    if (!program.domain) {
      return NextResponse.json(
        {
          success: false,
          error: 'Program has no domain set. Recurring deliverables require a domain template.',
        },
        { status: 400 }
      );
    }

    // Ensure upcoming deliverables
    const result = ensureUpcomingDeliverables(program, options);

    // If we created any deliverables, update the program
    if (result.created.length > 0) {
      const existingDeliverables = program.scope?.deliverables || [];
      const newDeliverables = result.created.map((c) => c.deliverable);

      await updatePlanningProgram(programId, {
        scope: {
          ...program.scope,
          deliverables: [...existingDeliverables, ...newDeliverables],
        },
      });
    }

    return NextResponse.json({
      success: true,
      programId,
      programTitle: program.title,
      domain: program.domain,
      intensity: program.intensity,
      summary: {
        created: result.created.length,
        skipped: result.skipped.length,
        errors: result.errors.length,
      },
      created: result.created.map((c) => ({
        id: c.deliverable.id,
        title: c.deliverable.title,
        outputId: c.outputId,
        period: c.period,
        dueDate: c.deliverable.dueDate,
      })),
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Ensure Deliverables] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
