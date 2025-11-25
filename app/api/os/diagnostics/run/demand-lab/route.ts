// app/api/os/diagnostics/run/demand-lab/route.ts
// API endpoint for running Demand Lab diagnostic

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runDemandLabEngine } from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';

export const maxDuration = 180; // 3 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId' },
        { status: 400 }
      );
    }

    // Verify company exists
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

    console.log('[API] Running Demand Lab for:', company.name);

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId,
      toolId: 'demandLab',
      status: 'running',
    });

    // Run the engine
    const result = await runDemandLabEngine({
      companyId,
      company,
      websiteUrl: company.website,
    });

    // Update run with results
    const updatedRun = await updateDiagnosticRun(run.id, {
      status: result.success ? 'complete' : 'failed',
      score: result.score ?? null,
      summary: result.summary ?? null,
      rawJson: result.data,
      metadata: result.error ? { error: result.error } : undefined,
    });

    console.log('[API] Demand Lab complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
    });

    return NextResponse.json({
      run: updatedRun,
      result: {
        success: result.success,
        score: result.score,
        summary: result.summary,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('[API] Demand Lab error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
