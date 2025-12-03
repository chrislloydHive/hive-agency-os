// lib/airtable/mediaOverview.ts
// Airtable helper for Media overview aggregations
//
// Provides summary views across media entities

import { getMediaProgramsByCompany, getAllMediaPrograms } from './mediaPrograms';
import { getMediaCampaignsByCompany, getAllMediaCampaigns } from './mediaCampaigns';
import { getMediaMarketsByCompany, getAllMediaMarkets } from './mediaMarkets';
import { getMediaStoresByCompany, getAllMediaStores } from './mediaStores';
import { getLast30DayMetrics } from './mediaPerformance';
import type {
  MediaOverview,
  GlobalMediaSummary,
  MediaProgramSummary,
  MediaChannel,
} from '@/lib/types/media';

// ============================================================================
// Company-level Overview
// ============================================================================

/**
 * Get complete media overview for a company
 */
export async function getMediaOverviewForCompany(companyId: string): Promise<MediaOverview> {
  // Fetch all entity types in parallel
  const [programs, campaigns, markets, stores, last30Days] = await Promise.all([
    getMediaProgramsByCompany(companyId),
    getMediaCampaignsByCompany(companyId),
    getMediaMarketsByCompany(companyId),
    getMediaStoresByCompany(companyId),
    getLast30DayMetrics(companyId),
  ]);

  // Count active campaigns
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active');

  // Build channel breakdown
  const channelBreakdown: Record<MediaChannel, number> = {
    Search: 0,
    Maps: 0,
    LSAs: 0,
    Social: 0,
    Display: 0,
    Radio: 0,
    Other: 0,
  };

  for (const campaign of activeCampaigns) {
    channelBreakdown[campaign.channel] = (channelBreakdown[campaign.channel] || 0) + 1;
  }

  // Calculate total monthly budget from active programs
  const totalMonthlyBudget = programs
    .filter((p) => p.status === 'Active')
    .reduce((sum, p) => sum + (p.monthlyBudget || 0), 0);

  return {
    companyId,
    programCount: programs.length,
    activeCampaignCount: activeCampaigns.length,
    marketCount: markets.length,
    storeCount: stores.length,
    channelBreakdown,
    totalMonthlyBudget,
    last30DaySpend: last30Days.spend,
    last30DayCalls: last30Days.calls,
    last30DayInstalls: last30Days.installs,
  };
}

/**
 * Get program summaries for a company
 */
export async function getProgramSummariesForCompany(
  companyId: string
): Promise<MediaProgramSummary[]> {
  const [programs, campaigns, markets, stores] = await Promise.all([
    getMediaProgramsByCompany(companyId),
    getMediaCampaignsByCompany(companyId),
    getMediaMarketsByCompany(companyId),
    getMediaStoresByCompany(companyId),
  ]);

  return programs.map((program) => {
    // Find campaigns linked to this program
    const programCampaigns = campaigns.filter((c) => c.programId === program.id);

    // Find markets linked to this program
    const programMarkets = markets.filter((m) => program.marketIds.includes(m.id));

    // Find stores in those markets
    const marketIds = new Set(programMarkets.map((m) => m.id));
    const programStores = stores.filter((s) => s.marketId && marketIds.has(s.marketId));

    // Calculate total monthly budget from campaigns
    const totalMonthlyBudget = programCampaigns.reduce(
      (sum, c) => sum + (c.monthlyBudget || 0),
      program.monthlyBudget || 0
    );

    return {
      program,
      campaignCount: programCampaigns.length,
      marketCount: programMarkets.length,
      storeCount: programStores.length,
      totalMonthlyBudget,
      // Performance metrics would be populated from MediaPerformance
      last30DaySpend: undefined,
      last30DayCalls: undefined,
      last30DayInstalls: undefined,
      last30DayLeads: undefined,
    };
  });
}

// ============================================================================
// Global Overview
// ============================================================================

/**
 * Get global media summary across all companies
 */
export async function getGlobalMediaSummary(): Promise<GlobalMediaSummary> {
  const [programs, campaigns, markets, stores] = await Promise.all([
    getAllMediaPrograms(),
    getAllMediaCampaigns(),
    getAllMediaMarkets(),
    getAllMediaStores(),
  ]);

  // Count active campaigns
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active');

  // Build channel breakdown
  const channelBreakdown: Record<MediaChannel, number> = {
    Search: 0,
    Maps: 0,
    LSAs: 0,
    Social: 0,
    Display: 0,
    Radio: 0,
    Other: 0,
  };

  for (const campaign of activeCampaigns) {
    channelBreakdown[campaign.channel] = (channelBreakdown[campaign.channel] || 0) + 1;
  }

  // Build company breakdown
  const companyMap = new Map<string, { name: string; programs: number; activeCampaigns: number }>();

  for (const program of programs) {
    const existing = companyMap.get(program.companyId) || {
      name: program.companyName || 'Unknown',
      programs: 0,
      activeCampaigns: 0,
    };
    existing.programs++;
    companyMap.set(program.companyId, existing);
  }

  for (const campaign of activeCampaigns) {
    const existing = companyMap.get(campaign.companyId);
    if (existing) {
      existing.activeCampaigns++;
    }
  }

  const companyBreakdown = Array.from(companyMap.entries()).map(([companyId, data]) => ({
    companyId,
    companyName: data.name,
    programCount: data.programs,
    activeCampaignCount: data.activeCampaigns,
  }));

  return {
    totalPrograms: programs.length,
    totalActiveCampaigns: activeCampaigns.length,
    totalMarkets: markets.length,
    totalStores: stores.length,
    channelBreakdown,
    companyBreakdown,
  };
}
