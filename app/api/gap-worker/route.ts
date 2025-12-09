// app/api/gap-worker/route.ts
//
// GAP Worker status/health endpoint.
// Used by DMA to verify connectivity to Hive OS GAP infrastructure.
//
// Request:
// POST /api/gap-worker
// { "action": "status" | "health" }
//
// Response:
// 200 OK
// {
//   "status": "ok",
//   "worker": "hive-agency-os",
//   "timestamp": "2024-01-01T00:00:00.000Z",
//   "capabilities": ["gap-ia", "gap-full", "website-diagnostic"]
// }

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface GapWorkerRequest {
  action?: 'status' | 'health' | 'ping';
  gapIaRunId?: string;
  companyId?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body (optional - status check doesn't require a body)
    const body: GapWorkerRequest = await request.json().catch(() => ({}));
    const { action = 'status' } = body;

    console.log('[gap-worker] Request received:', { action });

    // For now, implement a simple status/health check
    // Can be extended later to delegate to GAP engine / Inngest
    const response = {
      status: 'ok',
      worker: 'hive-agency-os',
      timestamp: new Date().toISOString(),
      action,
      capabilities: [
        'gap-ia',
        'gap-full',
        'website-diagnostic',
        'seo-lab',
        'brand-lab',
        'content-lab',
        'demand-lab',
        'ops-lab',
      ],
      endpoints: {
        gapIa: '/api/gap-ia/run',
        gapPlanFromIa: '/api/gap-plan/from-ia',
        websiteDiagnosticStart: '/api/diagnostics/website/start',
        websiteDiagnosticStatus: '/api/diagnostics/website/status',
      },
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        durationMs: Date.now() - startTime,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[gap-worker] Error:', error);

    return NextResponse.json(
      {
        status: 'error',
        worker: 'hive-agency-os',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          durationMs,
        },
      },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation/health check (simpler)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    worker: 'hive-agency-os',
    timestamp: new Date().toISOString(),
    description: 'GAP Worker status endpoint for Hive Agency OS',
    capabilities: [
      'gap-ia',
      'gap-full',
      'website-diagnostic',
      'seo-lab',
      'brand-lab',
      'content-lab',
      'demand-lab',
      'ops-lab',
    ],
    endpoints: {
      gapIa: {
        url: '/api/gap-ia/run',
        method: 'POST',
        description: 'Run GAP-IA (Initial Assessment) for any URL',
      },
      gapPlanFromIa: {
        url: '/api/gap-plan/from-ia',
        method: 'POST',
        description: 'Trigger Full GAP generation from an existing GAP-IA run',
      },
      websiteDiagnosticStart: {
        url: '/api/diagnostics/website/start',
        method: 'POST',
        description: 'Start a website diagnostic for a company',
      },
      websiteDiagnosticStatus: {
        url: '/api/diagnostics/website/status',
        method: 'GET/POST',
        description: 'Check website diagnostic status',
      },
      gapWorker: {
        url: '/api/gap-worker',
        method: 'GET/POST',
        description: 'This endpoint - worker status and health check',
      },
    },
  });
}
