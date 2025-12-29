// app/api/os/companies/[companyId]/artifacts/[artifactId]/outcome/route.ts
// Capture outcomes for shipped artifacts
//
// POST - Record outcome observation for a shipped artifact

import { NextRequest, NextResponse } from 'next/server';
import { getArtifactById } from '@/lib/airtable/artifacts';
import { getWorkItemsWithArtifactAttached } from '@/lib/airtable/workItems';
import { createOutcomeSignal } from '@/lib/airtable/outcomeSignals';
import type { OutcomeSignalConfidence } from '@/lib/types/outcomeSignal';

type Params = { params: Promise<{ companyId: string; artifactId: string }> };

// ============================================================================
// Types
// ============================================================================

interface CaptureOutcomeRequest {
  /** What was the main goal (primary conversion action) */
  primaryConversionAction: string;
  /** What actually happened */
  observedResult: string;
  /** Confidence in attribution */
  confidence: OutcomeSignalConfidence;
  /** Optional metric data */
  metric?: {
    label: string;
    value: string;
    period?: string;
  };
}

interface CaptureOutcomeResponse {
  success: boolean;
  signalId?: string;
  error?: string;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * POST /api/os/companies/[companyId]/artifacts/[artifactId]/outcome
 * Capture an outcome for a shipped artifact
 */
export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse<CaptureOutcomeResponse>> {
  try {
    const { companyId, artifactId } = await params;
    const body: CaptureOutcomeRequest = await request.json();

    // Validate required fields
    if (!body.primaryConversionAction?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Primary conversion action is required' },
        { status: 400 }
      );
    }
    if (!body.observedResult?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Observed result is required' },
        { status: 400 }
      );
    }
    if (!['low', 'medium', 'high'].includes(body.confidence)) {
      return NextResponse.json(
        { success: false, error: 'Invalid confidence level' },
        { status: 400 }
      );
    }

    // Get artifact to verify ownership
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      );
    }
    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Build evidence array
    const evidence: string[] = [
      `Goal: ${body.primaryConversionAction.trim()}`,
      `Result: ${body.observedResult.trim()}`,
      `Artifact: ${artifact.title} (${artifact.type})`,
    ];

    // Add metric to evidence if provided
    if (body.metric?.label && body.metric?.value) {
      const metricStr = body.metric.period
        ? `${body.metric.label}: ${body.metric.value} (${body.metric.period})`
        : `${body.metric.label}: ${body.metric.value}`;
      evidence.push(`Metric: ${metricStr}`);
    }

    // Build summary
    const summary = `${body.primaryConversionAction.trim()} → ${body.observedResult.trim().slice(0, 100)}${body.observedResult.length > 100 ? '...' : ''}`;

    // Get strategy ID from artifact or linked work items
    let strategyId = artifact.sourceStrategyId || '';
    let tacticIds: string[] = [];

    if (!strategyId) {
      // Try to get strategy from linked work items
      const linkedWorkItems = await getWorkItemsWithArtifactAttached(artifactId);
      const workItemWithStrategy = linkedWorkItems.find(
        (w) => w.strategyLink?.strategyId
      );
      if (workItemWithStrategy?.strategyLink) {
        strategyId = workItemWithStrategy.strategyLink.strategyId;
        if (workItemWithStrategy.strategyLink.tacticId) {
          tacticIds.push(workItemWithStrategy.strategyLink.tacticId);
        }
      }
    }

    // Create outcome signal
    const signal = await createOutcomeSignal({
      companyId,
      strategyId,
      source: 'artifact',
      sourceId: artifactId,
      signalType: 'learning', // Captured outcomes are learnings
      confidence: body.confidence,
      summary,
      evidence,
      tacticIds,
      createdAt: new Date().toISOString(),
    });

    console.log('[Outcome API] Captured outcome for artifact:', artifactId, {
      signalId: signal.id,
      confidence: body.confidence,
    });

    return NextResponse.json({
      success: true,
      signalId: signal.id,
    });
  } catch (error) {
    console.error('[Outcome API] Failed to capture outcome:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to capture outcome' },
      { status: 500 }
    );
  }
}
