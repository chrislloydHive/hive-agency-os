// app/api/gap-plan/from-ia/route.ts
//
// Trigger Full GAP generation from an existing GAP-IA run.
// This endpoint is called by DMA after a GAP-IA has been completed.
//
// Request:
// POST /api/gap-plan/from-ia
// {
//   "gapIaRunId": "rec123",
//   "companyId": "uuid-456",  // optional
//   "source": "dma"           // optional
// }
//
// Response:
// 202 Accepted
// {
//   "status": "queued",
//   "gapIaRunId": "rec123",
//   "message": "Full GAP generation queued"
// }

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { getGapIaRunById } from '@/lib/airtable/gapIaRuns';
import { createDiagnosticRun } from '@/lib/os/diagnostics/runs';

export const dynamic = 'force-dynamic';

interface GapPlanFromIaRequest {
  gapIaRunId: string;
  companyId?: string;
  source?: string;
  diagnosticRunId?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: GapPlanFromIaRequest = await request.json().catch(() => ({ gapIaRunId: '' }));
    const { gapIaRunId, companyId, source, diagnosticRunId } = body;

    // Validate required fields
    if (!gapIaRunId || typeof gapIaRunId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'gapIaRunId is required' },
        { status: 400 }
      );
    }

    console.log('[gap-plan/from-ia] Starting Full GAP for GAP-IA run:', gapIaRunId);

    // Verify the GAP-IA run exists
    const gapIaRun = await getGapIaRunById(gapIaRunId);
    if (!gapIaRun) {
      return NextResponse.json(
        { success: false, error: `GAP-IA run not found: ${gapIaRunId}` },
        { status: 404 }
      );
    }

    // Ensure we have a companyId (from request or from GAP-IA run)
    const resolvedCompanyId = companyId || gapIaRun.companyId;

    // Create a diagnostic run to track this if not provided
    let resolvedDiagnosticRunId = diagnosticRunId;
    if (!resolvedDiagnosticRunId && resolvedCompanyId) {
      try {
        const diagnosticRun = await createDiagnosticRun({
          companyId: resolvedCompanyId,
          toolId: 'gapPlan',
          status: 'running',
        });
        resolvedDiagnosticRunId = diagnosticRun.id;
        console.log('[gap-plan/from-ia] Created diagnostic run:', resolvedDiagnosticRunId);
      } catch (error) {
        console.warn('[gap-plan/from-ia] Could not create diagnostic run:', error);
        // Continue without diagnostic run - Full GAP can still run
      }
    }

    // Send the Inngest event to start Full GAP background processing
    const sendResult = await inngest.send({
      name: 'gap/generate-full',
      data: {
        gapIaRunId,
        companyId: resolvedCompanyId,
        diagnosticRunId: resolvedDiagnosticRunId,
        source: source || 'dma',
      },
    });

    const durationMs = Date.now() - startTime;
    console.log('[gap-plan/from-ia] Inngest event sent:', {
      gapIaRunId,
      companyId: resolvedCompanyId,
      diagnosticRunId: resolvedDiagnosticRunId,
      result: sendResult,
      durationMs,
    });

    // Return 202 Accepted - the job is now queued
    return NextResponse.json(
      {
        status: 'queued',
        gapIaRunId,
        companyId: resolvedCompanyId,
        diagnosticRunId: resolvedDiagnosticRunId,
        message: 'Full GAP generation queued',
        metadata: {
          durationMs,
          source: source || 'dma',
        },
      },
      { status: 202 }
    );

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[gap-plan/from-ia] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        metadata: {
          durationMs,
        },
      },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation/health check
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/gap-plan/from-ia',
    method: 'POST',
    description: 'Trigger Full GAP generation from an existing GAP-IA run',
    request: {
      gapIaRunId: 'string (required) - The GAP-IA run ID to generate Full GAP from',
      companyId: 'string (optional) - Company ID for context (defaults to GAP-IA run companyId)',
      source: 'string (optional) - Source of the request (e.g., "dma")',
      diagnosticRunId: 'string (optional) - Existing diagnostic run ID to update',
    },
    response: {
      status: '"queued"',
      gapIaRunId: 'string',
      companyId: 'string | null',
      diagnosticRunId: 'string | null',
      message: 'string',
    },
    statusCodes: {
      202: 'Accepted - Full GAP generation queued',
      400: 'Bad Request - Missing gapIaRunId',
      404: 'Not Found - GAP-IA run not found',
      500: 'Internal Server Error',
    },
  });
}
