// app/api/media/scenarios/[companyId]/[scenarioId]/forecast/route.ts
// API route to run forecast for a scenario
//
// POST /api/media/scenarios/[companyId]/[scenarioId]/forecast - Run forecast

import { NextRequest, NextResponse } from 'next/server';
import { getMediaScenarioById, updateMediaScenario } from '@/lib/media/scenarios';
import { forecastMediaPlan } from '@/lib/media/forecastEngine';
import { getMediaAssumptionsWithDefaults } from '@/lib/airtable/mediaAssumptions';
import { getMediaStoresByCompany } from '@/lib/airtable/mediaStores';
import type { MediaBudgetInput, MediaChannel, SeasonKey } from '@/lib/media/types';
import type { MediaScenarioForecastSummary } from '@/lib/media/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; scenarioId: string }> }
) {
  const { companyId, scenarioId } = await params;

  if (!companyId || !scenarioId) {
    return NextResponse.json({ error: 'Company ID and Scenario ID required' }, { status: 400 });
  }

  try {
    // Get scenario
    const scenario = await getMediaScenarioById(companyId, scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Get assumptions (use company-specific or defaults)
    const assumptions = await getMediaAssumptionsWithDefaults(companyId);

    // Get stores for the company
    const storesRaw = await getMediaStoresByCompany(companyId);
    const stores = storesRaw.map(s => ({
      id: s.id,
      name: s.name,
      market: s.marketName || 'Unknown',
      marketType: 'suburban' as const,
      isActive: true,
    }));

    // Convert scenario allocations to channel splits
    const totalSpend = scenario.allocations.reduce((sum, a) => sum + a.plannedSpend, 0);
    const channelSplits: Record<MediaChannel, number> = {
      search: 0,
      social: 0,
      lsa: 0,
      display: 0,
      maps: 0,
      youtube: 0,
      microsoft_search: 0,
      tiktok: 0,
      email: 0,
      affiliate: 0,
      radio: 0,
      tv: 0,
      streaming_audio: 0,
      out_of_home: 0,
      print: 0,
      direct_mail: 0,
    };

    // Populate channel splits from allocations
    for (const allocation of scenario.allocations) {
      if (totalSpend > 0) {
        channelSplits[allocation.channel] = allocation.plannedSpend / totalSpend;
      }
    }

    // Build budget input
    const budget: MediaBudgetInput = {
      totalMonthlyBudget: scenario.totalBudget,
      season: 'baseline' as SeasonKey,
      channelSplits,
    };

    // Run forecast
    const forecast = forecastMediaPlan({
      assumptions,
      budget,
      stores,
    });

    // Build forecast summary to cache
    const forecastSummary: MediaScenarioForecastSummary = {
      expectedInstalls: forecast.summary.totalInstalls,
      expectedLeads: forecast.summary.totalLeads,
      expectedCalls: forecast.summary.totalCalls,
      expectedCPA: forecast.summary.blendedCPI ?? undefined,
      expectedCPL: forecast.summary.blendedCPL ?? undefined,
      expectedImpressions: forecast.summary.totalImpressions,
      expectedClicks: forecast.summary.totalClicks,
      generatedAt: new Date().toISOString(),
    };

    // Save forecast summary to scenario
    await updateMediaScenario(companyId, scenarioId, { forecastSummary });

    return NextResponse.json({
      forecast,
      summary: forecastSummary,
    });
  } catch (error) {
    console.error('Error running forecast:', error);
    return NextResponse.json(
      { error: 'Failed to run forecast' },
      { status: 500 }
    );
  }
}
