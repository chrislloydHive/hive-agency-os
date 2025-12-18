// lib/contextGraph/setupSchema.ts
// Shared Schema Mapping between Setup Wizard and Context Graph
//
// This file defines the canonical mapping between Setup form fields
// and Context Graph paths. Both Setup and Strategic Plan should use
// this mapping to ensure consistency.

import type { SetupStepId } from '@/app/c/[companyId]/brain/setup/types';
import type { DomainName } from './companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Field type for value handling
 */
export type SetupFieldType = 'string' | 'string[]' | 'number' | 'boolean';

/**
 * Binding between a Setup form field and a Context Graph path
 */
export interface SetupFieldBinding {
  /** Setup step ID (e.g., 'business-identity', 'objectives') */
  setupStepId: SetupStepId;
  /** Field key within the step's form data (e.g., 'businessModel', 'revenueStreams') */
  setupFieldId: string;
  /** Full Context Graph path (e.g., 'identity.businessModel') */
  contextPath: string;
  /** Context Graph domain (derived from contextPath) */
  domain: DomainName;
  /** Field name within the domain (derived from contextPath) */
  field: string;
  /** Data type for proper handling */
  type: SetupFieldType;
  /** Human-readable label for display */
  label: string;
  /** Whether this field is required for step completion */
  required?: boolean;
}

/**
 * Context node with provenance info for display
 */
export interface ContextNodeInfo {
  value: unknown;
  source: string | null;
  sourceName: string | null;
  confidence: number;
  updatedAt: string | null;
  isHumanOverride: boolean;
}

// ============================================================================
// Field Bindings by Step
// ============================================================================

/**
 * Business Identity step field bindings
 */
export const IDENTITY_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'business-identity',
    setupFieldId: 'businessName',
    contextPath: 'identity.businessName',
    domain: 'identity',
    field: 'businessName',
    type: 'string',
    label: 'Business Name',
    required: true,
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'icpDescription',
    contextPath: 'audience.icpDescription',
    domain: 'audience',
    field: 'icpDescription',
    type: 'string',
    label: 'ICP Description',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'industry',
    contextPath: 'identity.industry',
    domain: 'identity',
    field: 'industry',
    type: 'string',
    label: 'Industry',
    required: true,
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'businessModel',
    contextPath: 'identity.businessModel',
    domain: 'identity',
    field: 'businessModel',
    type: 'string',
    label: 'Business Model',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'revenueModel',
    contextPath: 'identity.revenueModel',
    domain: 'identity',
    field: 'revenueModel',
    type: 'string',
    label: 'Revenue Model',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'geographicFootprint',
    contextPath: 'identity.geographicFootprint',
    domain: 'identity',
    field: 'geographicFootprint',
    type: 'string',
    label: 'Geographic Footprint',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'serviceArea',
    contextPath: 'identity.serviceArea',
    domain: 'identity',
    field: 'serviceArea',
    type: 'string',
    label: 'Service Area',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'seasonalityNotes',
    contextPath: 'identity.seasonalityNotes',
    domain: 'identity',
    field: 'seasonalityNotes',
    type: 'string',
    label: 'Seasonality Notes',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'peakSeasons',
    contextPath: 'identity.peakSeasons',
    domain: 'identity',
    field: 'peakSeasons',
    type: 'string[]',
    label: 'Peak Seasons',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'revenueStreams',
    contextPath: 'identity.revenueStreams',
    domain: 'identity',
    field: 'revenueStreams',
    type: 'string[]',
    label: 'Revenue Streams',
  },
  {
    setupStepId: 'business-identity',
    setupFieldId: 'primaryCompetitors',
    contextPath: 'identity.primaryCompetitors',
    domain: 'identity',
    field: 'primaryCompetitors',
    type: 'string[]',
    label: 'Primary Competitors',
  },
];

/**
 * Objectives step field bindings
 */
