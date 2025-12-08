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
  | 'FCB'
  | 'WebsiteLab'
  | 'BrandLab'
  | 'ContentLab'
  | 'SEOLab'
  | 'DemandLab'
  | 'OpsLab'
  | 'AudienceLab'
  | 'MediaLab'
  | 'CreativeLab'
  | 'CompetitorLab'
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
  | 'BrandLab'
  | 'SEOLab'
  | 'CompetitorLab'
  | 'StrategicPlan'
  | 'QBR'
  | 'Blueprint'
  | 'Brain'
  | 'Work'
  | 'Analytics'
  | 'InsightsEngine';

/**
 * Auto-fill mode for Context Graph fields
 *
 * - 'auto': Can be fully auto-filled by FCB/Labs/GAP - no human input required
 * - 'assist': AI should help refine, not invent (e.g., vision, mission, strategic narrative)
 * - 'manual': Requires human input - numeric goals, budgets, contractual constraints
 */
export type AutoFillMode = 'auto' | 'assist' | 'manual';

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
  /**
   * Auto-fill mode - determines how this field should be populated:
   * - 'auto' (default): Can be fully auto-filled by FCB/Labs/GAP
   * - 'assist': AI should help refine, not invent from scratch
   * - 'manual': Requires human input (e.g., numeric goals, budgets)
   */
  autoFillMode?: AutoFillMode;
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
    primarySources: ['Setup', 'GAP', 'Manual', 'FCB'],
    critical: true,
  },
  {
    path: 'identity.businessDescription',
    domain: 'identity',
    field: 'businessDescription',
    section: 'identity',
    label: 'Business Description',
    type: 'string',
    description: 'A 1-2 sentence description of what the business does',
    primarySources: ['Setup', 'GAP', 'FCB'],
  },
  {
    path: 'identity.industry',
    domain: 'identity',
    field: 'industry',
    section: 'identity',
    label: 'Industry',
    type: 'string',
    primarySources: ['Setup', 'GAP', 'GAPHeavy', 'FCB'],
    critical: true,
  },
  {
    path: 'identity.businessModel',
    domain: 'identity',
    field: 'businessModel',
    section: 'identity',
    label: 'Business Model',
    type: 'string',
    description: 'The business model type (e.g., B2B, B2C, SaaS, Service Provider)',
    primarySources: ['Setup', 'GAP', 'FCB'],
  },
  {
    path: 'identity.primaryOffering',
    domain: 'identity',
    field: 'primaryOffering',
    section: 'identity',
    label: 'Primary Offering',
    type: 'string',
    description: 'What the business primarily sells or offers',
    primarySources: ['Setup', 'GAP', 'FCB'],
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
    path: 'identity.foundedYear',
    domain: 'identity',
    field: 'foundedYear',
    section: 'identity',
    label: 'Founded Year',
    type: 'number',
    description: 'Year the company was founded',
    primarySources: ['Setup', 'FCB'],
  },
  {
    path: 'identity.companySize',
    domain: 'identity',
    field: 'companySize',
    section: 'identity',
    label: 'Company Size',
    type: 'string',
    description: 'Size category (e.g., Small, Medium, Enterprise, 1-10 employees)',
    primarySources: ['Setup', 'FCB'],
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
    primarySources: ['Setup', 'GAP', 'AudienceLab', 'FCB'],
    critical: true,
  },
  {
    path: 'audience.audienceDescription',
    domain: 'audience',
    field: 'audienceDescription',
    section: 'audience',
    label: 'Audience Description',
    type: 'string',
    description: 'A detailed 1-2 sentence description of the ideal customer',
    primarySources: ['Setup', 'AudienceLab', 'FCB'],
  },
  {
    path: 'audience.primaryBuyerRoles',
    domain: 'audience',
    field: 'primaryBuyerRoles',
    section: 'audience',
    label: 'Primary Buyer Roles',
    type: 'string[]',
    primarySources: ['Setup', 'AudienceLab', 'FCB'],
  },
  {
    path: 'audience.targetDemographics',
    domain: 'audience',
    field: 'targetDemographics',
    section: 'audience',
    label: 'Target Demographics',
    type: 'string[]',
    description: 'Demographic characteristics (e.g., Age 35-55, Homeowners)',
    primarySources: ['Setup', 'AudienceLab', 'FCB'],
  },
  {
    path: 'audience.buyerTypes',
    domain: 'audience',
    field: 'buyerTypes',
    section: 'audience',
    label: 'Buyer Types',
    type: 'string[]',
    description: 'Buyer persona types (e.g., First-time buyers, Cost-conscious)',
    primarySources: ['Setup', 'AudienceLab', 'FCB'],
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
    autoFillMode: 'assist', // AI can help refine, but shouldn't invent from scratch
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
    type: 'string[]',
    description: 'Personality traits that define the brand (e.g., Innovative, Reliable)',
    primarySources: ['BrandLab', 'FCB'],
  },
  {
    path: 'brand.voiceDescriptors',
    domain: 'brand',
    field: 'voiceDescriptors',
    section: 'brand',
    label: 'Voice Descriptors',
    type: 'string[]',
    description: 'Adjectives that describe the brand voice (e.g., Professional, Friendly)',
    primarySources: ['BrandLab', 'FCB'],
  },
  {
    path: 'brand.brandPromise',
    domain: 'brand',
    field: 'brandPromise',
    section: 'brand',
    label: 'Brand Promise',
    type: 'string',
    description: 'The core promise the brand makes to customers',
    primarySources: ['BrandLab', 'FCB'],
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
    autoFillMode: 'assist', // Typically requires human-provided brand guide
  },

  // ===========================================================================
  // ProductOffer Domain
  // ===========================================================================
  {
    path: 'productOffer.primaryProducts',
    domain: 'productOffer',
    field: 'primaryProducts',
    section: 'productOffer',
    label: 'Primary Products',
    type: 'string[]',
    description: 'Main products sold by the business',
    primarySources: ['Setup', 'FCB', 'GAP'],
  },
  {
    path: 'productOffer.services',
    domain: 'productOffer',
    field: 'services',
    section: 'productOffer',
    label: 'Services',
    type: 'string[]',
    description: 'Services offered by the business',
    primarySources: ['Setup', 'FCB', 'GAP'],
  },
  {
    path: 'productOffer.valueProposition',
    domain: 'productOffer',
    field: 'valueProposition',
    section: 'productOffer',
    label: 'Value Proposition',
    type: 'string',
    description: 'Core value proposition or unique selling point',
    primarySources: ['Setup', 'FCB', 'BrandLab', 'GAP'],
    critical: true,
  },
  {
    path: 'productOffer.pricingModel',
    domain: 'productOffer',
    field: 'pricingModel',
    section: 'productOffer',
    label: 'Pricing Model',
    type: 'string',
    description: 'How the business prices its offerings (e.g., subscription, per-project, hourly)',
    primarySources: ['Setup', 'FCB'],
  },
  {
    path: 'productOffer.keyDifferentiators',
    domain: 'productOffer',
    field: 'keyDifferentiators',
    section: 'productOffer',
    label: 'Key Differentiators',
    type: 'string[]',
    description: 'What makes the business different from competitors',
    primarySources: ['Setup', 'FCB', 'BrandLab', 'GAP'],
  },
  {
    path: 'productOffer.productLines',
    domain: 'productOffer',
    field: 'productLines',
    section: 'productOffer',
    label: 'Product Lines',
    type: 'string[]',
    description: 'Main product or service lines offered',
    primarySources: ['Setup', 'FCB', 'GAP'],
    critical: true,
  },
  {
    path: 'productOffer.productCategories',
    domain: 'productOffer',
    field: 'productCategories',
    section: 'productOffer',
    label: 'Product Categories',
    type: 'string[]',
    description: 'Categories of products or services',
    primarySources: ['Setup', 'FCB', 'GAP'],
    critical: true,
  },
  {
    path: 'productOffer.heroProducts',
    domain: 'productOffer',
    field: 'heroProducts',
    section: 'productOffer',
    label: 'Hero Products',
    type: 'string[]',
    description: 'Flagship products or services featured in marketing',
    primarySources: ['Setup', 'FCB', 'GAP'],
  },
  {
    path: 'productOffer.pricingNotes',
    domain: 'productOffer',
    field: 'pricingNotes',
    section: 'productOffer',
    label: 'Pricing Notes',
    type: 'string',
    description: 'Notes about pricing strategy or considerations',
    primarySources: ['Setup', 'FCB'],
  },
  {
    path: 'productOffer.uniqueOffers',
    domain: 'productOffer',
    field: 'uniqueOffers',
    section: 'productOffer',
    label: 'Unique Offers',
    type: 'string[]',
    description: 'Special or unique offers available',
    primarySources: ['Setup', 'FCB', 'GAP'],
  },
  {
    path: 'productOffer.conversionOffers',
    domain: 'productOffer',
    field: 'conversionOffers',
    section: 'productOffer',
    label: 'Conversion Offers',
    type: 'string[]',
    description: 'Offers designed to drive conversions',
    primarySources: ['Setup', 'FCB', 'GAP'],
  },
  {
    path: 'productOffer.leadMagnets',
    domain: 'productOffer',
    field: 'leadMagnets',
    section: 'productOffer',
    label: 'Lead Magnets',
    type: 'string[]',
    description: 'Free resources or offers used to capture leads',
    primarySources: ['Setup', 'FCB', 'GAP'],
  },

  // ===========================================================================
  // Objectives Domain - ALL MANUAL (requires human input for business goals)
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
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.secondaryObjectives',
    domain: 'objectives',
    field: 'secondaryObjectives',
    section: 'objectives',
    label: 'Secondary Objectives',
    type: 'string[]',
    primarySources: ['Setup', 'StrategicPlan'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.primaryBusinessGoal',
    domain: 'objectives',
    field: 'primaryBusinessGoal',
    section: 'objectives',
    label: 'Primary Business Goal',
    type: 'string',
    primarySources: ['Setup', 'StrategicPlan'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.timeHorizon',
    domain: 'objectives',
    field: 'timeHorizon',
    section: 'objectives',
    label: 'Time Horizon',
    type: 'string',
    primarySources: ['Setup', 'StrategicPlan'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.kpiLabels',
    domain: 'objectives',
    field: 'kpiLabels',
    section: 'objectives',
    label: 'KPI Labels',
    type: 'string[]',
    primarySources: ['Setup', 'StrategicPlan'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.targetCpa',
    domain: 'objectives',
    field: 'targetCpa',
    section: 'objectives',
    label: 'Target CPA',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.targetRoas',
    domain: 'objectives',
    field: 'targetRoas',
    section: 'objectives',
    label: 'Target ROAS',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.revenueGoal',
    domain: 'objectives',
    field: 'revenueGoal',
    section: 'objectives',
    label: 'Revenue Goal',
    type: 'number',
    primarySources: ['Setup', 'StrategicPlan'],
    autoFillMode: 'manual',
  },
  {
    path: 'objectives.leadGoal',
    domain: 'objectives',
    field: 'leadGoal',
    section: 'objectives',
    label: 'Lead Goal',
    type: 'number',
    primarySources: ['Setup', 'StrategicPlan'],
    autoFillMode: 'manual',
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
    description: 'Core value prop, key pillars, supporting points, proof points, differentiators, tagline variants, feature-to-benefit map',
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
  // Budget & Ops Domain - ALL MANUAL (requires human input for financial data)
  // ===========================================================================
  {
    path: 'budgetOps.totalMarketingBudget',
    domain: 'budgetOps',
    field: 'totalMarketingBudget',
    section: 'constraints',
    label: 'Total Marketing Budget',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
    autoFillMode: 'manual',
  },
  {
    path: 'budgetOps.mediaSpendBudget',
    domain: 'budgetOps',
    field: 'mediaSpendBudget',
    section: 'constraints',
    label: 'Media Spend Budget',
    type: 'number',
    primarySources: ['Setup', 'MediaLab'],
    autoFillMode: 'manual',
  },
  {
    path: 'budgetOps.budgetPeriod',
    domain: 'budgetOps',
    field: 'budgetPeriod',
    section: 'constraints',
    label: 'Budget Period',
    type: 'string',
    primarySources: ['Setup'],
    autoFillMode: 'manual',
  },
  {
    path: 'budgetOps.avgCustomerValue',
    domain: 'budgetOps',
    field: 'avgCustomerValue',
    section: 'constraints',
    label: 'Avg Customer Value',
    type: 'number',
    primarySources: ['Setup'],
    autoFillMode: 'manual',
  },
  {
    path: 'budgetOps.customerLTV',
    domain: 'budgetOps',
    field: 'customerLTV',
    section: 'constraints',
    label: 'Customer LTV',
    type: 'number',
    primarySources: ['Setup'],
    autoFillMode: 'manual',
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

  // ===========================================================================
  // DigitalInfra Domain
  // ===========================================================================
  {
    path: 'digitalInfra.trackingStackSummary',
    domain: 'digitalInfra',
    field: 'trackingStackSummary',
    section: 'ops',
    label: 'Tracking Stack Summary',
    type: 'string',
    description: 'Summary of digital tracking infrastructure (GA4, GBP, social presence, etc.)',
    primarySources: ['GAP', 'Setup', 'OpsLab'],
  },
  {
    path: 'digitalInfra.gbpHealth',
    domain: 'digitalInfra',
    field: 'gbpHealth',
    section: 'ops',
    label: 'Google Business Profile Health',
    type: 'string',
    description: 'Health status of Google Business Profile (healthy, warning, critical, not_configured)',
    primarySources: ['GAP', 'OpsLab'],
  },
  {
    path: 'digitalInfra.dataQuality',
    domain: 'digitalInfra',
    field: 'dataQuality',
    section: 'ops',
    label: 'Data Quality',
    type: 'string',
    description: 'Assessment of overall data quality and measurement infrastructure',
    primarySources: ['GAP', 'OpsLab'],
  },
  {
    path: 'digitalInfra.ga4Health',
    domain: 'digitalInfra',
    field: 'ga4Health',
    section: 'ops',
    label: 'GA4 Health',
    type: 'string',
    description: 'Health status of GA4 configuration',
    primarySources: ['GAP', 'OpsLab', 'Setup'],
  },
  {
    path: 'digitalInfra.searchConsoleHealth',
    domain: 'digitalInfra',
    field: 'searchConsoleHealth',
    section: 'ops',
    label: 'Search Console Health',
    type: 'string',
    description: 'Health status of Google Search Console',
    primarySources: ['GAP', 'OpsLab'],
  },

  // ===========================================================================
  // Competitive Domain
  // ===========================================================================
  // Positioning Map Core Fields (new)
  {
    path: 'competitive.primaryAxis',
    domain: 'competitive',
    field: 'primaryAxis',
    section: 'competitive',
    label: 'Primary Axis',
    type: 'string',
    description: 'The primary axis for positioning map (e.g., "Enterprise ↔ SMB")',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP', 'Setup'],
    critical: true,
  },
  {
    path: 'competitive.secondaryAxis',
    domain: 'competitive',
    field: 'secondaryAxis',
    section: 'competitive',
    label: 'Secondary Axis',
    type: 'string',
    description: 'The secondary axis for positioning map (e.g., "Premium ↔ Budget")',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP', 'Setup'],
    critical: true,
  },
  {
    path: 'competitive.positionSummary',
    domain: 'competitive',
    field: 'positionSummary',
    section: 'competitive',
    label: 'Position Summary',
    type: 'string',
    description: 'Strategic summary of competitive positioning',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.whitespaceOpportunities',
    domain: 'competitive',
    field: 'whitespaceOpportunities',
    section: 'competitive',
    label: 'Whitespace Opportunities',
    type: 'string[]',
    description: 'Strategic whitespace opportunities identified in the market',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  // Competitors Array
  {
    path: 'competitive.competitors',
    domain: 'competitive',
    field: 'competitors',
    section: 'competitive',
    label: 'Competitors',
    type: 'json',
    description: 'Array of competitor profiles with positioning data',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP', 'Setup'],
    critical: true,
  },
  {
    path: 'competitive.primaryCompetitors',
    domain: 'competitive',
    field: 'primaryCompetitors',
    section: 'competitive',
    label: 'Primary Competitors (Legacy)',
    type: 'json',
    description: 'Enhanced competitor profiles with positioning data',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP', 'Setup'],
  },
  {
    path: 'competitive.shareOfVoice',
    domain: 'competitive',
    field: 'shareOfVoice',
    section: 'competitive',
    label: 'Share of Voice',
    type: 'string',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.marketPosition',
    domain: 'competitive',
    field: 'marketPosition',
    section: 'competitive',
    label: 'Market Position',
    type: 'string',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.competitiveAdvantages',
    domain: 'competitive',
    field: 'competitiveAdvantages',
    section: 'competitive',
    label: 'Competitive Advantages',
    type: 'string[]',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.differentiationStrategy',
    domain: 'competitive',
    field: 'differentiationStrategy',
    section: 'competitive',
    label: 'Differentiation Strategy',
    type: 'string',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.uniqueValueProps',
    domain: 'competitive',
    field: 'uniqueValueProps',
    section: 'competitive',
    label: 'Unique Value Props',
    type: 'string[]',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.competitiveThreats',
    domain: 'competitive',
    field: 'competitiveThreats',
    section: 'competitive',
    label: 'Competitive Threats',
    type: 'string[]',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.invalidCompetitors',
    domain: 'competitive',
    field: 'invalidCompetitors',
    section: 'competitive',
    label: 'Invalid Competitors',
    type: 'string[]',
    primarySources: ['CompetitorLab', 'manual'],
  },
  {
    path: 'competitive.competitiveOpportunities',
    domain: 'competitive',
    field: 'competitiveOpportunities',
    section: 'competitive',
    label: 'Competitive Opportunities',
    type: 'string[]',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.marketTrends',
    domain: 'competitive',
    field: 'marketTrends',
    section: 'competitive',
    label: 'Market Trends',
    type: 'string[]',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
  },
  {
    path: 'competitive.positioningAxes',
    domain: 'competitive',
    field: 'positioningAxes',
    section: 'competitive',
    label: 'Positioning Axes (Legacy)',
    type: 'json',
    description: 'Primary/secondary axis definitions for positioning map',
    primarySources: ['CompetitorLab', 'BrandLab', 'Setup'],
  },
  {
    path: 'competitive.ownPositionPrimary',
    domain: 'competitive',
    field: 'ownPositionPrimary',
    section: 'competitive',
    label: 'Position (Primary Axis)',
    type: 'number',
    description: 'Company position on primary axis (0-100)',
    primarySources: ['CompetitorLab', 'BrandLab', 'Setup'],
  },
  {
    path: 'competitive.ownPositionSecondary',
    domain: 'competitive',
    field: 'ownPositionSecondary',
    section: 'competitive',
    label: 'Position (Secondary Axis)',
    type: 'number',
    description: 'Company position on secondary axis (0-100)',
    primarySources: ['CompetitorLab', 'BrandLab', 'Setup'],
  },
  {
    path: 'competitive.positioningSummary',
    domain: 'competitive',
    field: 'positioningSummary',
    section: 'competitive',
    label: 'Positioning Summary (Legacy)',
    type: 'string',
    description: 'LLM-generated summary of competitive positioning',
    primarySources: ['CompetitorLab', 'BrandLab', 'GAP'],
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

// ============================================================================
// AutoFillMode Helpers
// ============================================================================

/**
 * Get the autoFillMode for a field, defaulting to 'auto' if not specified
 */
export function getAutoFillMode(field: ContextFieldDef): AutoFillMode {
  return field.autoFillMode ?? 'auto';
}

/**
 * Get all fields that can be auto-filled (mode === 'auto')
 */
export function getAutoFillableFields(): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => !f.deprecated && getAutoFillMode(f) === 'auto');
}

/**
 * Get all fields that require manual input (mode === 'manual')
 */
export function getManualFields(): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => !f.deprecated && getAutoFillMode(f) === 'manual');
}

/**
 * Get all fields where AI can assist (mode === 'assist')
 */
export function getAssistFields(): ContextFieldDef[] {
  return CONTEXT_FIELDS.filter(f => !f.deprecated && getAutoFillMode(f) === 'assist');
}

/**
 * Check if a field requires manual input
 */
export function isManualField(path: string): boolean {
  const field = getFieldDef(path);
  return field ? getAutoFillMode(field) === 'manual' : false;
}

/**
 * Check if a field can be auto-filled
 */
export function isAutoFillable(path: string): boolean {
  const field = getFieldDef(path);
  return field ? getAutoFillMode(field) === 'auto' : true;
}
