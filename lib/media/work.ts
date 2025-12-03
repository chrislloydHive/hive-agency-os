// lib/media/work.ts
// Media → Work integration
//
// This module generates Work items from Media scorecards based on
// performance thresholds and rules.
//
// RULES:
// - Low visibility (< 50): "Improve local visibility for [Store]"
// - Low demand with spend (< 50): "Audit demand generation for [Store]"
// - Low conversion with demand (< 50): "Improve conversion path for [Store]"
//
// Work items are created with:
// - Source type: 'media_scorecard'
// - Area: 'Other' (could be 'Funnel' or 'SEO' based on issue)
// - Severity based on how low the score is

import type {
  MediaStoreScorecardV2,
  MediaMarketScorecard,
} from '@/lib/types/media';
import type {
  WorkSourceMediaScorecard,
  WorkCategory,
  WorkPriority,
} from '@/lib/types/work';
import {
  createWorkItem,
  type CreateWorkItemInput,
  type WorkItemArea,
  type WorkItemSeverity,
  type WorkItemRecord,
} from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

/**
 * Work item draft generated from media scorecard
 */
export interface MediaWorkItemDraft {
  title: string;
  description: string;
  area: WorkItemArea;
  severity: WorkItemSeverity;
  category: WorkCategory;
  priority: WorkPriority;
  storeId?: string;
  storeName?: string;
  marketId?: string;
  marketName?: string;
  scoreType: 'visibility' | 'demand' | 'conversion';
  score: number;
}

/**
 * Threshold configuration for work item generation
 */
export interface MediaWorkThresholds {
  visibility: number; // Default: 50
  demand: number; // Default: 50
  conversion: number; // Default: 50
  minSpendForDemandAlert: number; // Default: 100 (only alert if spending)
}

const DEFAULT_THRESHOLDS: MediaWorkThresholds = {
  visibility: 50,
  demand: 50,
  conversion: 50,
  minSpendForDemandAlert: 100,
};

// ============================================================================
// Work Item Generation
// ============================================================================

/**
 * Generate work item drafts from store scorecards
 *
 * Analyzes each store's scores and generates work items for
 * those that fall below configured thresholds.
 *
 * @param scorecards - Array of store scorecards
 * @param thresholds - Optional custom thresholds
 * @returns Array of work item drafts
 */
export function generateMediaWorkFromScorecards(
  scorecards: MediaStoreScorecardV2[],
  thresholds?: Partial<MediaWorkThresholds>
): MediaWorkItemDraft[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const drafts: MediaWorkItemDraft[] = [];

  for (const scorecard of scorecards) {
    // Check visibility score
    if (scorecard.visibilityScore < t.visibility) {
      drafts.push({
        title: `Improve local visibility for ${scorecard.storeName}`,
        description: buildVisibilityDescription(scorecard),
        area: 'SEO', // Visibility is primarily Maps/GBP optimization
        severity: getSeverityFromScore(scorecard.visibilityScore),
        category: 'seo',
        priority: getPriorityFromScore(scorecard.visibilityScore),
        storeId: scorecard.storeId,
        storeName: scorecard.storeName,
        marketId: scorecard.marketId,
        marketName: scorecard.marketName,
        scoreType: 'visibility',
        score: scorecard.visibilityScore,
      });
    }

    // Check demand score (only if store has spend)
    if (scorecard.demandScore < t.demand && scorecard.spend >= t.minSpendForDemandAlert) {
      drafts.push({
        title: `Audit demand generation for ${scorecard.storeName}`,
        description: buildDemandDescription(scorecard),
        area: 'Funnel',
        severity: getSeverityFromScore(scorecard.demandScore),
        category: 'demand',
        priority: getPriorityFromScore(scorecard.demandScore),
        storeId: scorecard.storeId,
        storeName: scorecard.storeName,
        marketId: scorecard.marketId,
        marketName: scorecard.marketName,
        scoreType: 'demand',
        score: scorecard.demandScore,
      });
    }

    // Check conversion score (only if there's decent demand)
    if (
      scorecard.conversionScore < t.conversion &&
      scorecard.demandScore >= t.demand // Has decent demand
    ) {
      drafts.push({
        title: `Improve conversion path for ${scorecard.storeName}`,
        description: buildConversionDescription(scorecard),
        area: 'Funnel',
        severity: getSeverityFromScore(scorecard.conversionScore),
        category: 'demand',
        priority: getPriorityFromScore(scorecard.conversionScore),
        storeId: scorecard.storeId,
        storeName: scorecard.storeName,
        marketId: scorecard.marketId,
        marketName: scorecard.marketName,
        scoreType: 'conversion',
        score: scorecard.conversionScore,
      });
    }
  }

  // Sort by severity (Critical first) then by score (lowest first)
  drafts.sort((a, b) => {
    const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
    const aDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (aDiff !== 0) return aDiff;
    return a.score - b.score;
  });

  return drafts;
}

