// app/api/os/companies/[companyId]/strategy/[strategyId]/programs/route.ts
// List and create Planning Programs for a strategy
//
// Programs are the bridge between Strategy Tactics and executable Work Items.
// Each Program corresponds to a single Tactic and can be committed to generate Work.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  listPlanningPrograms,
  createPlanningProgramFromTactic,
} from '@/lib/airtable/planningPrograms';
import { getStrategyById } from '@/lib/os/strategy';
import {
  PlanningProgramScopeSchema,
  PlanningProgramSuccessSchema,
  PlanningProgramPlanSchema,
} from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

type Params = { params: Promise<{ companyId: string; strategyId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateFromTacticSchema = z.object({
  tacticId: z.string().min(1),
  tacticTitle: z.string().min(1),
  tacticDescription: z.string().optional().default(''),
  objectiveId: z.string().optional(),
  betId: z.string().optional(),
  workstreams: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
});

const CreateProgramSchema = z.object({
  title: z.string().min(1).max(200),
  origin: z.object({
    strategyId: z.string(),
    objectiveId: z.string().optional(),
    betId: z.string().optional(),
    tacticId: z.string().optional(),
    tacticTitle: z.string().optional(),
  }),
  scope: PlanningProgramScopeSchema.optional(),
  success: PlanningProgramSuccessSchema.optional(),
  planDetails: PlanningProgramPlanSchema.optional(),
});

// ============================================================================
// GET - List programs for a strategy
// ============================================================================

/**
 * GET /api/os/companies/[companyId]/strategy/[strategyId]/programs
 * List all Planning Programs for a strategy
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { companyId, strategyId } = await params;

    // Verify strategy exists and belongs to company
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (strategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy does not belong to this company' },
        { status: 403 }
      );
    }

    const programs = await listPlanningPrograms(companyId, strategyId);

    return NextResponse.json({ programs });
  } catch (error) {
    console.error('[API] Failed to list programs:', error);
    return NextResponse.json(
      { error: 'Failed to list programs' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new program
// ============================================================================

/**
 * POST /api/os/companies/[companyId]/strategy/[strategyId]/programs
 * Create a new Planning Program
 *
 * Supports two modes:
 * 1. From Tactic: Provide tacticId, tacticTitle, tacticDescription
 *    This uses idempotent creation - if a program for this tactic exists, returns it
 *
 * 2. Manual: Provide title, origin, and optionally scope/success/planDetails
 *    Creates a fresh program without tactic linkage
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, strategyId } = await params;

    // Verify strategy exists and belongs to company
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (strategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy does not belong to this company' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Try to parse as "from tactic" creation first
    const fromTacticResult = CreateFromTacticSchema.safeParse(body);

    if (fromTacticResult.success) {
      // Create from tactic (idempotent)
      const { tacticId, tacticTitle, tacticDescription, objectiveId, betId, workstreams, channels } = fromTacticResult.data;

      const result = await createPlanningProgramFromTactic(
        companyId,
        strategyId,
        tacticId,
        tacticTitle,
        tacticDescription,
        { objectiveId, betId, workstreams: workstreams as never, channels }
      );

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to create program from tactic' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        program: result.program,
        created: result.created,
        message: result.created
          ? 'Program created successfully'
          : 'Program already exists for this tactic',
      });
    }

    // Try manual creation
    const manualResult = CreateProgramSchema.safeParse(body);

    if (!manualResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: manualResult.error.format(),
          hint: 'Provide either tacticId+tacticTitle (from tactic) or title+origin (manual)'
        },
        { status: 400 }
      );
    }

    // Manual creation - for now, redirect to from-tactic if tacticId is in origin
    const { title, origin, scope, success, planDetails } = manualResult.data;

    if (origin.tacticId && origin.tacticTitle) {
      // Use idempotent tactic creation
      const result = await createPlanningProgramFromTactic(
        companyId,
        strategyId,
        origin.tacticId,
        origin.tacticTitle,
        scope?.summary || '',
        {
          objectiveId: origin.objectiveId,
          betId: origin.betId,
          workstreams: scope?.workstreams as never,
          channels: scope?.channels
        }
      );

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to create program' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        program: result.program,
        created: result.created,
      });
    }

    // Full manual creation without tactic
    // For now, we require tactic linkage - this can be expanded later
    return NextResponse.json(
      {
        error: 'Manual program creation without tactic not yet supported',
        hint: 'Provide tacticId and tacticTitle in origin or use the from-tactic format'
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Failed to create program:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create program' },
      { status: 500 }
    );
  }
}
