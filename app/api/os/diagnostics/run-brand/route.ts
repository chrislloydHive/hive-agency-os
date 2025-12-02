// app/api/os/diagnostics/run-brand/route.ts
// Brand Lab V2 diagnostic API endpoint
//
// This endpoint now triggers an async Inngest job instead of running synchronously.
// Use the /api/os/diagnostics/status/brand-lab endpoint to poll for status.

import { NextRequest, NextResponse } from 'next/server';
import { createDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { getCompanyById } from '@/lib/airtable/companies';
import { inngest } from '@/lib/inngest/client';
import { setDiagnosticStatus, makeStatusKey } from '@/lib/os/diagnostics/statusStore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/os/diagnostics/run-brand
 *
 * Run Brand Lab V2 diagnostic for a company (async via Inngest)
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

    console.log('[Brand Lab API] Starting async diagnostic for:', company.name);

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

    // Send event to Inngest to start the background job
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
      runId: run.id,
      companyId,
      companyName: company.name,
      websiteUrl: company.website,
      message: 'Brand Lab diagnostic started. Poll /api/os/diagnostics/status/brand-lab?companyId=... for status.',
    });

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
