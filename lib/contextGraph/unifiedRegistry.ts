// lib/contextGraph/unifiedRegistry.ts
// Unified Context Field Registry - Single Source of Truth
//
// CANONICAL CONTEXT DOCTRINE (see docs/context/reuse-affirmation.md):
// =======================================================================
// Context = durable, factual truth about the business that exists BEFORE strategy.
//
// Context MUST:
// - Be stable over time
// - Be usable by all AI systems
// - Never contain goals, scores, evaluations, or recommendations
// - Never depend on diagnostics or outcomes
//
// If a field answers "what should we do?", "how are we performing?",
// or "what should change?" → it DOES NOT belong in Context.
//
// EXPLICITLY EXCLUDED FROM CONTEXT:
// ❌ Objectives Zone (entire) → belongs in Strategy
// ❌ Health Scores / Dimension Scores → belongs in Diagnostics
// ❌ Position Summary / Threat Levels → synthesized conclusions → Strategy
// ❌ Whitespace / Opportunities → synthesized conclusions → Strategy
// ❌ Content Score / SEO Score / Website Score → Diagnostics
// ❌ Status / Performance / Maturity evaluations → Diagnostics
// =======================================================================
//
// RULES:
// 1. All context fields MUST be defined here
// 2. Form sections = registry grouped by domain
// 3. Map zones = registry grouped by zoneId
// 4. Dev mode validates that all rendered fields exist in registry
// 5. Diagnostics/Labs may READ context but NEVER WRITE to it
// 6. AI can only create PROPOSED nodes, never overwrite CONFIRMED

import type { ZoneId } from '@/components/context-map/types';
import type { DomainName } from './companyContextGraph';

// ============================================================================
// Types
// ============================================================================

export type FieldSource = 'user' | 'ai' | 'lab' | 'strategy' | 'import';
export type FieldStatus = 'confirmed' | 'proposed';
export type FieldValueType = 'string' | 'string[]' | 'number' | 'boolean' | 'array' | 'object' | 'competitors';

/**
 * Strategy Input sections that fields can belong to
 */
export type StrategySection =
  | 'businessReality'
  | 'constraints'
  | 'competition'
  | 'executionCapabilities'
  | null; // Some fields don't appear in Strategy Inputs

/**
 * Domains/features that can require a field
 */
export type RequiredForDomain =
  | 'strategy'           // Required for strategy readiness
  | 'websiteProgram'     // Required for Website Program generation
  | 'contentProgram'     // Required for Content Program
  | 'demandProgram'      // Required for Demand Gen Program
  | 'seoProgram'         // Required for SEO Program
  | 'competition';       // Required for Competition Lab

/**
 * Unified field registry entry
 * Combines Context Map, Context Form, and Strategy linkage
 */
export interface UnifiedFieldEntry {
  // === Identity ===
  /** Canonical, stable key (e.g., 'identity.businessModel') */
  key: string;
  /** Human-readable label */
  label: string;
  /** Short label for compact displays */
  shortLabel?: string;
  /** Description for tooltips/help */
  description?: string;

  // === Graph Domain Placement (for Form) ===
  /** Domain in CompanyContextGraph - used for Form sections */
  domain: DomainName;
  /** Path in CompanyContextGraph (for resolver) */
  graphPath?: string;

  // === Context Map Zone Placement ===
  /** Zone ID where this field appears in Context Map */
  zoneId: ZoneId;
  /** Category within the zone (for sub-grouping) */
  category: string;

  // === Strategy Inputs Placement ===
  /** Strategy Inputs section (null = not in Strategy Inputs) */
  strategySection: StrategySection;
  /** Field name within the Strategy section (for mapping) */
  strategyField?: string;

  // === Data Shape ===
  /** Type of value */
  valueType: FieldValueType;
  /** Path in legacy CompanyContext object (dot notation) */
  legacyPath: string;

  // === Defaults ===
  /** Default status for new entries */
  defaultStatus: FieldStatus;
  /** Default source */
  defaultSource: FieldSource;

  // === Requirements ===
  /** Domains that require this field */
  requiredFor: RequiredForDomain[];
  /** Is this critical (blocks strategy)? */
  isCritical?: boolean;
  /** Is this recommended but not critical? */
  isRecommended?: boolean;

