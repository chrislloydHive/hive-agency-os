// app/api/os/diagnostics/run/seo-lab/route.ts
// API endpoint for running SEO Lab diagnostic
// This is the comprehensive SEO diagnostic with GSC integration
//
// ModuleResult Contract:
// - ALWAYS writes a moduleResult to Airtable rawJson, even on failure
// - Uses inputUrl/normalizedUrl for provenance tracking
// - Validates evidence set before marking as "completed"

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runSeoLabEngine } from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';
import { createDiagnosticError, detectErrorCode, type DiagnosticErrorCode } from '@/lib/os/diagnostics/messages';
import { tryNormalizeWebsiteUrl } from '@/lib/utils/urls';
import {
  buildFailedModuleResult,
  buildCompletedModuleResult,
  detectModuleErrorCode,
  type ModuleResult,
} from '@/lib/os/diagnostics/moduleResult';

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
  const startedAt = new Date().toISOString();
  let runId: string | null = null;
  let inputUrl = '';
  let normalizedUrl: string | null = null;
  let airtableCompanyId = '';

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

    // Track input URL for provenance
    inputUrl = company.website;

    // Normalize URL
    const normResult = tryNormalizeWebsiteUrl(inputUrl);
    if (!normResult.ok) {
      // URL invalid - still create run record with failed moduleResult
      airtableCompanyId = company.id;

      const failedResult = buildFailedModuleResult(
        'seoLab',
        inputUrl,
        null,
        normResult.error,
        'INVALID_URL',
        startedAt
      );

      const run = await createDiagnosticRun({
        companyId: airtableCompanyId,
        toolId: 'seoLab',
        status: 'failed',
        summary: failedResult.summary,
        rawJson: failedResult,
        metadata: { inputUrl, error: normResult.error },
      });

      return NextResponse.json({
        run,
        result: {
          success: false,
          error: normResult.error,
          moduleResult: failedResult,
        },
      }, { status: 400 });
    }

    normalizedUrl = normResult.url;

    // Use the Airtable record ID for linking
    airtableCompanyId = company.id;

    console.log('[API] Running SEO Lab for:', {
      companyName: company.name,
      airtableCompanyId,
      isValidRecordId: airtableCompanyId?.startsWith('rec'),
      inputUrl,
      normalizedUrl,
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
    const run = await createDiagnosticRun({
      companyId: airtableCompanyId,
      toolId: 'seoLab',
      status: 'running',
      metadata: { inputUrl, normalizedUrl },
    });
    runId = run.id;

    // Run the SEO Lab engine with normalized URL
    const result = await runSeoLabEngine({
      companyId: airtableCompanyId,
      company,
      websiteUrl: normalizedUrl,
      workspaceId,
    });

    // Build module result based on engine result
    let moduleResult: ModuleResult;

    if (result.success && result.report) {
      moduleResult = buildCompletedModuleResult(
        'seoLab',
        inputUrl,
        normalizedUrl,
        result.score ?? 0,
        result.summary ?? '',
        result.report.dataConfidence,
        result.report,
        startedAt
      );
    } else {
      moduleResult = buildFailedModuleResult(
        'seoLab',
        inputUrl,
        normalizedUrl,
        result.error || 'Unknown error',
        detectModuleErrorCode(result.error || ''),
        startedAt
      );
    }

    // Update run with moduleResult (ALWAYS writes, never blank)
    const updatedRun = await updateDiagnosticRun(run.id, {
      status: result.success ? 'complete' : 'failed',
      score: result.score ?? null,
      summary: result.summary ?? moduleResult.summary,
      rawJson: moduleResult, // Always write moduleResult
      metadata: { inputUrl, normalizedUrl, error: result.error },
    });

    console.log('[API] SEO Lab complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
      status: moduleResult.status,
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
        moduleResult,
      },
    });
  } catch (error) {
    console.error('[API] SEO Lab error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Build failed moduleResult for the error
    const failedResult = buildFailedModuleResult(
      'seoLab',
      inputUrl,
      normalizedUrl,
      errorMessage,
      detectModuleErrorCode(errorMessage),
      startedAt
    );

    // If we have a run ID, update it with the failed result (never leave blank)
    if (runId) {
      try {
        await updateDiagnosticRun(runId, {
          status: 'failed',
          summary: failedResult.summary,
          rawJson: failedResult,
          metadata: { inputUrl, normalizedUrl, error: errorMessage },
        });
        console.log('[API] SEO Lab: Updated run with failed moduleResult:', runId);
      } catch (updateError) {
        console.error('[API] SEO Lab: Failed to update run with error:', updateError);
      }
    } else if (airtableCompanyId) {
      // No run created yet - create one with failed status
      try {
        await createDiagnosticRun({
          companyId: airtableCompanyId,
          toolId: 'seoLab',
          status: 'failed',
          summary: failedResult.summary,
          rawJson: failedResult,
          metadata: { inputUrl, normalizedUrl, error: errorMessage },
        });
        console.log('[API] SEO Lab: Created failed run with moduleResult');
      } catch (createError) {
        console.error('[API] SEO Lab: Failed to create failed run:', createError);
      }
    }

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
        moduleResult: failedResult,
        // Include technical details for debugging
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
