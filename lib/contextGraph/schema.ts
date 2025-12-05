// lib/contextGraph/schema.ts
// Central Schema & Mapping Registry for Context Graph
//
// This is the SINGLE SOURCE OF TRUTH for all Context Graph fields.
// It defines:
// - All valid field paths (e.g., 'identity.icpDescription')
// - Field types and labels
// - Primary sources for each field
// - Section groupings for UI display
//
// All writers (Setup, Labs, Strategic Plan, etc.) should reference this registry
// to ensure consistent field naming and source attribution.

import type { DomainName } from './companyContextGraph';
import type { ContextSource } from './types';

// ============================================================================
// Context Section IDs
// ============================================================================

/**
 * High-level sections for grouping fields in UI
 */
export type ContextSectionId =
  | 'identity'
  | 'audience'
  | 'brand'
  | 'website'
  | 'media'
  | 'creative'
  | 'objectives'
  | 'constraints'
  | 'productOffer'
  | 'content'
  | 'seo'
  | 'ops'
  | 'competitive'
  | 'historical'
  | 'storeRisk';

// ============================================================================
// Field Type Definitions
// ============================================================================

/**
 * Primitive field types for validation and display
 */
export type FieldType =
  | 'string'
  | 'string[]'
  | 'number'
  | 'boolean'
  | 'json'
  | 'record';

/**
 * Writer module identifiers - all modules that can write to Context Graph
 */
export type WriterModuleId =
  | 'Setup'
  | 'GAP'
  | 'GAPHeavy'
  | 'WebsiteLab'
  | 'BrandLab'
  | 'ContentLab'
  | 'SEOLab'
  | 'DemandLab'
  | 'OpsLab'
  | 'AudienceLab'
  | 'MediaLab'
  | 'CreativeLab'
  | 'StrategicPlan'
  | 'QBR'
  | 'ICPExtractor'
  | 'Analytics'
  | 'Manual';

/**
 * Consumer module identifiers - all modules that read from Context Graph
 */
export type ConsumerModuleId =
  | 'Setup'
  | 'SetupLoader'
  | 'AudienceLab'
  | 'MediaLab'
  | 'CreativeLab'
  | 'StrategicPlan'
  | 'QBR'
  | 'Blueprint'
  | 'Brain'
  | 'Work'
  | 'Analytics';

/**
 * Definition of a Context Graph field
 */
export interface ContextFieldDef {
  /** Full dot-path to the field (e.g., 'identity.icpDescription') */
  path: string;
  /** Domain this field belongs to */
  domain: DomainName;
  /** Field name within the domain */
  field: string;
  /** UI section for grouping */
  section: ContextSectionId;
  /** Human-readable label */
  label: string;
  /** Field type */
  type: FieldType;
  /** Description of what this field contains */
  description?: string;
  /** Primary sources expected to write this field */
  primarySources: WriterModuleId[];
  /** Whether this field is critical for system operation */
  critical?: boolean;
  /** Whether this field is deprecated (kept for backward compat) */
  deprecated?: boolean;
}

// ============================================================================
// Context Field Registry
// ============================================================================

/**
 * All Context Graph fields with their definitions
 *
 * This is the canonical list of all fields in the Context Graph.
 * Add new fields here when extending the schema.
 */
