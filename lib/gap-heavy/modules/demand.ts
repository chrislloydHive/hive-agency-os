// lib/gap-heavy/modules/demand.ts
// Demand Diagnostic Module - GA4 Traffic & Behavior Analysis

import type { CompanyRecord } from '@/lib/airtable/companies';
import type { DiagnosticModuleResult, EvidencePack } from '../types';
import { fetchGA4Snapshot, isGA4Configured, isValidPropertyId } from '@/lib/telemetry/ga4Client';
import type { Ga4Snapshot } from '@/lib/telemetry/ga4Client';

// ============================================================================
// Types
// ============================================================================

export interface DemandEvidenceData {
  // GA4 Configuration
  ga4Enabled: boolean;
  ga4PropertyId?: string;
  ga4Linked?: boolean;
  primaryConversionEvents?: string[];

  // GA4 Metrics (from snapshot)
  snapshot?: Ga4Snapshot;
  sessionCount?: number;
  userCount?: number;
  engagedSessionsCount?: number;
  engagementRate?: number;
  conversionCount?: number;
  topLandingPages?: Array<{ page: string; sessions: number; conversions: number }>;
  trafficSourceBreakdown?: Record<string, number>;
}

// ============================================================================
// Main Demand Module Function
// ============================================================================

/**
 * Run Demand Module - Analyzes first-party traffic and behavior via GA4
 *
 * This module queries GA4 to understand:
 * - Traffic volume and trends
 * - User behavior and engagement
 * - Conversion events
 * - Traffic sources
 * - Landing page performance
 *
 * @param input - Company, website URL, and evidence pack
 * @returns DiagnosticModuleResult with GA4 insights (or graceful skip if not configured)
 */
