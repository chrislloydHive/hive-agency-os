// app/api/os/context/run-baseline/route.ts
// Run baseline diagnostics for Context AI
//
// Runs Full GAP + Competition to gather baseline signals for accurate context generation.
// Falls back to GAP-IA if Full GAP fails.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFullGAPOrchestrator } from '@/lib/gap/orchestrator';
import { runCompetitionV3 } from '@/lib/competition-v3';
import { runCompetitionV4, shouldRunV4, type CompetitionV4Result } from '@/lib/competition-v4';
import { runInitialAssessment } from '@/lib/gap/core';

export const maxDuration = 180; // 3 minutes - these diagnostics can take a while

interface BaselineRunResult {
  success: boolean;
  fullGap: {
    ran: boolean;
    success: boolean;
    error?: string;
    runId?: string;
  };
  competition: {
    ran: boolean;
    success: boolean;
    error?: string;
    competitorCount?: number;
  };
  competitionV4?: {
    ran: boolean;
    success: boolean;
    error?: string;
    competitorCount?: number;
  };
  gapIa: {
    ran: boolean;
    success: boolean;
    error?: string;
  };
  message: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { companyId } = body as { companyId: string };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log('[context/run-baseline] Starting baseline for:', company.name);

    const result: BaselineRunResult = {
      success: false,
      fullGap: { ran: false, success: false },
      competition: { ran: false, success: false },
      gapIa: { ran: false, success: false },
      message: '',
    };

    // Track V4 result if enabled
    let competitionV4Result: CompetitionV4Result | null = null;

    // Run Full GAP and Competition in parallel
    const [fullGapResult, competitionResult] = await Promise.allSettled([
      // Full GAP Orchestrator
      (async () => {
        console.log('[context/run-baseline] Running Full GAP...');
        result.fullGap.ran = true;
        try {
          const output = await runFullGAPOrchestrator({
            companyId,
            gapIaRun: {},
          });
          result.fullGap.success = output.success;
          if (!output.success) {
            result.fullGap.error = output.error;
          }
          return output;
        } catch (error) {
          result.fullGap.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
      })(),

      // Competition V3
      (async () => {
        console.log('[context/run-baseline] Running Competition V3...');
        result.competition.ran = true;
        try {
          const output = await runCompetitionV3({ companyId });
          result.competition.success = output.run.status === 'completed';
          result.competition.competitorCount = output.competitors.length;
          if (output.run.error) {
            result.competition.error = output.run.error;
          }
          return output;
        } catch (error) {
          result.competition.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
      })(),
    ]);

    console.log('[context/run-baseline] Full GAP result:', fullGapResult.status);
    console.log('[context/run-baseline] Competition result:', competitionResult.status);

    // Check if Full GAP failed - fall back to GAP-IA
    if (fullGapResult.status === 'rejected' || !result.fullGap.success) {
      const websiteUrl = company.website || `https://${company.domain}`;

      console.log('[context/run-baseline] Full GAP failed, falling back to GAP-IA for:', websiteUrl);
      result.gapIa.ran = true;

      try {
        const gapIaOutput = await runInitialAssessment({ url: websiteUrl });
        result.gapIa.success = !!gapIaOutput.initialAssessment;
        console.log('[context/run-baseline] GAP-IA completed successfully');
      } catch (error) {
        result.gapIa.error = error instanceof Error ? error.message : String(error);
        console.error('[context/run-baseline] GAP-IA also failed:', error);
      }
    }

    // Run Competition V4 (if enabled via COMPETITION_ENGINE flag)
    if (shouldRunV4()) {
      console.log('[context/run-baseline] Running Competition V4 (Classification Tree)...');
      result.competitionV4 = { ran: true, success: false };

      try {
        competitionV4Result = await runCompetitionV4({
          companyId,
          companyName: company.name ?? undefined,
          domain: company.domain ?? company.website ?? undefined,
        });
        result.competitionV4.success = competitionV4Result.execution.status === 'completed';
        result.competitionV4.competitorCount = competitionV4Result.competitors.validated.length;

        console.log(`[context/run-baseline] Competition V4 completed: ${competitionV4Result.competitors.validated.length} validated, ${competitionV4Result.competitors.removed.length} removed`);
      } catch (error) {
        result.competitionV4.error = error instanceof Error ? error.message : String(error);
        console.error('[context/run-baseline] Competition V4 failed:', error);
      }
    }

    // Determine overall success
    // We consider it a success if we got either Full GAP or GAP-IA data
    const hasGapData = result.fullGap.success || result.gapIa.success;
    const hasCompetitionData = result.competition.success;

    result.success = hasGapData; // At minimum we need GAP data

    // Build summary message
    const parts: string[] = [];
    if (result.fullGap.success) {
      parts.push('Full GAP completed');
    } else if (result.gapIa.success) {
      parts.push('GAP-IA completed (fallback)');
    } else {
      parts.push('GAP analysis failed');
    }

    if (hasCompetitionData) {
      parts.push(`V3: ${result.competition.competitorCount} competitors`);
    } else if (result.competition.ran) {
      parts.push('Competition V3 failed');
    }

    if (result.competitionV4?.ran) {
      if (result.competitionV4.success) {
        parts.push(`V4: ${result.competitionV4.competitorCount} validated`);
      } else {
        parts.push('V4 failed');
      }
    }

    result.message = parts.join('; ');

    const durationMs = Date.now() - startTime;
    console.log('[context/run-baseline] Completed in', durationMs, 'ms:', result.message);

    // Include V4 result if available (non-breaking addition)
    const response: Record<string, unknown> = { ...result, durationMs };
    if (competitionV4Result) {
      response.competitionV4Result = competitionV4Result;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[context/run-baseline] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Baseline run failed' },
      { status: 500 }
    );
  }
}
