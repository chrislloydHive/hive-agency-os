// app/api/context/heal/route.ts
// AI Auto-Healing API
//
// GET /api/context/heal?companyId=xxx - Check if healing needed
// POST /api/context/heal - Generate healing report with fixes

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import {
  generateHealingReport,
  needsHealing,
  getRecommendedDiagnostics,
} from '@/lib/contextGraph/inference/aiHeal';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const maxDuration = 60;

// GET - Quick check if healing is needed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // Quick check
    const healthCheck = await needsHealing(companyId, graph);
    const diagnostics = getRecommendedDiagnostics(graph);

    return NextResponse.json({
      ok: true,
      companyId,
      ...healthCheck,
      recommendedDiagnostics: diagnostics,
    });
  } catch (error) {
    console.error('[API] Heal check error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Generate full healing report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, options } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    console.log('[API] Generating healing report for company:', companyId);

    const report = await generateHealingReport(companyId, graph, {
      includeMissing: options?.includeMissing ?? true,
      includeStale: options?.includeStale ?? true,
      includeContradictions: options?.includeContradictions ?? true,
      targetDomains: options?.targetDomains as DomainName[] | undefined,
      maxFixes: options?.maxFixes ?? 20,
    });

    const diagnostics = getRecommendedDiagnostics(graph);

    console.log('[API] Healing report generated:', {
      companyId,
      fixCount: report.fixes.length,
      analyzedIssues: report.analyzedIssues,
      canAutoHeal: report.canAutoHeal,
    });

    return NextResponse.json({
      ok: true,
      companyId,
      ...report,
      recommendedDiagnostics: diagnostics,
    });
  } catch (error) {
    console.error('[API] Heal report error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
