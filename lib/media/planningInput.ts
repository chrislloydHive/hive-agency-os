// lib/media/planningInput.ts
// Canonical Input Schema for Media Planning (13 Categories)
//
// This is the single source of truth for all inputs needed to generate
// an AI-powered media plan. The schema covers:
//
// 1. Business & Brand Context
// 2. Marketing Objectives & KPIs
// 3. Audience Inputs
// 4. Product & Offer Inputs
// 5. Historical Performance
// 6. Digital Infrastructure
// 7. Competitive Intelligence
// 8. Creative & Content
// 9. Operational Constraints
// 10. Budget Inputs
// 11. Channel Universe
// 12. Store/Location Inputs
// 13. Risk Appetite

// ============================================================================
// Category 1: Business & Brand Context
// ============================================================================

export type MarketMaturity = 'launch' | 'growth' | 'plateau' | 'turnaround' | 'other';

export interface BusinessBrandContext {
  businessModel?: string;              // DTC, retail, SaaS, etc.
  revenueModel?: string;               // transactions, subscriptions, services, etc.
  profitCenters?: string[];
  marketMaturity?: MarketMaturity;
  geographicFootprint?: string;        // summary + key regions
  seasonalityNotes?: string;
  competitiveLandscape?: string;
  positioning?: string;
  valueProps?: string[];
  differentiators?: string[];
  brandPerception?: string;
}

// ============================================================================
// Category 2: Marketing Objectives & KPIs
// ============================================================================

export type PrimaryObjective =
  | 'lead_generation'
  | 'sales_conversions'
  | 'traffic_growth'
  | 'brand_awareness'
  | 'engagement'
  | 'blended';

export type TimeHorizon = '30d' | '90d' | 'quarter' | 'year' | 'custom';

export interface MarketingObjectivesKpis {
  primaryObjective?: PrimaryObjective;
  secondaryObjectives?: PrimaryObjective[];
  primaryBusinessGoal?: string;        // free-text
  kpiLabels?: string[];                // installs, bookings, etc.
  targetCpa?: number | null;
  targetCpl?: number | null;
  targetRoas?: number | null;
  targetMer?: number | null;
  targetCac?: number | null;
  targetLtv?: number | null;
  contributionMarginRequirement?: string;
  timeHorizon?: TimeHorizon;
  timeHorizonCustomRange?: { start: string; end: string } | null;
}

// ============================================================================
// Category 3: Audience Inputs
// ============================================================================

export interface AudienceInputs {
  coreSegments?: string[];
  demographics?: string;
  geos?: string;                       // DMA, ZIPs, etc.
  behavioralDrivers?: string[];
  demandStates?: string[];             // in-market, unaware, etc.
  mediaHabits?: string;
  culturalNuances?: string;
  languages?: string[];
}

// ============================================================================
// Category 4: Product & Offer Inputs
// ============================================================================

export interface ProductOfferInputs {
  productLines?: string[];
  heroProducts?: string[];
  pricingNotes?: string;
  promoWindows?: string;
  marginTiers?: string;
  inventoryConstraints?: string;
}

// ============================================================================
// Category 5: Historical Performance
// ============================================================================

export interface HistoricalPerformanceInputs {
  pastSpendByChannelSummary?: string;
  pastPerformanceSummary?: string;     // CPA/ROAS/CTR/CVR notes
  channelContributionSummary?: string;
  seasonalityOverlays?: string;
  storeOrGeoPerformance?: string;
  incrementalityNotes?: string;
  attributionModelHistory?: string;
}

// ============================================================================
// Category 6: Digital Infrastructure
// ============================================================================

export interface DigitalInfraInputs {
  trackingStackSummary?: string;
  ga4Health?: string;
  searchConsoleHealth?: string;
  gbpHealth?: string;
  crmAndLeadFlow?: string;
  offlineConversionTracking?: string;
  callTracking?: string;
  storeVisitMeasurement?: string;
  measurementLimits?: string;
}

// ============================================================================
// Category 7: Competitive Intelligence
// ============================================================================

export interface CompetitiveIntelInputs {
  shareOfVoice?: string;
  competitorMediaMix?: string;
  competitorBudgets?: string;
  competitorSearchStrategy?: string;
  competitorCreativeThemes?: string;
  categoryBenchmarks?: string;
}

