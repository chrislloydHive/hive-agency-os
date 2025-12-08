// app/api/os/companies/[companyId]/gap/latest/route.ts
// API endpoint to get the latest GAP-IA run for a company

import { NextRequest, NextResponse } from 'next/server';
import { listDiagnosticRunsForCompany, type DiagnosticRun } from '@/lib/os/diagnostics/runs';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log('[gap/latest] Fetching latest GAP run for company:', companyId);

    // Fetch recent GAP runs - always use 'gapSnapshot' as the canonical diagnostic type
    // The UI may display this as "GAP IA" but the underlying type is always 'gapSnapshot'
    const runs = await listDiagnosticRunsForCompany(companyId, {
      toolId: 'gapSnapshot',
      limit: 1,
      status: 'complete',
    });

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'No GAP runs found for this company', hasRun: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      run: sanitizeRun(runs[0]),
      hasRun: true,
    });
  } catch (error) {
    console.error('[gap/latest] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest GAP run' },
      { status: 500 }
    );
  }
}

/**
 * Sanitize run for client response
 */
function sanitizeRun(run: DiagnosticRun) {
  return {
    id: run.id,
    toolId: run.toolId,
    status: run.status,
    score: run.score,
    summary: run.summary,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    // Include structured data for UI display
    data: run.rawJson ? extractDisplayData(run.rawJson) : null,
  };
}

/**
 * Extract key display data from raw JSON
 */
function extractDisplayData(rawJson: unknown): Record<string, unknown> | null {
  if (!rawJson || typeof rawJson !== 'object') return null;

  const raw = rawJson as Record<string, unknown>;
  const ia = raw.initialAssessment as Record<string, unknown> | undefined;

  if (!ia) return null;

  // Extract V2 format data
  const summary = ia.summary as Record<string, unknown> | undefined;
  const dimensions = ia.dimensions as Record<string, unknown> | undefined;
  const quickWins = ia.quickWins as { bullets?: unknown[] } | undefined;
  const breakdown = ia.breakdown as Record<string, unknown> | undefined;

  // Legacy V2 fields
  const core = ia.core as Record<string, unknown> | undefined;

  return {
    overallScore: summary?.overallScore ?? core?.overallScore,
    maturityStage: summary?.maturityStage ?? core?.marketingMaturity,
    topOpportunities: summary?.topOpportunities ?? core?.topOpportunities,
    dimensions: dimensions ? Object.keys(dimensions).map((key) => {
      const dim = (dimensions as Record<string, { score?: number; oneLiner?: string }>)[key];
      return {
        name: key,
        score: dim?.score,
        summary: dim?.oneLiner,
      };
    }) : [],
    quickWins: quickWins?.bullets?.map((qw: unknown) => {
      if (typeof qw === 'string') return qw;
      if (qw && typeof qw === 'object' && 'action' in qw) {
        return (qw as { action: string }).action;
      }
      return null;
    }).filter(Boolean) ?? [],
    strengths: breakdown?.strengths ?? [],
    gaps: breakdown?.gaps ?? [],
  };
}
