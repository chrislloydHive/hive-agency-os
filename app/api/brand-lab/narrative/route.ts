// app/api/brand-lab/narrative/route.ts
// API endpoint for generating Brand Lab narrative reports

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestRunForCompanyAndTool, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { generateBrandNarrativeReport } from '@/lib/gap-heavy/modules/brand-narrative-engine';
import type { BrandDiagnosticResult, BrandActionPlan, BrandNarrativeReport } from '@/lib/gap-heavy/modules/brandLab';

export const maxDuration = 120; // 2 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, runId, diagnostic, actionPlan, forceRegenerate } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    console.log('[API] Generating Brand Lab narrative for:', company.name);

    // Get the latest Brand Lab run if no diagnostic/actionPlan provided
    let brandDiagnostic: BrandDiagnosticResult | undefined = diagnostic;
    let brandActionPlan: BrandActionPlan | undefined = actionPlan;
    let targetRunId = runId;

    if (!brandDiagnostic || !brandActionPlan) {
      // Fetch from the latest Brand Lab run
      const latestRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');

      if (!latestRun) {
        return NextResponse.json(
          { error: 'No Brand Lab run found for this company' },
          { status: 404 }
        );
      }

      targetRunId = latestRun.id;

      // Check if narrative already exists and we're not forcing regeneration
      const rawData = latestRun.rawJson as any;
      if (rawData?.narrativeReport && !forceRegenerate) {
        console.log('[API] Returning existing narrative report');
        return NextResponse.json({
          narrative: rawData.narrativeReport,
          cached: true,
        });
      }

      // Extract diagnostic and action plan from run data
      brandDiagnostic = rawData?.diagnostic;
      brandActionPlan = rawData?.actionPlan;

      if (!brandDiagnostic || !brandActionPlan) {
        return NextResponse.json(
          { error: 'Please run the Brand Lab diagnostic first. The narrative report requires completed Brand Lab results.' },
          { status: 400 }
        );
      }
    }

    // Generate the narrative report
    const narrative = await generateBrandNarrativeReport({
      companyName: company.name,
      websiteUrl: company.website || '',
      diagnostic: brandDiagnostic,
      actionPlan: brandActionPlan,
    });

    // Store the narrative back to the run record
    if (targetRunId) {
      try {
        const latestRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');
        if (latestRun && latestRun.id === targetRunId) {
          const rawData = latestRun.rawJson as any;
          await updateDiagnosticRun(targetRunId, {
            rawJson: {
              ...rawData,
              narrativeReport: narrative,
            },
          });
          console.log('[API] Narrative stored to Brand Lab run:', targetRunId);
        }
      } catch (error) {
        console.error('[API] Failed to store narrative to run:', error);
        // Don't fail the request, just log the error
      }
    }

    console.log('[API] Brand Lab narrative generated successfully');

    return NextResponse.json({
      narrative,
      cached: false,
    });

  } catch (error) {
    console.error('[API] Brand Lab narrative error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'Missing companyId' },
      { status: 400 }
    );
  }

  try {
    // Get the latest Brand Lab run
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');

    if (!latestRun) {
      return NextResponse.json(
        { error: 'No Brand Lab run found for this company' },
        { status: 404 }
      );
    }

    const rawData = latestRun.rawJson as any;
    const narrative = rawData?.narrativeReport as BrandNarrativeReport | undefined;

    if (!narrative) {
      return NextResponse.json({
        hasNarrative: false,
        narrative: null,
      });
    }

    return NextResponse.json({
      hasNarrative: true,
      narrative,
    });

  } catch (error) {
    console.error('[API] Brand Lab narrative GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
