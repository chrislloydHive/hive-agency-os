// app/api/pipeline/opportunities/route.ts
// API for creating new opportunities

import { NextRequest, NextResponse } from 'next/server';
import { createOpportunity } from '@/lib/airtable/opportunities';
import { getCompanyById } from '@/lib/airtable/companies';
import { logOpportunityCreatedFromCompany } from '@/lib/telemetry/events';
import type { PipelineStage } from '@/lib/types/pipeline';

export const runtime = 'nodejs';

/**
 * POST /api/pipeline/opportunities
 * Create a new opportunity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      companyId,
      name,
      stage,
      value,
      closeDate,
      owner,
      notes,
      nextStep,
      nextStepDue,
    } = body;

    // Validate required field
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { ok: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create opportunity
    const opportunity = await createOpportunity({
      companyId: companyId || undefined,
      name: name.trim(),
      stage: (stage as PipelineStage) || 'discovery',
      value: value ? Number(value) : undefined,
      closeDate: closeDate || undefined,
      owner: owner || undefined,
      notes: notes || undefined,
      nextStep: nextStep || undefined,
      nextStepDue: nextStepDue || undefined,
    });

    if (!opportunity) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create opportunity' },
        { status: 500 }
      );
    }

    // Log telemetry event (if created from a company)
    if (companyId) {
      const company = await getCompanyById(companyId);
      logOpportunityCreatedFromCompany(
        opportunity.id,
        companyId,
        company?.name,
        name.trim()
      );
    }

    console.log('[Opportunities API] Created opportunity:', opportunity.id);

    return NextResponse.json({
      ok: true,
      opportunity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Opportunities API] Error creating opportunity:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
