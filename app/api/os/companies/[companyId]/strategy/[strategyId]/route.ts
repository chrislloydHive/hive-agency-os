// app/api/os/companies/[companyId]/strategy/[strategyId]/route.ts
// CRUD operations for a specific strategy record
//
// PATCH - Update strategy fields (including goalStatement, pillars, plays, objectives)
// GET - Retrieve strategy by ID

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStrategyById, updateStrategy } from '@/lib/os/strategy';

// ============================================================================
// Validation Schemas
// ============================================================================

// Objective schema
const ObjectiveSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  priority: z.number().optional(),
  kpis: z.array(z.string()).optional(),
});

// Pillar (Strategic Bet) schema
const PillarSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['draft', 'proposed', 'accepted', 'rejected', 'archived']).optional(),
  priority: z.number().optional(),
  isPinned: z.boolean().optional(),
  linkedObjectiveIds: z.array(z.string()).optional(),
  linkedPlayIds: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Play (Tactic) schema
const PlaySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  channel: z.string().optional(),
  status: z.enum(['proposed', 'active', 'narrowed', 'completed', 'archived']).optional(),
  priority: z.number().optional(),
  isPinned: z.boolean().optional(),
  linkedPillarIds: z.array(z.string()).optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
  effort: z.enum(['high', 'medium', 'low']).optional(),
  owner: z.string().optional(),
  deadline: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const PatchBodySchema = z.object({
  // Goal Statement (plain-language, 0-400 chars)
  goalStatement: z.string().trim().max(400).optional(),
  // Other updatable fields can be added here
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(1000).optional(),
  // Strategy content
  objectives: z.array(ObjectiveSchema).optional(),
  pillars: z.array(PillarSchema).optional(),
  plays: z.array(PlaySchema).optional(),
});

type PatchBody = z.infer<typeof PatchBodySchema>;

// ============================================================================
// Route Handlers
// ============================================================================

interface RouteParams {
  params: Promise<{ companyId: string; strategyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/strategy/[strategyId]
 * Retrieve a specific strategy by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId, strategyId } = await params;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    const strategy = await getStrategyById(strategyId);

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Verify strategy belongs to the company
    if (strategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy does not belong to this company' },
        { status: 403 }
      );
    }

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('[GET /api/os/companies/[companyId]/strategy/[strategyId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get strategy' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/os/companies/[companyId]/strategy/[strategyId]
 * Update strategy fields
 *
 * Supports updating:
 * - goalStatement (plain-language goal, 0-400 chars)
 * - title
 * - summary
 * - objectives (array of StrategyObjective)
 * - pillars (array of StrategyPillar / Strategic Bets)
 * - plays (array of StrategyPlay / Tactics)
 *
 * goalStatementUpdatedAt is automatically set when goalStatement changes
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId, strategyId } = await params;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    // Verify strategy exists and belongs to company
    const existingStrategy = await getStrategyById(strategyId);
    if (!existingStrategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (existingStrategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy does not belong to this company' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const parseResult = PatchBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const body: PatchBody = parseResult.data;

    // Build updates object (only include fields that were provided)
    const updates: Record<string, unknown> = {};

    if (body.goalStatement !== undefined) {
      updates.goalStatement = body.goalStatement;
      // Note: goalStatementUpdatedAt is auto-set in updateStrategy
    }
    if (body.title !== undefined) {
      updates.title = body.title;
    }
    if (body.summary !== undefined) {
      updates.summary = body.summary;
    }
    if (body.objectives !== undefined) {
      updates.objectives = body.objectives;
    }
    if (body.pillars !== undefined) {
      updates.pillars = body.pillars;
    }
    if (body.plays !== undefined) {
      updates.plays = body.plays;
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    console.log(`[PATCH /api/os/companies/[companyId]/strategy/[strategyId]] Updating:`, {
      strategyId,
      companyId,
      fields: Object.keys(updates),
    });

    // Perform update
    const updatedStrategy = await updateStrategy({
      strategyId,
      updates,
    });

    return NextResponse.json({
      success: true,
      strategy: updatedStrategy,
      updatedFields: Object.keys(updates),
    });
  } catch (error) {
    console.error('[PATCH /api/os/companies/[companyId]/strategy/[strategyId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update strategy' },
      { status: 500 }
    );
  }
}
