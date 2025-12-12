// app/api/os/companies/[companyId]/labs/audience/route.ts
// Audience Lab API Endpoint
//
// POST - Run Audience Lab
// GET - Get lab status (available inputs)

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import {
  runAudienceLab,
  buildAudienceLabInput,
  type AudienceLabInput,
} from '@/lib/os/labs/audience';

// ============================================================================
// POST - Run Audience Lab
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Labs must be explicitly enabled
  if (!FEATURE_FLAGS.LABS_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    console.log(`[AudienceLabAPI] Running for ${companyId}`);

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Gather inputs in parallel
    const [context, competitionRun] = await Promise.all([
      getCompanyContext(companyId),
      getLatestCompetitionRunV3(companyId).catch(() => null),
    ]);

    // Build input from gathered data
    const input: AudienceLabInput = buildAudienceLabInput({
      companyId,
      companyName: company.name || 'Unknown Company',
      domain: company.domain || company.website || undefined,

      // Context
      context: context ? {
        businessModel: context.businessModel || undefined,
        valueProposition: context.valueProposition || undefined,
        primaryAudience: context.primaryAudience || undefined,
        secondaryAudience: context.secondaryAudience || undefined,
        icpDescription: context.icpDescription || undefined,
        differentiators: context.differentiators || undefined,
      } : undefined,

      // Competition (V3 format, extracting category info)
      competition: competitionRun ? {
        categoryName: competitionRun.insights?.[0]?.title || undefined,
        categoryDescription: competitionRun.insights?.[0]?.description || undefined,
        positioning: competitionRun.insights?.find(i => i.category === 'opportunity')?.description || undefined,
        competitors: competitionRun.competitors?.slice(0, 5).map(c => ({
          name: c.name,
          type: c.classification?.type || undefined,
        })),
      } : undefined,
    });

    // Run the lab
    const result = await runAudienceLab(input);

    return NextResponse.json({
      status: 'ok',
      ...result,
    });

  } catch (error) {
    console.error('[AudienceLabAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Lab Status/Available Inputs
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Labs must be explicitly enabled
  if (!FEATURE_FLAGS.LABS_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    // Check what inputs are available
    const [context, competitionRun] = await Promise.all([
      getCompanyContext(companyId),
      getLatestCompetitionRunV3(companyId).catch(() => null),
    ]);

    const hasContext = !!(context && (context.businessModel || context.valueProposition || context.primaryAudience));
    const hasCompetition = !!(competitionRun?.competitors?.length);

    return NextResponse.json({
      status: 'ok',
      ready: hasContext, // Only context is required
      inputs: {
        hasContext,
        hasCompetition,
      },
      // TODO: Add lastRun info if we persist runs
      lastRun: null,
    });

  } catch (error) {
    console.error('[AudienceLabAPI] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
