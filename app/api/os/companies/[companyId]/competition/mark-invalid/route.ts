// app/api/os/companies/[companyId]/competition/mark-invalid/route.ts
// Mark a competitor domain as invalid (negative memory) for the company.

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { setFieldUntypedWithResult, createProvenance } from '@/lib/contextGraph/mutate';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));
    const domain: string | undefined = body?.domain;

    if (!companyId || !domain) {
      return NextResponse.json({ error: 'companyId and domain are required' }, { status: 400 });
    }

    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json({ error: 'Context graph not found' }, { status: 404 });
    }

    const current: string[] = Array.isArray(graph.competitive.invalidCompetitors?.value)
      ? graph.competitive.invalidCompetitors.value
      : [];

    const normalized = domain.toLowerCase();
    const next = Array.from(new Set([...current.map(d => d.toLowerCase()), normalized]));

    const provenance = createProvenance('competitor_lab', { confidence: 0.9, notes: 'User marked invalid competitor' });
    const { graph: updated } = setFieldUntypedWithResult(
      graph,
      'competitive',
      'invalidCompetitors',
      next,
      provenance,
      { force: true }
    );

    await saveContextGraph(updated, 'competitor_lab');

    return NextResponse.json({ success: true, invalidCompetitors: next });
  } catch (error) {
    console.error('[competition/mark-invalid] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
