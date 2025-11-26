// app/api/diagnostics/website/start/route.ts
// API endpoint for starting Website Diagnostic

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { setDiagnosticStatus, makeStatusKey } from '@/lib/os/diagnostics/statusStore';
import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';

export const maxDuration = 300; // 5 minutes timeout

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
        { error: 'Company has no website URL configured' },
        { status: 400 }
      );
    }

    console.log('[Website Diagnostic] Starting for:', company.name, company.website);

    const statusKey = makeStatusKey('websiteLab', companyId);

    // Initialize status
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Initializing...',
      percent: 5,
    });

    // Create run record
    const run = await createDiagnosticRun({
      companyId,
      toolId: 'websiteLab',
      status: 'running',
    });

    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Loading diagnostic engine...',
      percent: 10,
      runId: run.id,
    });

    // Run the diagnostic asynchronously
    runDiagnosticAsync(companyId, company, run.id, statusKey).catch(error => {
      console.error('[Website Diagnostic] Async error:', error);
      setDiagnosticStatus(statusKey, {
        status: 'failed',
        currentStep: '',
        percent: 0,
        error: error.message,
        runId: run.id,
      });
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      message: 'Diagnostic started',
    });
  } catch (error) {
    console.error('[Website Diagnostic] Start error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start diagnostic' },
      { status: 500 }
    );
  }
}

// Run the diagnostic asynchronously
async function runDiagnosticAsync(
  companyId: string,
  company: CompanyRecord,
  runId: string,
  statusKey: string
) {
  try {
    // Update progress: Discovering pages
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Discovering website pages...',
      percent: 20,
      runId,
    });

    // Import and run the engine
    const { runWebsiteLabEngine } = await import('@/lib/os/diagnostics/engines');

    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Extracting evidence...',
      percent: 35,
      runId,
    });

    // Update progress before running
    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Running website analysis...',
      percent: 50,
      runId,
    });

    // Run the actual diagnostic
    const result = await runWebsiteLabEngine({
      companyId,
      company,
      websiteUrl: company.website!,
    });

    setDiagnosticStatus(statusKey, {
      status: 'running',
      currentStep: 'Saving results...',
      percent: 98,
      runId,
    });

    // Update run with results
    await updateDiagnosticRun(runId, {
      status: result.success ? 'complete' : 'failed',
      score: result.score ?? null,
      summary: result.summary ?? null,
      rawJson: result.data,
      metadata: result.error ? { error: result.error } : undefined,
    });

    setDiagnosticStatus(statusKey, {
      status: result.success ? 'completed' : 'failed',
      currentStep: result.success ? 'Complete!' : 'Failed',
      percent: 100,
      error: result.error,
      runId,
    });

    console.log('[Website Diagnostic] Completed:', {
      runId,
      success: result.success,
      score: result.score,
    });
  } catch (error) {
    console.error('[Website Diagnostic] Run error:', error);

    // Update status
    setDiagnosticStatus(statusKey, {
      status: 'failed',
      currentStep: '',
      percent: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      runId,
    });

    // Update run record
    await updateDiagnosticRun(runId, {
      status: 'failed',
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}
