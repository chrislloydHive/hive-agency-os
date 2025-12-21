// app/api/os/diagnostics/run/content-lab/route.ts
// API endpoint for running Content Lab V1 diagnostic
//
// ModuleResult Contract:
// - ALWAYS writes a moduleResult to Airtable rawJson, even on failure
// - Uses inputUrl/normalizedUrl for provenance tracking
// - Marks as "completed_shallow" when no blog detected (not hard truth)
// - Includes realistic dataConfidence based on scan depth

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { runContentLabEngine } from '@/lib/diagnostics/content-lab';
import { getCompanyById } from '@/lib/airtable/companies';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';
import { tryNormalizeWebsiteUrl } from '@/lib/utils/urls';
import {
  buildFailedModuleResult,
  buildCompletedModuleResult,
  buildShallowModuleResult,
  detectModuleErrorCode,
  shouldBeShallowContentResult,
  type ModuleResult,
} from '@/lib/os/diagnostics/moduleResult';

export const maxDuration = 300; // 5 minutes timeout

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

    // Track input URL for provenance
    inputUrl = company.website;

    // Normalize URL
    const normResult = tryNormalizeWebsiteUrl(inputUrl);
    if (!normResult.ok) {
      // URL invalid - still create run record with failed moduleResult
      airtableCompanyId = company.id;

      const failedResult = buildFailedModuleResult(
        'contentLab',
        inputUrl,
        null,
        normResult.error,
        'INVALID_URL',
        startedAt
      );

      const run = await createDiagnosticRun({
        companyId: airtableCompanyId,
        toolId: 'contentLab',
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

    // Extract company type for company-type-aware scoring
    const companyType = company.companyType || null;

    console.log('[API] Running Content Lab V1 for:', {
      companyName: company.name,
      airtableCompanyId,
      inputUrl,
      normalizedUrl,
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
      toolId: 'contentLab',
      status: 'running',
      metadata: { inputUrl, normalizedUrl },
    });
    runId = run.id;

    // Run the Content Lab V1 engine with normalized URL (company-type aware)
    const result = await runContentLabEngine({
      companyId: airtableCompanyId,
      url: normalizedUrl,
      companyType,
      workspaceId,
    });

    // Build module result based on engine result
    let moduleResult: ModuleResult;

    if (result.success && result.report) {
      // Check if result should be marked as shallow (no blog, only homepage, etc.)
      const shallowCheck = shouldBeShallowContentResult({
        hasBlog: result.report.findings?.contentTypes?.some(ct => ct.type === 'blog' && ct.present) ?? false,
        articleCount: result.report.findings?.articleTitles?.length ?? 0,
        contentUrls: result.report.findings?.contentUrls,
      });

      if (shallowCheck.isShallow) {
        moduleResult = buildShallowModuleResult(
          'contentLab',
          inputUrl,
          normalizedUrl,
          result.score ?? 0,
          result.summary ?? '',
          shallowCheck.reason!,
          shallowCheck.missingData!,
          result.report,
          startedAt
        );
        console.log('[API] Content Lab: Marked as completed_shallow:', {
          reason: shallowCheck.reason,
          missingData: shallowCheck.missingData,
        });
      } else {
        moduleResult = buildCompletedModuleResult(
          'contentLab',
          inputUrl,
          normalizedUrl,
          result.score ?? 0,
          result.summary ?? '',
          result.report.dataConfidence,
          result.report,
          startedAt
        );
      }
    } else {
      moduleResult = buildFailedModuleResult(
        'contentLab',
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
      metadata: { inputUrl, normalizedUrl, moduleStatus: moduleResult.status, error: result.error },
    });

    console.log('[API] Content Lab complete:', {
      runId: updatedRun.id,
      success: result.success,
      score: result.score,
      moduleStatus: moduleResult.status,
      dataConfidenceLevel: moduleResult.dataConfidence.level,
      issues: result.report?.issues?.length ?? 0,
      quickWins: result.report?.quickWins?.length ?? 0,
      topics: result.report?.findings?.topics?.length ?? 0,
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
    console.error('[API] Content Lab error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Build failed moduleResult for the error
    const failedResult = buildFailedModuleResult(
      'contentLab',
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
        console.log('[API] Content Lab: Updated run with failed moduleResult:', runId);
      } catch (updateError) {
        console.error('[API] Content Lab: Failed to update run with error:', updateError);
      }
    } else if (airtableCompanyId) {
      // No run created yet - create one with failed status
      try {
        await createDiagnosticRun({
          companyId: airtableCompanyId,
          toolId: 'contentLab',
          status: 'failed',
          summary: failedResult.summary,
          rawJson: failedResult,
          metadata: { inputUrl, normalizedUrl, error: errorMessage },
        });
        console.log('[API] Content Lab: Created failed run with moduleResult');
      } catch (createError) {
        console.error('[API] Content Lab: Failed to create failed run:', createError);
      }
    }

    // Provide helpful guidance for common Airtable errors
    let hint = '';
    if (errorMessage.includes('INVALID_VALUE_FOR_COLUMN')) {
      if (errorMessage.includes('Tool ID')) {
        hint = ' HINT: Add "contentLab" to the Tool ID single select options in the Diagnostic Runs Airtable table.';
      } else if (errorMessage.includes('Company')) {
        hint = ' HINT: Ensure the Company field in Diagnostic Runs is a Link field pointing to the Companies table, and the company record exists.';
      } else {
        hint = ' HINT: Check that all field values match the expected Airtable field types (single select options, link fields, etc).';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage + hint,
        moduleResult: failedResult,
      },
      { status: 500 }
    );
  }
}
