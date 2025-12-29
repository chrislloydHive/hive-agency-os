// app/api/os/companies/[companyId]/strategy/[strategyId]/revision-proposals/[proposalId]/route.ts
// API endpoints for a single Strategy Revision Proposal
//
// GET - Get a single proposal
// POST - Apply or reject a proposal (with evolution tracking)
// DELETE - Delete a proposal

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, updateStrategy } from '@/lib/os/strategy';
import {
  getRevisionProposalById,
  applyRevisionProposal,
  rejectRevisionProposal,
  deleteRevisionProposal,
} from '@/lib/airtable/strategyRevisionProposals';
import type { StrategyRevisionChange, StrategyRevisionTarget } from '@/lib/types/strategyRevision';
import type { StrategyPillar, StrategyPlay, StrategyObjective, CompanyStrategy } from '@/lib/types/strategy';
import { normalizeObjectives, generatePlayId, generateObjectiveId } from '@/lib/types/strategy';

// Evolution tracking imports
import { createStrategySnapshot, hashSnapshot } from '@/lib/types/strategyEvolution';
import { getOrCreateInitialVersion, createStrategyVersion, getLatestStrategyVersion } from '@/lib/airtable/strategyVersions';
import { createEvolutionEvent } from '@/lib/airtable/strategyEvolutionEvents';
import { diffStrategySnapshots } from '@/lib/os/strategy/evolution/diff';

