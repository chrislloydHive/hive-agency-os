// app/api/os/companies/[companyId]/snapshot/refresh/route.ts
// API endpoint to refresh a company's strategic snapshot

import { NextRequest, NextResponse } from 'next/server';
import { refreshCompanyStrategicSnapshot } from '@/lib/os/companies/strategySnapshot';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  console.log('[API] Refreshing strategic snapshot for:', companyId);

  try {
    const snapshot = await refreshCompanyStrategicSnapshot(companyId);

    return NextResponse.json({
      ok: true,
      snapshot: {
        companyId: snapshot.companyId,
        overallScore: snapshot.overallScore,
        maturityStage: snapshot.maturityStage,
        focusAreasCount: snapshot.focusAreas.length,
        updatedAt: snapshot.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API] Snapshot refresh failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Snapshot refresh failed' },
      { status: 500 }
    );
  }
}