export const OBJECTIVES_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'objectives',
    setupFieldId: 'primaryObjective',
    contextPath: 'objectives.primaryObjective',
    domain: 'objectives',
    field: 'primaryObjective',
    type: 'string',
    label: 'Primary Objective',
    required: true,
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'secondaryObjectives',
    contextPath: 'objectives.secondaryObjectives',
    domain: 'objectives',
    field: 'secondaryObjectives',
    type: 'string[]',
    label: 'Secondary Objectives',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'primaryBusinessGoal',
    contextPath: 'objectives.primaryBusinessGoal',
    domain: 'objectives',
    field: 'primaryBusinessGoal',
    type: 'string',
    label: 'Primary Business Goal',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'timeHorizon',
    contextPath: 'objectives.timeHorizon',
    domain: 'objectives',
    field: 'timeHorizon',
    type: 'string',
    label: 'Time Horizon',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'targetCpa',
    contextPath: 'objectives.targetCpa',
    domain: 'objectives',
    field: 'targetCpa',
    type: 'number',
    label: 'Target CPA',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'targetRoas',
    contextPath: 'objectives.targetRoas',
    domain: 'objectives',
    field: 'targetRoas',
    type: 'number',
    label: 'Target ROAS',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'revenueGoal',
    contextPath: 'objectives.revenueGoal',
    domain: 'objectives',
    field: 'revenueGoal',
    type: 'number',
    label: 'Revenue Goal',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'leadGoal',
    contextPath: 'objectives.leadGoal',
    domain: 'objectives',
    field: 'leadGoal',
    type: 'number',
    label: 'Lead Goal',
  },
  {
    setupStepId: 'objectives',
    setupFieldId: 'kpiLabels',
    contextPath: 'objectives.kpiLabels',
    domain: 'objectives',
    field: 'kpiLabels',
    type: 'string[]',
    label: 'KPI Labels',
  },
];

/**
 * Audience step field bindings
 *
 * NOTE: The ICP fields (primaryAudience, primaryBuyerRoles, companyProfile)
 * are the canonical source of truth and should be filled first. Other fields
 * like coreSegments are derived/supporting data.
 */
export const AUDIENCE_BINDINGS: SetupFieldBinding[] = [
  // ============================================================================
  // Canonical ICP Fields - These are the PRIMARY constraint for Labs
  // ============================================================================
  {
    setupStepId: 'audience',
    setupFieldId: 'primaryAudience',
    contextPath: 'audience.primaryAudience',
    domain: 'audience',
    field: 'primaryAudience',
    type: 'string',
    label: 'Primary Audience',
    required: true,
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'primaryBuyerRoles',
    contextPath: 'audience.primaryBuyerRoles',
    domain: 'audience',
    field: 'primaryBuyerRoles',
    type: 'string[]',
    label: 'Primary Buyer Roles',
  },
  // Note: companyProfile is handled as an object, not individual fields
  // It will be written via a custom handler in the form
  // ============================================================================
  // Supporting Audience Fields
  // ============================================================================
  {
    setupStepId: 'audience',
    setupFieldId: 'coreSegments',
    contextPath: 'audience.coreSegments',
    domain: 'audience',
    field: 'coreSegments',
    type: 'string[]',
    label: 'Core Segments',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'demographics',
    contextPath: 'audience.demographics',
    domain: 'audience',
    field: 'demographics',
    type: 'string',
    label: 'Demographics',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'geos',
    contextPath: 'audience.geos',
    domain: 'audience',
    field: 'geos',
    type: 'string',
    label: 'Geographic Focus',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'primaryMarkets',
    contextPath: 'audience.primaryMarkets',
    domain: 'audience',
    field: 'primaryMarkets',
    type: 'string[]',
    label: 'Primary Markets',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'behavioralDrivers',
    contextPath: 'audience.behavioralDrivers',
    domain: 'audience',
    field: 'behavioralDrivers',
    type: 'string[]',
    label: 'Behavioral Drivers',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'demandStates',
    contextPath: 'audience.demandStates',
    domain: 'audience',
    field: 'demandStates',
    type: 'string[]',
    label: 'Demand States',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'painPoints',
    contextPath: 'audience.painPoints',
    domain: 'audience',
    field: 'painPoints',
    type: 'string[]',
    label: 'Pain Points',
  },
  {
    setupStepId: 'audience',
    setupFieldId: 'motivations',
    contextPath: 'audience.motivations',
    domain: 'audience',
    field: 'motivations',
    type: 'string[]',
    label: 'Motivations',
  },
];