  // === Readiness ===
  /** Weight for readiness calculation (0-1, higher = more important) */
  readinessWeight?: number;

  // === Resolution ===
  /** Source priority for resolution (higher = preferred) */
  sourcePriority?: FieldSource[];

  // === AI Generation ===
  /** Whether AI can propose values for this field */
  aiProposable?: boolean;
  /** Prompt hint for AI when generating proposals */
  aiPromptHint?: string;

  // === Visibility ===
  /** Whether to show in Form view (default: true) */
  showInForm?: boolean;
  /** Whether to show in Map view (default: true) */
  showInMap?: boolean;
}

// ============================================================================
// Default Source Priority
// ============================================================================

export const DEFAULT_SOURCE_PRIORITY: FieldSource[] = ['user', 'lab', 'ai', 'strategy', 'import'];

// ============================================================================
// CANONICAL ZONES (per doctrine)
// ============================================================================
// 1. Business Reality - identity, brand (factual only)
// 2. Audience / ICP - audience segments
// 3. Constraints - budget, timeline, compliance, restrictions
// 4. Competitive Landscape - FACTS ONLY (competitors, notes)
// 5. Go-to-Market - factual mechanics (conversion action, sales motion)
// 6. Geography & Seasonality - scope, service area, patterns
// 7. Pricing & Unit Economics - price range, AOV, LTV
// 8. Execution Reality - CAPABILITIES only (team, platform stack) - NOT scores
// ============================================================================

// ============================================================================
// Unified Field Registry - CANONICAL FIELDS ONLY
// ============================================================================