// ============================================================================
// GET - Get single proposal
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string; proposalId: string }> }
) {
  try {
    const { proposalId } = await params;

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      );
    }

    const proposal = await getRevisionProposalById(proposalId);

    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error('[GET /revision-proposals/:id] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get proposal' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Apply or Reject proposal
// ============================================================================

interface ApplyRejectRequest {
  action: 'apply' | 'reject';
  reason?: string;
  forceApply?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string; proposalId: string }> }
) {
  try {
    const { companyId, strategyId, proposalId } = await params;
    const body = (await request.json()) as ApplyRejectRequest;

    if (!companyId || !strategyId || !proposalId) {
      return NextResponse.json(
        { error: 'Company ID, Strategy ID, and Proposal ID are required' },
        { status: 400 }
      );
    }

    if (!body.action || !['apply', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Action must be "apply" or "reject"' },
        { status: 400 }
      );
    }

    // Get proposal
    const proposal = await getRevisionProposalById(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Verify proposal belongs to strategy
    if (proposal.strategyId !== strategyId) {
      return NextResponse.json(
        { error: 'Proposal does not belong to this strategy' },
        { status: 403 }
      );
    }

    // Check if already decided
    if (proposal.status !== 'draft') {
      return NextResponse.json(
        { error: `Proposal has already been ${proposal.status}` },
        { status: 400 }
      );
    }

    // Handle reject
    if (body.action === 'reject') {
      const updated = await rejectRevisionProposal(proposalId, body.reason);
      return NextResponse.json({
        success: true,
        proposal: updated,
        message: 'Proposal rejected',
      });
    }

    // Handle apply
    // Load strategy
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Check for high-impact changes that require confirmation
    const hasHighImpactChanges = proposal.changes.some(
      c =>
        c.target === 'goalStatement' ||
        c.target === 'objectives' ||
        c.action === 'remove'
    );

    if (hasHighImpactChanges && !body.forceApply) {
      return NextResponse.json({
        status: 'confirmation_required',
        message: 'This proposal includes high-impact changes. Pass forceApply=true to confirm.',
        highImpactChanges: proposal.changes.filter(
          c =>
            c.target === 'goalStatement' ||
            c.target === 'objectives' ||
            c.action === 'remove'
        ),
      }, { status: 409 });
    }

    // -------------------------------------------------------------------------
    // EVOLUTION TRACKING: Capture before state
    // -------------------------------------------------------------------------
    const beforeSnapshot = createStrategySnapshot(strategy as CompanyStrategy);
    const beforeHash = hashSnapshot(beforeSnapshot);

    // Ensure we have an initial version if this is the first evolution event
    const latestVersion = await getLatestStrategyVersion(strategyId);
    const versionBefore = latestVersion?.versionNumber ?? 0;

    if (!latestVersion) {
      // Create initial version for this strategy
      await getOrCreateInitialVersion(companyId, strategyId, beforeSnapshot);
    }

    // Apply changes to strategy
    const result = await applyChangesToStrategy(strategy, proposal.changes);

    // Update strategy
    const updatedStrategy = await updateStrategy({
      strategyId: strategy.id,
      updates: result.updates,
    });

    // -------------------------------------------------------------------------
    // EVOLUTION TRACKING: Capture after state and create records
    // -------------------------------------------------------------------------
    const afterSnapshot = createStrategySnapshot(updatedStrategy as CompanyStrategy);
    const afterHash = hashSnapshot(afterSnapshot);

    // Compute diff
    const diffSummary = diffStrategySnapshots(beforeSnapshot, afterSnapshot);

    // Create new version (idempotent by hash)
    const newVersion = await createStrategyVersion({
      companyId,
      strategyId,
      snapshot: afterSnapshot,
      trigger: 'proposal',
    });

    // Determine primary target from first change
    const primaryTarget = proposal.changes[0]?.target || 'tactics';

    // Create evolution event
    const evolutionEvent = await createEvolutionEvent({
      companyId,
      strategyId,
      proposalId: proposal.id,
      title: proposal.title,
      target: primaryTarget,
      changes: proposal.changes,
      confidenceAtApply: proposal.confidence,
      evidenceSignalIds: proposal.signalIds,
      evidenceSnippets: proposal.evidence,
      versionFrom: versionBefore || 1,
      versionTo: newVersion.versionNumber,
      snapshotHashBefore: beforeHash,
      snapshotHashAfter: afterHash,
      diffSummary,
    });

    // Mark proposal as applied
    const updatedProposal = await applyRevisionProposal(proposalId);

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      strategy: updatedStrategy,
      changesApplied: result.changesApplied,
      message: `Applied ${result.changesApplied} changes to strategy`,
      evolution: {
        eventId: evolutionEvent.id,
        versionBefore: versionBefore || 1,
        versionAfter: newVersion.versionNumber,
        impactScore: diffSummary.impactScore,
        riskFlags: diffSummary.riskFlags,
      },
    });
  } catch (error) {
    console.error('[POST /revision-proposals/:id] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process proposal' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete proposal
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string; proposalId: string }> }
) {
  try {
    const { proposalId } = await params;

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteRevisionProposal(proposalId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Proposal not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Proposal deleted',
    });
  } catch (error) {
    console.error('[DELETE /revision-proposals/:id] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete proposal' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Apply Changes Logic
// ============================================================================

interface StrategyUpdates {
  goalStatement?: string;
  strategyFrame?: Record<string, unknown>;
  objectives?: StrategyObjective[];
  pillars?: StrategyPillar[];
  plays?: StrategyPlay[];
  lastHumanUpdatedAt?: string;
}

async function applyChangesToStrategy(
  strategy: NonNullable<Awaited<ReturnType<typeof getStrategyById>>>,
  changes: StrategyRevisionChange[]
): Promise<{ updates: StrategyUpdates; changesApplied: number }> {
  const updates: StrategyUpdates = {
    lastHumanUpdatedAt: new Date().toISOString(),
  };
  let changesApplied = 0;

  for (const change of changes) {
    switch (change.target) {
      case 'goalStatement':
        if (change.action === 'update' && typeof change.after === 'string') {
          updates.goalStatement = change.after;
          changesApplied++;
        }
        break;

      case 'audience':
      case 'valueProp':
      case 'positioning':
      case 'constraints':
        if (typeof change.after === 'string') {
          const currentFrame = updates.strategyFrame || { ...strategy.strategyFrame } || {};
          currentFrame[change.target] = change.after;
          updates.strategyFrame = currentFrame;
          changesApplied++;
        }
        break;

      case 'objectives':
        updates.objectives = applyObjectiveChange(
          normalizeObjectives(strategy.objectives),
          change
        );
        changesApplied++;
        break;

      case 'strategicBets':
        updates.pillars = applyPillarChange(strategy.pillars, change);
        changesApplied++;
        break;

      case 'tactics':
        updates.plays = applyTacticChange(strategy.plays || [], change);
        changesApplied++;
        break;
    }
  }

  return { updates, changesApplied };
}

function applyObjectiveChange(
  objectives: StrategyObjective[],
  change: StrategyRevisionChange
): StrategyObjective[] {
  if (change.action === 'add' && change.after) {
    const afterObj = change.after as Partial<StrategyObjective>;
    return [
      ...objectives,
      {
        id: afterObj.id || generateObjectiveId(),
        text: afterObj.text || '',
        metric: afterObj.metric,
        target: afterObj.target,
        status: 'draft',
      },
    ];
  }

  if (change.action === 'update' && change.path) {
    // Extract ID from path like "objectives[obj_123]"
    const match = change.path.match(/\[([^\]]+)\]/);
    const objectiveId = match?.[1];

    if (objectiveId) {
      return objectives.map(obj => {
        if (obj.id === objectiveId) {
          const afterObj = change.after as Partial<StrategyObjective>;
          return { ...obj, ...afterObj };
        }
        return obj;
      });
    }
  }

  if (change.action === 'remove' && change.path) {
    const match = change.path.match(/\[([^\]]+)\]/);
    const objectiveId = match?.[1];
    if (objectiveId) {
      return objectives.filter(obj => obj.id !== objectiveId);
    }
  }

  return objectives;
}

