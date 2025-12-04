// lib/media/planningInputPrefill.ts
// Prefill Media Planning Inputs from Brain & Diagnostics
//
// This module aggregates data from various sources to prefill the 13 input
// categories for media planning. Sources include:
// - Brain (Company Brain / Client Brain)
// - Media Profile
// - Diagnostics (GAP, Website Lab, Brand Lab, Demand Lab, Ops Lab)
// - Media Memory / Media Performance
// - Company record

import { getBrainCompanyContext, type BrainCompanyContext } from '@/lib/brain/companyContext';
import { getMediaProfile, type MediaProfile } from './mediaProfile';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  type MediaPlanningInputs,
  type MediaPlanningInputsWithMetadata,
  type FieldMetadata,
  type FieldSource,
  type PrimaryObjective,
  type MarketMaturity,
  type RiskTolerance,
  type MediaChannelId,
  createEmptyPlanningInputs,
} from './planningInput';

// ============================================================================
// Types
// ============================================================================

export interface PrefillResult {
  inputs: MediaPlanningInputs;
  metadata: Record<string, FieldMetadata>;
  sources: {
    brain: boolean;
    profile: boolean;
    diagnostics: boolean;
    memory: boolean;
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build prefilled media planning inputs from all available sources
 */
export async function buildPrefilledMediaPlanningInputs(
  companyId: string
): Promise<PrefillResult> {
  // Load all sources in parallel
  const [brain, profile, company, memory, diagnostics] = await Promise.all([
    getBrainCompanyContext(companyId).catch(() => ({} as BrainCompanyContext)),
    getMediaProfile(companyId).catch(() => null),
    getCompanyById(companyId).catch(() => null),
    loadMediaMemory(companyId).catch(() => null),
    loadDiagnosticsData(companyId).catch(() => null),
  ]);

  const inputs = createEmptyPlanningInputs();
  const metadata: Record<string, FieldMetadata> = {};

  // Track which sources were used
  const sources = {
    brain: !!brain && Object.keys(brain).length > 0,
    profile: !!profile,
    diagnostics: !!diagnostics,
    memory: !!memory,
  };

  // ============================================================================
  // Category 1: Business & Brand
  // ============================================================================
  inputs.businessBrand = {
    businessModel: prefillField(
      profile?.notes?.includes('retail') ? 'retail' : brain.businessModel,
      'businessModel',
      brain.businessModel ? 'brain' : 'unknown',
      metadata
    ),
    revenueModel: prefillField(
      brain.revenueModel,
      'revenueModel',
      'brain',
      metadata
    ),
    profitCenters: [],
    marketMaturity: prefillField(
      mapToMarketMaturity(brain.marketMaturity),
      'marketMaturity',
      brain.marketMaturity ? 'brain' : 'unknown',
      metadata
    ),
    geographicFootprint: prefillField(
      brain.geographicFootprint,
      'geographicFootprint',
      brain.geographicFootprint ? 'brain' : 'unknown',
      metadata
    ),
    seasonalityNotes: prefillField(
      brain.seasonalityNotes,
      'seasonalityNotes',
      'brain',
      metadata
    ),
    competitiveLandscape: prefillField(
      brain.competitiveSummary,
      'competitiveLandscape',
      'brain',
      metadata
    ),
    positioning: prefillField(
      brain.brandSummary || brain.businessSummary,
      'positioning',
      brain.brandSummary ? 'brain' : 'unknown',
      metadata
    ),
    valueProps: prefillArrayField(
      brain.valueProps,
      'valueProps',
      'brain',
      metadata
    ),
    differentiators: prefillArrayField(
      brain.differentiators,
      'differentiators',
      'brain',
      metadata
    ),
    brandPerception: prefillField(
      brain.brandPerception,
      'brandPerception',
      'brain',
      metadata
    ),
  };

  // ============================================================================
  // Category 2: Marketing Objectives & KPIs
  // ============================================================================
  inputs.objectivesKpis = {
    primaryObjective: prefillField(
      mapToPrimaryObjective(profile?.primaryObjective),
      'primaryObjective',
      profile?.primaryObjective ? 'profile' : 'unknown',
      metadata
    ),
    secondaryObjectives: [],
    primaryBusinessGoal: undefined,
    kpiLabels: profile?.primaryObjective
      ? prefillArrayField(
          getKpiLabelsForObjective(profile.primaryObjective),
          'kpiLabels',
          'profile',
          metadata
        )
      : [],
    targetCpa: prefillField(
      profile?.maxCpa || null,
      'targetCpa',
      profile?.maxCpa ? 'profile' : 'unknown',
      metadata
    ),
    targetCpl: null,
    targetRoas: prefillField(
      profile?.minRoas || null,
      'targetRoas',
      profile?.minRoas ? 'profile' : 'unknown',
      metadata
    ),
    targetMer: null,
    targetCac: null,
    targetLtv: null,
    contributionMarginRequirement: undefined,
    timeHorizon: 'quarter',
    timeHorizonCustomRange: null,
  };

  // ============================================================================
  // Category 3: Audience Inputs
  // ============================================================================
  inputs.audience = {
    coreSegments: prefillArrayField(
      brain.audienceSegments,
      'coreSegments',
      'brain',
      metadata
    ),
    demographics: undefined,
    geos: prefillField(
      brain.geographicFootprint,
      'geos',
      brain.geographicFootprint ? 'brain' : 'unknown',
      metadata
    ),
    behavioralDrivers: [],
    demandStates: [],
    mediaHabits: undefined,
    culturalNuances: undefined,
    languages: [],
  };

  // ============================================================================
  // Category 4: Product & Offer Inputs
  // ============================================================================
  inputs.productOffer = {
    productLines: prefillArrayField(
      brain.productLines,
      'productLines',
      'brain',
      metadata
    ),
    heroProducts: [],
    pricingNotes: prefillField(
      profile?.avgTicketValue ? `Avg ticket: $${profile.avgTicketValue}` : undefined,
      'pricingNotes',
      profile?.avgTicketValue ? 'profile' : 'unknown',
      metadata
    ),
    promoWindows: undefined,
    marginTiers: undefined,
    inventoryConstraints: undefined,
  };

  // ============================================================================
  // Category 5: Historical Performance
  // ============================================================================
  inputs.historical = {
    pastSpendByChannelSummary: prefillField(
      brain.mediaHistorySummary || memory?.spendSummary,
      'pastSpendByChannelSummary',
      brain.mediaHistorySummary ? 'brain' : memory?.spendSummary ? 'diagnostics' : 'unknown',
      metadata
    ),
    pastPerformanceSummary: prefillField(
      memory?.performanceSummary,
      'pastPerformanceSummary',
      memory?.performanceSummary ? 'diagnostics' : 'unknown',
      metadata
    ),
    channelContributionSummary: undefined,
    seasonalityOverlays: prefillField(
      brain.seasonalityNotes,
      'seasonalityOverlays',
      brain.seasonalityNotes ? 'brain' : 'unknown',
      metadata
    ),
    storeOrGeoPerformance: undefined,
    incrementalityNotes: undefined,
    attributionModelHistory: undefined,
  };

  // ============================================================================
  // Category 6: Digital Infrastructure
  // ============================================================================
  inputs.digitalInfra = {
    trackingStackSummary: prefillField(
      brain.trackingStackSummary || diagnostics?.trackingSummary,
      'trackingStackSummary',
      brain.trackingStackSummary ? 'brain' : diagnostics?.trackingSummary ? 'diagnostics' : 'unknown',
      metadata
    ),
    ga4Health: prefillField(
      diagnostics?.ga4Health,
      'ga4Health',
      diagnostics?.ga4Health ? 'diagnostics' : 'unknown',
      metadata
    ),
    searchConsoleHealth: prefillField(
      diagnostics?.gscHealth,
      'searchConsoleHealth',
      diagnostics?.gscHealth ? 'diagnostics' : 'unknown',
      metadata
    ),
    gbpHealth: prefillField(
      diagnostics?.gbpHealth,
      'gbpHealth',
      diagnostics?.gbpHealth ? 'diagnostics' : 'unknown',
      metadata
    ),
    crmAndLeadFlow: undefined,
    offlineConversionTracking: undefined,
    callTracking: undefined,
    storeVisitMeasurement: undefined,
    measurementLimits: undefined,
  };

  // ============================================================================
  // Category 7: Competitive Intelligence
  // ============================================================================
  inputs.competitive = {
    shareOfVoice: prefillField(
      brain.competitiveSummary,
      'shareOfVoice',
      brain.competitiveSummary ? 'brain' : 'unknown',
      metadata
    ),
    competitorMediaMix: undefined,
    competitorBudgets: undefined,
    competitorSearchStrategy: undefined,
    competitorCreativeThemes: undefined,
    categoryBenchmarks: undefined,
  };

  // ============================================================================
  // Category 8: Creative & Content
  // ============================================================================
  inputs.creativeContent = {
    creativeInventorySummary: prefillField(
      brain.creativeInventorySummary,
      'creativeInventorySummary',
      brain.creativeInventorySummary ? 'brain' : 'unknown',
      metadata
    ),
    brandGuidelines: undefined,
    coreMessages: prefillArrayField(
      brain.valueProps,
      'coreMessages',
      brain.valueProps?.length ? 'brain' : 'unknown',
      metadata
    ),
    proofPoints: prefillArrayField(
      brain.differentiators,
      'proofPoints',
      brain.differentiators?.length ? 'brain' : 'unknown',
      metadata
    ),
    contentGaps: prefillField(
      brain.contentSummary,
      'contentGaps',
      brain.contentSummary ? 'brain' : 'unknown',
      metadata
    ),
    productionScalability: undefined,
    ugcPipelines: undefined,
  };

  // ============================================================================
  // Category 9: Operational Constraints
  // ============================================================================
  inputs.operational = {
    budgetCapsFloors: undefined,
    pacingRequirements: undefined,
    channelRestrictions: profile?.excludedChannels?.length
      ? prefillField(
          `Excluded: ${profile.excludedChannels.join(', ')}`,
          'channelRestrictions',
          'profile',
          metadata
        )
      : undefined,
    dataAvailability: prefillField(
      brain.constraintsSummary,
      'dataAvailability',
      brain.constraintsSummary ? 'brain' : 'unknown',
      metadata
    ),
    talentConstraints: undefined,
    platformLimitations: undefined,
  };

  // ============================================================================
  // Category 10: Budget Inputs
  // ============================================================================
  inputs.budget = {
    totalBudgetMonthly: null,
    totalBudgetQuarterly: null,
    totalBudgetAnnual: null,
    minBudget: null,
    maxBudget: null,
    brandVsPerformanceRules: undefined,
    testingBudgetNotes: undefined,
    creativeBudgetNotes: undefined,
    reportingBudgetNotes: undefined,
  };

  // ============================================================================
  // Category 11: Channel Universe
  // ============================================================================
  inputs.channels = {
    requiredChannels: prefillArrayField(
      mapToMediaChannelIds(profile?.requiredChannels),
      'requiredChannels',
      profile?.requiredChannels?.length ? 'profile' : 'unknown',
      metadata
    ),
    disallowedChannels: prefillArrayField(
      mapToMediaChannelIds(profile?.excludedChannels),
      'disallowedChannels',
      profile?.excludedChannels?.length ? 'profile' : 'unknown',
      metadata
    ),
    notes: undefined,
  };

  // ============================================================================
  // Category 12: Store/Location Inputs
  // ============================================================================
  inputs.storeLocation = {
    isMultiLocation: prefillField(
      brain.isMultiLocation,
      'isMultiLocation',
      brain.isMultiLocation !== undefined ? 'brain' : 'unknown',
      metadata
    ),
    storeSummary: prefillField(
      brain.storeCount ? `${brain.storeCount} stores` : undefined,
      'storeSummary',
      brain.storeCount ? 'brain' : 'unknown',
      metadata
    ),
    tradeAreaNotes: undefined,
    revenueDistribution: undefined,
    capacityNotes: profile?.maxStoreCapacity
      ? prefillField(
          'Per-store capacity limits configured',
          'capacityNotes',
          'profile',
          metadata
        )
      : undefined,
    localCompetitiveDensity: undefined,
    localSeasonality: undefined,
  };

  // ============================================================================
  // Category 13: Risk Appetite
  // ============================================================================
  inputs.risk = {
    riskTolerance: prefillField(
      'balanced' as RiskTolerance,
      'riskTolerance',
      'unknown',
      metadata
    ),
    cacVolatilityTolerance: undefined,
    growthAtBreakevenOk: undefined,
    testingComfort: undefined,
  };

  return { inputs, metadata, sources };
}

// ============================================================================
// Prefill Helpers
// ============================================================================

function prefillField<T>(
  value: T | undefined,
  fieldName: string,
  source: FieldSource,
  metadata: Record<string, FieldMetadata>
): T | undefined {
  if (value !== undefined && value !== null && value !== '') {
    metadata[fieldName] = {
      source,
      confidence: source === 'brain' ? 'high' : source === 'diagnostics' ? 'medium' : 'low',
      lastUpdated: new Date().toISOString(),
    };
  }
  return value;
}

function prefillArrayField<T>(
  value: T[] | undefined,
  fieldName: string,
  source: FieldSource,
  metadata: Record<string, FieldMetadata>
): T[] {
  if (value && value.length > 0) {
    metadata[fieldName] = {
      source,
      confidence: source === 'brain' ? 'high' : source === 'diagnostics' ? 'medium' : 'low',
      lastUpdated: new Date().toISOString(),
    };
    return value;
  }
  return [];
}

// ============================================================================
// Type Mappers
// ============================================================================

function mapToPrimaryObjective(
  profileObjective?: string
): PrimaryObjective | undefined {
  if (!profileObjective) return undefined;

  const map: Record<string, PrimaryObjective> = {
    installs: 'sales_conversions',
    calls: 'lead_generation',
    traffic: 'traffic_growth',
    awareness: 'brand_awareness',
    blended: 'blended',
  };

  return map[profileObjective] || 'blended';
}

function mapToMarketMaturity(
  value?: string
): MarketMaturity | undefined {
  if (!value) return undefined;

  const lower = value.toLowerCase();
  if (lower.includes('launch') || lower.includes('new')) return 'launch';
  if (lower.includes('growth') || lower.includes('growing')) return 'growth';
  if (lower.includes('plateau') || lower.includes('mature')) return 'plateau';
  if (lower.includes('turnaround') || lower.includes('declining')) return 'turnaround';
  return 'other';
}

function mapToMediaChannelIds(
  channels?: string[]
): MediaChannelId[] {
  if (!channels) return [];

  const map: Record<string, MediaChannelId> = {
    search: 'search_google',
    maps: 'maps_gbp',
    lsa: 'lsa',
    social: 'social_meta',
    display: 'display',
    youtube: 'youtube',
    radio: 'radio',
    email: 'email_sms',
    affiliate: 'partnerships',
    direct_mail: 'email_sms',
    tv: 'ctv_ott',
    streaming_audio: 'streaming_audio',
    microsoft_search: 'search_bing',
    tiktok: 'social_tiktok',
    out_of_home: 'out_of_home',
    print: 'out_of_home',
  };

  return channels
    .map((c) => map[c])
    .filter((c): c is MediaChannelId => c !== undefined);
}

function getKpiLabelsForObjective(
  objective?: string
): string[] {
  if (!objective) return [];

  const map: Record<string, string[]> = {
    installs: ['Installs', 'Install Rate', 'Cost per Install'],
    calls: ['Calls', 'Call Rate', 'Cost per Call', 'Lead Quality'],
    traffic: ['Sessions', 'Users', 'Cost per Visit', 'Bounce Rate'],
    awareness: ['Impressions', 'Reach', 'Brand Lift', 'Share of Voice'],
    blended: ['Leads', 'Installs', 'ROAS', 'Blended CPA'],
  };

  return map[objective] || [];
}

// ============================================================================
// Data Loaders
// ============================================================================

interface MediaMemoryData {
  spendSummary?: string;
  performanceSummary?: string;
  topChannels?: string[];
  winningCreatives?: string[];
}

async function loadMediaMemory(
  companyId: string
): Promise<MediaMemoryData | null> {
  try {
    const { getMediaMemoryContext } = await import('./mediaMemory');
    const context = await getMediaMemoryContext(companyId);

    if (!context || context.recentEntries.length === 0) return null;

    // Extract summary from recent entries
    const latestEntry = context.recentEntries[0];
    const topChannelNames = latestEntry?.topPerformingChannels?.map(c => c.channel) || [];

    return {
      spendSummary: latestEntry?.aggregateMetrics
        ? `$${latestEntry.aggregateMetrics.totalSpend.toLocaleString()} total spend`
        : undefined,
      performanceSummary: latestEntry?.keyLearnings?.join('. '),
      topChannels: topChannelNames,
      winningCreatives: context.winningThemes,
    };
  } catch {
    return null;
  }
}

interface DiagnosticsData {
  trackingSummary?: string;
  ga4Health?: string;
  gscHealth?: string;
  gbpHealth?: string;
  seoSummary?: string;
}

async function loadDiagnosticsData(
  companyId: string
): Promise<DiagnosticsData | null> {
  try {
    const { getLatestRunForCompanyAndTool } = await import('@/lib/os/diagnostics/runs');
    const run = await getLatestRunForCompanyAndTool(companyId, 'gapHeavy');

    if (!run?.metadata) return null;

    const metadata = run.metadata as Record<string, unknown>;

    return {
      trackingSummary: (metadata.trackingSummary as string) || undefined,
      ga4Health: (metadata.ga4Status as string) || undefined,
      gscHealth: (metadata.gscStatus as string) || undefined,
      gbpHealth: (metadata.gbpStatus as string) || undefined,
      seoSummary: (metadata.seoSummary as string) || undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Export for Server Actions
// ============================================================================

/**
 * Get prefilled inputs with metadata for UI
 */
export async function getPlanningInputsForCompany(
  companyId: string
): Promise<MediaPlanningInputsWithMetadata> {
  const result = await buildPrefilledMediaPlanningInputs(companyId);
  return {
    inputs: result.inputs,
    metadata: result.metadata,
  };
}