/**
 * Generate work items from market scorecards
 */
export function generateMediaWorkFromMarkets(
  markets: MediaMarketScorecard[],
  thresholds?: Partial<MediaWorkThresholds>
): MediaWorkItemDraft[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const drafts: MediaWorkItemDraft[] = [];

  for (const market of markets) {
    // Market-level visibility issue
    if (market.visibilityScore < t.visibility && market.storeCount > 1) {
      drafts.push({
        title: `Market-wide visibility issue in ${market.marketName}`,
        description: `The ${market.marketName} market has an average visibility score of ${market.visibilityScore}/100 across ${market.storeCount} stores. This suggests a systemic issue with local presence that should be addressed market-wide.\n\nConsider:\n- Reviewing GBP profiles for all stores\n- Checking Maps ranking and optimization\n- Auditing local SEO signals`,
        area: 'SEO',
        severity: getSeverityFromScore(market.visibilityScore),
        category: 'seo',
        priority: getPriorityFromScore(market.visibilityScore),
        marketId: market.marketId,
        marketName: market.marketName,
        scoreType: 'visibility',
        score: market.visibilityScore,
      });
    }

    // Market-level demand issue
    if (market.demandScore < t.demand && market.spend >= t.minSpendForDemandAlert * market.storeCount) {
      drafts.push({
        title: `Low demand generation in ${market.marketName} market`,
        description: `The ${market.marketName} market shows low demand metrics (score: ${market.demandScore}/100) despite active media spend.\n\nTotal spend: ${formatCurrency(market.spend)}\nTotal calls: ${market.calls}\nTotal leads: ${market.lsaLeads}\n\nReview campaign targeting and creative for this market.`,
        area: 'Funnel',
        severity: getSeverityFromScore(market.demandScore),
        category: 'demand',
        priority: getPriorityFromScore(market.demandScore),
        marketId: market.marketId,
        marketName: market.marketName,
        scoreType: 'demand',
        score: market.demandScore,
      });
    }
  }

  return drafts;
}

// ============================================================================
// Work Item Creation
// ============================================================================

/**
 * Create work items from media scorecard drafts
 *
 * Takes generated drafts and creates actual Work records in Airtable.
 *
 * @param companyId - Company record ID
 * @param drafts - Array of work item drafts to create
 * @returns Array of created work items
 */
export async function createMediaWorkItems(
  companyId: string,
  drafts: MediaWorkItemDraft[]
): Promise<WorkItemRecord[]> {
  const created: WorkItemRecord[] = [];

  for (const draft of drafts) {
    const source: WorkSourceMediaScorecard = {
      sourceType: 'media_scorecard',
      storeId: draft.storeId,
      marketId: draft.marketId,
      scoreType: draft.scoreType,
      score: draft.score,
      generatedAt: new Date().toISOString(),
    };

    const input: CreateWorkItemInput = {
      title: draft.title,
      companyId,
      notes: draft.description,
      area: draft.area,
      severity: draft.severity,
      status: 'Backlog',
      source,
    };

    try {
      const workItem = await createWorkItem(input);
      if (workItem) {
        created.push(workItem);
      }
    } catch (error) {
      console.error('[Media Work] Failed to create work item:', draft.title, error);
    }
  }

  return created;
}

/**
 * Convenience function: analyze scorecards and create work items in one step
 */
