// app/api/pipeline/opportunities/[opportunityId]/route.ts
// Single Opportunity API - GET and PATCH

import { NextRequest, NextResponse } from 'next/server';
import { getOpportunityById, updateOpportunity } from '@/lib/airtable/opportunities';
import type { PipelineStage } from '@/lib/types/pipeline';

export const runtime = 'nodejs';

/**
 * GET /api/pipeline/opportunities/[opportunityId]
 * Fetch a single opportunity by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const { opportunityId } = await params;

    if (!opportunityId) {
      return NextResponse.json(
        { ok: false, error: 'Missing opportunityId' },
        { status: 400 }
      );
    }

    const opportunity = await getOpportunityById(opportunityId);

    if (!opportunity) {
      return NextResponse.json(
        { ok: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      opportunity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Opportunity API] Error fetching:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipeline/opportunities/[opportunityId]
 * Update opportunity fields (stage, value, etc.)
 *
 * Null-clearing: Pass null or empty string to clear these fields:
 * nextStep, nextStepDue, source, owner, decisionOwner, decisionDate,
 * budgetConfidence, knownCompetitors, rfpDueDate, rfpDecisionDate, rfpLink
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const { opportunityId } = await params;
    const body = await request.json();

    if (!opportunityId) {
      return NextResponse.json(
        { ok: false, error: 'Missing opportunityId' },
        { status: 400 }
      );
    }

    // Build updates object from allowed fields
    // All string fields support null-clearing (empty string -> null)
    const updates: Partial<{
      stage: PipelineStage;
      value: number;
      deliverableName: string | null;
      closeDate: string | null;
      owner: string | null;
      notes: string | null;
      source: string | null;
      nextStep: string | null;
      nextStepDue: string | null;
      decisionOwner: string | null;
      decisionDate: string | null;
      budgetConfidence: string | null;
      knownCompetitors: string | null;
      rfpDueDate: string | null;
      rfpDecisionDate: string | null;
      rfpLink: string | null;
      opportunityType: string | null;
    }> = {};

    // Helper: normalize empty string to null for clearable fields
    const normalize = (val: unknown): string | null => {
      if (val === null || val === undefined || val === '') return null;
      return String(val);
    };

    if (body.stage !== undefined) {
      updates.stage = body.stage as PipelineStage;
    }
    if (body.value !== undefined) {
      updates.value = Number(body.value);
    }
    if (body.deliverableName !== undefined) {
      updates.deliverableName = normalize(body.deliverableName);
    }
    if (body.closeDate !== undefined) {
      updates.closeDate = normalize(body.closeDate);
    }
    if (body.owner !== undefined) {
      updates.owner = normalize(body.owner);
    }
    if (body.notes !== undefined) {
      updates.notes = normalize(body.notes);
    }
    if (body.source !== undefined) {
      updates.source = normalize(body.source);
    }
    if (body.nextStep !== undefined) {
      updates.nextStep = normalize(body.nextStep);
    }
    if (body.nextStepDue !== undefined) {
      updates.nextStepDue = normalize(body.nextStepDue);
    }
    // Buying Process fields
    if (body.decisionOwner !== undefined) {
      updates.decisionOwner = normalize(body.decisionOwner);
    }
    if (body.decisionDate !== undefined) {
      updates.decisionDate = normalize(body.decisionDate);
    }
    if (body.budgetConfidence !== undefined) {
      updates.budgetConfidence = normalize(body.budgetConfidence);
    }
    if (body.knownCompetitors !== undefined) {
      updates.knownCompetitors = normalize(body.knownCompetitors);
    }
    // RFP fields
    if (body.rfpDueDate !== undefined) {
      updates.rfpDueDate = normalize(body.rfpDueDate);
    }
    if (body.rfpDecisionDate !== undefined) {
      updates.rfpDecisionDate = normalize(body.rfpDecisionDate);
    }
    if (body.rfpLink !== undefined) {
      updates.rfpLink = normalize(body.rfpLink);
    }
    // Deal Context field
    if (body.opportunityType !== undefined) {
      updates.opportunityType = normalize(body.opportunityType);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const opportunity = await updateOpportunity(opportunityId, updates);

    if (!opportunity) {
      return NextResponse.json(
        { ok: false, error: 'Failed to update opportunity' },
        { status: 500 }
      );
    }

    console.log(`[Opportunity API] Updated ${opportunityId}:`, Object.keys(updates));

    return NextResponse.json({
      ok: true,
      opportunity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Opportunity API] Error updating:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