export async function runDemandModule(input: {
  company: CompanyRecord;
  websiteUrl: string;
  evidence: EvidencePack;
}): Promise<DiagnosticModuleResult> {
  const startTime = new Date().toISOString();

  console.log('[Demand Module] Starting demand diagnostic for:', input.company.name);

  try {
    // ========================================================================
    // 1. Validate GA4 Configuration
    // ========================================================================

    const ga4Enabled = !!input.company.ga4Linked && !!input.company.ga4PropertyId;

    if (!ga4Enabled) {
      console.log('[Demand Module] GA4 not configured, skipping');

      const evidenceData: DemandEvidenceData = {
        ga4Enabled: false,
        ga4PropertyId: input.company.ga4PropertyId,
        ga4Linked: input.company.ga4Linked,
        primaryConversionEvents: input.company.primaryConversionEvents,
      };

      if (!input.evidence.demand) {
        input.evidence.demand = {};
      }
      input.evidence.demand.ga4 = evidenceData;

      return {
        module: 'demand',
        status: 'completed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        score: undefined,
        summary: 'GA4 not configured for this company; Demand module skipped.',
        issues: [],
        recommendations: [],
        rawEvidence: evidenceData,
      };
    }

    // Validate property ID format
    if (!isValidPropertyId(input.company.ga4PropertyId)) {
      console.warn('[Demand Module] Invalid GA4 property ID format');

      const evidenceData: DemandEvidenceData = {
        ga4Enabled: false,
        ga4PropertyId: input.company.ga4PropertyId,
        ga4Linked: input.company.ga4Linked,
      };

      if (!input.evidence.demand) {
        input.evidence.demand = {};
      }
      input.evidence.demand.ga4 = evidenceData;

      return {
        module: 'demand',
        status: 'completed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        score: undefined,
        summary: 'GA4 property ID appears invalid; Demand module skipped.',
        issues: ['GA4 property ID format is invalid'],
        recommendations: ['Verify GA4 property ID is correct (should be 9-10 digit number)'],
        rawEvidence: evidenceData,
      };
    }

    // Check if GA4 client is configured
    if (!isGA4Configured()) {
      console.warn('[Demand Module] GA4 API credentials not configured');

      const evidenceData: DemandEvidenceData = {
        ga4Enabled: true,
        ga4PropertyId: input.company.ga4PropertyId,
        ga4Linked: input.company.ga4Linked,
      };

      if (!input.evidence.demand) {
        input.evidence.demand = {};
      }
      input.evidence.demand.ga4 = evidenceData;

      return {
        module: 'demand',
        status: 'completed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        score: undefined,
        summary: 'GA4 API credentials not configured on server; Demand module limited.',
        issues: ['GA4 Data API credentials not available'],
        recommendations: ['Contact administrator to configure GA4 service account'],
        rawEvidence: evidenceData,
      };
    }

    // ========================================================================
    // 2. Fetch GA4 Data
    // ========================================================================

    console.log('[Demand Module] Fetching GA4 data for property:', input.company.ga4PropertyId);

    const snapshot = await fetchGA4Snapshot(
      input.company.ga4PropertyId!,
      30, // Last 30 days
      input.company.primaryConversionEvents
    );

    if (!snapshot || snapshot.overview.totalSessions === 0) {
      console.log('[Demand Module] No GA4 data available');

      const evidenceData: DemandEvidenceData = {
        ga4Enabled: true,
        ga4PropertyId: input.company.ga4PropertyId,
        ga4Linked: input.company.ga4Linked,
        snapshot: snapshot || undefined,
      };

      if (!input.evidence.demand) {
        input.evidence.demand = {};
      }
      input.evidence.demand.ga4 = evidenceData;

      return {
        module: 'demand',
        status: 'completed',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        score: undefined,
        summary: 'GA4 configured but no traffic data available for the past 30 days.',
        issues: ['No traffic data in GA4 for this property'],
        recommendations: [
          'Verify GA4 tracking is properly installed on website',
          'Check that the property ID is correct',
          'Ensure sufficient time has passed for data collection',
        ],
        rawEvidence: evidenceData,
      };
    }

    // ========================================================================
    // 3. Process GA4 Snapshot
    // ========================================================================

    const { overview, pages, channels } = snapshot;

    // Build top landing pages
    const topLandingPages = pages.slice(0, 10).map(p => ({
      page: p.pagePath,
      sessions: p.sessions,
      conversions: p.conversions,
    }));

    // Build traffic source breakdown
    const trafficSourceBreakdown: Record<string, number> = {};
    for (const channel of channels) {
      trafficSourceBreakdown[channel.channelGroup] = channel.sessions;
    }

    // ========================================================================
    // 4. Compute Demand Score (0-100)
    // ========================================================================

    const score = computeDemandScore({
      totalSessions: overview.totalSessions,
      totalUsers: overview.totalUsers,
      engagementRate: overview.engagementRate,
      totalConversions: overview.totalConversions,
      hasConversionEventsConfigured: !!input.company.primaryConversionEvents?.length,
    });

    // ========================================================================
    // 5. Generate Insights
    // ========================================================================

    const { summary, issues, recommendations } = generateDemandInsights({
      overview,
      pages,
      channels,
      score,
      hasConversionEventsConfigured: !!input.company.primaryConversionEvents?.length,
    });

    // ========================================================================
    // 6. Store Evidence
    // ========================================================================

    const evidenceData: DemandEvidenceData = {
      ga4Enabled: true,
      ga4PropertyId: input.company.ga4PropertyId,
      ga4Linked: input.company.ga4Linked,
      primaryConversionEvents: input.company.primaryConversionEvents,
      snapshot,
      sessionCount: overview.totalSessions,
      userCount: overview.totalUsers,
      engagedSessionsCount: overview.totalEngagedSessions,
      engagementRate: overview.engagementRate,
      conversionCount: overview.totalConversions,
      topLandingPages,
      trafficSourceBreakdown,
    };

    if (!input.evidence.demand) {
      input.evidence.demand = {};
    }
    input.evidence.demand.ga4 = evidenceData;

    const completedTime = new Date().toISOString();

    console.log('[Demand Module] Completed with score:', score);

    return {
      module: 'demand',
      status: 'completed',
      startedAt: startTime,
      completedAt: completedTime,
      score,
      summary,
      issues,
      recommendations,
      rawEvidence: evidenceData,
    };
  } catch (error) {
    // Graceful error handling - never crash the Heavy run
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Demand Module] Error:', errorMsg);

    const evidenceData: DemandEvidenceData = {
      ga4Enabled: false,
      ga4PropertyId: input.company.ga4PropertyId,
      ga4Linked: input.company.ga4Linked,
    };

    if (!input.evidence.demand) {
      input.evidence.demand = {};
    }
    input.evidence.demand.ga4 = evidenceData;

    return {
      module: 'demand',
      status: 'failed',
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      score: undefined,
      summary: `Demand analysis encountered an error: ${errorMsg}`,
      issues: ['Unable to complete demand analysis due to technical error'],
      recommendations: ['Verify GA4 configuration and retry'],
      rawEvidence: { ...evidenceData, error: errorMsg },
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute demand score based on GA4 metrics (0-100)
 */
function computeDemandScore(metrics: {
  totalSessions: number;
  totalUsers: number;
  engagementRate: number;
  totalConversions: number;
  hasConversionEventsConfigured: boolean;
}): number {
  let score = 0;

  // Traffic Volume (30 points)
  // Scale: 0-1000 sessions/month = 0-30 points
  const trafficScore = Math.min((metrics.totalSessions / 1000) * 30, 30);
  score += trafficScore;

  // Engagement (30 points)
  // Scale: engagement rate 0-100% = 0-30 points
  const engagementScore = (metrics.engagementRate / 100) * 30;
  score += engagementScore;

  // Conversions (40 points)
  if (metrics.hasConversionEventsConfigured) {
    // If conversions are configured, score based on conversion rate
    const conversionRate = metrics.totalSessions > 0
      ? (metrics.totalConversions / metrics.totalSessions) * 100
      : 0;

    // Scale: 0-10% conversion rate = 0-40 points
    const conversionScore = Math.min((conversionRate / 10) * 40, 40);
    score += conversionScore;
  } else {
    // If conversions not configured, can get max 20 points
    // (assume some baseline if traffic and engagement are good)
    if (metrics.totalSessions > 100 && metrics.engagementRate > 30) {
      score += 20;
    }
  }

  return Math.round(Math.min(score, 100));
}

/**
 * Generate summary, issues, and recommendations based on GA4 data
 */
function generateDemandInsights(data: {
  overview: Ga4Snapshot['overview'];
  pages: Ga4Snapshot['pages'];
  channels: Ga4Snapshot['channels'];
  score: number;
  hasConversionEventsConfigured: boolean;
}): {
  summary: string;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  const { overview, pages, channels, score, hasConversionEventsConfigured } = data;

  // Analyze traffic volume
  if (overview.totalSessions < 100) {
    issues.push('Very low traffic volume (< 100 sessions/month)');
    recommendations.push('Focus on increasing website traffic through SEO and content marketing');
    recommendations.push('Consider paid advertising to jumpstart visitor acquisition');
  } else if (overview.totalSessions < 500) {
    issues.push('Low traffic volume (< 500 sessions/month)');
    recommendations.push('Develop content strategy to increase organic search visibility');
  }

  // Analyze engagement
  if (overview.engagementRate < 30) {
    issues.push(`Low engagement rate (${overview.engagementRate.toFixed(1)}%)`);
    recommendations.push('Improve page content quality and relevance to increase engagement');
    recommendations.push('Optimize user experience to encourage longer sessions');
  } else if (overview.engagementRate < 50) {
    issues.push(`Moderate engagement rate (${overview.engagementRate.toFixed(1)}%)`);
    recommendations.push('Test content variations to improve engagement metrics');
  }

  // Analyze conversions
  if (hasConversionEventsConfigured) {
    const conversionRate = overview.totalSessions > 0
      ? (overview.totalConversions / overview.totalSessions) * 100
      : 0;

    if (conversionRate < 1) {
      issues.push(`Low conversion rate (${conversionRate.toFixed(2)}%)`);
      recommendations.push('Add clear, compelling calls-to-action on high-traffic pages');
      recommendations.push('Optimize conversion funnel to reduce friction');
    } else if (conversionRate < 3) {
      issues.push(`Moderate conversion rate (${conversionRate.toFixed(2)}%)`);
      recommendations.push('A/B test CTAs and landing page variations to improve conversion');
    }
  } else {
    issues.push('No conversion events configured in GA4');
    recommendations.push('Configure primary conversion events in company settings to track goals');
  }

  // Analyze traffic sources
  const topChannel = channels[0];
  if (topChannel && topChannel.sessions / overview.totalSessions > 0.7) {
    issues.push(`Over-reliance on ${topChannel.channelGroup} (${Math.round(topChannel.sessions / overview.totalSessions * 100)}% of traffic)`);
    recommendations.push('Diversify traffic sources to reduce dependency on single channel');
  }

  const organicChannel = channels.find(c => c.channelGroup === 'Organic Search');
  if (!organicChannel || organicChannel.sessions < overview.totalSessions * 0.2) {
    issues.push('Low organic search traffic');
    recommendations.push('Invest in SEO to build sustainable organic traffic channel');
  }

  // Analyze landing pages
  const topPage = pages[0];
  if (topPage && topPage.sessions / overview.totalSessions > 0.6) {
    issues.push(`${Math.round(topPage.sessions / overview.totalSessions * 100)}% of traffic goes to a single page`);
    recommendations.push('Develop additional high-value landing pages to distribute traffic');
  }

  // Generate summary
  let summaryText = '';
  if (score >= 70) {
    summaryText = `Strong demand signals with ${overview.totalSessions.toLocaleString()} sessions and ${overview.totalUsers.toLocaleString()} users over 30 days. `;
  } else if (score >= 50) {
    summaryText = `Moderate demand with ${overview.totalSessions.toLocaleString()} sessions and ${overview.totalUsers.toLocaleString()} users. `;
  } else {
    summaryText = `Limited demand signals with ${overview.totalSessions.toLocaleString()} sessions and ${overview.totalUsers.toLocaleString()} users. `;
  }

  summaryText += `Engagement rate is ${overview.engagementRate.toFixed(1)}%. `;

  if (hasConversionEventsConfigured && overview.totalConversions > 0) {
    const conversionRate = (overview.totalConversions / overview.totalSessions) * 100;
    summaryText += `Conversion rate: ${conversionRate.toFixed(2)}% (${overview.totalConversions} conversions).`;
  } else {
    summaryText += 'Conversion tracking needs setup.';
  }

  return {
    summary: summaryText,
    issues,
    recommendations,
  };
}
