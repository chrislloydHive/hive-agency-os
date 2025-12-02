// app/api/os/diagnostics/run/demand-lab/route.ts
// API endpoint for running Demand Lab diagnostic

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runDemandLabEngine } from '@/lib/diagnostics/demand-lab';
import { getCompanyById } from '@/lib/airtable/companies';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, workspaceId } = body;

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

    // Use the Airtable record ID for linking
    const airtableCompanyId = company.id;

    // Extract company type for V2 company-type-aware scoring
    const companyType = company.companyType || null;

    console.log('[API] Running Demand Lab V2 for:', {
      companyName: company.name,
      airtableCompanyId,
      website: company.website,
      companyType,
    });

    // Validate that we have a proper Airtable record ID
    if (!airtableCompanyId || !airtableCompanyId.startsWith('rec')) {
      console.error('[API] Invalid company record ID:', {
        id: airtableCompanyId,
        companyId,
        companyName: company.name,
      });
      return NextResponse.json(
        { error: `Invalid company record ID: ${airtableCompanyId}. Expected Airtable record ID starting with "rec".` },
        { status: 400 }
      );
    }

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId: airtableCompanyId,
      toolId: 'demandLab',
      status: 'running',
    });

    // Run the Demand Lab V2 engine (company-type aware)
    const result = await runDemandLabEngine({
      companyId: airtableCompanyId,
      url: company.website,
      companyType,
      workspaceId,
    });

    // Update run with results
    const updatedRun = await updateDiagnosticRun(run.id, {
      status: result.success ? 'complete' : 'failed',
      score: result.score ?? null,
      summary: result.summary ?? null,
      rawJson: result.report,
      metadata: result.error ? { error: result.error } : undefined,
    });

    console.log('[API] Demand Lab complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
      issues: result.report?.issues?.length ?? 0,
      quickWins: result.report?.quickWins?.length ?? 0,
    });

    // Process post-run hooks (Brain entry + Strategic Snapshot) in background
    if (result.success) {
      processDiagnosticRunCompletionAsync(airtableCompanyId, updatedRun);
    }

    return NextResponse.json({
      run: updatedRun,
      result: {
        success: result.success,
        score: result.score,
        summary: result.summary,
        report: result.report,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('[API] Demand Lab error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Provide helpful guidance for common Airtable errors
    let hint = '';
    if (errorMessage.includes('INVALID_VALUE_FOR_COLUMN')) {
      if (errorMessage.includes('Tool ID')) {
        hint = ' HINT: Add "demandLab" to the Tool ID single select options in the Diagnostic Runs Airtable table.';
      } else if (errorMessage.includes('Company')) {
        hint = ' HINT: Ensure the Company field in Diagnostic Runs is a Link field pointing to the Companies table, and the company record exists.';
      } else {
        hint = ' HINT: Check that all field values match the expected Airtable field types (single select options, link fields, etc).';
      }
    }

    return NextResponse.json(
      { error: errorMessage + hint },
      { status: 500 }
    );
  }
}