/**
 * Personas step field bindings
 * Note: Personas are handled separately via PersonaSet integration
 */
export const PERSONAS_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'personas',
    setupFieldId: 'personaCount',
    contextPath: 'audience.personaNames',
    domain: 'audience',
    field: 'personaNames',
    type: 'string[]',
    label: 'Persona Names',
  },
];

/**
 * Website step field bindings
 */
export const WEBSITE_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'website',
    setupFieldId: 'websiteSummary',
    contextPath: 'website.websiteSummary',
    domain: 'website',
    field: 'websiteSummary',
    type: 'string',
    label: 'Website Summary',
  },
  {
    setupStepId: 'website',
    setupFieldId: 'conversionBlocks',
    contextPath: 'website.conversionBlocks',
    domain: 'website',
    field: 'conversionBlocks',
    type: 'string[]',
    label: 'Conversion Blocks',
  },
  {
    setupStepId: 'website',
    setupFieldId: 'conversionOpportunities',
    contextPath: 'website.conversionOpportunities',
    domain: 'website',
    field: 'conversionOpportunities',
    type: 'string[]',
    label: 'Conversion Opportunities',
  },
  {
    setupStepId: 'website',
    setupFieldId: 'criticalIssues',
    contextPath: 'website.criticalIssues',
    domain: 'website',
    field: 'criticalIssues',
    type: 'string[]',
    label: 'Critical Issues',
  },
  {
    setupStepId: 'website',
    setupFieldId: 'quickWins',
    contextPath: 'website.quickWins',
    domain: 'website',
    field: 'quickWins',
    type: 'string[]',
    label: 'Quick Wins',
  },
];

/**
 * Media Foundations step field bindings
 */
export const MEDIA_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'media-foundations',
    setupFieldId: 'mediaSummary',
    contextPath: 'performanceMedia.mediaSummary',
    domain: 'performanceMedia',
    field: 'mediaSummary',
    type: 'string',
    label: 'Media Summary',
  },
  {
    setupStepId: 'media-foundations',
    setupFieldId: 'activeChannels',
    contextPath: 'performanceMedia.activeChannels',
    domain: 'performanceMedia',
    field: 'activeChannels',
    type: 'string[]',
    label: 'Active Channels',
  },
  {
    setupStepId: 'media-foundations',
    setupFieldId: 'attributionModel',
    contextPath: 'performanceMedia.attributionModel',
    domain: 'performanceMedia',
    field: 'attributionModel',
    type: 'string',
    label: 'Attribution Model',
  },
  {
    setupStepId: 'media-foundations',
    setupFieldId: 'mediaIssues',
    contextPath: 'performanceMedia.mediaIssues',
    domain: 'performanceMedia',
    field: 'mediaIssues',
    type: 'string[]',
    label: 'Media Issues',
  },
  {
    setupStepId: 'media-foundations',
    setupFieldId: 'mediaOpportunities',
    contextPath: 'performanceMedia.mediaOpportunities',
    domain: 'performanceMedia',
    field: 'mediaOpportunities',
    type: 'string[]',
    label: 'Media Opportunities',
  },
];

/**
 * Budget & Scenarios step field bindings
 */
