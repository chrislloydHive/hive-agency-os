// app/api/os/diagnostics/run-brand/route.ts
// Brand Lab diagnostic API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runBrandLab } from '@/lib/gap-heavy/modules/brandLabImpl';
import { getHeavyGapRunsByCompanyId, createHeavyGapRun, updateHeavyGapRunState } from '@/lib/airtable/gapHeavyRuns';
import { HeavyGapRunState, createInitialState } from '@/lib/gap-heavy/state';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute timeout

/**
 * POST /api/os/diagnostics/run-brand
 *
 * Run Brand Lab diagnostic for a company
 *
 * Body: { companyId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log('[Brand Lab API] Running diagnostic for company:', companyId);

    // Get company data
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    if (!company.website) {
      return NextResponse.json(
        { error: 'Company has no website URL' },
        { status: 400 }
      );
    }

    // Get or create Heavy GAP run for this company
    const existingRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
    let heavyRun: HeavyGapRunState;

    if (existingRuns.length > 0) {
      // Update existing run
      heavyRun = existingRuns[0];
      console.log('[Brand Lab API] Found existing Heavy Run:', heavyRun.id);
    } else {
      // Create new run
      heavyRun = await createHeavyGapRun({
        gapPlanRunId: '',
        companyId,
        url: company.website,
        domain: new URL(company.website).hostname,
      });
      console.log('[Brand Lab API] Created new Heavy Run:', heavyRun.id);
    }

    // Run Brand Lab
    const result = await runBrandLab({
      company,
      websiteUrl: company.website,
      // TODO: Pull existing GAP data if available
    });

    console.log('[Brand Lab API] ✓ Diagnostic complete');

    // Save result to Heavy Run evidencePack
    const updatedState: HeavyGapRunState = {
      ...heavyRun,
      evidencePack: {
        ...(heavyRun.evidencePack || {}),
        brandLab: result,
        modules: heavyRun.evidencePack?.modules || [],
      },
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };

    await updateHeavyGapRunState(updatedState);
    console.log('[Brand Lab API] ✓ Saved to Airtable');

    return NextResponse.json({
      success: true,
      companyId,
      companyName: company.name,
      websiteUrl: company.website,
      score: result.diagnostic.score,
      benchmarkLabel: result.diagnostic.benchmarkLabel,
      summary: result.actionPlan.summary,
      result,
    });

  } catch (error) {
    console.error('[Brand Lab API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to run brand diagnostic',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
