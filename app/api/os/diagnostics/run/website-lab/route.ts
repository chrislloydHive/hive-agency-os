// app/api/os/diagnostics/run/website-lab/route.ts
// API endpoint for running Website Lab diagnostic

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runWebsiteLabEngine } from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';

export const maxDuration = 240; // 4 minutes timeout

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

    console.log('[API] Running Website Lab for:', company.name);

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId,
      toolId: 'websiteLab',
      status: 'running',
    });

    // Run the engine
    const result = await runWebsiteLabEngine({
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

    console.log('[API] Website Lab complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
    });

    // Process post-run hooks (Brain entry + Strategic Snapshot) in background
    if (result.success) {
      processDiagnosticRunCompletionAsync(companyId, updatedRun);
    }

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
    console.error('[API] Website Lab error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
