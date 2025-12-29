// app/api/os/companies/[companyId]/work-items/[workItemId]/outcome/route.ts
// Capture outcomes for completed work items
//
// POST - Record outcome observation for a work item

import { NextRequest, NextResponse } from 'next/server';
import { getWorkItemById } from '@/lib/airtable/workItems';
import { createOutcomeSignal } from '@/lib/airtable/outcomeSignals';
import type { OutcomeSignalConfidence } from '@/lib/types/outcomeSignal';

type Params = { params: Promise<{ companyId: string; workItemId: string }> };

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
  /** Optional artifact ID if outcome is tied to shipped artifact */
  artifactId?: string;
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
 * POST /api/os/companies/[companyId]/work-items/[workItemId]/outcome
 * Capture an outcome for a completed work item
 */
export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse<CaptureOutcomeResponse>> {
  try {
    const { companyId, workItemId } = await params;
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

    // Get work item to verify ownership and get strategy/tactic links
    const workItem = await getWorkItemById(workItemId);
    if (!workItem) {
      return NextResponse.json(
        { success: false, error: 'Work item not found' },
        { status: 404 }
      );
    }
    if (workItem.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Work item not found' },
        { status: 404 }
      );
    }

    // Build evidence array
    const evidence: string[] = [
      `Goal: ${body.primaryConversionAction.trim()}`,
      `Result: ${body.observedResult.trim()}`,
    ];

    // Add metric to evidence if provided
    if (body.metric?.label && body.metric?.value) {
      const metricStr = body.metric.period
        ? `${body.metric.label}: ${body.metric.value} (${body.metric.period})`
        : `${body.metric.label}: ${body.metric.value}`;
      evidence.push(`Metric: ${metricStr}`);
    }

    // Add artifact reference if provided
    if (body.artifactId) {
      evidence.push(`Artifact: ${body.artifactId}`);
    }

    // Build summary
    const summary = `${body.primaryConversionAction.trim()} → ${body.observedResult.trim().slice(0, 100)}${body.observedResult.length > 100 ? '...' : ''}`;

    // Get strategy/tactic links from work item
    const strategyId = workItem.strategyLink?.strategyId || '';
    const tacticIds = workItem.strategyLink?.tacticId ? [workItem.strategyLink.tacticId] : [];

    // Create outcome signal
    const signal = await createOutcomeSignal({
      companyId,
      strategyId,
      source: body.artifactId ? 'artifact' : 'work',
      sourceId: body.artifactId || workItemId,
      signalType: 'learning', // Captured outcomes are learnings
      confidence: body.confidence,
      summary,
      evidence,
      tacticIds,
      createdAt: new Date().toISOString(),
    });

    console.log('[Outcome API] Captured outcome for work item:', workItemId, {
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
