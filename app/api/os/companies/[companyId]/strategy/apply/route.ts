// app/api/os/companies/[companyId]/strategy/apply/route.ts
// Apply AI-Generated Drafts to Strategy
//
// This endpoint takes AI-proposed drafts and applies them to the strategy.
// All writes go through this endpoint - AI never writes directly.
//
// Supports:
// - apply_objectives: Apply objective drafts
// - apply_strategy: Apply strategy draft (creates/updates strategy)
// - apply_tactics: Apply tactic drafts
// - apply_field: Apply field improvement

import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveStrategy,
  getStrategyById,
  createDraftStrategy,
  updateStrategy,
} from '@/lib/os/strategy';
import { generateStrategyItemId } from '@/lib/types/strategy';
import type {
  ApplyStrategyDraftRequest,
  ApplyTacticsDraftRequest,
  ApplyObjectivesDraftRequest,
  ApplyDraftResponse,
  StrategyDraft,
  TacticDraft,
  ObjectiveDraft,
} from '@/lib/types/strategyOrchestration';
import type { StrategyPillar, StrategyPlay, StrategyObjective } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

type ApplyAction =
  | 'apply_objectives'
  | 'apply_strategy'
  | 'apply_tactics'
  | 'apply_field';

interface ApplyRequest {
  action: ApplyAction;
  strategyId?: string;

  // For apply_objectives
  objectiveDrafts?: ObjectiveDraft[];

  // For apply_strategy
  strategyDraft?: StrategyDraft;

  // For apply_tactics
  tacticDrafts?: TacticDraft[];

  // For apply_field
  fieldPath?: string;
  newValue?: unknown;

