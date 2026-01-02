// lib/os/planning/domainTemplates.ts
// Domain-level Program Templates for Bundle Instantiation
//
// These templates define the structure of Programs by domain:
// - Strategy, Creative, Media, LocalVisibility, Analytics, Operations
//
// Each domain has:
// - Intensity configurations (Core, Standard, Aggressive)
// - Allowed workstream types
// - Expected outputs with cadence
// - Success signals/KPIs
//
// IMPORTANT: No pricing or margin data. OS receives SCOPE, not PRICE.

import type {
  ProgramDomain,
  IntensityLevel,
  IntensityConfig,
  ProgramTemplate,
  ExpectedOutput,
  SuccessSignal,
  CadenceType,
  BundlePreset,
} from '@/lib/types/programTemplate';
import type { WorkstreamType } from '@/lib/types/program';
import { DOMAIN_WORKSTREAM_MAP } from '@/lib/types/programTemplate';

// ============================================================================
// Intensity Configurations (shared patterns)
// ============================================================================

const CORE_INTENSITY: IntensityConfig = {
  cadence: ['quarterly'],
  outputMultiplier: 0.6,
  experimentationBudget: 'none',
  analysisDepth: 'basic',
};

const STANDARD_INTENSITY: IntensityConfig = {
  cadence: ['monthly', 'quarterly'],
  outputMultiplier: 1.0,
  experimentationBudget: 'limited',
  analysisDepth: 'regular',
};

const AGGRESSIVE_INTENSITY: IntensityConfig = {
  cadence: ['weekly', 'monthly', 'quarterly'],
  outputMultiplier: 1.5,
  experimentationBudget: 'full',
  analysisDepth: 'deep',
};

// Helper to create intensity levels with domain-specific overrides
function createIntensityLevels(
  overrides?: Partial<Record<IntensityLevel, Partial<IntensityConfig>>>
): Record<IntensityLevel, IntensityConfig> {
  return {
    Core: { ...CORE_INTENSITY, ...overrides?.Core },
    Standard: { ...STANDARD_INTENSITY, ...overrides?.Standard },
    Aggressive: { ...AGGRESSIVE_INTENSITY, ...overrides?.Aggressive },
  };
}

// ============================================================================
// Strategy Domain Template
// ============================================================================

const STRATEGY_OUTPUTS: ExpectedOutput[] = [
  {
    id: 'strategy-qbr-narrative',
    name: 'QBR Narrative',
    description: 'Quarterly business review narrative summarizing performance and strategy',
    workstreamType: 'ops',
    cadence: 'quarterly',
    deliverableType: 'document',
  },
  {
    id: 'strategy-monthly-summary',
    name: 'Monthly Performance Summary',
    description: 'Monthly summary of key metrics and strategic progress',
    workstreamType: 'analytics',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'strategy-optimization-decisions',
    name: 'Optimization Decisions',
    description: 'Documented decisions on budget shifts, channel changes, or strategy pivots',
    workstreamType: 'ops',
    cadence: 'monthly',
    deliverableType: 'document',
  },
];

const STRATEGY_SIGNALS: SuccessSignal[] = [
  {
    id: 'strategy-adoption',
    metric: 'Strategy Adoption Rate',
    description: 'Percentage of tactics being actively executed',
    targetDirection: 'increase',
    measurementFrequency: 'quarterly',
  },
  {
    id: 'strategy-performance-shift',
    metric: 'Downstream Performance Shift',
    description: 'Movement in primary KPIs after strategy changes',
    targetDirection: 'increase',
    measurementFrequency: 'quarterly',
  },
];

const STRATEGY_TEMPLATE: ProgramTemplate = {
  id: 'domain-strategy',
  name: 'Strategy Program',
  domain: 'Strategy',
  description: 'Strategic planning, QBR preparation, and performance analysis',
  intensityLevels: createIntensityLevels({
    Core: { cadence: ['quarterly'] },
    Standard: { cadence: ['monthly', 'quarterly'] },
    Aggressive: { cadence: ['monthly', 'quarterly'], analysisDepth: 'deep' },
  }),
  allowedWorkTypes: DOMAIN_WORKSTREAM_MAP.Strategy,
  maxConcurrentWork: { Core: 2, Standard: 4, Aggressive: 6 },
  expectedOutputs: STRATEGY_OUTPUTS,
  successSignals: STRATEGY_SIGNALS,
};

