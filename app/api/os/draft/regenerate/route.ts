// app/api/os/draft/regenerate/route.ts
// Regenerate Draft API
//
// POST /api/os/draft/regenerate
// Regenerates a draft from existing baseline signals.
// If forceCompetition=true, runs fresh Competition V3 before regenerating.
// When V4 is enabled, always runs V4 to get validated competitors.
// Used when saved content exists and user wants to regenerate the AI draft.
//
// TRUST: Validates baseRevisionId to prevent regenerating against stale data.
// Returns 409 Conflict if the saved context has been modified since baseRevisionId.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import {
  buildSignalsBundle,
  generateDraftForResource,
  isDraftableResourceKind,
  arePrereqsReady,
  ensurePrereqs,
} from '@/lib/os/draft';
import { runCompetitionV4, shouldRunV4 } from '@/lib/competition-v4';
import type { DraftRegenerateRequest, DraftRegenerateResponse } from '@/lib/os/draft';

export const maxDuration = 180; // 3 minutes if running fresh competition

export async function POST(request: NextRequest) {
  console.log('=== [draft/regenerate] ENDPOINT HIT ===');
  try {
    const body = await request.json();
    console.log('[draft/regenerate] Request body:', JSON.stringify(body));
    const { companyId, kind, forceCompetition = false, baseRevisionId } = body as DraftRegenerateRequest;

    // Validate inputs
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing companyId' } as DraftRegenerateResponse,
        { status: 400 }
      );
    }

    if (!kind || !isDraftableResourceKind(kind)) {
      return NextResponse.json(
        { success: false, error: `Invalid resource kind: ${kind}` } as DraftRegenerateResponse,
        { status: 400 }
      );
    }

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' } as DraftRegenerateResponse,
        { status: 404 }
      );
    }

    // TRUST: Validate baseRevisionId to prevent regenerating against stale data
    // This is especially important for 'context' kind to ensure we're regenerating
    // based on the same context version the user was viewing
    if (baseRevisionId && kind === 'context') {
      const currentContext = await getCompanyContext(companyId);
      if (currentContext?.updatedAt && currentContext.updatedAt !== baseRevisionId) {
        console.log('[draft/regenerate] Revision conflict:', {
          baseRevisionId,
          currentRevisionId: currentContext.updatedAt,
        });
        return NextResponse.json(
          {
            success: false,
            draft: null,
            message: 'Context was modified since you last loaded it. Please refresh and try again.',
            error: 'REVISION_CONFLICT',
          } as DraftRegenerateResponse,
          { status: 409 }
        );
      }
    }

    console.log('[draft/regenerate] Starting for:', { companyId, kind, companyName: company.name, forceCompetition, baseRevisionId });

    // Build signals - if forceCompetition, use ensurePrereqs to run fresh Competition V3/V4
    // and get fresh signals in one call (avoids Airtable stale reads)
    let signals;
    if (forceCompetition) {
      console.log('[draft/regenerate] Running fresh Competition (forceCompetition=true)...');
      const prereqsResult = await ensurePrereqs(companyId, { forceCompetition: true });
      signals = prereqsResult.signals;
      console.log('[draft/regenerate] Fresh signals from ensurePrereqs:', {
        competitorCount: signals.competitors?.length ?? 0,
        competitorSource: signals.competitorSource,
        topDomains: signals.competitors?.slice(0, 3).map(c => c.domain),
      });
    } else if (shouldRunV4()) {
      // V4 enabled - run V4 to get validated competitors even without forceCompetition
      // V4 doesn't have storage yet, so we need to run it fresh each time
      console.log('[draft/regenerate] Running Competition V4 (V4 enabled, no forceCompetition)...');

      let freshV4Result = null;
      try {
        freshV4Result = await runCompetitionV4({
          companyId,
          companyName: company.name ?? undefined,
          domain: company.domain ?? company.website ?? undefined,
        });
        console.log('[competition-v4] ran', companyId);
        console.log('[draft/regenerate] V4 result:', {
          status: freshV4Result.execution.status,
          category: freshV4Result.category.category_name,
          validatedCount: freshV4Result.competitors.validated.length,
          removedCount: freshV4Result.competitors.removed.length,
        });
      } catch (error) {
        console.error('[draft/regenerate] V4 failed, falling back to V3:', error);
      }

      // Build signals bundle with fresh V4 result
      signals = await buildSignalsBundle(companyId, { freshCompetitionV4Result: freshV4Result ?? undefined });

      console.log('[signals] competitorSource', signals.competitorSource,
        signals.competitors?.slice(0, 10).map(c => c.domain));
    } else {
      // V3 only - build from existing data
      console.log('[draft/regenerate] Building from existing data (V3 only)...');
      signals = await buildSignalsBundle(companyId);
    }

    // Check if we have enough signal to regenerate
    if (!arePrereqsReady(signals)) {
      return NextResponse.json({
        success: false,
        draft: null,
        message: 'No baseline data available. Run diagnostics first.',
        error: 'INSUFFICIENT_SIGNAL',
      } as DraftRegenerateResponse);
    }

    // Generate the draft
    const draftResult = await generateDraftForResource(kind, companyId, signals);

    console.log('[draft/regenerate] Completed:', {
      success: draftResult.success,
      summary: draftResult.summary,
    });

    return NextResponse.json({
      success: draftResult.success,
      draft: draftResult.draft,
      message: draftResult.summary,
      error: draftResult.error,
    } as DraftRegenerateResponse);
  } catch (error) {
    console.error('[draft/regenerate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        draft: null,
        message: error instanceof Error ? error.message : 'Regeneration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as DraftRegenerateResponse,
      { status: 500 }
    );
  }
}
