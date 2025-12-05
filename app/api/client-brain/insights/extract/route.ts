// app/api/client-brain/insights/extract/route.ts
// Extract insights from a DiagnosticRun using the Brain Insights Engine
//
// DEPRECATED: This endpoint is deprecated. Insights are now automatically
// extracted when diagnostics complete via processDiagnosticRunCompletion.
// Use the /api/os/client-brain/[companyId]/insights/refresh endpoint instead.

import { NextRequest, NextResponse } from 'next/server';
import { getDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { processCompletedDiagnostic } from '@/lib/insights/engine';

interface ExtractRequest {
  runId: string;
  companyId: string;
  toolSlug: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExtractRequest;
    const { runId, companyId } = body;

    if (!runId || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: runId, companyId' },
        { status: 400 }
      );
    }

    console.log('[InsightExtract] Starting extraction (via engine):', { runId, companyId });

    // Get the diagnostic run
    const run = await getDiagnosticRun(runId);
    if (!run) {
      return NextResponse.json(
        { error: 'Diagnostic run not found' },
        { status: 404 }
      );
    }

    // Use the new insights engine for extraction
    const result = await processCompletedDiagnostic(companyId, run);

    console.log('[InsightExtract] Extraction complete:', result);

    return NextResponse.json({
      success: result.success,
      message: result.error || `Extracted ${result.insightsCreated} insights (${result.insightsSkipped} duplicates skipped)`,
      insightsCreated: result.insightsCreated,
      insightsSkipped: result.insightsSkipped,
      durationMs: result.duration,
    });

  } catch (error) {
    console.error('[InsightExtract] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract insights' },
      { status: 500 }
    );
  }
}
