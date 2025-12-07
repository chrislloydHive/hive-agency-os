// app/api/os/companies/[companyId]/competition/run-v2/route.ts
// Competition Discovery V2 API Endpoint
//
// Triggers the enhanced competition discovery pipeline with:
// - Full Brain context integration
// - Multi-signal discovery (AI simulation)
// - Context-informed scoring
// - Step tracking for observability
// - Proper error handling and status updates

import { NextResponse } from 'next/server';
import { runCompetitionV2 } from '@/lib/competition/discoveryV2';

export const maxDuration = 120; // Allow up to 2 minutes for discovery

interface Props {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log(`[api/competition/run-v2] Starting discovery v2 for company: ${companyId}`);

    // Run the V2 discovery pipeline
    // This creates a run record, executes all steps, and updates status
    const run = await runCompetitionV2({ companyId });

    console.log(`[api/competition/run-v2] Discovery v2 ${run.status} for company: ${companyId}`);
    console.log(`[api/competition/run-v2] Found ${run.competitors.length} competitors`);

    // Return the full run object
    // The client needs status, steps, stats, errorMessage for proper UI display
    return NextResponse.json({
      success: run.status !== 'failed',
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      competitors: run.competitors,
      steps: run.steps,
      stats: run.stats,
      querySummary: run.querySummary,
      errorMessage: run.errorMessage,
      errors: run.errors,
      dataConfidenceScore: run.dataConfidenceScore,
    });
  } catch (error) {
    console.error('[api/competition/run-v2] Discovery failed:', error);

    // Return error response - the run record may still exist in failed state
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST to trigger competition discovery v2' },
    { status: 405 }
  );
}