// ============================================================================
// Category 8: Creative & Content
// ============================================================================

export interface CreativeContentInputs {
  creativeInventorySummary?: string;
  brandGuidelines?: string;
  coreMessages?: string[];
  proofPoints?: string[];
  contentGaps?: string;
  productionScalability?: string;
  ugcPipelines?: string;
}

// ============================================================================
// Category 9: Operational Constraints
// ============================================================================

export interface OperationalConstraintsInputs {
  budgetCapsFloors?: string;
  pacingRequirements?: string;
  channelRestrictions?: string;
  dataAvailability?: string;
  talentConstraints?: string;
  platformLimitations?: string;
}

// ============================================================================
// Category 10: Budget Inputs
// ============================================================================

export interface BudgetInputs {
  totalBudgetMonthly?: number | null;
  totalBudgetQuarterly?: number | null;
  totalBudgetAnnual?: number | null;
  minBudget?: number | null;
  maxBudget?: number | null;
  brandVsPerformanceRules?: string;
  testingBudgetNotes?: string;
  creativeBudgetNotes?: string;
  reportingBudgetNotes?: string;
}

// ============================================================================
// Category 11: Channel Universe
// ============================================================================

export type MediaChannelId =
  // Search
  | 'search_google'
  | 'search_bing'
  | 'shopping'
  // Local
  | 'lsa'
  | 'maps_gbp'
  | 'local_seo'
  // Social
  | 'social_meta'
  | 'social_tiktok'
  | 'social_instagram'
  | 'social_linkedin'
  | 'social_pinterest'
  | 'social_x'
  // Display & Video
  | 'display'
  | 'retargeting'
  | 'youtube'
  | 'programmatic_video'
  // Audio & TV
  | 'radio'
  | 'streaming_audio'
  | 'ctv_ott'
  // Other
  | 'out_of_home'
  | 'influencers'
  | 'email_sms'
  | 'organic_content'
  | 'partnerships'
  | 'pr'
  | 'events'
  | 'in_store_media';

export interface ChannelUniverseInputs {
  requiredChannels?: MediaChannelId[];
  disallowedChannels?: MediaChannelId[];
  notes?: string;
}

// ============================================================================
// Category 12: Store/Location Inputs
// ============================================================================

export interface StoreLocationInputs {
  isMultiLocation?: boolean;
  storeSummary?: string;
  tradeAreaNotes?: string;
  revenueDistribution?: string;
  capacityNotes?: string;
  localCompetitiveDensity?: string;
  localSeasonality?: string;
}

// ============================================================================
// Category 13: Risk Appetite
// ============================================================================

export type RiskTolerance = 'conservative' | 'balanced' | 'aggressive';

export interface RiskAppetiteInputs {
  riskTolerance?: RiskTolerance;
  cacVolatilityTolerance?: string;
  growthAtBreakevenOk?: boolean;
  testingComfort?: string;
}

// ============================================================================
// Complete Planning Inputs (All 13 Categories)
// ============================================================================

export interface MediaPlanningInputs {
  businessBrand: BusinessBrandContext;
  objectivesKpis: MarketingObjectivesKpis;
  audience: AudienceInputs;
  productOffer: ProductOfferInputs;
  historical: HistoricalPerformanceInputs;
  digitalInfra: DigitalInfraInputs;
  competitive: CompetitiveIntelInputs;
  creativeContent: CreativeContentInputs;
  operational: OperationalConstraintsInputs;
  budget: BudgetInputs;
  channels: ChannelUniverseInputs;
  storeLocation: StoreLocationInputs;
  risk: RiskAppetiteInputs;
}

// ============================================================================
// Field Metadata for UI
// ============================================================================

export type FieldSource = 'brain' | 'diagnostics' | 'profile' | 'manual' | 'unknown';

export interface FieldMetadata {
  source: FieldSource;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated?: string;
}

export interface MediaPlanningInputsWithMetadata {
  inputs: MediaPlanningInputs;
  metadata: Partial<Record<string, FieldMetadata>>;
}

// ============================================================================
// Category Metadata
// ============================================================================

export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: string[];
}

