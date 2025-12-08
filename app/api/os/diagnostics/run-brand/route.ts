// app/api/os/diagnostics/run-brand/route.ts
// Brand Lab V2 diagnostic API endpoint
//
// Supports two modes:
// 1. Async (default): Triggers Inngest job for background processing
// 2. Sync (fallback): Runs directly if ?sync=true or Inngest is unavailable
//
// Use the /api/os/diagnostics/status/brand-lab endpoint to poll for status.

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { inngest } from '@/lib/inngest/client';
import { setDiagnosticStatus, makeStatusKey } from '@/lib/os/diagnostics/statusStore';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for sync mode

/**
 * POST /api/os/diagnostics/run-brand
 *
 * Run Brand Lab V2 diagnostic for a company
 *
 * Body: { companyId: string, sync?: boolean }
 * Query: ?sync=true for synchronous execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, sync: syncBody } = body;
    const syncQuery = request.nextUrl.searchParams.get('sync') === 'true';
    const useSync = syncBody || syncQuery;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

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

    console.log('[Brand Lab API] Starting diagnostic for:', company.name, { sync: useSync });

    // Initialize status in store
    const statusKey = makeStatusKey('brandLab', companyId);
    setDiagnosticStatus(statusKey, {
      status: 'pending',
      currentStep: 'Initializing...',
      percent: 0,
    });

    // Create run record with "running" status
    const run = await createDiagnosticRun({
      companyId,
      toolId: 'brandLab',
      status: 'running',
    });

    // Update status
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Starting Brand Lab analysis...',
      percent: 5,
      runId: run.id,
    });

    // Sync mode: run directly
    if (useSync) {
      return await runBrandLabSync(companyId, company, run.id, statusKey);
    }

    // Async mode: try Inngest, fallback to sync if it fails
    try {
      await inngest.send({
        name: 'brand.diagnostic.start',
        data: {
          companyId,
          runId: run.id,
        },
      });

      console.log('[Brand Lab API] Inngest job triggered:', {
        runId: run.id,
        companyId,
      });

      return NextResponse.json({
        success: true,
        run: {
          id: run.id,
          status: 'running',
          companyId,
        },
        runId: run.id,
        companyId,
        companyName: company.name,
        websiteUrl: company.website,
        mode: 'async',
        message: 'Brand Lab diagnostic started. Poll /api/os/diagnostics/status/brand-lab?companyId=... for status.',
      });
    } catch (inngestError) {
      console.warn('[Brand Lab API] Inngest failed, falling back to sync mode:', inngestError);
      return await runBrandLabSync(companyId, company, run.id, statusKey);
    }

  } catch (error) {
    console.error('[Brand Lab API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to start brand diagnostic',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Run Brand Lab synchronously (fallback mode)
 */
async function runBrandLabSync(
  companyId: string,
  company: CompanyRecord,
  runId: string,
  statusKey: string
) {
  console.log('[Brand Lab API] Running in SYNC mode');

  try {
    // Update status
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Analyzing brand signals...',
      percent: 15,
      runId,
    });

    // Import and run V1 engine
    const { runBrandLab: runBrandLabV1 } = await import('@/lib/gap-heavy/modules/brandLabImpl');

    const v1Result = await runBrandLabV1({
      company,
      websiteUrl: company.website!,
      skipCompetitive: false,
    });

    console.log('[Brand Lab API] V1 analysis complete:', {
      v1Score: v1Result.diagnostic.score,
      benchmarkLabel: v1Result.diagnostic.benchmarkLabel,
    });

    // Update status
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Building dimension scores...',
      percent: 70,
      runId,
    });

    // Build full V2 result
    const { buildBrandLabResultFromV1 } = await import('@/lib/diagnostics/brand-lab');

    const fullResult = await buildBrandLabResultFromV1(v1Result, {
      company,
      websiteUrl: company.website!,
      companyId,
    });

    // Update status
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Saving results...',
      percent: 95,
      runId,
    });

    // Log what we're about to save
    const rawJsonStr = JSON.stringify(fullResult);
    console.log('[Brand Lab API] Saving results:', {
      runId,
      score: fullResult.overallScore,
      summaryLength: fullResult.narrativeSummary?.length,
      rawJsonLength: rawJsonStr.length,
      hasDimensions: Array.isArray(fullResult.dimensions),
      dimensionCount: fullResult.dimensions?.length,
    });

    // Update diagnostic run with results
    const updatedRun = await updateDiagnosticRun(runId, {
      status: 'complete',
      score: fullResult.overallScore,
      summary: fullResult.narrativeSummary,
      rawJson: fullResult,
    });

    console.log('[Brand Lab API] Run updated:', {
      runId: updatedRun.id,
      status: updatedRun.status,
      hasRawJson: !!updatedRun.rawJson,
    });

    // Update final status
    setDiagnosticStatus(statusKey, {
      status: 'completed',
      currentStep: 'Complete',
      percent: 100,
      runId,
      score: fullResult.overallScore,
      benchmarkLabel: fullResult.maturityStage,
    });

    console.log('[Brand Lab API] SYNC mode complete:', {
      runId,
      score: fullResult.overallScore,
      maturityStage: fullResult.maturityStage,
    });

    return NextResponse.json({
      success: true,
      run: {
        id: runId,
        status: 'complete',
        companyId,
      },
      runId,
      companyId,
      companyName: company.name,
      websiteUrl: company.website,
      mode: 'sync',
      score: fullResult.overallScore,
      maturityStage: fullResult.maturityStage,
      benchmarkLabel: fullResult.maturityStage,
    });

  } catch (error) {
    console.error('[Brand Lab API] Sync execution failed:', error);

    // Update status to failed
    setDiagnosticStatus(statusKey, {
      status: 'failed',
      currentStep: 'Failed',
      percent: 0,
      runId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Update run record
    await updateDiagnosticRun(runId, {
      status: 'failed',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      {
        error: 'Brand diagnostic failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
