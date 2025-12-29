// app/api/os/companies/[companyId]/strategy/[strategyId]/revision-proposals/route.ts
// API endpoints for Strategy Revision Proposals
//
// GET - List all revision proposals for a strategy
// POST - Generate new revision proposals from outcome signals

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/lib/os/strategy';
import {
  getRevisionProposals,
  createRevisionProposals,
  deleteDraftProposals,
} from '@/lib/airtable/strategyRevisionProposals';
import {
  generateRevisionProposals,
  getStrategyCompleteness,
  applyCompletenessPenalty,
} from '@/lib/os/strategy/revision/generateRevisionProposals';
import { generateArtifactSignals } from '@/lib/os/outcomes/generateSignals';
import type { ArtifactSignalContext, OutcomeSignal } from '@/lib/types/outcomeSignal';
import type { RevisionGenerationContext } from '@/lib/types/strategyRevision';
import { normalizeObjectives } from '@/lib/types/strategy';

// ============================================================================
// GET - List revision proposals
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'draft' | 'applied' | 'rejected' | null;

    const proposals = await getRevisionProposals(companyId, strategyId, {
      status: status || undefined,
    });

    return NextResponse.json({
      proposals,
      count: proposals.length,
    });
  } catch (error) {
    console.error('[GET /revision-proposals] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get proposals' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Generate revision proposals
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    // Load strategy
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Verify strategy belongs to company
    if (strategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy does not belong to this company' },
        { status: 403 }
      );
    }

    // Fetch artifacts linked to this strategy
    const artifactsResponse = await fetch(
      `${request.nextUrl.origin}/api/os/companies/${companyId}/artifacts?strategyId=${strategyId}`,
      { headers: request.headers }
    );

    const signals: OutcomeSignal[] = [];

    if (artifactsResponse.ok) {
      const artifactsData = await artifactsResponse.json();
      const artifacts = artifactsData.artifacts || [];

      // Generate signals from each artifact
      for (const artifact of artifacts) {
        if (artifact.status === 'draft') continue;

        const usage = artifact.usage || {};
        const daysSinceCreation = Math.floor(
          (Date.now() - new Date(artifact.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        const feedbackRatings = { helpful: 0, neutral: 0, not_helpful: 0 };
        if (artifact.feedback) {
          for (const entry of artifact.feedback) {
            if (entry.rating === 'helpful') feedbackRatings.helpful++;
            else if (entry.rating === 'neutral') feedbackRatings.neutral++;
            else if (entry.rating === 'not_helpful') feedbackRatings.not_helpful++;
          }
        }

        const context: ArtifactSignalContext = {
          artifactId: artifact.id,
          artifactType: artifact.type,
          artifactTitle: artifact.title,
          artifactStatus: artifact.status,
          workItemsCreated: usage.attachedWorkCount || 0,
          workItemsCompleted: usage.completedWorkCount || 0,
          daysSinceCreation,
          feedbackRatings,
          strategyId: artifact.sourceStrategyId || undefined,
          tacticIds: artifact.includedTacticIds || undefined,
        };

        const artifactSignals = generateArtifactSignals(context);
        signals.push(...artifactSignals);
      }
    }

    // Check strategy completeness
    const objectives = normalizeObjectives(strategy.objectives);
    const { isComplete, missingFields } = getStrategyCompleteness({
      goalStatement: strategy.goalStatement,
      audience: strategy.strategyFrame?.audience,
      valueProp: strategy.strategyFrame?.valueProp,
      positioning: strategy.strategyFrame?.positioning,
      constraints: strategy.strategyFrame?.constraints,
      objectives: objectives.map(o => ({
        id: o.id,
        text: o.text,
        status: o.status,
      })),
      bets: strategy.pillars.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
      })),
      tactics: (strategy.plays || []).map(t => ({
        id: t.id,
        title: t.title,
        channels: t.channels,
        status: t.status,
      })),
    });

    // Build generation context
    const generationContext: RevisionGenerationContext = {
      companyId,
      strategyId,
      currentStrategy: {
        goalStatement: strategy.goalStatement,
        audience: strategy.strategyFrame?.audience,
        valueProp: strategy.strategyFrame?.valueProp,
        positioning: strategy.strategyFrame?.positioning,
        constraints: strategy.strategyFrame?.constraints,
        objectives: objectives.map(o => ({
          id: o.id,
          text: o.text,
          status: o.status,
        })),
        bets: strategy.pillars.map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
        tactics: (strategy.plays || []).map(t => ({
          id: t.id,
          title: t.title,
          channels: t.channels,
          status: t.status,
        })),
      },
      signals: signals.map(s => ({
        id: s.id,
        signalType: s.signalType,
        confidence: s.confidence,
        summary: s.summary,
        evidence: s.evidence,
        tacticIds: s.tacticIds,
        objectiveIds: s.objectiveIds,
        strategyId: s.strategyId,
      })),
      isIncomplete: !isComplete,
      missingFields,
    };

    // Generate proposals
    let proposals = generateRevisionProposals(generationContext);

    // Apply completeness penalty if strategy is incomplete
    if (!isComplete) {
      proposals = proposals.map(p => ({
        ...p,
        confidence: applyCompletenessPenalty(p.confidence, isComplete),
      }));
    }

    if (proposals.length === 0) {
      return NextResponse.json({
        proposals: [],
        signalsUsed: signals.map(s => s.id),
        message: 'No revision proposals generated. Either no signals or no matching patterns.',
      });
    }

    // Delete existing draft proposals (idempotency)
    const deletedCount = await deleteDraftProposals(companyId, strategyId);
    if (deletedCount > 0) {
      console.log(`[POST /revision-proposals] Deleted ${deletedCount} existing draft proposals`);
    }

    // Save new proposals
    const savedProposals = await createRevisionProposals(
      proposals.map(p => ({
        companyId: p.companyId,
        strategyId: p.strategyId,
        title: p.title,
        summary: p.summary,
        signalIds: p.signalIds,
        evidence: p.evidence,
        confidence: p.confidence,
        changes: p.changes,
      }))
    );

    return NextResponse.json({
      proposals: savedProposals,
      signalsUsed: signals.map(s => s.id),
      rulesApplied: proposals.length > 0 ? ['low-impact', 'abandoned', 'learning', 'high-impact'] : [],
      strategyCompleteness: {
        isComplete,
        missingFields,
      },
    });
  } catch (error) {
    console.error('[POST /revision-proposals] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate proposals' },
      { status: 500 }
    );
  }
}