export const BUDGET_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'budget-scenarios',
    setupFieldId: 'totalMarketingBudget',
    contextPath: 'budgetOps.totalMarketingBudget',
    domain: 'budgetOps',
    field: 'totalMarketingBudget',
    type: 'number',
    label: 'Total Marketing Budget',
  },
  {
    setupStepId: 'budget-scenarios',
    setupFieldId: 'mediaSpendBudget',
    contextPath: 'budgetOps.mediaSpendBudget',
    domain: 'budgetOps',
    field: 'mediaSpendBudget',
    type: 'number',
    label: 'Media Spend Budget',
  },
  {
    setupStepId: 'budget-scenarios',
    setupFieldId: 'budgetPeriod',
    contextPath: 'budgetOps.budgetPeriod',
    domain: 'budgetOps',
    field: 'budgetPeriod',
    type: 'string',
    label: 'Budget Period',
  },
  {
    setupStepId: 'budget-scenarios',
    setupFieldId: 'avgCustomerValue',
    contextPath: 'budgetOps.avgCustomerValue',
    domain: 'budgetOps',
    field: 'avgCustomerValue',
    type: 'number',
    label: 'Average Customer Value',
  },
  {
    setupStepId: 'budget-scenarios',
    setupFieldId: 'customerLTV',
    contextPath: 'budgetOps.customerLTV',
    domain: 'budgetOps',
    field: 'customerLTV',
    type: 'number',
    label: 'Customer LTV',
  },
];

/**
 * Creative Strategy step field bindings
 */
export const CREATIVE_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'creative-strategy',
    setupFieldId: 'coreMessages',
    contextPath: 'creative.coreMessages',
    domain: 'creative',
    field: 'coreMessages',
    type: 'string[]',
    label: 'Core Messages',
  },
  {
    setupStepId: 'creative-strategy',
    setupFieldId: 'proofPoints',
    contextPath: 'creative.proofPoints',
    domain: 'creative',
    field: 'proofPoints',
    type: 'string[]',
    label: 'Proof Points',
  },
  {
    setupStepId: 'creative-strategy',
    setupFieldId: 'callToActions',
    contextPath: 'creative.callToActions',
    domain: 'creative',
    field: 'callToActions',
    type: 'string[]',
    label: 'Call to Actions',
  },
  {
    setupStepId: 'creative-strategy',
    setupFieldId: 'availableFormats',
    contextPath: 'creative.availableFormats',
    domain: 'creative',
    field: 'availableFormats',
    type: 'string[]',
    label: 'Available Formats',
  },
  {
    setupStepId: 'creative-strategy',
    setupFieldId: 'brandGuidelines',
    contextPath: 'creative.brandGuidelines',
    domain: 'creative',
    field: 'brandGuidelines',
    type: 'string',
    label: 'Brand Guidelines',
  },
];

/**
 * Measurement step field bindings
 */
export const MEASUREMENT_BINDINGS: SetupFieldBinding[] = [
  {
    setupStepId: 'measurement',
    setupFieldId: 'ga4PropertyId',
    contextPath: 'digitalInfra.ga4PropertyId',
    domain: 'digitalInfra',
    field: 'ga4PropertyId',
    type: 'string',
    label: 'GA4 Property ID',
  },
  {
    setupStepId: 'measurement',
    setupFieldId: 'ga4ConversionEvents',
    contextPath: 'digitalInfra.ga4ConversionEvents',
    domain: 'digitalInfra',
    field: 'ga4ConversionEvents',
    type: 'string[]',
    label: 'GA4 Conversion Events',
  },
  {
    setupStepId: 'measurement',
    setupFieldId: 'callTracking',
    contextPath: 'digitalInfra.callTracking',
    domain: 'digitalInfra',
    field: 'callTracking',
    type: 'string',
    label: 'Call Tracking',
  },
  {
    setupStepId: 'measurement',
    setupFieldId: 'trackingTools',
    contextPath: 'digitalInfra.trackingTools',
    domain: 'digitalInfra',
    field: 'trackingTools',
    type: 'string[]',
    label: 'Tracking Tools',
  },
  {
    setupStepId: 'measurement',
    setupFieldId: 'attributionModel',
    contextPath: 'digitalInfra.attributionModel',
    domain: 'digitalInfra',
    field: 'attributionModel',
    type: 'string',
    label: 'Attribution Model',
  },
  {
    setupStepId: 'measurement',
    setupFieldId: 'attributionWindow',
    contextPath: 'digitalInfra.attributionWindow',
    domain: 'digitalInfra',
    field: 'attributionWindow',
    type: 'string',
    label: 'Attribution Window',
  },
];

// ============================================================================
// Combined Bindings
// ============================================================================

/**
 * All field bindings across all steps
 */
