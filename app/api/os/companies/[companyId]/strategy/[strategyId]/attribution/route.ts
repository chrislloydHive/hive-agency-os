// app/api/os/companies/[companyId]/strategy/[strategyId]/attribution/route.ts
// Strategy Attribution API - Compute outcome attribution for evolution events
//
// GET - Compute attribution for all events in a strategy
// Query params: preDays, postDays (defaults 30/30)

import { NextRequest, NextResponse } from 'next/server';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { getStrategyById } from '@/lib/os/strategy';
import {
  computeAttribution,
  generateAttributionSummary,
} from '@/lib/os/strategy/attribution/computeAttribution';
import { generateArtifactSignals } from '@/lib/os/outcomes/generateSignals';
import type { OutcomeSignal, ArtifactSignalContext } from '@/lib/types/outcomeSignal';
import type { AttributionWindow } from '@/lib/types/strategyAttribution';
import { DEFAULT_ATTRIBUTION_WINDOW } from '@/lib/types/strategyAttribution';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// GET - Compute attribution
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;
    const url = new URL(request.url);

    // Parse window parameters
    const preDays = parseInt(url.searchParams.get('preDays') || String(DEFAULT_ATTRIBUTION_WINDOW.preDays), 10);
    const postDays = parseInt(url.searchParams.get('postDays') || String(DEFAULT_ATTRIBUTION_WINDOW.postDays), 10);

    // Validate parameters
    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Company ID and Strategy ID are required' },
        { status: 400 }
      );
    }

    if (preDays < 1 || preDays > 365 || postDays < 1 || postDays > 365) {
      return NextResponse.json(
        { error: 'preDays and postDays must be between 1 and 365' },
        { status: 400 }
      );
    }

    // Verify strategy exists
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Generate outcome signals from artifacts
    const signals = await generateSignalsForStrategy(companyId, strategyId);

    // Build window
    const window: AttributionWindow = { preDays, postDays };

    // Compute strategy completeness (basic check)
    const strategyComplete = Boolean(
      strategy.goalStatement &&
      strategy.objectives &&
      strategy.objectives.length > 0 &&
      strategy.pillars &&
      strategy.pillars.length > 0
    );

    // Compute attribution
    const result = await computeAttribution({
      strategyId,
      companyId,
      signals,
      window,
      strategyComplete,
    });

    // Generate summary for quick UI access
    const summary = generateAttributionSummary(result);

    return NextResponse.json({
      ...result,
      summary,
    });
  } catch (error) {
    console.error('[GET /attribution] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute attribution' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate outcome signals for a strategy from its linked artifacts
 */
async function generateSignalsForStrategy(
  companyId: string,
  strategyId: string
): Promise<OutcomeSignal[]> {
  try {
    // Fetch all artifacts for company
    const allArtifacts = await getArtifactsForCompany(companyId);

    // Filter to strategy-linked artifacts or those without strategy link
    // Use sourceStrategyId for artifacts created from strategy handoff
    const relevantArtifacts = allArtifacts.filter(
      (a) => a.sourceStrategyId === strategyId || !a.sourceStrategyId
    );

    const signals: OutcomeSignal[] = [];

    for (const artifact of relevantArtifacts) {
      // Skip draft artifacts - they haven't been executed
      if (artifact.status === 'draft') continue;

      const usage = artifact.usage;
      if (!usage) continue;

      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(artifact.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Build feedback ratings
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
        strategyId,
        tacticIds: artifact.includedTacticIds ?? undefined,
      };

      signals.push(...generateArtifactSignals(context));
    }

    return signals;
  } catch (error) {
    console.error('[generateSignalsForStrategy] Error:', error);
    return [];
  }
}
