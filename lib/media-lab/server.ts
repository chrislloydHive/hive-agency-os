// lib/media-lab/server.ts
// Server-side functions for Media Lab V1

import {
  getMediaPlansForCompany,
  getChannelsForMediaPlan,
  getFlightsForMediaPlan,
  getCompanyMediaFields,
} from '@/lib/airtable/mediaLab';
import type {
  MediaLabData,
  MediaLabSummary,
  MediaPlan,
} from '@/lib/media-lab/types';

/**
 * Get complete Media Lab data for a company
 *
 * Fetches:
 * - Media program status from Company record
 * - All media plans
 * - Channels and flights for each plan
 *
 * @param companyId - Airtable Company record ID
 * @returns Complete media lab data including summary and plans
 */
export async function getMediaLabForCompany(companyId: string): Promise<MediaLabData> {
  try {
    console.log('[getMediaLabForCompany] Fetching media lab data for company:', companyId);

    // Fetch company media fields and all plans in parallel
    const [companyFields, plans] = await Promise.all([
      getCompanyMediaFields(companyId),
      getMediaPlansForCompany(companyId),
    ]);

    // Fetch channels and flights for each plan
    const plansWithDetails = await Promise.all(
      plans.map(async (plan) => {
        const [channels, flights] = await Promise.all([
          getChannelsForMediaPlan(plan.id),
          getFlightsForMediaPlan(plan.id),
        ]);

        return {
          plan,
          channels,
          flights,
        };
      })
    );

    // Calculate summary metrics
    const activePlans = plans.filter(
      (p) => p.status === 'active'
    );

    const totalActiveBudget = activePlans.reduce(
      (sum, plan) => sum + (plan.totalBudget || 0),
      0
    );

    // Get primary markets from active plans (prefer active plans, fall back to any plan)
    const primaryMarkets =
      activePlans.find((p) => p.primaryMarkets)?.primaryMarkets ||
      plans.find((p) => p.primaryMarkets)?.primaryMarkets ||
      null;

    const summary: MediaLabSummary = {
      hasMediaProgram: companyFields.hasMediaProgram || plans.length > 0,
      mediaStatus: companyFields.mediaStatus,
      primaryObjective: companyFields.mediaPrimaryObjective,
      primaryMarkets,
      totalActiveBudget: totalActiveBudget > 0 ? totalActiveBudget : null,
      activePlanCount: activePlans.length,
    };

    console.log('[getMediaLabForCompany] Summary:', {
      planCount: plans.length,
      activePlanCount: activePlans.length,
      totalActiveBudget,
    });

    return {
      summary,
      plans: plansWithDetails,
    };
  } catch (error) {
    console.error('[getMediaLabForCompany] Error:', error);

    // Return empty state on error
    return {
      summary: {
        hasMediaProgram: false,
        mediaStatus: 'none',
        primaryObjective: null,
        primaryMarkets: null,
        totalActiveBudget: null,
        activePlanCount: 0,
      },
      plans: [],
    };
  }
}

/**
 * Get just the summary for a company (lighter weight for dashboard/blueprint)
 */
export async function getMediaLabSummary(companyId: string): Promise<MediaLabSummary> {
  const data = await getMediaLabForCompany(companyId);
  return data.summary;
}