function applyPillarChange(
  pillars: StrategyPillar[],
  change: StrategyRevisionChange
): StrategyPillar[] {
  if (change.action === 'add' && change.after) {
    const afterObj = change.after as Partial<StrategyPillar>;
    return [
      ...pillars,
      {
        id: afterObj.id || `pillar_${Date.now()}`,
        title: afterObj.title || '',
        description: afterObj.description || '',
        priority: afterObj.priority || 'medium',
        order: pillars.length,
      },
    ];
  }

  if (change.action === 'update' && change.path) {
    const match = change.path.match(/\[([^\]]+)\]/);
    const pillarId = match?.[1];

    if (pillarId) {
      return pillars.map(pillar => {
        if (pillar.id === pillarId) {
          const afterObj = change.after as Partial<StrategyPillar>;
          return { ...pillar, ...afterObj };
        }
        return pillar;
      });
    }
  }

  if (change.action === 'remove' && change.path) {
    const match = change.path.match(/\[([^\]]+)\]/);
    const pillarId = match?.[1];
    if (pillarId) {
      return pillars.filter(pillar => pillar.id !== pillarId);
    }
  }

  return pillars;
}

function applyTacticChange(
  plays: StrategyPlay[],
  change: StrategyRevisionChange
): StrategyPlay[] {
  if (change.action === 'add' && change.after) {
    const afterObj = change.after as Partial<StrategyPlay>;
    return [
      ...plays,
      {
        id: afterObj.id || generatePlayId(),
        title: afterObj.title || '',
        description: afterObj.description || '',
        status: 'proposed',
        channels: afterObj.channels,
      },
    ];
  }

  if (change.action === 'update' && change.path) {
    const match = change.path.match(/\[([^\]]+)\]/);
    const playId = match?.[1];

    if (playId) {
      return plays.map(play => {
        if (play.id === playId) {
          const afterObj = change.after as Partial<StrategyPlay>;
          // Filter out internal suggestion fields
          const { _suggestedRefinement, ...cleanAfter } = afterObj as Record<string, unknown>;
          return { ...play, ...cleanAfter } as StrategyPlay;
        }
        return play;
      });
    }
  }

  if (change.action === 'remove' && change.path) {
    const match = change.path.match(/\[([^\]]+)\]/);
    const playId = match?.[1];
    if (playId) {
      return plays.filter(play => play.id !== playId);
    }
  }

  return plays;
}
