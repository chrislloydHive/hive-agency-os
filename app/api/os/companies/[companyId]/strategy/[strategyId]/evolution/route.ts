// app/api/os/companies/[companyId]/strategy/[strategyId]/evolution/route.ts
// Strategy Evolution History API
//
// GET - List evolution events for a strategy
// POST - Rollback to a previous event

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, updateStrategy } from '@/lib/os/strategy';
import {
  listEvolutionEvents,
  getEvolutionEvent,
  createRollbackEvent,
} from '@/lib/airtable/strategyEvolutionEvents';
import {
  getStrategyVersionByNumber,
  createStrategyVersion,
  getLatestStrategyVersion,
} from '@/lib/airtable/strategyVersions';
import {
  createStrategySnapshot,
  hashSnapshot,
} from '@/lib/types/strategyEvolution';
import { diffStrategySnapshots } from '@/lib/os/strategy/evolution/diff';
import type { CompanyStrategy, StrategyObjective, StrategyPillar, StrategyPlay } from '@/lib/types/strategy';

// ============================================================================
// GET - List evolution events
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { strategyId } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const includeRolledBack = url.searchParams.get('includeRolledBack') === 'true';

    if (!strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    const events = await listEvolutionEvents(strategyId, {
      limit,
      includeRolledBack,
    });

    // Get latest version for context
    const latestVersion = await getLatestStrategyVersion(strategyId);

    return NextResponse.json({
      events,
      currentVersion: latestVersion?.versionNumber || 0,
      totalEvents: events.length,
    });
  } catch (error) {
    console.error('[GET /evolution] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list evolution events' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Rollback to previous event
// ============================================================================

interface RollbackRequest {
  eventId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;
    const body = (await request.json()) as RollbackRequest;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    if (!body.eventId) {
      return NextResponse.json(
        { error: 'Event ID is required for rollback' },
        { status: 400 }
      );
    }

    // Get the event to rollback
    const eventToRollback = await getEvolutionEvent(body.eventId);
    if (!eventToRollback) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify event belongs to this strategy
    if (eventToRollback.strategyId !== strategyId) {
      return NextResponse.json(
        { error: 'Event does not belong to this strategy' },
        { status: 403 }
      );
    }

    // Check if already rolled back
    if (eventToRollback.rolledBack) {
      return NextResponse.json(
        { error: 'Event has already been rolled back' },
        { status: 400 }
      );
    }

    // Get the version before the event (what we're rolling back to)
    const versionToRestore = await getStrategyVersionByNumber(
      strategyId,
      eventToRollback.versionFrom
    );

    if (!versionToRestore) {
      return NextResponse.json(
        { error: `Version ${eventToRollback.versionFrom} not found for rollback` },
        { status: 404 }
      );
    }

    // Get current strategy state
    const currentStrategy = await getStrategyById(strategyId);
    if (!currentStrategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Capture current state before rollback
    const beforeSnapshot = createStrategySnapshot(currentStrategy as CompanyStrategy);
    const beforeHash = hashSnapshot(beforeSnapshot);
    const latestVersion = await getLatestStrategyVersion(strategyId);
    const versionBefore = latestVersion?.versionNumber || 1;

    // Restore strategy from version snapshot
    const restoredSnapshot = versionToRestore.snapshot;
    const updates = snapshotToStrategyUpdates(restoredSnapshot);

    await updateStrategy({
      strategyId,
      updates: {
        ...updates,
        lastHumanUpdatedAt: new Date().toISOString(),
      },
    });

    // Compute diff for the rollback
    const diffSummary = diffStrategySnapshots(beforeSnapshot, restoredSnapshot);

    // Create new version for the restored state
    const newVersion = await createStrategyVersion({
      companyId,
      strategyId,
      snapshot: restoredSnapshot,
      trigger: 'rollback',
    });

    // Create rollback event
    const rollbackEvent = await createRollbackEvent({
      companyId,
      strategyId,
      rollbackOfEventId: body.eventId,
      versionFrom: versionBefore,
      versionTo: newVersion.versionNumber,
      snapshotHashBefore: beforeHash,
      snapshotHashAfter: hashSnapshot(restoredSnapshot),
      diffSummary,
    });

    // Reload strategy to return current state
    const restoredStrategy = await getStrategyById(strategyId);

    return NextResponse.json({
      success: true,
      strategy: restoredStrategy,
      rollbackEvent: {
        id: rollbackEvent.id,
        rolledBackEventId: body.eventId,
        versionRestoredTo: versionToRestore.versionNumber,
        newVersion: newVersion.versionNumber,
      },
      message: `Rolled back to version ${versionToRestore.versionNumber}`,
    });
  } catch (error) {
    console.error('[POST /evolution] Rollback error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rollback' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a snapshot back to strategy updates
 */
function snapshotToStrategyUpdates(snapshot: {
  strategyId: string;
  goalStatement?: string;
  frame?: {
    audience?: string;
    offering?: string;
    valueProp?: string;
    positioning?: string;
    constraints?: string;
    successMetrics?: string[];
    nonGoals?: string[];
  };
  objectives: Array<{
    id: string;
    text: string;
    metric?: string;
    target?: string;
    timeframe?: string;
    status?: string;
  }>;
  pillars: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status?: string;
    order?: number;
  }>;
  tactics: Array<{
    id: string;
    title: string;
    description?: string;
    channels?: string[];
    status?: string;
  }>;
  title: string;
  summary: string;
  status: string;
}): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    title: snapshot.title,
    summary: snapshot.summary,
    status: snapshot.status,
    goalStatement: snapshot.goalStatement,
  };

  // Convert objectives
  updates.objectives = snapshot.objectives.map((obj) => ({
    id: obj.id,
    text: obj.text,
    metric: obj.metric,
    target: obj.target,
    timeframe: obj.timeframe,
    status: obj.status || 'active',
  })) as StrategyObjective[];

  // Convert pillars
  updates.pillars = snapshot.pillars.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    priority: p.priority,
    status: p.status,
    order: p.order,
  })) as StrategyPillar[];

  // Convert tactics to plays
  updates.plays = snapshot.tactics.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    channels: t.channels,
    status: t.status || 'proposed',
  })) as StrategyPlay[];

  // Convert frame
  if (snapshot.frame) {
    updates.strategyFrame = {
      targetAudience: snapshot.frame.audience,
      audience: snapshot.frame.audience,
      primaryOffering: snapshot.frame.offering,
      offering: snapshot.frame.offering,
      valueProposition: snapshot.frame.valueProp,
      valueProp: snapshot.frame.valueProp,
      positioning: snapshot.frame.positioning,
      constraints: snapshot.frame.constraints,
      successMetrics: snapshot.frame.successMetrics,
      nonGoals: snapshot.frame.nonGoals,
    };
  }

  return updates;
}
