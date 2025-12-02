// app/api/os/diagnostics/run/seo-lab/route.ts
// API endpoint for running SEO Lab diagnostic
// This is the comprehensive SEO diagnostic with GSC integration

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runSeoLabEngine } from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';
import { createDiagnosticError, detectErrorCode, type DiagnosticErrorCode } from '@/lib/os/diagnostics/messages';

/**
 * Helper to create structured error response
 */
function errorResponse(code: DiagnosticErrorCode, status: number) {
  const error = createDiagnosticError(code);
  return NextResponse.json(
    {
      error: error.userMessage,
      errorCode: error.code,
      suggestion: error.suggestion,
      retryable: error.retryable,
    },
    { status }
  );
}

export const maxDuration = 300; // 5 minutes timeout for comprehensive diagnostic

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, workspaceId } = body;

    if (!companyId) {
      return errorResponse('MISSING_COMPANY_ID', 400);
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return errorResponse('COMPANY_NOT_FOUND', 404);
    }

    if (!company.website) {
      return errorResponse('NO_WEBSITE_URL', 400);
    }

    // Use the Airtable record ID for linking
    const airtableCompanyId = company.id;

    console.log('[API] Running SEO Lab for:', {
      companyName: company.name,
      airtableCompanyId,
      isValidRecordId: airtableCompanyId?.startsWith('rec'),
      website: company.website,
    });

    // Validate that we have a proper Airtable record ID
    if (!airtableCompanyId || !airtableCompanyId.startsWith('rec')) {
      console.error('[API] Invalid company record ID:', {
        id: airtableCompanyId,
        companyId,
        companyName: company.name,
      });
      return errorResponse('INVALID_COMPANY_ID', 400);
    }

    // Create run record with "running" status
    // NOTE: If this fails with "Field 'Company' cannot accept the provided value",
    // check that "seoLab" is added to the Tool ID single select options in Airtable
    const run = await createDiagnosticRun({
      companyId: airtableCompanyId,
      toolId: 'seoLab',
      status: 'running',
    });

    // Run the SEO Lab engine
    const result = await runSeoLabEngine({
      companyId: airtableCompanyId,
      company,
      websiteUrl: company.website,
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

    console.log('[API] SEO Lab complete:', {
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
    console.error('[API] SEO Lab error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Detect error code from error message
    const errorCode = detectErrorCode(errorMessage);
    const structuredError = createDiagnosticError(errorCode);

    // Add specific hints for Airtable configuration errors
    let suggestion = structuredError.suggestion;
    if (errorMessage.includes('INVALID_VALUE_FOR_COLUMN')) {
      if (errorMessage.includes('Tool ID')) {
        suggestion = 'Add "seoLab" to the Tool ID options in Airtable.';
      } else if (errorMessage.includes('Company')) {
        suggestion = 'Check the Company field links to the Companies table.';
      }
    }

    return NextResponse.json(
      {
        error: structuredError.userMessage,
        errorCode: structuredError.code,
        suggestion,
        retryable: structuredError.retryable,
        // Include technical details for debugging
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
