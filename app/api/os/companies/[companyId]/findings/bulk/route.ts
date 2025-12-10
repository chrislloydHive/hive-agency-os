// app/api/os/companies/[companyId]/findings/bulk/route.ts
// Bulk create findings from diagnostic issues
//
// Used by DiagnosticIssuesPanel "Add to Plan" action

import { NextResponse } from 'next/server';
import {
  saveDiagnosticFindings,
  type CreateDiagnosticFindingInput,
} from '@/lib/airtable/diagnosticDetails';

interface FindingInput {
  title: string;
  description?: string;
  severity: string;
  domain?: string;
  sourceLabSlug?: string;
  sourceRunId?: string;
  recommendedAction?: string;
}

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;

  try {
    const body = await request.json();
    const { findings } = body as { findings: FindingInput[] };

    if (!findings || !Array.isArray(findings) || findings.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'findings array is required' },
        { status: 400 }
      );
    }

    console.log('[FindingsBulk] Creating', findings.length, 'findings for company:', companyId);

    // Map to CreateDiagnosticFindingInput format
    const findingsToCreate: CreateDiagnosticFindingInput[] = findings.map(f => ({
      companyId,
      labRunId: f.sourceRunId || '',
      labSlug: f.sourceLabSlug,
      category: f.domain,
      severity: f.severity as 'low' | 'medium' | 'high' | 'critical',
      description: f.title,
      recommendation: f.recommendedAction || f.description,
      isConvertedToWorkItem: false,
    }));

    const createdIds = await saveDiagnosticFindings(findingsToCreate);

    console.log('[FindingsBulk] Created', createdIds.length, 'findings');

    return NextResponse.json({
      ok: true,
      created: createdIds.length,
      ids: createdIds,
    });
  } catch (error) {
    console.error('[FindingsBulk] Error creating findings:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create findings' },
      { status: 500 }
    );
  }
}