export async function analyzeAndCreateMediaWork(
  companyId: string,
  scorecards: MediaStoreScorecardV2[],
  thresholds?: Partial<MediaWorkThresholds>
): Promise<{
  drafts: MediaWorkItemDraft[];
  created: WorkItemRecord[];
  errors: string[];
}> {
  console.log('[Media Work] Analyzing scorecards for company:', companyId);

  const drafts = generateMediaWorkFromScorecards(scorecards, thresholds);
  console.log(`[Media Work] Generated ${drafts.length} work item drafts`);

  if (drafts.length === 0) {
    return { drafts, created: [], errors: [] };
  }

  const created = await createMediaWorkItems(companyId, drafts);
  const errors: string[] = [];

  if (created.length < drafts.length) {
    errors.push(`Created ${created.length}/${drafts.length} work items (some failed)`);
  }

  console.log(`[Media Work] Created ${created.length} work items`);

  return { drafts, created, errors };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityFromScore(score: number): WorkItemSeverity {
  if (score < 20) return 'Critical';
  if (score < 40) return 'High';
  if (score < 60) return 'Medium';
  return 'Low';
}

function getPriorityFromScore(score: number): WorkPriority {
  if (score < 20) return 'P0';
  if (score < 40) return 'P1';
  if (score < 60) return 'P2';
  return 'P3';
}

function buildVisibilityDescription(scorecard: MediaStoreScorecardV2): string {
  const parts = [
    `**Visibility Score: ${scorecard.visibilityScore}/100**`,
    '',
    `Store "${scorecard.storeName}" has low visibility in local search results.`,
    '',
    '**Current Metrics:**',
    `- Total Impressions: ${formatNumber(scorecard.impressions)}`,
    `- Maps/GBP Clicks: ${formatNumber(scorecard.clicks)}`,
    `- Direction Requests: ${formatNumber(scorecard.directionRequests)}`,
    `- Reviews: ${scorecard.reviews}${scorecard.reviewRating ? ` (${scorecard.reviewRating.toFixed(1)} avg)` : ''}`,
    '',
    '**Recommended Actions:**',
    '1. Verify GBP profile is complete and accurate',
    '2. Check GBP photos are recent and high-quality',
    '3. Ensure hours and contact info are up-to-date',
    '4. Respond to recent reviews',
    '5. Consider adding posts/updates to GBP',
  ];

  if (scorecard.marketName) {
    parts.splice(2, 0, `Market: ${scorecard.marketName}`);
  }

  return parts.join('\n');
}

function buildDemandDescription(scorecard: MediaStoreScorecardV2): string {
  const parts = [
    `**Demand Score: ${scorecard.demandScore}/100**`,
    '',
    `Store "${scorecard.storeName}" is generating low engagement despite active media spend.`,
    '',
    '**Current Metrics:**',
    `- Media Spend: ${formatCurrency(scorecard.spend)}`,
    `- Clicks: ${formatNumber(scorecard.clicks)}`,
    `- Calls: ${formatNumber(scorecard.calls)}`,
    `- Direction Requests: ${formatNumber(scorecard.directionRequests)}`,
    scorecard.ctr ? `- CTR: ${(scorecard.ctr * 100).toFixed(2)}%` : '',
    '',
    '**Recommended Actions:**',
    '1. Review ad creative and messaging',
    '2. Check targeting - is the right audience being reached?',
    '3. Audit landing pages for relevance',
    '4. Consider A/B testing different offers',
    '5. Review competitor activity in this area',
  ].filter(Boolean);

  return parts.join('\n');
}

function buildConversionDescription(scorecard: MediaStoreScorecardV2): string {
  const parts = [
    `**Conversion Score: ${scorecard.conversionScore}/100**`,
    '',
    `Store "${scorecard.storeName}" has good visibility/demand but low conversions.`,
    '',
    '**Current Metrics:**',
    `- Leads: ${formatNumber(scorecard.lsaLeads)}`,
    `- Installs: ${formatNumber(scorecard.installs)}`,
    `- Calls: ${formatNumber(scorecard.calls)}`,
    scorecard.cpl ? `- Cost per Lead: ${formatCurrency(scorecard.cpl)}` : '',
    '',
    '**Recommended Actions:**',
    '1. Audit the booking/lead form experience',
    '2. Ensure phone number is prominent and clickable',
    '3. Check that store hours match call availability',
    '4. Review call handling and response times',
    '5. Consider adding chat or SMS options',
  ].filter(Boolean);

  return parts.join('\n');
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
