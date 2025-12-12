// app/api/os/media/qbr/route.ts
// API route to generate a Media QBR presentation
//
// POST: Generate a QBR from media/analytics data using AI

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getCompanyAnalyticsSnapshot } from '@/lib/os/companies/companyAnalytics';
import { getCompanyMediaProgramSummary } from '@/lib/os/analytics/getCompanyMediaProgramSummary';
import { getCompanyMediaCampaigns } from '@/lib/os/analytics/getCompanyMediaCampaigns';
import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import { generateCompanyStatusNarrative } from '@/lib/os/contextAi/generateCompanyStatusNarrative';
import { getCompanyStatusSummary } from '@/lib/os/companies/companyStatus';
import { generateMediaQbr } from '@/lib/os/mediaAi/generateMediaQbr';
import type { MediaQbrInput } from '@/lib/types/mediaQbr';

export const dynamic = 'force-dynamic';

interface RequestBody {
  companyId?: string;
  range?: '28d' | '90d';
}

/**
 * POST /api/os/media/qbr
 *
 * Generates a Media QBR presentation using AI.
 *
 * Request body:
 * - companyId: string (required)
 * - range: '28d' | '90d' (optional, default '28d')
 *
 * Returns:
 * - ok: boolean
 * - qbr: MediaQbrOutput (if successful)
 * - message: string (if error)
 */
export async function POST(request: NextRequest) {
  console.log('[MediaQBR] Received request');

  try {
    // Parse request body
    let body: RequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty or invalid JSON body
    }

    const companyId = body?.companyId;
    const range = body?.range || '28d';

    // Validate input
    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { ok: false, message: 'companyId is required' },
        { status: 400 }
      );
    }

    if (range !== '28d' && range !== '90d') {
      return NextResponse.json(
        { ok: false, message: 'range must be "28d" or "90d"' },
        { status: 400 }
      );
    }

    console.log('[MediaQBR] Processing company:', companyId, 'range:', range);

    // Fetch company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, message: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if company has media program
    if (!companyHasMediaProgram(company)) {
      return NextResponse.json({
        ok: false,
        message: 'This company does not have an active media program.',
      });
    }

    // Load all required data in parallel
    console.log('[MediaQBR] Loading data for QBR generation...');
    const [analytics, mediaSummary, campaigns, findings, statusSummary] = await Promise.all([
      getCompanyAnalyticsSnapshot({ companyId, range }),
      getCompanyMediaProgramSummary({ companyId }),
      getCompanyMediaCampaigns({ companyId, status: 'all' }),
      getCompanyFindings(companyId, { labs: ['analytics', 'media', 'demand'] }),
      getCompanyStatusSummary({ companyId }).catch(() => null),
    ]);

    // Optionally generate narrative for additional context
    let narrative = undefined;
    if (statusSummary && analytics.hasAnalytics) {
      try {
        narrative = await generateCompanyStatusNarrative({
          companyId,
          companyName: company.name,
          status: statusSummary,
          analytics,
        });
      } catch (error) {
        console.warn('[MediaQBR] Failed to generate narrative (continuing without):', error);
      }
    }

    // Build QBR input
    const qbrInput: MediaQbrInput = {
      companyId,
      companyName: company.name,
      range,
      analytics,
      mediaSummary,
      campaigns,
      findings,
      narrative,
    };

    // Generate QBR
    console.log('[MediaQBR] Generating QBR...');
    const qbr = await generateMediaQbr(qbrInput);

    console.log('[MediaQBR] QBR generated successfully:', {
      companyId,
      executiveSummaryLength: qbr.executiveSummary.length,
      markdownLength: qbr.slideMarkdown.length,
      modelUsed: qbr.modelUsed,
    });

    return NextResponse.json({
      ok: true,
      qbr,
    });
  } catch (error) {
    console.error('[MediaQBR] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Unexpected error generating QBR.',
      },
      { status: 500 }
    );
  }
}
