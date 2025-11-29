// app/api/os/companies/[companyId]/health-check/route.ts
// Quick Health Check API endpoint
//
// POST /api/os/companies/[companyId]/health-check
// Runs a lightweight health check and returns consolidated status

import { NextRequest, NextResponse } from 'next/server';
import {
  runQuickHealthCheckForCompany,
  type QuickHealthCheckOptions,
} from '@/lib/os/companies/healthCheck';

export const maxDuration = 120; // Allow up to 2 minutes for GAP Snapshot

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Health check request for company:', companyId);

    // Parse optional options from body
    let options: QuickHealthCheckOptions = {};
    try {
      const body = await request.json();
      if (body.reuseRecentGapSnapshot !== undefined) {
        options.reuseRecentGapSnapshot = body.reuseRecentGapSnapshot;
      }
      if (body.gapSnapshotMaxAgeHours !== undefined) {
        options.gapSnapshotMaxAgeHours = body.gapSnapshotMaxAgeHours;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Run the health check
    const result = await runQuickHealthCheckForCompany(companyId, options);

    console.log('[API] Health check complete:', {
      companyId,
      status: result.status,
      score: result.overallScore,
      alerts: result.alertsCount,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error('[API] Health check error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