  // Input hashes at generation time (for staleness detection)
  inputHashes?: {
    contextHash: string;
    objectivesHash?: string;
    strategyHash?: string;
  };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as ApplyRequest;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    if (!body.action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    console.log(`[apply] Action: ${body.action} for company: ${companyId}`);

    let result: ApplyDraftResponse;

    switch (body.action) {
      case 'apply_objectives':
        result = await handleApplyObjectives(companyId, body);
        break;

      case 'apply_strategy':
        result = await handleApplyStrategy(companyId, body);
        break;

      case 'apply_tactics':
        result = await handleApplyTactics(companyId, body);
        break;

      case 'apply_field':
        result = await handleApplyField(companyId, body);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }

    console.log(`[apply] ${body.action} completed:`, result.success ? 'success' : 'failed');

    return NextResponse.json(result);
  } catch (error) {
    console.error('[apply] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply draft',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

async function handleApplyObjectives(
  companyId: string,
  body: ApplyRequest
): Promise<ApplyDraftResponse> {
  const { objectiveDrafts, strategyId } = body;

  if (!objectiveDrafts || objectiveDrafts.length === 0) {
    return { success: false, error: 'No objective drafts provided' };
  }

  // Get or create strategy
  let strategy = strategyId
    ? await getStrategyById(strategyId)
    : await getActiveStrategy(companyId);

  if (!strategy) {
    // Create a new strategy with these objectives (as strings for now)
    strategy = await createDraftStrategy({
      companyId,
      title: 'New Strategy',
      summary: '',
      objectives: objectiveDrafts.map((d) => d.text),
      pillars: [],
    });

    // Then update with full objective structure
    const fullObjectives: StrategyObjective[] = objectiveDrafts.map((d) => ({
      id: generateStrategyItemId(),
      text: d.text,
      metric: d.metric,
      target: d.target,
      timeframe: d.timeframe,
    }));

    strategy = await updateStrategy({
      strategyId: strategy.id,
      updates: {
        objectives: fullObjectives,
        lastAiUpdatedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      createdIds: fullObjectives.map((o) => o.id || 'unknown'),
      strategy: {
        id: strategy.id,
        title: strategy.title,
        updatedAt: strategy.updatedAt,
      },
    };
  }

  // Convert drafts to objectives
  const newObjectives: StrategyObjective[] = objectiveDrafts.map((d) => ({
    id: generateStrategyItemId(),
    text: d.text,
    metric: d.metric,
    target: d.target,
    timeframe: d.timeframe,
  }));

  // Merge with existing objectives
  const existingObjectives = Array.isArray(strategy.objectives)
    ? strategy.objectives.map((o) =>
        typeof o === 'string' ? { id: generateStrategyItemId(), text: o } : o
      )
    : [];

  const updatedStrategy = await updateStrategy({
    strategyId: strategy.id,
    updates: {
      objectives: [...existingObjectives, ...newObjectives],
      lastAiUpdatedAt: new Date().toISOString(),
    },
  });

  return {
    success: true,
    createdIds: newObjectives.map((o) => o.id || 'unknown'),
    strategy: {
      id: updatedStrategy.id,
      title: updatedStrategy.title,
      updatedAt: updatedStrategy.updatedAt,
    },
  };
}

async function handleApplyStrategy(
  companyId: string,
  body: ApplyRequest
): Promise<ApplyDraftResponse> {
  const { strategyDraft, strategyId } = body;

  if (!strategyDraft) {
    return { success: false, error: 'No strategy draft provided' };
  }

  // Convert draft priorities to pillars
  const pillars: StrategyPillar[] = strategyDraft.priorities.map((p, i) => ({
    id: generateStrategyItemId(),
    title: p.title,
    description: p.description,
    priority: p.priority,
    order: i,
  }));

  // Get existing strategy or create new one
  let strategy = strategyId
    ? await getStrategyById(strategyId)
    : await getActiveStrategy(companyId);

  if (!strategy) {
    // Create new strategy
    strategy = await createDraftStrategy({
      companyId,
      title: strategyDraft.title,
      summary: strategyDraft.summary,
      objectives: [],
      pillars,
    });

    // Update with tradeoffs
    await updateStrategy({
      strategyId: strategy.id,
      updates: {
        tradeoffs: strategyDraft.tradeoffs,
        lastAiUpdatedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      createdIds: [strategy.id],
      strategy: {
        id: strategy.id,
        title: strategy.title,
        updatedAt: strategy.updatedAt,
      },
    };
  }

  // Update existing strategy
  const updatedStrategy = await updateStrategy({
    strategyId: strategy.id,
    updates: {
      title: strategyDraft.title,
      summary: strategyDraft.summary,
      pillars,
      tradeoffs: strategyDraft.tradeoffs,
      lastAiUpdatedAt: new Date().toISOString(),
    },
  });

  return {
    success: true,
    updatedIds: [updatedStrategy.id],
    strategy: {
      id: updatedStrategy.id,
      title: updatedStrategy.title,
      updatedAt: updatedStrategy.updatedAt,
    },
  };
}

async function handleApplyTactics(
  companyId: string,
  body: ApplyRequest
): Promise<ApplyDraftResponse> {
  const { tacticDrafts, strategyId } = body;

  if (!tacticDrafts || tacticDrafts.length === 0) {
    return { success: false, error: 'No tactic drafts provided' };
  }

  // Get strategy
  const strategy = strategyId
    ? await getStrategyById(strategyId)
    : await getActiveStrategy(companyId);

  if (!strategy) {
    return { success: false, error: 'No strategy found to add tactics to' };
  }

  // Convert drafts to plays
  const newPlays: StrategyPlay[] = tacticDrafts.map((t) => ({
    id: generateStrategyItemId(),
    title: t.title,
    description: t.description,
    status: 'proposed' as const,
  }));

  // Merge with existing plays
  const existingPlays = strategy.plays || [];

  const updatedStrategy = await updateStrategy({
    strategyId: strategy.id,
    updates: {
      plays: [...existingPlays, ...newPlays],
      lastAiUpdatedAt: new Date().toISOString(),
    },
  });

  return {
    success: true,
    createdIds: newPlays.map((p) => p.id),
    strategy: {
      id: updatedStrategy.id,
      title: updatedStrategy.title,
      updatedAt: updatedStrategy.updatedAt,
    },
  };
}

async function handleApplyField(
  companyId: string,
  body: ApplyRequest
): Promise<ApplyDraftResponse> {
  const { fieldPath, newValue, strategyId } = body;

  if (!fieldPath || newValue === undefined) {
    return { success: false, error: 'fieldPath and newValue are required' };
  }

  // Get strategy
  const strategy = strategyId
    ? await getStrategyById(strategyId)
    : await getActiveStrategy(companyId);

  if (!strategy) {
    return { success: false, error: 'No strategy found to update' };
  }

  // Parse field path and apply update
  // Supports paths like: "title", "summary", "strategyFrame.audience", etc.
  const updates: Record<string, unknown> = {};

  if (fieldPath.startsWith('strategyFrame.')) {
    const frameField = fieldPath.replace('strategyFrame.', '');
    const currentFrame = strategy.strategyFrame || {};
    updates.strategyFrame = {
      ...currentFrame,
      [frameField]: newValue,
    };
  } else {
    updates[fieldPath] = newValue;
  }

  updates.lastHumanUpdatedAt = new Date().toISOString();

  const updatedStrategy = await updateStrategy({
    strategyId: strategy.id,
    updates,
  });

  return {
    success: true,
    updatedIds: [updatedStrategy.id],
    strategy: {
      id: updatedStrategy.id,
      title: updatedStrategy.title,
      updatedAt: updatedStrategy.updatedAt,
    },
  };
}
