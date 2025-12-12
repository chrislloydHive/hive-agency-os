// lib/os/analytics/getCompanyMediaProgramSummary.ts
// Media Program Summary helper for the unified Analytics layer
//
// This module provides a high-level summary of a company's media program
// for use in Company Overview, QBR reports, and other places that need
// a quick snapshot without loading all campaign details.

import type {
  CompanyMediaProgramSummary,
  MediaProgramHealth,
} from '@/lib/types/mediaAnalytics';
import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getMediaOverviewForCompany } from '@/lib/airtable/mediaOverview';
import { getMediaKpiSummary } from '@/lib/media/analytics';

// ============================================================================
// Types
// ============================================================================

export interface GetCompanyMediaProgramSummaryParams {
  companyId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute program health based on KPIs and thresholds
 */
function computeProgramHealth(params: {
  spend?: number;
  cpl?: number;
  calls?: number;
  leads?: number;
}): { health: MediaProgramHealth; message: string } {
  const { spend, cpl, calls, leads } = params;

  // If no spend, program might not be active
  if (!spend || spend === 0) {
    return {
      health: 'neutral',
      message: 'No recent media spend detected.',
    };
  }

  // Calculate simple health heuristics
  const totalConversions = (calls || 0) + (leads || 0);

  // If spending but no conversions, that's concerning
  if (totalConversions === 0) {
    return {
      health: 'at_risk',
      message: 'Media spend detected but no conversions yet.',
    };
  }

  // If CPL is very high (>$200), might need attention
  if (cpl && cpl > 200) {
    return {
      health: 'at_risk',
      message: `Cost per lead is high at $${Math.round(cpl)}.`,
    };
  }

  // If CPL is moderate ($100-$200), neutral
  if (cpl && cpl > 100) {
    return {
      health: 'neutral',
      message: 'Performance is stable with room for optimization.',
    };
  }

  // Otherwise, assume things are going well
  return {
    health: 'good',
    message: 'Media program is performing well.',
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get Company Media Program Summary
 *
 * Provides a high-level summary of a company's media program including:
 * - Whether they have an active media program
 * - Primary KPIs (spend, CPL, calls, leads)
 * - Program health assessment
 * - Human-readable status message
 *
 * This function never throws - it always returns a valid summary with
 * hasMediaProgram = false if no program exists.
 *
 * @param params - companyId
 * @returns CompanyMediaProgramSummary
 */
export async function getCompanyMediaProgramSummary(
  params: GetCompanyMediaProgramSummaryParams
): Promise<CompanyMediaProgramSummary> {
  const { companyId } = params;
  const now = new Date().toISOString();

  // Initialize with defaults for companies without media programs
  const summary: CompanyMediaProgramSummary = {
    companyId,
    hasMediaProgram: false,
    programStatusMessage: 'No active media program on file.',
    updatedAt: now,
  };

  try {
    // Check if company has a media program
    const company = await getCompanyById(companyId);
    if (!company || !companyHasMediaProgram(company)) {
      return summary;
    }

    // Company has a media program - fetch overview and KPIs
    const [overview, kpiSummary] = await Promise.all([
      getMediaOverviewForCompany(companyId).catch(() => null),
      getMediaKpiSummary(companyId).catch(() => null),
    ]);

    // Update summary with program info
    summary.hasMediaProgram = true;

    if (overview) {
      summary.activeCampaignCount = overview.activeCampaignCount || 0;
      summary.marketCount = overview.marketCount || 0;
      summary.storeCount = overview.storeCount || 0;
      summary.totalMonthlyBudget = overview.totalMonthlyBudget || 0;
    }

    if (kpiSummary) {
      summary.primaryKpis = {
        mediaSpend: kpiSummary.totalSpend,
        cpl: kpiSummary.avgCpl,
        calls: kpiSummary.totalCalls,
        installsOrLeads: kpiSummary.totalLsaLeads + kpiSummary.totalInstalls,
        impressions: kpiSummary.totalImpressions,
      };

      // Compute program health
      const { health, message } = computeProgramHealth({
        spend: kpiSummary.totalSpend,
        cpl: kpiSummary.avgCpl,
        calls: kpiSummary.totalCalls,
        leads: kpiSummary.totalLsaLeads,
      });

      summary.programHealth = health;
      summary.programStatusMessage = message;
    } else {
      summary.programStatusMessage = 'Media program active but no recent performance data.';
    }

    console.log('[mediaProgram] Summary computed:', {
      companyId,
      hasMediaProgram: summary.hasMediaProgram,
      programHealth: summary.programHealth,
      spend: summary.primaryKpis?.mediaSpend,
    });

    return summary;
  } catch (error) {
    console.error('[mediaProgram] Error computing summary:', error);
    return summary;
  }
}
