// app/api/os/companies/[companyId]/onboarding/stream/route.ts
// SSE streaming endpoint for Deep Context Build (Baseline Context Build) progress
//
// Uses Server-Sent Events to stream real-time progress updates to the UI
//
// NOTE: This now uses runBaselineContextBuild which is the canonical
// "Run Everything Once" function for building/refreshing company context.

import { NextRequest } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  runBaselineContextBuild,
  type BaselineBuildInput,
} from '@/lib/contextGraph/baseline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Vercel

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return new Response(JSON.stringify({ error: 'Company not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let options: Partial<BaselineBuildInput> = {};
  try {
    const body = await request.json();
    options = body || {};
  } catch {
    // No body is fine
  }

  console.log(`[Baseline Stream] Starting for ${company.name}`);

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Send SSE event helper
  const sendEvent = async (data: unknown) => {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    } catch (error) {
      console.error('[Onboarding Stream] Error sending event:', error);
    }
  };

  // Send initial connection event
  sendEvent({
    type: 'connected',
    companyId,
    companyName: company.name,
    timestamp: new Date().toISOString(),
  });

  // Run baseline context build with progress callback (in background)
  (async () => {
    try {
      const result = await runBaselineContextBuild(
        {
          companyId,
          force: options.force ?? false,
          dryRun: options.dryRun ?? false,
        },
        // Progress callback - streams each step update to the client
        async (progress) => {
          await sendEvent(progress);
        }
      );

      // Final result (redundant with 'complete' event but ensures delivery)
      await sendEvent({
        type: 'done',
        result: {
          success: result.success,
          companyId: result.companyId,
          companyName: result.companyName,
          runId: result.runId,
          durationMs: result.totalDurationMs,
          steps: result.steps,
          summary: result.summary,
          wasNoOp: result.wasNoOp,
          contextHealthBefore: {
            score: result.contextBefore.overallScore,
            severity: result.contextBefore.severity,
          },
          contextHealthAfter: {
            score: result.contextAfter.overallScore,
            severity: result.contextAfter.severity,
          },
          snapshotId: result.snapshotId,
          error: result.error,
        },
      });
    } catch (error) {
      console.error('[Baseline Stream] Critical error:', error);
      await sendEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        steps: [],
        totalSteps: 9,
      });
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