export const PLANNING_CATEGORIES: CategoryInfo[] = [
  {
    id: 'businessBrand',
    name: 'Business & Brand',
    description: 'Business model, positioning, and brand context',
    icon: 'building',
    fields: [
      'businessModel',
      'revenueModel',
      'profitCenters',
      'marketMaturity',
      'geographicFootprint',
      'seasonalityNotes',
      'competitiveLandscape',
      'positioning',
      'valueProps',
      'differentiators',
      'brandPerception',
    ],
  },
  {
    id: 'objectivesKpis',
    name: 'Objectives & KPIs',
    description: 'Marketing goals, targets, and success metrics',
    icon: 'target',
    fields: [
      'primaryObjective',
      'secondaryObjectives',
      'primaryBusinessGoal',
      'kpiLabels',
      'targetCpa',
      'targetCpl',
      'targetRoas',
      'targetMer',
      'targetCac',
      'targetLtv',
      'contributionMarginRequirement',
      'timeHorizon',
    ],
  },
  {
    id: 'audience',
    name: 'Audience',
    description: 'Target segments, demographics, and behaviors',
    icon: 'users',
    fields: [
      'coreSegments',
      'demographics',
      'geos',
      'behavioralDrivers',
      'demandStates',
      'mediaHabits',
      'culturalNuances',
      'languages',
    ],
  },
  {
    id: 'productOffer',
    name: 'Products & Offers',
    description: 'Product lines, pricing, and promotions',
    icon: 'package',
    fields: [
      'productLines',
      'heroProducts',
      'pricingNotes',
      'promoWindows',
      'marginTiers',
      'inventoryConstraints',
    ],
  },
  {
    id: 'historical',
    name: 'Historical Performance',
    description: 'Past media spend, performance, and learnings',
    icon: 'chart-line',
    fields: [
      'pastSpendByChannelSummary',
      'pastPerformanceSummary',
      'channelContributionSummary',
      'seasonalityOverlays',
      'storeOrGeoPerformance',
      'incrementalityNotes',
      'attributionModelHistory',
    ],
  },
  {
    id: 'digitalInfra',
    name: 'Digital Infrastructure',
    description: 'Tracking, measurement, and data capabilities',
    icon: 'database',
    fields: [
      'trackingStackSummary',
      'ga4Health',
      'searchConsoleHealth',
      'gbpHealth',
      'crmAndLeadFlow',
      'offlineConversionTracking',
      'callTracking',
      'storeVisitMeasurement',
      'measurementLimits',
    ],
  },
  {
    id: 'competitive',
    name: 'Competitive Intelligence',
    description: 'Competitor landscape and benchmarks',
    icon: 'chart-bar',
    fields: [
      'shareOfVoice',
      'competitorMediaMix',
      'competitorBudgets',
      'competitorSearchStrategy',
      'competitorCreativeThemes',
      'categoryBenchmarks',
    ],
  },
  {
    id: 'creativeContent',
    name: 'Creative & Content',
    description: 'Creative assets, guidelines, and capabilities',
    icon: 'palette',
    fields: [
      'creativeInventorySummary',
      'brandGuidelines',
      'coreMessages',
      'proofPoints',
      'contentGaps',
      'productionScalability',
      'ugcPipelines',
    ],
  },
  {
    id: 'operational',
    name: 'Operational Constraints',
    description: 'Budget limits, restrictions, and team capacity',
    icon: 'settings',
    fields: [
      'budgetCapsFloors',
      'pacingRequirements',
      'channelRestrictions',
      'dataAvailability',
      'talentConstraints',
      'platformLimitations',
    ],
  },
  {
    id: 'budget',
    name: 'Budget',
    description: 'Total budget, allocation rules, and reserves',
    icon: 'dollar-sign',
    fields: [
      'totalBudgetMonthly',
      'totalBudgetQuarterly',
      'totalBudgetAnnual',
      'minBudget',
      'maxBudget',
      'brandVsPerformanceRules',
      'testingBudgetNotes',
      'creativeBudgetNotes',
      'reportingBudgetNotes',
    ],
  },
  {
    id: 'channels',
    name: 'Channel Universe',
    description: 'Required and disallowed media channels',
    icon: 'layers',
    fields: ['requiredChannels', 'disallowedChannels', 'notes'],
  },
  {
    id: 'storeLocation',
    name: 'Stores & Locations',
    description: 'Multi-location context and local factors',
    icon: 'map-pin',
    fields: [
      'isMultiLocation',
      'storeSummary',
      'tradeAreaNotes',
      'revenueDistribution',
      'capacityNotes',
      'localCompetitiveDensity',
      'localSeasonality',
    ],
  },
  {
    id: 'risk',
    name: 'Risk Appetite',
    description: 'Risk tolerance and testing comfort',
    icon: 'shield',
    fields: [
      'riskTolerance',
      'cacVolatilityTolerance',
      'growthAtBreakevenOk',
      'testingComfort',
    ],
  },
];