export const UNIFIED_FIELD_REGISTRY: UnifiedFieldEntry[] = [
  // ============================================================================
  // ZONE 1: Business Reality (Identity + Brand - factual only)
  // ============================================================================
  {
    key: 'identity.businessModel',
    label: 'Business Model',
    shortLabel: 'Model',
    description: 'Primary business model (B2B, B2C, SaaS, eCommerce, etc.)',
    domain: 'identity',
    graphPath: 'identity.businessModel',
    zoneId: 'business-reality',
    category: 'identity',
    strategySection: 'businessReality',
    strategyField: 'businessModel',
    valueType: 'string',
    legacyPath: 'businessModel',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    readinessWeight: 1.0,
    aiProposable: true,
    aiPromptHint: 'Infer the business model from company description',
  },
  {
    key: 'identity.businessName',
    label: 'Business Name',
    shortLabel: 'Name',
    domain: 'identity',
    graphPath: 'identity.businessName',
    zoneId: 'business-reality',
    category: 'identity',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'businessName',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    showInMap: false, // Basic info, not needed in map
  },
  {
    key: 'identity.industry',
    label: 'Industry',
    domain: 'identity',
    graphPath: 'identity.industry',
    zoneId: 'business-reality',
    category: 'identity',
    strategySection: 'businessReality',
    strategyField: 'industry',
    valueType: 'string',
    legacyPath: 'industry',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    readinessWeight: 0.5,
    aiProposable: true,
  },
  {
    key: 'identity.marketMaturity',
    label: 'Market Maturity',
    shortLabel: 'Stage',
    description: 'Growth stage: Startup, Growth, Mature, Declining',
    domain: 'identity',
    graphPath: 'identity.marketMaturity',
    zoneId: 'business-reality',
    category: 'identity',
    strategySection: 'businessReality',
    strategyField: 'stage',
    valueType: 'string',
    legacyPath: 'marketMaturity',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    readinessWeight: 0.3,
    aiProposable: true,
  },
  {
    key: 'identity.geographicFootprint',
    label: 'Geographic Footprint',
    shortLabel: 'Geography',
    domain: 'identity',
    graphPath: 'identity.geographicFootprint',
    zoneId: 'business-reality',
    category: 'identity',
    strategySection: 'businessReality',
    strategyField: 'geographicFootprint',
    valueType: 'string',
    legacyPath: 'geographicFootprint',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    readinessWeight: 0.4,
    aiProposable: true,
  },
  {
    key: 'identity.seasonalityNotes',
    label: 'Seasonality Notes',
    domain: 'identity',
    graphPath: 'identity.seasonalityNotes',
    zoneId: 'overflow',
    category: 'ops',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'seasonalityNotes',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  // Brand fields (factual only - value proposition is structured narrative)
  {
    key: 'brand.positioning',
    label: 'Brand Positioning',
    shortLabel: 'Positioning',
    description: 'Unique market position and core value proposition',
    domain: 'brand',
    graphPath: 'brand.positioning',
    zoneId: 'business-reality',
    category: 'brand',
    strategySection: 'businessReality',
    strategyField: 'valueProposition',
    valueType: 'string',
    legacyPath: 'positioning',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    readinessWeight: 0.9,
    aiProposable: true,
    aiPromptHint: 'Define the unique market position and value proposition',
  },
  {
    key: 'brand.valueProps',
    label: 'Value Propositions',
    domain: 'brand',
    graphPath: 'brand.valueProps',
    zoneId: 'business-reality',
    category: 'brand',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'valueProps',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'brand.differentiators',
    label: 'Differentiators',
    domain: 'brand',
    graphPath: 'brand.differentiators',
    zoneId: 'business-reality',
    category: 'brand',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'differentiators',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'brand.toneOfVoice',
    label: 'Tone of Voice',
    domain: 'brand',
    graphPath: 'brand.toneOfVoice',
    zoneId: 'business-reality',
    category: 'brand',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'toneOfVoice',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'brand.tagline',
    label: 'Tagline',
    domain: 'brand',
    graphPath: 'brand.tagline',
    zoneId: 'business-reality',
    category: 'brand',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'tagline',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
  },

  // ============================================================================
  // ZONE 2: Audience / ICP
  // ============================================================================
  {
    key: 'audience.primaryAudience',
    label: 'Primary Audience',
    shortLabel: 'Audience',
    description: 'Primary target audience segment',
    domain: 'audience',
    graphPath: 'audience.primaryAudience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: 'businessReality',
    strategyField: 'primaryAudience',
    valueType: 'string',
    legacyPath: 'primaryAudience',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy', 'demandProgram'],
    isCritical: true,
    readinessWeight: 1.0,
    aiProposable: true,
    aiPromptHint: 'Identify the primary target audience segment',
  },
  {
    key: 'audience.secondaryAudience',
    label: 'Secondary Audience',
    domain: 'audience',
    graphPath: 'audience.secondaryAudience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'secondaryAudience',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.icpDescription',
    label: 'ICP Description',
    shortLabel: 'ICP',
    description: 'Ideal Customer Profile description',
    domain: 'audience',
    graphPath: 'audience.icpDescription',
    zoneId: 'audience',
    category: 'audience',
    strategySection: 'businessReality',
    strategyField: 'icpDescription',
    valueType: 'string',
    legacyPath: 'icpDescription',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    readinessWeight: 1.0,
    aiProposable: true,
    aiPromptHint: 'Describe the ideal customer profile in detail',
  },
  {
    key: 'audience.coreSegments',
    label: 'Core Segments',
    domain: 'audience',
    graphPath: 'audience.coreSegments',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'coreSegments',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.demographics',
    label: 'Demographics',
    domain: 'audience',
    graphPath: 'audience.demographics',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'demographics',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.painPoints',
    label: 'Pain Points',
    domain: 'audience',
    graphPath: 'audience.painPoints',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'painPoints',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.mediaHabits',
    label: 'Media Habits',
    domain: 'audience',
    graphPath: 'audience.mediaHabits',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'mediaHabits',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },

  // ============================================================================
  // ZONE 3: Constraints (Budget, Timeline, Compliance, Restrictions)
  // ============================================================================
  {
    key: 'operationalConstraints.minBudget',
    label: 'Minimum Budget',
    shortLabel: 'Min Budget',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.minBudget',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'minBudget',
    valueType: 'number',
    legacyPath: 'minBudget',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    readinessWeight: 0.8,
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.maxBudget',
    label: 'Maximum Budget',
    shortLabel: 'Max Budget',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.maxBudget',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'maxBudget',
    valueType: 'number',
    legacyPath: 'maxBudget',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    readinessWeight: 0.8,
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.timeline',
    label: 'Timeline',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.timeline',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'timeline',
    valueType: 'string',
    legacyPath: 'timeline',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.channelRestrictions',
    label: 'Channel Restrictions',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.channelRestrictions',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'channelRestrictions',
    valueType: 'array',
    legacyPath: 'channelRestrictions',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.complianceRequirements',
    label: 'Compliance Requirements',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.complianceRequirements',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'complianceRequirements',
    valueType: 'array',
    legacyPath: 'complianceRequirements',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.blackoutPeriods',
    label: 'Blackout Periods',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.blackoutPeriods',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'blackoutPeriods',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.legalRestrictions',
    label: 'Legal Restrictions',
    shortLabel: 'Legal',
    description: 'Legal or regulatory restrictions affecting marketing',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.legalRestrictions',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'legalRestrictions',
    valueType: 'string',
    legacyPath: 'legalRestrictions',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.launchDeadlines',
    label: 'Launch Deadlines',
    shortLabel: 'Deadlines',
    description: 'Key launch deadlines or milestone dates',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.launchDeadlines',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: 'constraints',
    strategyField: 'launchDeadlines',
    valueType: 'array',
    legacyPath: 'launchDeadlines',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.platformRestrictions',
    label: 'Platform Restrictions',
    domain: 'operationalConstraints',
    graphPath: 'operationalConstraints.platformRestrictions',
    zoneId: 'constraints',
    category: 'operationalConstraints',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'platformRestrictions',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },

  // ============================================================================
  // ZONE 4: Competitive Landscape (FACTS ONLY)
  // REMOVED: positionSummary, competitiveAdvantages, overallThreatLevel
  // (These are synthesized conclusions - belong in Strategy/Labs)
  // ============================================================================
  {
    key: 'competitive.competitors',
    label: 'Competitors',
    domain: 'competitive',
    graphPath: 'competitive.competitors',
    zoneId: 'competitive',
    category: 'competitive',
    strategySection: 'competition',
    strategyField: 'competitors',
    valueType: 'competitors',
    legacyPath: 'competitors',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: ['strategy', 'competition'],
    isCritical: true,
    readinessWeight: 0.7,
    aiProposable: true,
    aiPromptHint: 'Identify key competitors in the market',
  },
  {
    key: 'competitive.competitorsNotes',
    label: 'Competitive Notes',
    description: 'Factual notes about competitors (not synthesized conclusions)',
    domain: 'competitive',
    graphPath: 'competitive.competitorsNotes',
    zoneId: 'competitive',
    category: 'competitive',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'competitorsNotes',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
  },
  // NOTE: positionSummary, competitiveAdvantages, overallThreatLevel REMOVED
  // These are synthesized conclusions that belong in Strategy/Labs, not Context

  // ============================================================================
  // ZONE 5: Go-to-Market (Factual Mechanics ONLY)
  // ============================================================================
  {
    key: 'productOffer.primaryProducts',
    label: 'Primary Products/Services',
    shortLabel: 'Offering',
    domain: 'productOffer',
    graphPath: 'productOffer.primaryProducts',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: 'businessReality',
    strategyField: 'primaryOffering',
    valueType: 'array',
    legacyPath: 'primaryProducts',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy', 'websiteProgram'],
    isCritical: true,
    readinessWeight: 1.0,
    aiProposable: true,
    aiPromptHint: 'Identify the main products or services offered',
  },
  {
    key: 'productOffer.primaryConversionAction',
    label: 'Primary Conversion Action',
    description: 'Lead, signup, purchase, etc.',
    domain: 'productOffer',
    graphPath: 'productOffer.primaryConversionAction',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'primaryConversionAction',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    aiProposable: true,
  },
  {
    key: 'productOffer.salesChannels',
    label: 'Sales Channels',
    description: 'Self-serve, sales-led, marketplace, etc.',
    domain: 'productOffer',
    graphPath: 'productOffer.salesChannels',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'salesChannels',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'performanceMedia.activeChannels',
    label: 'Active Channels',
    description: 'Current marketing channels in use',
    domain: 'performanceMedia',
    graphPath: 'performanceMedia.activeChannels',
    zoneId: 'go-to-market',
    category: 'performanceMedia',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'performanceMedia.activeChannels',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'performanceMedia.totalMonthlySpend',
    label: 'Total Monthly Spend',
    description: 'Current monthly ad spend (factual)',
    domain: 'performanceMedia',
    graphPath: 'performanceMedia.totalMonthlySpend',
    zoneId: 'go-to-market',
    category: 'performanceMedia',
    strategySection: null,
    valueType: 'number',
    legacyPath: 'performanceMedia.totalMonthlySpend',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },

  // ============================================================================
  // ZONE 6: Geography & Seasonality
  // ============================================================================
  {
    key: 'ops.geographicScope',
    label: 'Geographic Scope',
    domain: 'ops',
    graphPath: 'ops.geographicScope',
    zoneId: 'overflow',
    category: 'ops',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'geographicScope',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    aiProposable: true,
  },
  {
    key: 'ops.serviceArea',
    label: 'Service Area',
    domain: 'ops',
    graphPath: 'ops.serviceArea',
    zoneId: 'overflow',
    category: 'ops',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'serviceArea',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'ops.peakSeasons',
    label: 'Peak Seasons',
    domain: 'ops',
    graphPath: 'ops.peakSeasons',
    zoneId: 'overflow',
    category: 'ops',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'peakSeasons',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'ops.notes',
    label: 'Additional Notes',
    domain: 'ops',
    graphPath: 'ops.notes',
    zoneId: 'overflow',
    category: 'ops',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'notes',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
  },

  // ============================================================================
  // ZONE 7: Pricing & Unit Economics (factual only)
  // ============================================================================
  {
    key: 'productOffer.priceRange',
    label: 'Price Range',
    domain: 'productOffer',
    graphPath: 'productOffer.priceRange',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'priceRange',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    aiProposable: false,
  },
  {
    key: 'productOffer.avgOrderValue',
    label: 'Average Order Value',
    shortLabel: 'AOV',
    domain: 'productOffer',
    graphPath: 'productOffer.avgOrderValue',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: null,
    valueType: 'number',
    legacyPath: 'avgOrderValue',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    aiProposable: false,
  },
  {
    key: 'productOffer.customerLTV',
    label: 'Customer Lifetime Value',
    shortLabel: 'LTV',
    domain: 'productOffer',
    graphPath: 'productOffer.customerLTV',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: null,
    valueType: 'number',
    legacyPath: 'customerLTV',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },
  {
    key: 'productOffer.grossMargin',
    label: 'Gross Margin',
    domain: 'productOffer',
    graphPath: 'productOffer.grossMargin',
    zoneId: 'go-to-market',
    category: 'productOffer',
    strategySection: null,
    valueType: 'number',
    legacyPath: 'grossMargin',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false,
  },

  // ============================================================================
  // ZONE 8: Execution Reality - CAPABILITIES ONLY (NOT scores/evaluations)
  // REMOVED: website.quality, performance, websiteScore, executiveSummary
  // REMOVED: content.maturity, contentScore
  // REMOVED: seo.status, seoScore
  // (These are diagnostic evaluations - belong in Labs/Diagnostics)
  // ============================================================================
  {
    key: 'creative.brandAssets',
    label: 'Brand/Creative Assets',
    description: 'Factual list of available brand assets',
    domain: 'creative',
    graphPath: 'creative.brandAssets',
    zoneId: 'execution',
    category: 'creative',
    strategySection: null,
    valueType: 'string',
    legacyPath: 'creative.brandAssets',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  // NOTE: All website/content/seo SCORES and EVALUATIONS removed.
  // Diagnostics output should be stored in Labs/Reports, not Context.
];

// ============================================================================
// REMOVED FIELDS REGISTRY (for migration/audit purposes)
// These were removed per the canonicalization doctrine.
// ============================================================================

export const REMOVED_FIELDS = [
  // Objectives zone (entire) - belongs in Strategy
  'objectives.primaryObjective',
  'objectives.secondaryObjectives',
  'objectives.keyMetrics',
  'objectives.targetCpa',
  'objectives.targetRoas',
  // Competitive synthesized conclusions - belongs in Strategy/Labs
  'competitive.positionSummary',
  'competitive.competitiveAdvantages',
  'competitive.overallThreatLevel',
  'competitive.primaryAxis',
  'competitive.secondaryAxis',
  'competitive.whitespaceOpportunities',
  'competitive.competitiveOpportunities',
  'competitive.competitiveThreats',
  // Execution scores/evaluations - belongs in Diagnostics
  'website.quality',
  'website.performance',
  'website.executiveSummary',
  'website.websiteScore',
  'content.maturity',
  'content.contentScore',
  'seo.status',
  'seo.seoScore',
  // Derived diagnostic outputs (non-canonical context)
  'brand.healthScore',
  'brand.dimensionScores',
] as const;

export type RemovedFieldKey = typeof REMOVED_FIELDS[number];

/**
 * Check if a field key was removed from canonical context
 */
export function isRemovedField(key: string): boolean {
  return (REMOVED_FIELDS as readonly string[]).includes(key);
}

// ============================================================================
// Registry Lookup Maps (pre-computed for performance)
// ============================================================================

/** Map of field key to registry entry */
export const REGISTRY_BY_KEY = new Map<string, UnifiedFieldEntry>(
  UNIFIED_FIELD_REGISTRY.map(entry => [entry.key, entry])
);

/** Map of legacy path to registry entry */
export const REGISTRY_BY_LEGACY_PATH = new Map<string, UnifiedFieldEntry>(
  UNIFIED_FIELD_REGISTRY.map(entry => [entry.legacyPath, entry])
);

/** Map of graph path to registry entry */
export const REGISTRY_BY_GRAPH_PATH = new Map<string, UnifiedFieldEntry>(
  UNIFIED_FIELD_REGISTRY
    .filter(entry => entry.graphPath)
    .map(entry => [entry.graphPath!, entry])
);

// ============================================================================
// Registry Lookup Functions
// ============================================================================

/**
 * Get registry entry by field key
 */
export function getRegistryEntry(key: string): UnifiedFieldEntry | undefined {
  return REGISTRY_BY_KEY.get(key);
}

/**
 * Get registry entry by legacy path
 */
export function getRegistryEntryByLegacyPath(legacyPath: string): UnifiedFieldEntry | undefined {
  return REGISTRY_BY_LEGACY_PATH.get(legacyPath);
}

/**
 * Get registry entry by graph path
 */
export function getRegistryEntryByGraphPath(graphPath: string): UnifiedFieldEntry | undefined {
  return REGISTRY_BY_GRAPH_PATH.get(graphPath);
}

/**
 * Check if a field key is canonical (exists in registry)
 */
export function isCanonicalField(key: string): boolean {
  return REGISTRY_BY_KEY.has(key);
}

// ============================================================================
// Form View Functions (grouped by domain)
// ============================================================================

/**
 * Get all fields for a specific domain (for Form sections)
 */
export function getFieldsForDomain(domain: DomainName): UnifiedFieldEntry[] {
  return UNIFIED_FIELD_REGISTRY.filter(
    entry => entry.domain === domain && entry.showInForm !== false
  );
}

/**
 * Get all domains that have at least one field
 */
export function getDomainsWithFields(): DomainName[] {
  const domains = new Set<DomainName>();
  for (const entry of UNIFIED_FIELD_REGISTRY) {
    if (entry.showInForm !== false) {
      domains.add(entry.domain);
    }
  }
  return Array.from(domains);
}

// ============================================================================
// Map View Functions (grouped by zone)
// ============================================================================

/**
 * Get all fields for a specific zone (for Map zones)
 */
export function getFieldsForZone(zoneId: ZoneId): UnifiedFieldEntry[] {
  return UNIFIED_FIELD_REGISTRY.filter(
    entry => entry.zoneId === zoneId && entry.showInMap !== false
  );
}

/**
 * Get all zones that have at least one field
 */
export function getZonesWithFields(): ZoneId[] {
  const zones = new Set<ZoneId>();
  for (const entry of UNIFIED_FIELD_REGISTRY) {
    if (entry.showInMap !== false) {
      zones.add(entry.zoneId);
    }
  }
  return Array.from(zones);
}

// ============================================================================
// Strategy Functions
// ============================================================================

/**
 * Get all fields for a specific strategy section
 */
export function getFieldsForStrategySection(section: StrategySection): UnifiedFieldEntry[] {
  return UNIFIED_FIELD_REGISTRY.filter(entry => entry.strategySection === section);
}

/**
 * Get all fields required for a domain
 */
export function getFieldsRequiredFor(domain: RequiredForDomain): UnifiedFieldEntry[] {
  return UNIFIED_FIELD_REGISTRY.filter(entry => entry.requiredFor.includes(domain));
}

/**
 * Get all critical fields
 */
export function getCriticalFields(): UnifiedFieldEntry[] {
  return UNIFIED_FIELD_REGISTRY.filter(entry => entry.isCritical);
}

/**
 * Get all AI-proposable fields
 */
export function getAIProposableFields(): UnifiedFieldEntry[] {
  return UNIFIED_FIELD_REGISTRY.filter(entry => entry.aiProposable);
}

// ============================================================================
// Label & UI Helpers
// ============================================================================

/**
 * Get label for a field by key
 */
export function getLabelForKey(key: string): string {
  const entry = getRegistryEntry(key);
  if (entry) return entry.label;

  // Fallback: convert key to title case
  const parts = key.split('.');
  const last = parts[parts.length - 1];
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Get short label for a field by key (falls back to full label)
 */
export function getShortLabelForKey(key: string): string {
  const entry = getRegistryEntry(key);
  return entry?.shortLabel || entry?.label || getLabelForKey(key);
}

// ============================================================================
// Dev-Only Validation
// ============================================================================

/**
 * Validate that a set of field keys all exist in the registry
 * Throws in development, logs warning in production
 */
export function validateFieldKeys(keys: string[], context: string): void {
  const missing = keys.filter(key => !REGISTRY_BY_KEY.has(key));

  if (missing.length > 0) {
    // Check if they're removed fields (expected)
    const removedKeys = missing.filter(isRemovedField);
    const unknownKeys = missing.filter(k => !isRemovedField(k));

    if (removedKeys.length > 0) {
      console.info(`[UnifiedRegistry:${context}] Skipping removed fields: ${removedKeys.join(', ')}`);
    }

    if (unknownKeys.length > 0) {
      const message = `[UnifiedRegistry:${context}] Unknown field keys: ${unknownKeys.join(', ')}`;

      if (process.env.NODE_ENV === 'development') {
        console.error(message);
      } else {
        console.warn(message);
      }
    }
  }
}

/**
 * Validate that a graph path exists in the registry
 */
export function validateGraphPath(path: string, context: string): boolean {
  // First check if it's a removed field (expected to not exist)
  if (isRemovedField(path)) {
    return false;
  }

  const exists = REGISTRY_BY_GRAPH_PATH.has(path) || REGISTRY_BY_KEY.has(path);

  if (!exists && process.env.NODE_ENV === 'development') {
    console.warn(`[UnifiedRegistry:${context}] Unknown graph path: ${path}`);
  }

  return exists;
}

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Map of legacy keys to current keys for migration
 * NOTE: Objectives and score fields are REMOVED, not migrated
 */
export const LEGACY_KEY_MIGRATION: Record<string, string> = {
  // Old key format → new key format
  'businessModel': 'identity.businessModel',
  'valueProposition': 'brand.positioning',
  'companyCategory': 'identity.industry',
  'marketSignals': 'identity.marketMaturity',
  'primaryAudience': 'audience.primaryAudience',
  'icpDescription': 'audience.icpDescription',
  'budget': 'operationalConstraints.maxBudget',
  'constraints': 'operationalConstraints.complianceRequirements',
  'competitors': 'competitive.competitors',
  'geographicScope': 'ops.geographicScope',
  // Removed: 'objectives' → 'objectives.primaryObjective' (no longer valid)
};

/**
 * Migrate a legacy key to the current key format
 * Returns null if the key has been removed from the canonical schema
 */
export function migrateLegacyKey(legacyKey: string): string | null {
  // Check if it would migrate to a removed field
  const migrated = LEGACY_KEY_MIGRATION[legacyKey] || legacyKey;
  if (isRemovedField(migrated)) {
    return null;
  }
  return migrated;
}