export const CONTEXT_FIELDS: ContextFieldDef[] = [
  // ===========================================================================
  // Identity Domain
  // ===========================================================================
  {
    path: 'identity.businessName',
    domain: 'identity',
    field: 'businessName',
    section: 'identity',
    label: 'Business Name',
    type: 'string',
    primarySources: ['Setup', 'GAP', 'Manual'],
    critical: true,
  },
  {
    path: 'identity.industry',
    domain: 'identity',
    field: 'industry',
    section: 'identity',
    label: 'Industry',
    type: 'string',
    primarySources: ['Setup', 'GAP', 'GAPHeavy'],
    critical: true,
  },
  {
    path: 'identity.businessModel',
    domain: 'identity',
    field: 'businessModel',
    section: 'identity',
    label: 'Business Model',
    type: 'string',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'identity.revenueModel',
    domain: 'identity',
    field: 'revenueModel',
    section: 'identity',
    label: 'Revenue Model',
    type: 'string',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'identity.icpDescription',
    domain: 'identity',
    field: 'icpDescription',
    section: 'identity',
    label: 'ICP Description',
    type: 'string',
    description: 'Canonical Ideal Customer Profile description - constrains all Labs',
    primarySources: ['Setup', 'GAP', 'ICPExtractor', 'StrategicPlan'],
    critical: true,
  },
  {
    path: 'identity.marketMaturity',
    domain: 'identity',
    field: 'marketMaturity',
    section: 'identity',
    label: 'Market Maturity',
    type: 'string',
    primarySources: ['Setup', 'GAP', 'GAPHeavy'],
  },
  {
    path: 'identity.geographicFootprint',
    domain: 'identity',
    field: 'geographicFootprint',
    section: 'identity',
    label: 'Geographic Footprint',
    type: 'string',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'identity.serviceArea',
    domain: 'identity',
    field: 'serviceArea',
    section: 'identity',
    label: 'Service Area',
    type: 'string',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'identity.competitiveLandscape',
    domain: 'identity',
    field: 'competitiveLandscape',
    section: 'identity',
    label: 'Competitive Landscape',
    type: 'string',
    primarySources: ['GAP', 'GAPHeavy', 'BrandLab'],
  },
  {
    path: 'identity.marketPosition',
    domain: 'identity',
    field: 'marketPosition',
    section: 'identity',
    label: 'Market Position',
    type: 'string',
    primarySources: ['GAP', 'GAPHeavy', 'BrandLab'],
  },
  {
    path: 'identity.primaryCompetitors',
    domain: 'identity',
    field: 'primaryCompetitors',
    section: 'identity',
    label: 'Primary Competitors',
    type: 'string[]',
    primarySources: ['Setup', 'GAP', 'GAPHeavy'],
  },
  {
    path: 'identity.seasonalityNotes',
    domain: 'identity',
    field: 'seasonalityNotes',
    section: 'identity',
    label: 'Seasonality Notes',
    type: 'string',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'identity.peakSeasons',
    domain: 'identity',
    field: 'peakSeasons',
    section: 'identity',
    label: 'Peak Seasons',
    type: 'string[]',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'identity.lowSeasons',
    domain: 'identity',
    field: 'lowSeasons',
    section: 'identity',
    label: 'Low Seasons',
    type: 'string[]',
    primarySources: ['Setup'],
  },
  {
    path: 'identity.profitCenters',
    domain: 'identity',
    field: 'profitCenters',
    section: 'identity',
    label: 'Profit Centers',
    type: 'string[]',
    primarySources: ['Setup'],
  },
  {
    path: 'identity.revenueStreams',
    domain: 'identity',
    field: 'revenueStreams',
    section: 'identity',
    label: 'Revenue Streams',
    type: 'string[]',
    primarySources: ['Setup', 'GAP'],
  },

  // ===========================================================================
  // Audience Domain
  // ===========================================================================
  {
    path: 'audience.primaryAudience',
    domain: 'audience',
    field: 'primaryAudience',
    section: 'audience',
    label: 'Primary Audience',
    type: 'string',
    description: 'Primary target audience description',
    primarySources: ['Setup', 'GAP', 'AudienceLab'],
    critical: true,
  },
  {
    path: 'audience.primaryBuyerRoles',
    domain: 'audience',
    field: 'primaryBuyerRoles',
    section: 'audience',
    label: 'Primary Buyer Roles',
    type: 'string[]',
    primarySources: ['Setup', 'AudienceLab'],
  },
  {
    path: 'audience.companyProfile',
    domain: 'audience',
    field: 'companyProfile',
    section: 'audience',
    label: 'Company Profile (B2B)',
    type: 'json',
    primarySources: ['Setup', 'AudienceLab'],
  },
  {
    path: 'audience.coreSegments',
    domain: 'audience',
    field: 'coreSegments',
    section: 'audience',
    label: 'Core Segments',
    type: 'string[]',
    primarySources: ['Setup', 'GAP', 'AudienceLab'],
    critical: true,
  },
  {
    path: 'audience.segmentDetails',
    domain: 'audience',
    field: 'segmentDetails',
    section: 'audience',
    label: 'Segment Details',
    type: 'json',
    primarySources: ['AudienceLab'],
  },
  {
    path: 'audience.demographics',
    domain: 'audience',
    field: 'demographics',
    section: 'audience',
    label: 'Demographics',
    type: 'string',
    primarySources: ['Setup', 'GAP', 'AudienceLab'],
  },
  {
    path: 'audience.geos',
    domain: 'audience',
    field: 'geos',
    section: 'audience',
    label: 'Geographic Targeting',
    type: 'string',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'audience.primaryMarkets',
    domain: 'audience',
    field: 'primaryMarkets',
    section: 'audience',
    label: 'Primary Markets',
    type: 'string[]',
    primarySources: ['Setup', 'GAP'],
  },
  {
    path: 'audience.behavioralDrivers',
    domain: 'audience',
    field: 'behavioralDrivers',
    section: 'audience',
    label: 'Behavioral Drivers',
    type: 'string[]',
    primarySources: ['Setup', 'AudienceLab'],
  },
  {
    path: 'audience.demandStates',
    domain: 'audience',
    field: 'demandStates',
    section: 'audience',
    label: 'Demand States',
    type: 'string[]',
    primarySources: ['Setup', 'AudienceLab'],
  },
  {
    path: 'audience.painPoints',
    domain: 'audience',
    field: 'painPoints',
    section: 'audience',
    label: 'Pain Points',
    type: 'string[]',
    primarySources: ['Setup', 'GAP', 'AudienceLab'],
  },
  {
    path: 'audience.motivations',
    domain: 'audience',
    field: 'motivations',
    section: 'audience',
    label: 'Motivations',
    type: 'string[]',
    primarySources: ['Setup', 'GAP', 'AudienceLab'],
  },
  {
    path: 'audience.personaNames',
    domain: 'audience',
    field: 'personaNames',
    section: 'audience',
    label: 'Persona Names',
    type: 'string[]',
    primarySources: ['AudienceLab', 'Setup'],
  },
  {
    path: 'audience.personaBriefs',
    domain: 'audience',
    field: 'personaBriefs',
    section: 'audience',
    label: 'Persona Briefs',
    type: 'json',
    primarySources: ['AudienceLab'],
  },

  // ===========================================================================
  // Brand Domain
  // ===========================================================================
  {
    path: 'brand.positioning',
    domain: 'brand',
    field: 'positioning',
    section: 'brand',
    label: 'Brand Positioning',
    type: 'string',
    primarySources: ['BrandLab', 'GAP', 'Setup'],
    critical: true,
  },
  {
    path: 'brand.tagline',
    domain: 'brand',
    field: 'tagline',
    section: 'brand',
    label: 'Tagline',
    type: 'string',
    primarySources: ['BrandLab', 'GAP'],
  },
  {
    path: 'brand.missionStatement',
    domain: 'brand',
    field: 'missionStatement',
    section: 'brand',
    label: 'Mission Statement',
    type: 'string',
    primarySources: ['BrandLab', 'GAP'],
  },
  {
    path: 'brand.valueProps',
    domain: 'brand',
    field: 'valueProps',
    section: 'brand',
    label: 'Value Propositions',
    type: 'string[]',
    primarySources: ['BrandLab', 'GAP', 'CreativeLab'],
    critical: true,
  },
  {
    path: 'brand.differentiators',
    domain: 'brand',
    field: 'differentiators',
    section: 'brand',
    label: 'Differentiators',
    type: 'string[]',
    primarySources: ['BrandLab', 'GAP', 'CreativeLab'],
  },
  {
    path: 'brand.uniqueSellingPoints',
    domain: 'brand',
    field: 'uniqueSellingPoints',
    section: 'brand',
    label: 'Unique Selling Points',
    type: 'string[]',
    primarySources: ['BrandLab', 'GAP'],
  },
  {
    path: 'brand.toneOfVoice',
    domain: 'brand',
    field: 'toneOfVoice',
    section: 'brand',
    label: 'Tone of Voice',
    type: 'string',
    primarySources: ['BrandLab', 'CreativeLab'],
  },
  {
    path: 'brand.brandPersonality',
    domain: 'brand',
    field: 'brandPersonality',
    section: 'brand',
    label: 'Brand Personality',
    type: 'string',
    primarySources: ['BrandLab'],
  },
  {
    path: 'brand.messagingPillars',
    domain: 'brand',
    field: 'messagingPillars',
    section: 'brand',
    label: 'Messaging Pillars',
    type: 'string[]',
    primarySources: ['BrandLab', 'CreativeLab'],
  },
  {
    path: 'brand.brandPerception',
    domain: 'brand',
    field: 'brandPerception',
    section: 'brand',
    label: 'Brand Perception',
    type: 'string',
    primarySources: ['BrandLab'],
  },
  {
    path: 'brand.brandStrengths',
    domain: 'brand',
    field: 'brandStrengths',
    section: 'brand',
    label: 'Brand Strengths',
    type: 'string[]',
    primarySources: ['BrandLab', 'GAP'],
  },
  {
    path: 'brand.brandWeaknesses',
    domain: 'brand',
    field: 'brandWeaknesses',
    section: 'brand',
    label: 'Brand Weaknesses',
    type: 'string[]',
    primarySources: ['BrandLab', 'GAP'],
  },
  {
    path: 'brand.brandGuidelines',
    domain: 'brand',
    field: 'brandGuidelines',
    section: 'brand',
    label: 'Brand Guidelines',
    type: 'string',
    primarySources: ['Setup', 'BrandLab'],
  },

  // ===========================================================================
  // Objectives Domain
  // ===========================================================================
  {
    path: 'objectives.primaryObjective',
    domain: 'objectives',
    field: 'primaryObjective',
    section: 'objectives',
    label: 'Primary Objective',
    type: 'string',
    primarySources: ['Setup', 'StrategicPlan', 'QBR'],
    critical: true,
  },
  {
    path: 'objectives.secondaryObjectives',
    domain: 'objectives',
    field: 'secondaryObjectives',
    section: 'objectives',
    label: 'Secondary Objectives',
    type: 'string[]',
    primarySources: ['Setup', 'StrategicPlan'],
  },
  {
    path: 'objectives.primaryBusinessGoal',
    domain: 'objectives',
    field: 'primaryBusinessGoal',
    section: 'objectives',
    label: 'Primary Business Goal',
    type: 'string',
    primarySources: ['Setup', 'StrategicPlan'],
  },
  {
    path: 'objectives.timeHorizon',
    domain: 'objectives',
    field: 'timeHorizon',
    section: 'objectives',
    label: 'Time Horizon',
    type: 'string',
    primarySources: ['Setup', 'StrategicPlan'],
  },
  {
    path: 'objectives.kpiLabels',
    domain: 'objectives',
    field: 'kpiLabels',
    section: 'objectives',
    label: 'KPI Labels',
    type: 'string[]',
    primarySources: ['Setup', 'StrategicPlan'],
  },
  {
    path: 'objectives.targetCpa',
    domain: 'objectives',
    field: 'targetCpa',
    section: 'objectives',
    label: 'Target CPA',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
  },
  {
    path: 'objectives.targetRoas',
    domain: 'objectives',
    field: 'targetRoas',
    section: 'objectives',
    label: 'Target ROAS',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
  },
  {
    path: 'objectives.revenueGoal',
    domain: 'objectives',
    field: 'revenueGoal',
    section: 'objectives',
    label: 'Revenue Goal',
    type: 'number',
    primarySources: ['Setup', 'StrategicPlan'],
  },
  {
    path: 'objectives.leadGoal',
    domain: 'objectives',
    field: 'leadGoal',
    section: 'objectives',
    label: 'Lead Goal',
    type: 'number',
    primarySources: ['Setup', 'StrategicPlan'],
  },

  // ===========================================================================
  // Website Domain
  // ===========================================================================
  {
    path: 'website.websiteScore',
    domain: 'website',
    field: 'websiteScore',
    section: 'website',
    label: 'Website Score',
    type: 'number',
    primarySources: ['WebsiteLab', 'GAP'],
  },
  {
    path: 'website.websiteSummary',
    domain: 'website',
    field: 'websiteSummary',
    section: 'website',
    label: 'Website Summary',
    type: 'string',
    primarySources: ['WebsiteLab', 'GAP', 'Setup'],
  },
  {
    path: 'website.conversionBlocks',
    domain: 'website',
    field: 'conversionBlocks',
    section: 'website',
    label: 'Conversion Blocks',
    type: 'string[]',
    primarySources: ['WebsiteLab', 'Setup'],
  },
  {
    path: 'website.conversionOpportunities',
    domain: 'website',
    field: 'conversionOpportunities',
    section: 'website',
    label: 'Conversion Opportunities',
    type: 'string[]',
    primarySources: ['WebsiteLab', 'Setup'],
  },
  {
    path: 'website.criticalIssues',
    domain: 'website',
    field: 'criticalIssues',
    section: 'website',
    label: 'Critical Issues',
    type: 'string[]',
    primarySources: ['WebsiteLab', 'Setup'],
  },
  {
    path: 'website.quickWins',
    domain: 'website',
    field: 'quickWins',
    section: 'website',
    label: 'Quick Wins',
    type: 'string[]',
    primarySources: ['WebsiteLab', 'Setup'],
  },

  // ===========================================================================
  // Performance Media Domain
  // ===========================================================================
  {
    path: 'performanceMedia.mediaSummary',
    domain: 'performanceMedia',
    field: 'mediaSummary',
    section: 'media',
    label: 'Media Summary',
    type: 'string',
    primarySources: ['DemandLab', 'MediaLab', 'Setup'],
  },
  {
    path: 'performanceMedia.activeChannels',
    domain: 'performanceMedia',
    field: 'activeChannels',
    section: 'media',
    label: 'Active Channels',
    type: 'string[]',
    primarySources: ['DemandLab', 'MediaLab', 'Setup', 'Analytics'],
  },
  {
    path: 'performanceMedia.attributionModel',
    domain: 'performanceMedia',
    field: 'attributionModel',
    section: 'media',
    label: 'Attribution Model',
    type: 'string',
    primarySources: ['Setup', 'DemandLab'],
  },
  {
    path: 'performanceMedia.mediaIssues',
    domain: 'performanceMedia',
    field: 'mediaIssues',
    section: 'media',
    label: 'Media Issues',
    type: 'string[]',
    primarySources: ['DemandLab', 'MediaLab', 'Setup'],
  },
  {
    path: 'performanceMedia.mediaOpportunities',
    domain: 'performanceMedia',
    field: 'mediaOpportunities',
    section: 'media',
    label: 'Media Opportunities',
    type: 'string[]',
    primarySources: ['DemandLab', 'MediaLab', 'Setup'],
  },

  // ===========================================================================
  // Creative Domain
  // ===========================================================================
  {
    path: 'creative.messaging',
    domain: 'creative',
    field: 'messaging',
    section: 'creative',
    label: 'Messaging Architecture',
    type: 'json',
    description: 'Core value prop, supporting points, proof points, differentiators',
    primarySources: ['CreativeLab'],
    critical: true,
  },
  {
    path: 'creative.segmentMessages',
    domain: 'creative',
    field: 'segmentMessages',
    section: 'creative',
    label: 'Segment Messages',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.creativeTerritories',
    domain: 'creative',
    field: 'creativeTerritories',
    section: 'creative',
    label: 'Creative Territories',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.campaignConcepts',
    domain: 'creative',
    field: 'campaignConcepts',
    section: 'creative',
    label: 'Campaign Concepts',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.guidelines',
    domain: 'creative',
    field: 'guidelines',
    section: 'creative',
    label: 'Creative Guidelines',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.channelPatterns',
    domain: 'creative',
    field: 'channelPatterns',
    section: 'creative',
    label: 'Channel Patterns',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.testingRoadmapItems',
    domain: 'creative',
    field: 'testingRoadmapItems',
    section: 'creative',
    label: 'Testing Roadmap',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.assetSpecs',
    domain: 'creative',
    field: 'assetSpecs',
    section: 'creative',
    label: 'Asset Specifications',
    type: 'json',
    primarySources: ['CreativeLab'],
  },
  {
    path: 'creative.coreMessages',
    domain: 'creative',
    field: 'coreMessages',
    section: 'creative',
    label: 'Core Messages (Legacy)',
    type: 'string[]',
    primarySources: ['Setup', 'GAP', 'CreativeLab'],
    deprecated: true,
  },
  {
    path: 'creative.proofPoints',
    domain: 'creative',
    field: 'proofPoints',
    section: 'creative',
    label: 'Proof Points (Legacy)',
    type: 'string[]',
    primarySources: ['Setup', 'GAP', 'BrandLab'],
    deprecated: true,
  },
  {
    path: 'creative.callToActions',
    domain: 'creative',
    field: 'callToActions',
    section: 'creative',
    label: 'Call to Actions (Legacy)',
    type: 'string[]',
    primarySources: ['Setup', 'CreativeLab'],
    deprecated: true,
  },
  {
    path: 'creative.availableFormats',
    domain: 'creative',
    field: 'availableFormats',
    section: 'creative',
    label: 'Available Formats',
    type: 'string[]',
    primarySources: ['Setup', 'CreativeLab'],
  },
  {
    path: 'creative.brandGuidelines',
    domain: 'creative',
    field: 'brandGuidelines',
    section: 'creative',
    label: 'Brand Guidelines (Creative)',
    type: 'string',
    primarySources: ['Setup', 'BrandLab'],
  },

  // ===========================================================================
  // Budget & Ops Domain
  // ===========================================================================
  {
    path: 'budgetOps.totalMarketingBudget',
    domain: 'budgetOps',
    field: 'totalMarketingBudget',
    section: 'constraints',
    label: 'Total Marketing Budget',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
  },
  {
    path: 'budgetOps.mediaSpendBudget',
    domain: 'budgetOps',
    field: 'mediaSpendBudget',
    section: 'constraints',
    label: 'Media Spend Budget',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
  },
  {
    path: 'budgetOps.budgetPeriod',
    domain: 'budgetOps',
    field: 'budgetPeriod',
    section: 'constraints',
    label: 'Budget Period',
    type: 'string',
    primarySources: ['Setup'],
  },
  {
    path: 'budgetOps.avgCustomerValue',
    domain: 'budgetOps',
    field: 'avgCustomerValue',
    section: 'constraints',
    label: 'Avg Customer Value',
    type: 'number',
    primarySources: ['Setup'],
  },
  {
    path: 'budgetOps.customerLTV',
    domain: 'budgetOps',
    field: 'customerLTV',
    section: 'constraints',
    label: 'Customer LTV',
    type: 'number',
    primarySources: ['Setup'],
  },

  // ===========================================================================
  // Content Domain
  // ===========================================================================
  {
    path: 'content.contentScore',
    domain: 'content',
    field: 'contentScore',
    section: 'content',
    label: 'Content Score',
    type: 'number',
    primarySources: ['ContentLab', 'GAP'],
  },
  {
    path: 'content.contentSummary',
    domain: 'content',
    field: 'contentSummary',
    section: 'content',
    label: 'Content Summary',
    type: 'string',
    primarySources: ['ContentLab', 'GAP'],
  },

  // ===========================================================================
  // SEO Domain
  // ===========================================================================
  {
    path: 'seo.seoScore',
    domain: 'seo',
    field: 'seoScore',
    section: 'seo',
    label: 'SEO Score',
    type: 'number',
    primarySources: ['SEOLab', 'GAP'],
  },
  {
    path: 'seo.seoSummary',
    domain: 'seo',
    field: 'seoSummary',
    section: 'seo',
    label: 'SEO Summary',
    type: 'string',
    primarySources: ['SEOLab', 'GAP'],
  },

  // ===========================================================================
  // Ops Domain
  // ===========================================================================
  {
    path: 'ops.opsScore',
    domain: 'ops',
    field: 'opsScore',
    section: 'ops',
    label: 'Ops Score',
    type: 'number',
    primarySources: ['OpsLab', 'GAP'],
  },
  {
    path: 'ops.trackingTools',
    domain: 'ops',
    field: 'trackingTools',
    section: 'ops',
    label: 'Tracking Tools',
    type: 'string[]',
    primarySources: ['Setup', 'OpsLab'],
  },
  {
    path: 'ops.ga4PropertyId',
    domain: 'ops',
    field: 'ga4PropertyId',
    section: 'ops',
    label: 'GA4 Property ID',
    type: 'string',
    primarySources: ['Setup', 'Manual'],
  },
  {
    path: 'ops.ga4ConversionEvents',
    domain: 'ops',
    field: 'ga4ConversionEvents',
    section: 'ops',
    label: 'GA4 Conversion Events',
    type: 'string[]',
    primarySources: ['Setup', 'OpsLab'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get field definition by path
 */
export function getFieldDef(path: string): ContextFieldDef | undefined {
  return CONTEXT_FIELDS.find(f => f.path === path);
}

/**
 * Get all fields for a section
 */
export function getFieldsBySection(section: ContextSectionId): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => f.section === section);
}

/**
 * Get all fields for a domain
 */
export function getFieldsByDomain(domain: DomainName): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => f.domain === domain);
}

/**
 * Get all critical fields
 */
export function getCriticalFields(): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => f.critical);
}

/**
 * Get all fields that a writer is expected to write
 */
export function getFieldsForWriter(writer: WriterModuleId): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => f.primarySources.includes(writer));
}

/**
 * Get all field paths as a Set for quick lookup
 */
export function getValidFieldPaths(): Set<string> {
  return new Set(CONTEXT_FIELDS.map(f => f.path));
}

/**
 * Check if a field path is valid
 */
export function isValidFieldPath(path: string): boolean {
  return CONTEXT_FIELDS.some(f => f.path === path);
}

/**
 * Get all unique sections
 */
export function getAllSections(): ContextSectionId[] {
  const sections = new Set<ContextSectionId>();
  CONTEXT_FIELDS.forEach(f => sections.add(f.section));
  return Array.from(sections);
}

/**
 * Build a lookup map of path -> field definition
 */
export function buildFieldLookup(): Map<string, ContextFieldDef> {
  const lookup = new Map<string, ContextFieldDef>();
  CONTEXT_FIELDS.forEach(f => lookup.set(f.path, f));
  return lookup;
}
