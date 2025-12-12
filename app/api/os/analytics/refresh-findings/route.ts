// app/api/os/analytics/refresh-findings/route.ts
// API route to refresh analytics-derived findings for a company
//
// POST: Generate AI findings from analytics data and write to Brain

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyAnalyticsSnapshot } from '@/lib/os/companies/companyAnalytics';
import { getCompanyStatusSummary } from '@/lib/os/companies/companyStatus';
import { generateAnalyticsFindings } from '@/lib/os/contextAi/generateAnalyticsFindings';
import { writeAnalyticsFindingsToBrain } from '@/lib/os/contextAi/writeAnalyticsFindingsToBrain';

export const dynamic = 'force-dynamic';

interface RequestBody {
  companyId?: string;
}

/**
 * POST /api/os/analytics/refresh-findings
 *
 * Generates analytics-derived findings using AI and writes them to Brain.
 *
 * Request body:
 * - companyId: string (required)
 *
 * Returns:
 * - ok: boolean
 * - findingsCreated: number
 * - message: string
 */
export async function POST(request: NextRequest) {
  console.log('[RefreshAnalyticsFindings] Received request');

  try {
    // Parse request body
    let body: RequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty or invalid JSON body
    }

    const companyId = body?.companyId;

    // Validate input
    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { ok: false, findingsCreated: 0, message: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log('[RefreshAnalyticsFindings] Processing company:', companyId);

    // Load analytics and status in parallel
    const [analytics, status] = await Promise.all([
      getCompanyAnalyticsSnapshot({ companyId, range: '28d' }),
      getCompanyStatusSummary({ companyId }),
    ]);

    // Check if company has analytics configured
    if (!analytics.hasAnalytics) {
      console.log('[RefreshAnalyticsFindings] No analytics for company:', companyId);
      return NextResponse.json({
        ok: false,
        findingsCreated: 0,
        message: 'No analytics configured for this company. Connect GA4 or Search Console first.',
      });
    }

    // Generate AI findings from analytics
    console.log('[RefreshAnalyticsFindings] Generating AI findings...');
    const aiFindings = await generateAnalyticsFindings({ analytics, status });

    if (!aiFindings.length) {
      console.log('[RefreshAnalyticsFindings] No significant findings generated');
      return NextResponse.json({
        ok: true,
        findingsCreated: 0,
        message: 'No significant analytics findings detected. Performance looks stable.',
      });
    }

    // Write findings to Brain
    console.log('[RefreshAnalyticsFindings] Writing', aiFindings.length, 'findings to Brain...');
    const writeResult = await writeAnalyticsFindingsToBrain({
      companyId,
      findings: aiFindings,
      replaceExisting: true, // Replace old analytics findings to avoid duplicates
    });

    if (!writeResult.success) {
      console.error('[RefreshAnalyticsFindings] Failed to write findings:', writeResult.error);
      return NextResponse.json(
        {
          ok: false,
          findingsCreated: 0,
          message: writeResult.error || 'Failed to write findings to Brain.',
        },
        { status: 500 }
      );
    }

    console.log('[RefreshAnalyticsFindings] Success:', {
      companyId,
      created: writeResult.createdCount,
      deleted: writeResult.deletedCount,
    });

    return NextResponse.json({
      ok: true,
      findingsCreated: writeResult.createdCount,
      message: `Generated ${writeResult.createdCount} analytics finding${writeResult.createdCount !== 1 ? 's' : ''}.`,
    });
  } catch (error) {
    console.error('[RefreshAnalyticsFindings] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        findingsCreated: 0,
        message: error instanceof Error ? error.message : 'Unexpected error refreshing analytics findings.',
      },
      { status: 500 }
    );
  }
}