// ============================================================================
// Channel Metadata
// ============================================================================

export interface ChannelInfo {
  id: MediaChannelId;
  name: string;
  category: 'search' | 'local' | 'social' | 'display' | 'video' | 'audio' | 'other';
  description: string;
}

export const MEDIA_CHANNEL_INFO: ChannelInfo[] = [
  // Search
  { id: 'search_google', name: 'Google Search', category: 'search', description: 'Google Search ads' },
  { id: 'search_bing', name: 'Microsoft Search', category: 'search', description: 'Bing/Microsoft ads' },
  { id: 'shopping', name: 'Google Shopping', category: 'search', description: 'Shopping campaigns' },
  // Local
  { id: 'lsa', name: 'Local Services Ads', category: 'local', description: 'Google LSA' },
  { id: 'maps_gbp', name: 'Maps & GBP', category: 'local', description: 'Google Business Profile & Maps' },
  { id: 'local_seo', name: 'Local SEO', category: 'local', description: 'Local organic optimization' },
  // Social
  { id: 'social_meta', name: 'Meta Ads', category: 'social', description: 'Facebook & Instagram ads' },
  { id: 'social_tiktok', name: 'TikTok', category: 'social', description: 'TikTok ads' },
  { id: 'social_instagram', name: 'Instagram', category: 'social', description: 'Instagram-specific' },
  { id: 'social_linkedin', name: 'LinkedIn', category: 'social', description: 'LinkedIn ads' },
  { id: 'social_pinterest', name: 'Pinterest', category: 'social', description: 'Pinterest ads' },
  { id: 'social_x', name: 'X (Twitter)', category: 'social', description: 'X/Twitter ads' },
  // Display & Video
  { id: 'display', name: 'Display', category: 'display', description: 'Display network ads' },
  { id: 'retargeting', name: 'Retargeting', category: 'display', description: 'Retargeting campaigns' },
  { id: 'youtube', name: 'YouTube', category: 'video', description: 'YouTube video ads' },
  { id: 'programmatic_video', name: 'Programmatic Video', category: 'video', description: 'Programmatic video' },
  // Audio & TV
  { id: 'radio', name: 'Radio', category: 'audio', description: 'Traditional radio' },
  { id: 'streaming_audio', name: 'Streaming Audio', category: 'audio', description: 'Spotify, Pandora, etc.' },
  { id: 'ctv_ott', name: 'CTV/OTT', category: 'video', description: 'Connected TV & streaming' },
  // Other
  { id: 'out_of_home', name: 'Out of Home', category: 'other', description: 'Billboards, transit, etc.' },
  { id: 'influencers', name: 'Influencers', category: 'other', description: 'Influencer marketing' },
  { id: 'email_sms', name: 'Email & SMS', category: 'other', description: 'Direct messaging' },
  { id: 'organic_content', name: 'Organic Content', category: 'other', description: 'Organic social & content' },
  { id: 'partnerships', name: 'Partnerships', category: 'other', description: 'Partner marketing' },
  { id: 'pr', name: 'PR', category: 'other', description: 'Public relations' },
  { id: 'events', name: 'Events', category: 'other', description: 'Event marketing' },
  { id: 'in_store_media', name: 'In-Store Media', category: 'other', description: 'In-store displays & signage' },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create empty planning inputs
 */
export function createEmptyPlanningInputs(): MediaPlanningInputs {
  return {
    businessBrand: {},
    objectivesKpis: {},
    audience: {},
    productOffer: {},
    historical: {},
    digitalInfra: {},
    competitive: {},
    creativeContent: {},
    operational: {},
    budget: {},
    channels: {},
    storeLocation: {},
    risk: {},
  };
}

/**
 * Count filled fields in a category
 */
export function countFilledFields(
  inputs: MediaPlanningInputs | null | undefined,
  categoryId: string
): { filled: number; total: number } {
  const category = PLANNING_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) {
    return { filled: 0, total: 0 };
  }

  if (!inputs) {
    return { filled: 0, total: category.fields.length };
  }

  const categoryData = inputs[categoryId as keyof MediaPlanningInputs];
  if (!categoryData || typeof categoryData !== 'object') {
    return { filled: 0, total: category.fields.length };
  }

  let filled = 0;
  for (const field of category.fields) {
    const value = (categoryData as Record<string, unknown>)[field];
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        if (value.length > 0) filled++;
      } else {
        filled++;
      }
    }
  }

  return { filled, total: category.fields.length };
}

