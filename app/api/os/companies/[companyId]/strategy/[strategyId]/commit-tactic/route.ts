// app/api/os/companies/[companyId]/strategy/[strategyId]/commit-tactic/route.ts
// Commit a tactic from Strategy to Work
//
// POST - Create a work item from a strategy tactic (idempotent)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStrategyById } from '@/lib/os/strategy';
import {
  createWorkItem,
  findWorkItemByStrategyTactic,
  type WorkItemRecord,
} from '@/lib/airtable/workItems';
import {
  buildWorkItemFromTactic,
  draftToCreateInput,
  findObjectiveInStrategy,
} from '@/lib/os/strategy/workBridge';
import type { Tactic, StrategicBet, StrategyObjective } from '@/lib/types/strategy';

// ============================================================================
// Validation Schema
// ============================================================================

const CommitTacticBodySchema = z.object({
  tacticId: z.string().min(1, 'tacticId is required'),
  objectiveId: z.string().optional(),
  betId: z.string().optional(),
  // Allow passing the tactic directly for flexibility
  tactic: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      channels: z.array(z.string()).optional(),
      impact: z.enum(['high', 'medium', 'low']).optional(),
      effort: z.enum(['high', 'medium', 'low']).optional(),
      timeline: z.string().optional(),
      owner: z.string().optional(),
      linkedBetIds: z.array(z.string()).optional(),
      isDerived: z.boolean().optional(),
      isPinned: z.boolean().optional(),
      isCustomized: z.boolean().optional(),
      status: z.enum(['proposed', 'active', 'completed', 'rejected']).optional(),
    })
    .optional(),
});

type CommitTacticBody = z.infer<typeof CommitTacticBodySchema>;

// ============================================================================
// Route Handler
// ============================================================================

interface RouteParams {
  params: Promise<{ companyId: string; strategyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/strategy/[strategyId]/commit-tactic
 * Commit a tactic to Work (idempotent)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, strategyId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = CommitTacticBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { tacticId, objectiveId, betId, tactic: tacticFromBody } = parseResult.data;

    console.log('[commit-tactic] Committing tactic to work:', {
      companyId,
      strategyId,
      tacticId,
      objectiveId,
      betId,
    });

    // Check for existing work item (idempotency)
    const existingWorkItem = await findWorkItemByStrategyTactic(strategyId, tacticId);
    if (existingWorkItem) {
      console.log('[commit-tactic] Found existing work item:', existingWorkItem.id);
      return NextResponse.json({
        status: 'ok',
        workItem: existingWorkItem,
        alreadyExists: true,
      });
    }

    // Load the strategy
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Find or use the provided tactic
    let tactic: Tactic | null = null;

    if (tacticFromBody) {
      // Use the tactic provided in the request body
      tactic = {
        id: tacticFromBody.id,
        title: tacticFromBody.title,
        description: tacticFromBody.description || '',
        channels: tacticFromBody.channels as any,
        impact: tacticFromBody.impact,
        effort: tacticFromBody.effort,
        timeline: tacticFromBody.timeline,
        owner: tacticFromBody.owner,
        linkedBetIds: tacticFromBody.linkedBetIds || [],
        isDerived: tacticFromBody.isDerived ?? false,
        isPinned: tacticFromBody.isPinned,
        isCustomized: tacticFromBody.isCustomized,
        status: tacticFromBody.status,
      };
    } else {
      // Try to find the tactic in the strategy
      // Note: The strategy structure varies by version (V6, V7, etc.)
      // For now, return an error if tactic is not provided
      return NextResponse.json(
        {
          error: 'Tactic not found',
          message: 'Please provide the tactic object in the request body',
        },
        { status: 400 }
      );
    }

    // Find objective if objectiveId provided
    let objective: StrategyObjective | undefined;
    if (objectiveId) {
      objective = findObjectiveInStrategy(strategy, objectiveId) || undefined;
    }

    // Find bet if betId provided (placeholder - depends on strategy structure)
    let bet: StrategicBet | undefined;
    if (betId) {
      // For now, we don't have a reliable way to find bets in all strategy versions
      // The caller should track this relationship
    }

    // Build the work item draft
    const draft = buildWorkItemFromTactic({
      strategy,
      objective,
      bet,
      tactic,
    });

    // Convert to CreateWorkItemInput
    const createInput = draftToCreateInput(draft, companyId);

    // Create the work item
    const workItem = await createWorkItem(createInput);

    if (!workItem) {
      return NextResponse.json(
        { error: 'Failed to create work item' },
        { status: 500 }
      );
    }

    console.log('[commit-tactic] Created work item:', workItem.id);

    return NextResponse.json({
      status: 'ok',
      workItem,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('[commit-tactic] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