// ============================================================================
// Creative Domain Template
// ============================================================================

const CREATIVE_OUTPUTS: ExpectedOutput[] = [
  {
    id: 'creative-assets',
    name: 'Creative Assets',
    description: 'Campaign creative assets (ads, banners, social graphics)',
    workstreamType: 'content',
    cadence: 'weekly',
    scaledByCadence: true,
    deliverableType: 'asset',
  },
  {
    id: 'creative-variations',
    name: 'Creative Variations',
    description: 'A/B test variations and creative experiments',
    workstreamType: 'content',
    cadence: 'monthly',
    deliverableType: 'asset',
  },
  {
    id: 'creative-testing-report',
    name: 'Testing Insights Report',
    description: 'Summary of creative performance and learnings',
    workstreamType: 'brand',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'creative-brand-refresh',
    name: 'Brand Refresh Assets',
    description: 'Quarterly brand asset updates and refreshes',
    workstreamType: 'brand',
    cadence: 'quarterly',
    deliverableType: 'asset',
  },
];

const CREATIVE_SIGNALS: SuccessSignal[] = [
  {
    id: 'creative-ctr',
    metric: 'Click-Through Rate',
    description: 'Engagement with creative assets',
    targetDirection: 'increase',
    measurementFrequency: 'weekly',
  },
  {
    id: 'creative-brand-consistency',
    metric: 'Brand Consistency Score',
    description: 'Adherence to brand guidelines across assets',
    targetDirection: 'maintain',
    measurementFrequency: 'monthly',
  },
  {
    id: 'creative-test-wins',
    metric: 'Test Win Rate',
    description: 'Percentage of creative tests that outperform control',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
];

const CREATIVE_TEMPLATE: ProgramTemplate = {
  id: 'domain-creative',
  name: 'Creative Program',
  domain: 'Creative',
  description: 'Creative asset production, variations, and testing insights',
  intensityLevels: createIntensityLevels({
    Core: { cadence: ['monthly'], outputMultiplier: 0.5 },
    Standard: { cadence: ['weekly', 'monthly'] },
    Aggressive: { cadence: ['weekly', 'monthly'], outputMultiplier: 2.0 },
  }),
  allowedWorkTypes: DOMAIN_WORKSTREAM_MAP.Creative,
  maxConcurrentWork: { Core: 3, Standard: 6, Aggressive: 10 },
  expectedOutputs: CREATIVE_OUTPUTS,
  successSignals: CREATIVE_SIGNALS,
};

// ============================================================================
// Media Domain Template
// ============================================================================

const MEDIA_OUTPUTS: ExpectedOutput[] = [
  {
    id: 'media-weekly-optimization',
    name: 'Weekly Optimization',
    description: 'Bid adjustments, budget shifts, and audience updates',
    workstreamType: 'paid_media',
    cadence: 'weekly',
    deliverableType: 'process',
  },
  {
    id: 'media-campaign-report',
    name: 'Campaign Performance Report',
    description: 'Monthly deep-dive into campaign performance and learnings',
    workstreamType: 'paid_media',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'media-channel-analysis',
    name: 'Channel Mix Analysis',
    description: 'Quarterly review of channel performance and budget allocation',
    workstreamType: 'paid_media',
    cadence: 'quarterly',
    deliverableType: 'document',
  },
  {
    id: 'media-experiment',
    name: 'Media Experiments',
    description: 'New channel or audience tests',
    workstreamType: 'paid_media',
    cadence: 'monthly',
    deliverableType: 'campaign',
  },
];

const MEDIA_SIGNALS: SuccessSignal[] = [
  {
    id: 'media-roas',
    metric: 'Return on Ad Spend (ROAS)',
    description: 'Revenue generated per dollar spent',
    targetDirection: 'increase',
    measurementFrequency: 'weekly',
  },
  {
    id: 'media-cpa',
    metric: 'Cost Per Acquisition (CPA)',
    description: 'Cost to acquire a customer or lead',
    targetDirection: 'decrease',
    measurementFrequency: 'weekly',
  },
  {
    id: 'media-impression-share',
    metric: 'Impression Share',
    description: 'Percentage of available impressions captured',
    targetDirection: 'increase',
    measurementFrequency: 'weekly',
  },
];

const MEDIA_TEMPLATE: ProgramTemplate = {
  id: 'domain-media',
  name: 'Media Program',
  domain: 'Media',
  description: 'Media optimization, budget shifts, and channel learnings',
  intensityLevels: createIntensityLevels({
    Core: { cadence: ['monthly'], experimentationBudget: 'none' },
    Standard: { cadence: ['weekly', 'monthly'] },
    Aggressive: { cadence: ['weekly', 'monthly'], experimentationBudget: 'full' },
  }),
  allowedWorkTypes: DOMAIN_WORKSTREAM_MAP.Media,
  maxConcurrentWork: { Core: 2, Standard: 4, Aggressive: 8 },
  expectedOutputs: MEDIA_OUTPUTS,
  successSignals: MEDIA_SIGNALS,
};

// ============================================================================
// LocalVisibility Domain Template
// ============================================================================

const LOCAL_VISIBILITY_OUTPUTS: ExpectedOutput[] = [
  {
    id: 'local-gbp-updates',
    name: 'GBP Updates',
    description: 'Google Business Profile posts, photos, and updates',
    workstreamType: 'seo',
    cadence: 'weekly',
    scaledByCadence: true,
    deliverableType: 'process',
  },
  {
    id: 'local-review-response',
    name: 'Review Response',
    description: 'Responses to customer reviews across platforms',
    workstreamType: 'seo',
    cadence: 'weekly',
    deliverableType: 'process',
  },
  {
    id: 'local-citation-audit',
    name: 'Citation Audit & Cleanup',
    description: 'Monthly audit and correction of local citations',
    workstreamType: 'seo',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'local-performance-report',
    name: 'Local Performance Report',
    description: 'Monthly report on local visibility metrics',
    workstreamType: 'seo',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'local-partnership-outreach',
    name: 'Partnership Outreach',
    description: 'Local partnership and community engagement',
    workstreamType: 'partnerships',
    cadence: 'monthly',
    deliverableType: 'process',
  },
];

const LOCAL_VISIBILITY_SIGNALS: SuccessSignal[] = [
  {
    id: 'local-gbp-views',
    metric: 'GBP Profile Views',
    description: 'Views of Google Business Profile',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
  {
    id: 'local-review-rating',
    metric: 'Average Review Rating',
    description: 'Average star rating across review platforms',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
  {
    id: 'local-review-volume',
    metric: 'Review Volume',
    description: 'Number of new reviews per month',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
  {
    id: 'local-direction-requests',
    metric: 'Direction Requests',
    description: 'Number of direction/routing requests from GBP',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
];

const LOCAL_VISIBILITY_TEMPLATE: ProgramTemplate = {
  id: 'domain-local-visibility',
  name: 'Local Visibility Program',
  domain: 'LocalVisibility',
  description: 'GBP updates, local visibility improvements, and engagement',
  intensityLevels: createIntensityLevels({
    Core: { cadence: ['monthly'], outputMultiplier: 0.5 },
    Standard: { cadence: ['weekly', 'monthly'] },
    Aggressive: { cadence: ['weekly', 'monthly'], outputMultiplier: 1.5 },
  }),
  allowedWorkTypes: DOMAIN_WORKSTREAM_MAP.LocalVisibility,
  maxConcurrentWork: { Core: 2, Standard: 4, Aggressive: 6 },
  expectedOutputs: LOCAL_VISIBILITY_OUTPUTS,
  successSignals: LOCAL_VISIBILITY_SIGNALS,
};

// ============================================================================
// Analytics Domain Template
// ============================================================================

const ANALYTICS_OUTPUTS: ExpectedOutput[] = [
  {
    id: 'analytics-weekly-pulse',
    name: 'Weekly Pulse Report',
    description: 'Key metrics snapshot and anomaly detection',
    workstreamType: 'analytics',
    cadence: 'weekly',
    deliverableType: 'document',
  },
  {
    id: 'analytics-dashboard-updates',
    name: 'Dashboard Updates',
    description: 'Dashboard maintenance and metric additions',
    workstreamType: 'analytics',
    cadence: 'monthly',
    deliverableType: 'integration',
  },
  {
    id: 'analytics-attribution-review',
    name: 'Attribution Review',
    description: 'Monthly review of attribution models and data quality',
    workstreamType: 'analytics',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'analytics-quarterly-deep-dive',
    name: 'Quarterly Analytics Deep Dive',
    description: 'Comprehensive analysis and insights report',
    workstreamType: 'analytics',
    cadence: 'quarterly',
    deliverableType: 'document',
  },
];

const ANALYTICS_SIGNALS: SuccessSignal[] = [
  {
    id: 'analytics-data-quality',
    metric: 'Data Quality Score',
    description: 'Percentage of clean, complete data in dashboards',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
  {
    id: 'analytics-insight-adoption',
    metric: 'Insight Adoption Rate',
    description: 'Percentage of insights acted upon',
    targetDirection: 'increase',
    measurementFrequency: 'quarterly',
  },
  {
    id: 'analytics-anomaly-detection',
    metric: 'Anomaly Detection Rate',
    description: 'Percentage of anomalies caught before impact',
    targetDirection: 'increase',
    measurementFrequency: 'monthly',
  },
];

const ANALYTICS_TEMPLATE: ProgramTemplate = {
  id: 'domain-analytics',
  name: 'Analytics Program',
  domain: 'Analytics',
  description: 'Dashboards, attribution insights, and signal quality',
  intensityLevels: createIntensityLevels({
    Core: { cadence: ['monthly', 'quarterly'], analysisDepth: 'basic' },
    Standard: { cadence: ['weekly', 'monthly', 'quarterly'] },
    Aggressive: { cadence: ['weekly', 'monthly', 'quarterly'], analysisDepth: 'deep' },
  }),
  allowedWorkTypes: DOMAIN_WORKSTREAM_MAP.Analytics,
  maxConcurrentWork: { Core: 1, Standard: 3, Aggressive: 5 },
  expectedOutputs: ANALYTICS_OUTPUTS,
  successSignals: ANALYTICS_SIGNALS,
};

// ============================================================================
// Operations Domain Template
// ============================================================================

const OPERATIONS_OUTPUTS: ExpectedOutput[] = [
  {
    id: 'ops-weekly-status',
    name: 'Weekly Status Update',
    description: 'Team status, blockers, and upcoming priorities',
    workstreamType: 'ops',
    cadence: 'weekly',
    deliverableType: 'document',
  },
  {
    id: 'ops-process-documentation',
    name: 'Process Documentation',
    description: 'Updated SOPs and workflow documentation',
    workstreamType: 'ops',
    cadence: 'monthly',
    deliverableType: 'document',
  },
  {
    id: 'ops-qbr-preparation',
    name: 'QBR Preparation',
    description: 'Quarterly business review slides and materials',
    workstreamType: 'ops',
    cadence: 'quarterly',
    deliverableType: 'document',
  },
  {
    id: 'ops-stakeholder-alignment',
    name: 'Stakeholder Alignment',
    description: 'Monthly stakeholder check-ins and alignment sessions',
    workstreamType: 'ops',
    cadence: 'monthly',
    deliverableType: 'process',
  },
];

const OPERATIONS_SIGNALS: SuccessSignal[] = [
  {
    id: 'ops-on-time-delivery',
    metric: 'On-Time Delivery Rate',
    description: 'Percentage of deliverables completed on schedule',
    targetDirection: 'increase',
    measurementFrequency: 'weekly',
  },
  {
    id: 'ops-blocker-resolution',
    metric: 'Blocker Resolution Time',
    description: 'Average time to resolve blockers',
    targetDirection: 'decrease',
    measurementFrequency: 'weekly',
  },
  {
    id: 'ops-stakeholder-satisfaction',
    metric: 'Stakeholder Satisfaction',
    description: 'Quarterly satisfaction score from stakeholders',
    targetDirection: 'increase',
    measurementFrequency: 'quarterly',
  },
];

const OPERATIONS_TEMPLATE: ProgramTemplate = {
  id: 'domain-operations',
  name: 'Operations Program',
  domain: 'Operations',
  description: 'Status updates, QBR narratives, and stakeholder alignment',
  intensityLevels: createIntensityLevels({
    Core: { cadence: ['monthly', 'quarterly'] },
    Standard: { cadence: ['weekly', 'monthly', 'quarterly'] },
    Aggressive: { cadence: ['weekly', 'monthly', 'quarterly'] },
  }),
  allowedWorkTypes: DOMAIN_WORKSTREAM_MAP.Operations,
  maxConcurrentWork: { Core: 2, Standard: 4, Aggressive: 6 },
  expectedOutputs: OPERATIONS_OUTPUTS,
  successSignals: OPERATIONS_SIGNALS,
};

// ============================================================================
// Domain Templates Export
// ============================================================================

/**
 * All domain templates indexed by domain
 */
export const DOMAIN_TEMPLATES: Record<ProgramDomain, ProgramTemplate> = {
  Strategy: STRATEGY_TEMPLATE,
  Creative: CREATIVE_TEMPLATE,
  Media: MEDIA_TEMPLATE,
  LocalVisibility: LOCAL_VISIBILITY_TEMPLATE,
  Analytics: ANALYTICS_TEMPLATE,
  Operations: OPERATIONS_TEMPLATE,
};

/**
 * Get template for a domain
 */
export function getDomainTemplate(domain: ProgramDomain): ProgramTemplate {
  return DOMAIN_TEMPLATES[domain];
}

/**
 * Get intensity config for a domain and intensity level
 */
export function getIntensityConfig(
  domain: ProgramDomain,
  intensity: IntensityLevel
): IntensityConfig {
  const template = DOMAIN_TEMPLATES[domain];
  const config = template.intensityLevels[intensity];
  if (!config) {
    throw new Error(`No intensity config found for domain=${domain}, intensity=${intensity}`);
  }
  return config;
}

/**
 * Get max concurrent work for a domain and intensity level
 */
export function getMaxConcurrentWork(
  domain: ProgramDomain,
  intensity: IntensityLevel
): number {
  const template = DOMAIN_TEMPLATES[domain];
  const maxWork = template.maxConcurrentWork[intensity];
  if (maxWork === undefined) {
    throw new Error(`No max concurrent work found for domain=${domain}, intensity=${intensity}`);
  }
  return maxWork;
}

/**
 * Get expected outputs for a domain filtered by cadence
 */
export function getExpectedOutputs(
  domain: ProgramDomain,
  cadences?: CadenceType[]
): ExpectedOutput[] {
  const template = DOMAIN_TEMPLATES[domain];
  if (!cadences || cadences.length === 0) {
    return template.expectedOutputs;
  }
  return template.expectedOutputs.filter((output) =>
    cadences.includes(output.cadence)
  );
}

/**
 * Get allowed workstreams for a domain
 */
export function getAllowedWorkstreams(domain: ProgramDomain): WorkstreamType[] {
  return DOMAIN_TEMPLATES[domain].allowedWorkTypes as WorkstreamType[];
}

/**
 * Check if a workstream is allowed for a domain
 */
export function isWorkstreamAllowed(
  domain: ProgramDomain,
  workstream: WorkstreamType
): boolean {
  return (DOMAIN_TEMPLATES[domain].allowedWorkTypes as WorkstreamType[]).includes(
    workstream
  );
}

// ============================================================================
// Bundle Helpers
// ============================================================================

/**
 * Standard bundle domains (Local Demand Engine example)
 */
export const LOCAL_DEMAND_ENGINE_DOMAINS: ProgramDomain[] = [
  'Strategy',
  'Creative',
  'Media',
  'LocalVisibility',
  'Analytics',
  'Operations',
];

/**
 * Get all domains for a bundle type
 */
export function getBundleDomains(bundleType: string): ProgramDomain[] {
  // For now, all bundles use all domains
  // This can be extended for different bundle configurations
  switch (bundleType) {
    case 'local-demand-engine':
      return LOCAL_DEMAND_ENGINE_DOMAINS;
    case 'digital-foundation':
      return ['Strategy', 'Creative', 'Analytics', 'Operations'];
    case 'media-accelerator':
      return ['Strategy', 'Media', 'Analytics', 'Operations'];
    default:
      return LOCAL_DEMAND_ENGINE_DOMAINS;
  }
}

/**
 * Calculate output count for an intensity level
 * Core = 60%, Standard = 100%, Aggressive = 150%
 */
export function calculateOutputCount(
  baseCount: number,
  intensity: IntensityLevel
): number {
  const template = STRATEGY_TEMPLATE; // Use any template for multiplier
  const config = template.intensityLevels[intensity];
  const multiplier = config?.outputMultiplier ?? 1.0;
  return Math.ceil(baseCount * multiplier);
}

// ============================================================================
// Bundle Presets
// ============================================================================

/**
 * All 6 domains - the full Local Demand Engine
 */
const ALL_DOMAINS: ProgramDomain[] = [
  'Strategy',
  'Creative',
  'Media',
  'LocalVisibility',
  'Analytics',
  'Operations',
];

/**
 * Bundle presets for quick instantiation
 */
export const BUNDLE_PRESETS: BundlePreset[] = [
  // ---- Car Toys Preset ----
  {
    id: 'car-toys-local-demand-engine-standard',
    name: 'Car Toys — Local Demand Engine (Standard)',
    description: 'Full 6-domain Local Demand Engine for Car Toys with standard intensity',
    domains: ALL_DOMAINS,
    defaultIntensity: 'Standard',
    enabled: true,
    targetClient: 'Car Toys',
    sortOrder: 1,
  },

  // ---- Generic Local Demand Engine Presets ----
  {
    id: 'local-demand-engine-core',
    name: 'Local Demand Engine (Core)',
    description: 'Full 6-domain coverage with reduced cadence and minimal experimentation',
    domains: ALL_DOMAINS,
    defaultIntensity: 'Core',
    enabled: true,
    sortOrder: 10,
  },
  {
    id: 'local-demand-engine-standard',
    name: 'Local Demand Engine (Standard)',
    description: 'Full 6-domain coverage with regular optimization and continuous learning',
    domains: ALL_DOMAINS,
    defaultIntensity: 'Standard',
    enabled: true,
    sortOrder: 11,
  },
  {
    id: 'local-demand-engine-aggressive',
    name: 'Local Demand Engine (Aggressive)',
    description: 'Full 6-domain coverage with increased frequency and deep analysis',
    domains: ALL_DOMAINS,
    defaultIntensity: 'Aggressive',
    enabled: true,
    sortOrder: 12,
  },

  // ---- Specialized Bundles ----
  {
    id: 'digital-foundation-standard',
    name: 'Digital Foundation (Standard)',
    description: 'Strategy, Creative, Analytics, and Operations for digital-first brands',
    domains: ['Strategy', 'Creative', 'Analytics', 'Operations'],
    defaultIntensity: 'Standard',
    enabled: true,
    sortOrder: 20,
  },
  {
    id: 'media-accelerator-standard',
    name: 'Media Accelerator (Standard)',
    description: 'Strategy, Media, Analytics, and Operations for performance marketing focus',
    domains: ['Strategy', 'Media', 'Analytics', 'Operations'],
    defaultIntensity: 'Standard',
    enabled: true,
    sortOrder: 21,
  },
  {
    id: 'local-visibility-starter',
    name: 'Local Visibility Starter (Core)',
    description: 'LocalVisibility, Analytics, and Operations for local businesses',
    domains: ['LocalVisibility', 'Analytics', 'Operations'],
    defaultIntensity: 'Core',
    enabled: true,
    sortOrder: 22,
  },
];

/**
 * Get all enabled bundle presets
 */
export function getEnabledBundlePresets(): BundlePreset[] {
  return BUNDLE_PRESETS.filter((p) => p.enabled).sort(
    (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100)
  );
}

/**
 * Get a bundle preset by ID
 */
export function getBundlePresetById(id: string): BundlePreset | undefined {
  return BUNDLE_PRESETS.find((p) => p.id === id);
}

/**
 * Get bundle presets for a specific client
 */
export function getBundlePresetsForClient(clientName: string): BundlePreset[] {
  return BUNDLE_PRESETS.filter(
    (p) => p.enabled && p.targetClient?.toLowerCase() === clientName.toLowerCase()
  );
}

/**
 * Check if a preset ID is valid
 */
export function isValidBundlePreset(id: string): boolean {
  return BUNDLE_PRESETS.some((p) => p.id === id);
}