/**
 * Calculate overall completeness percentage
 */
export function calculateCompleteness(inputs: MediaPlanningInputs | null | undefined): number {
  if (!inputs) {
    return 0;
  }

  let totalFilled = 0;
  let totalFields = 0;

  for (const category of PLANNING_CATEGORIES) {
    const { filled, total } = countFilledFields(inputs, category.id);
    totalFilled += filled;
    totalFields += total;
  }

  return totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
}

/**
 * Get required fields that are missing
 */
export function getMissingRequiredFields(
  inputs: MediaPlanningInputs
): string[] {
  const required = [
    { category: 'objectivesKpis', field: 'primaryObjective' },
    { category: 'budget', field: 'totalBudgetMonthly' },
  ];

  const missing: string[] = [];

  for (const { category, field } of required) {
    const categoryData = inputs[category as keyof MediaPlanningInputs];
    if (!categoryData || typeof categoryData !== 'object') {
      missing.push(`${category}.${field}`);
      continue;
    }

    const value = (categoryData as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === '') {
      missing.push(`${category}.${field}`);
    }
  }

  return missing;
}

/**
 * Validate inputs are ready for AI generation
 */
export function validateForGeneration(
  inputs: MediaPlanningInputs | null | undefined
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!inputs) {
    errors.push('Inputs are required');
    return { valid: false, errors };
  }

  // Check primary objective
  if (!inputs.objectivesKpis?.primaryObjective) {
    errors.push('Primary objective is required');
  }

  // Check budget (at least one budget field)
  const hasBudget =
    inputs.budget?.totalBudgetMonthly ||
    inputs.budget?.totalBudgetQuarterly ||
    inputs.budget?.totalBudgetAnnual;
  if (!hasBudget) {
    errors.push('At least one budget value is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Field Labels
// ============================================================================

export const FIELD_LABELS: Record<string, string> = {
  // Business & Brand
  businessModel: 'Business Model',
  revenueModel: 'Revenue Model',
  profitCenters: 'Profit Centers',
  marketMaturity: 'Market Maturity',
  geographicFootprint: 'Geographic Footprint',
  seasonalityNotes: 'Seasonality Notes',
  competitiveLandscape: 'Competitive Landscape',
  positioning: 'Brand Positioning',
  valueProps: 'Value Propositions',
  differentiators: 'Differentiators',
  brandPerception: 'Brand Perception',

  // Objectives & KPIs
  primaryObjective: 'Primary Objective',
  secondaryObjectives: 'Secondary Objectives',
  primaryBusinessGoal: 'Business Goal',
  kpiLabels: 'KPI Labels',
  targetCpa: 'Target CPA',
  targetCpl: 'Target CPL',
  targetRoas: 'Target ROAS',
  targetMer: 'Target MER',
  targetCac: 'Target CAC',
  targetLtv: 'Target LTV',
  contributionMarginRequirement: 'Contribution Margin',
  timeHorizon: 'Time Horizon',

  // Audience
  coreSegments: 'Core Segments',
  demographics: 'Demographics',
  geos: 'Geographic Targets',
  behavioralDrivers: 'Behavioral Drivers',
  demandStates: 'Demand States',
  mediaHabits: 'Media Habits',
  culturalNuances: 'Cultural Nuances',
  languages: 'Languages',

  // Product & Offer
  productLines: 'Product Lines',
  heroProducts: 'Hero Products',
  pricingNotes: 'Pricing Notes',
  promoWindows: 'Promo Windows',
  marginTiers: 'Margin Tiers',
  inventoryConstraints: 'Inventory Constraints',

  // Historical
  pastSpendByChannelSummary: 'Past Spend by Channel',
  pastPerformanceSummary: 'Past Performance',
  channelContributionSummary: 'Channel Contribution',
  seasonalityOverlays: 'Seasonality Overlays',
  storeOrGeoPerformance: 'Store/Geo Performance',
  incrementalityNotes: 'Incrementality Notes',
  attributionModelHistory: 'Attribution History',

  // Digital Infra
  trackingStackSummary: 'Tracking Stack',
  ga4Health: 'GA4 Health',
  searchConsoleHealth: 'Search Console Health',
  gbpHealth: 'GBP Health',
  crmAndLeadFlow: 'CRM & Lead Flow',
  offlineConversionTracking: 'Offline Tracking',
  callTracking: 'Call Tracking',
  storeVisitMeasurement: 'Store Visit Measurement',
  measurementLimits: 'Measurement Limits',

  // Competitive
  shareOfVoice: 'Share of Voice',
  competitorMediaMix: 'Competitor Media Mix',
  competitorBudgets: 'Competitor Budgets',
  competitorSearchStrategy: 'Competitor Search Strategy',
  competitorCreativeThemes: 'Competitor Creative Themes',
  categoryBenchmarks: 'Category Benchmarks',

  // Creative
  creativeInventorySummary: 'Creative Inventory',
  brandGuidelines: 'Brand Guidelines',
  coreMessages: 'Core Messages',
  proofPoints: 'Proof Points',
  contentGaps: 'Content Gaps',
  productionScalability: 'Production Scalability',
  ugcPipelines: 'UGC Pipelines',

  // Operational
  budgetCapsFloors: 'Budget Caps & Floors',
  pacingRequirements: 'Pacing Requirements',
  channelRestrictions: 'Channel Restrictions',
  dataAvailability: 'Data Availability',
  talentConstraints: 'Talent Constraints',
  platformLimitations: 'Platform Limitations',

  // Budget
  totalBudgetMonthly: 'Monthly Budget',
  totalBudgetQuarterly: 'Quarterly Budget',
  totalBudgetAnnual: 'Annual Budget',
  minBudget: 'Minimum Budget',
  maxBudget: 'Maximum Budget',
  brandVsPerformanceRules: 'Brand vs Performance Rules',
  testingBudgetNotes: 'Testing Budget',
  creativeBudgetNotes: 'Creative Budget',
  reportingBudgetNotes: 'Reporting Budget',

  // Channels
  requiredChannels: 'Required Channels',
  disallowedChannels: 'Disallowed Channels',
  notes: 'Channel Notes',

  // Store/Location
  isMultiLocation: 'Multi-Location',
  storeSummary: 'Store Summary',
  tradeAreaNotes: 'Trade Area Notes',
  revenueDistribution: 'Revenue Distribution',
  capacityNotes: 'Capacity Notes',
  localCompetitiveDensity: 'Local Competition',
  localSeasonality: 'Local Seasonality',

  // Risk
  riskTolerance: 'Risk Tolerance',
  cacVolatilityTolerance: 'CAC Volatility Tolerance',
  growthAtBreakevenOk: 'Growth at Breakeven OK',
  testingComfort: 'Testing Comfort',
};

export const OBJECTIVE_LABELS: Record<PrimaryObjective, string> = {
  lead_generation: 'Lead Generation',
  sales_conversions: 'Sales & Conversions',
  traffic_growth: 'Traffic Growth',
  brand_awareness: 'Brand Awareness',
  engagement: 'Engagement',
  blended: 'Blended Goals',
};

export const MARKET_MATURITY_LABELS: Record<MarketMaturity, string> = {
  launch: 'Launch',
  growth: 'Growth',
  plateau: 'Plateau',
  turnaround: 'Turnaround',
  other: 'Other',
};

export const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  '30d': '30 Days',
  '90d': '90 Days',
  quarter: 'Quarter',
  year: 'Year',
  custom: 'Custom Range',
};