export const ALL_SETUP_BINDINGS: SetupFieldBinding[] = [
  ...IDENTITY_BINDINGS,
  ...OBJECTIVES_BINDINGS,
  ...AUDIENCE_BINDINGS,
  ...PERSONAS_BINDINGS,
  ...WEBSITE_BINDINGS,
  ...MEDIA_BINDINGS,
  ...BUDGET_BINDINGS,
  ...CREATIVE_BINDINGS,
  ...MEASUREMENT_BINDINGS,
];

/**
 * Bindings organized by step ID
 */
export const BINDINGS_BY_STEP: Record<SetupStepId, SetupFieldBinding[]> = {
  'business-identity': IDENTITY_BINDINGS,
  'objectives': OBJECTIVES_BINDINGS,
  'audience': AUDIENCE_BINDINGS,
  'personas': PERSONAS_BINDINGS,
  'website': WEBSITE_BINDINGS,
  'media-foundations': MEDIA_BINDINGS,
  'budget-scenarios': BUDGET_BINDINGS,
  'creative-strategy': CREATIVE_BINDINGS,
  'measurement': MEASUREMENT_BINDINGS,
  'summary': [], // Summary step doesn't have editable fields
};

/**
 * Bindings organized by context path for quick lookup
 */
export const BINDINGS_BY_PATH: Map<string, SetupFieldBinding> = new Map(
  ALL_SETUP_BINDINGS.map(binding => [binding.contextPath, binding])
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get bindings for a specific step
 */
export function getBindingsForStep(stepId: SetupStepId): SetupFieldBinding[] {
  return BINDINGS_BY_STEP[stepId] || [];
}

/**
 * Get binding by context path
 */
export function getBindingByPath(contextPath: string): SetupFieldBinding | undefined {
  return BINDINGS_BY_PATH.get(contextPath);
}

/**
 * Get binding by setup field ID within a step
 */
export function getBindingByFieldId(
  stepId: SetupStepId,
  fieldId: string
): SetupFieldBinding | undefined {
  const bindings = getBindingsForStep(stepId);
  return bindings.find(b => b.setupFieldId === fieldId);
}

/**
 * Get all context paths for a step
 */
export function getContextPathsForStep(stepId: SetupStepId): string[] {
  return getBindingsForStep(stepId).map(b => b.contextPath);
}

/**
 * Get all domains used by a step
 */
export function getDomainsForStep(stepId: SetupStepId): DomainName[] {
  const bindings = getBindingsForStep(stepId);
  const domains = new Set<DomainName>();
  for (const binding of bindings) {
    domains.add(binding.domain);
  }
  return Array.from(domains);
}

/**
 * Human-readable source names for provenance display
 */
export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  user: 'Manual Edit',
  manual: 'Manual Entry',
  setup_wizard: 'Setup Wizard',
  qbr: 'Strategic Plan',
  strategy: 'Strategy',
  brain: 'Brain',
  gap_ia: 'GAP IA',
  gap_full: 'GAP Full',
  gap_heavy: 'GAP Heavy',
  website_lab: 'Website Lab',
  brand_lab: 'Brand Lab',
  content_lab: 'Content Lab',
  seo_lab: 'SEO Lab',
  demand_lab: 'Demand Lab',
  ops_lab: 'Ops Lab',
  audience_lab: 'Audience Lab',
  media_lab: 'Media Lab',
  creative_lab: 'Creative Lab',
  ux_lab: 'UX Lab',
  airtable: 'Airtable Import',
  import: 'Data Import',
  inferred: 'AI Inferred',
  analytics_ga4: 'Google Analytics',
  analytics_gsc: 'Search Console',
  analytics_gads: 'Google Ads',
};

/**
 * Get human-readable source name
 */
export function getSourceDisplayName(source: string): string {
  return SOURCE_DISPLAY_NAMES[source] || source;
}

/**
 * Check if a source is considered a human override
 */
export function isHumanSource(source: string): boolean {
  const humanSources = ['user', 'manual', 'setup_wizard', 'qbr', 'strategy'];
  return humanSources.includes(source);
}
