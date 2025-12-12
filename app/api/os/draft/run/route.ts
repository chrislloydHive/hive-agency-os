// app/api/os/draft/run/route.ts
// Generic Draft Generation API
//
// POST /api/os/draft/run
// Runs diagnostics if needed and generates a draft for the specified resource kind.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  ensurePrereqs,
  generateDraftForResource,
  buildSignalsBundle,
  isDraftableResourceKind,
  arePrereqsReady,
} from '@/lib/os/draft';
import type { DraftRunRequest, DraftRunResponse } from '@/lib/os/draft';

export const maxDuration = 180; // 3 minutes for full pipeline (Full GAP + Competition + AI)

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { companyId, kind, skipDiagnostics = false, forceCompetition = false } = body as DraftRunRequest;

    // Validate inputs
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing companyId' } as DraftRunResponse,
        { status: 400 }
      );
    }

    if (!kind || !isDraftableResourceKind(kind)) {
      return NextResponse.json(
        { success: false, error: `Invalid resource kind: ${kind}` } as DraftRunResponse,
        { status: 400 }
      );
    }

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' } as DraftRunResponse,
        { status: 404 }
      );
    }

    console.log('[draft/run] Starting for:', { companyId, kind, companyName: company.name, forceCompetition });

    // Check if prereqs were already ready before this call
    const initialSignals = await buildSignalsBundle(companyId);
    const prereqsWereReady = arePrereqsReady(initialSignals);

    // Ensure prerequisites (runs diagnostics if needed)
    const prereqResult = await ensurePrereqs(companyId, { skipDiagnostics, forceCompetition });

    if (!prereqResult.ready && !skipDiagnostics) {
      // Prerequisites couldn't be established
      const durationMs = Date.now() - startTime;
      return NextResponse.json({
        success: false,
        draft: null,
        prereqsWereReady,
        prereqsReady: false,
        message: prereqResult.error || 'Failed to establish prerequisites',
        durationMs,
        error: prereqResult.error,
      } as DraftRunResponse);
    }

    // Generate the draft
    const draftResult = await generateDraftForResource(kind, companyId, prereqResult.signals);

    const durationMs = Date.now() - startTime;

    // Build response message
    const messageParts: string[] = [];
    if (prereqResult.actions.length > 0) {
      messageParts.push(...prereqResult.actions);
    }
    if (draftResult.success) {
      messageParts.push(`${kind} draft generated`);
    } else {
      messageParts.push(draftResult.error || 'Draft generation failed');
    }

    console.log('[draft/run] Completed in', durationMs, 'ms:', messageParts.join('; '));

    return NextResponse.json({
      success: draftResult.success,
      draft: draftResult.draft,
      prereqsWereReady,
      prereqsReady: prereqResult.ready,
      message: messageParts.join('; '),
      durationMs,
      error: draftResult.error,
    } as DraftRunResponse);
  } catch (error) {
    console.error('[draft/run] Error:', error);
    const durationMs = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        draft: null,
        prereqsWereReady: false,
        prereqsReady: false,
        message: error instanceof Error ? error.message : 'Draft generation failed',
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as DraftRunResponse,
      { status: 500 }
    );
  }
}
