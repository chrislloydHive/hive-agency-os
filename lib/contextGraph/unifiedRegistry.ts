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
import {
  CANONICAL_CONVERSION_ACTIONS,
  getConversionActionLabel,
} from '@/lib/constants/conversionActions';

// ============================================================================
// Types
// ============================================================================

export type FieldSource = 'user' | 'ai' | 'lab' | 'strategy' | 'import';
export type FieldStatus = 'confirmed' | 'proposed';

/**
 * Field value types for schema V2
 * - text: Short text input
 * - select: Single selection from predefined options
 * - multi-select: Multiple selections from options (with optional custom values)
 * - list: User-defined list of strings (add/remove)
 * - number: Numeric value
 * - url: URL with validation
 * - string/string[]/array/object/competitors: Legacy types for backward compatibility
 */
export type FieldValueType =
  | 'text'          // Short text input
  | 'select'        // Single selection from options
  | 'multi-select'  // Multiple selections (optionally allow custom)
  | 'list'          // User-defined list items
  | 'number'        // Numeric value
  | 'url'           // URL with validation
  // Legacy types (backward compatibility)
  | 'string'
  | 'string[]'
  | 'boolean'
  | 'array'
  | 'object'
  | 'competitors';

/**
 * Option for select/multi-select fields
 */
export interface SelectOption {
  value: string;
  label: string;
}

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

  // === Select/Multi-Select Options (Schema V2) ===
  /** Options for select/multi-select fields */
  options?: SelectOption[];
  /** For multi-select: whether custom values beyond options are allowed */
  allowCustomOptions?: boolean;
}

// ============================================================================
// Default Source Priority
// ============================================================================

export const DEFAULT_SOURCE_PRIORITY: FieldSource[] = ['user', 'lab', 'ai', 'strategy', 'import'];

// ============================================================================
// CONTEXT SCHEMA V2 - STRICT PREDEFINED FIELDS
// ============================================================================
// The new schema has exactly 48 predefined fields across 8 zones.
// No arbitrary "Notes" or free-form fields. AI can only populate these keys.
// ============================================================================

/**
 * Schema V2 field keys - the ONLY valid context fields
 * 48 total fields across 8 zones
 */
export const CONTEXT_SCHEMA_V2_KEYS = [
  // Zone A: Business Reality (8 fields)
  'businessReality.industry',
  'businessReality.marketStage',
  'businessReality.businessModel',
  'businessReality.businessArchetype',
  'businessReality.seasonalityNotes',
  'businessReality.pricingRange',
  'businessReality.geoFocus',
  'businessReality.salesMotion',

  // Zone B: Audience/ICP (8 fields)
  'audience.primaryAudience',
  'audience.icpDescription',
  'audience.secondaryAudiences',
  'audience.customerPainPoints',
  'audience.purchaseTriggers',
  'audience.decisionCriteria',
  'audience.commonObjections',
  'audience.mediaHabits',

  // Zone C: Offer (6 fields)
  'offer.productsServices',
  'offer.primaryOffer',
  'offer.pricingModel',
  'offer.freeTrialOrFreemium',
  'offer.coreOutcome',
  'offer.differentiatorsObserved',

  // Zone D: Brand (6 fields) - NO toneOfVoice
  'brand.brandAttributes',
  'brand.brandDos',
  'brand.brandDonts',
  'brand.approvedMessagingPillars',
  'brand.existingBrandGuidelines',
  'brand.brandGuidelinesLink',

  // Zone E: Go-to-Market (5 fields)
  'gtm.activeChannels',
  'gtm.salesChannels',
  'gtm.conversionAction',
  'gtm.currentFunnelMotion',
  'gtm.partnerships',

  // Zone F: Competitive Landscape (4 fields)
  'competitive.competitors',
  'competitive.categoryAlternatives',
  'competitive.replacementAlternatives',
  'competitive.competitiveNotes',

  // Zone G: Constraints (6 fields)
  'constraints.minBudget',
  'constraints.maxBudget',
  'constraints.geoRestrictions',
  'constraints.complianceLegal',
  'constraints.timeConstraints',
  'constraints.techConstraints',

  // Zone H: Execution Capabilities (5 fields)
  'capabilities.teamCapacity',
  'capabilities.inHouseSkills',
  'capabilities.toolsStack',
  'capabilities.brandAssetsAvailable',
  'capabilities.analyticsInstrumentation',
] as const;

export type ContextSchemaV2Key = typeof CONTEXT_SCHEMA_V2_KEYS[number];

/**
 * Check if a key is a valid Schema V2 key
 */
export function isSchemaV2Key(key: string): key is ContextSchemaV2Key {
  return (CONTEXT_SCHEMA_V2_KEYS as readonly string[]).includes(key);
}

// ============================================================================
// SCHEMA V2 SELECT OPTIONS
// ============================================================================

export const MARKET_STAGE_OPTIONS: SelectOption[] = [
  { value: 'pre-launch', label: 'Pre-launch' },
  { value: 'early', label: 'Early Stage' },
  { value: 'growth', label: 'Growth' },
  { value: 'mature', label: 'Mature' },
];

export const BUSINESS_ARCHETYPE_OPTIONS: SelectOption[] = [
  { value: 'local_service', label: 'Local Service' },
  { value: 'regional_multi_location_service', label: 'Regional / Multi-location Service' },
  { value: 'national_retail_brand', label: 'National Retail Brand' },
  { value: 'ecommerce_only', label: 'E-commerce Only' },
  { value: 'marketplace', label: 'Marketplace / Platform' },
  { value: 'saas', label: 'SaaS / Software' },
];

export const BUSINESS_MODEL_OPTIONS: SelectOption[] = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'services', label: 'Services' },
  { value: 'other', label: 'Other' },
];

export const SALES_MOTION_OPTIONS: SelectOption[] = [
  { value: 'self-serve', label: 'Self-serve' },
  { value: 'sales-led', label: 'Sales-led' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'unknown', label: 'Unknown' },
];

export const PRICING_MODEL_OPTIONS: SelectOption[] = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'one-time', label: 'One-time' },
  { value: 'usage', label: 'Usage-based' },
  { value: 'tiered', label: 'Tiered' },
  { value: 'unknown', label: 'Unknown' },
];

export const YES_NO_UNKNOWN_OPTIONS: SelectOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
];

export const YES_NO_PARTIAL_UNKNOWN_OPTIONS: SelectOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partial', label: 'Partial' },
  { value: 'unknown', label: 'Unknown' },
];

export const ANALYTICS_QUALITY_OPTIONS: SelectOption[] = [
  { value: 'good', label: 'Good' },
  { value: 'partial', label: 'Partial' },
  { value: 'poor', label: 'Poor' },
  { value: 'unknown', label: 'Unknown' },
];

export const BRAND_ATTRIBUTE_OPTIONS: SelectOption[] = [
  { value: 'approachable', label: 'Approachable' },
  { value: 'premium', label: 'Premium' },
  { value: 'playful', label: 'Playful' },
  { value: 'technical', label: 'Technical' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'bold', label: 'Bold' },
  { value: 'trustworthy', label: 'Trustworthy' },
  { value: 'innovative', label: 'Innovative' },
  { value: 'friendly', label: 'Friendly' },
];

/**
 * Primary Conversion Action options - derived from canonical list
 * @see lib/constants/conversionActions.ts for the source of truth
 */
export const PRIMARY_CONVERSION_ACTION_OPTIONS: SelectOption[] =
  CANONICAL_CONVERSION_ACTIONS.map(action => ({
    value: action.key,
    label: action.label,
  }));

// ============================================================================
// SCHEMA V2 REGISTRY - Structured Context Fields
// ============================================================================

export const CONTEXT_SCHEMA_V2_REGISTRY: UnifiedFieldEntry[] = [
  // ============================================================================
  // ZONE A: Business Reality (7 fields)
  // ============================================================================
  {
    key: 'businessReality.industry',
    label: 'Industry',
    description: 'Primary industry or market sector',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: 'businessReality',
    valueType: 'text',
    legacyPath: 'industry',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Identify the primary industry (e.g., "SaaS", "Healthcare", "E-commerce")',
  },
  {
    key: 'businessReality.marketStage',
    label: 'Market Stage',
    shortLabel: 'Stage',
    description: 'Current market/growth stage',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: 'businessReality',
    valueType: 'select',
    options: MARKET_STAGE_OPTIONS,
    legacyPath: 'marketMaturity',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: pre-launch, early, growth, or mature',
  },
  {
    key: 'businessReality.businessModel',
    label: 'Business Model',
    shortLabel: 'Model',
    description: 'Primary business model',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: 'businessReality',
    valueType: 'select',
    options: BUSINESS_MODEL_OPTIONS,
    legacyPath: 'businessModel',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    aiProposable: true,
    aiPromptHint: 'Select: subscription, marketplace, ecommerce, services, or other',
  },
  {
    key: 'businessReality.businessArchetype',
    label: 'Business Archetype',
    shortLabel: 'Archetype',
    description: 'How the business competes (local vs regional service, retail, ecommerce, marketplace, SaaS)',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: 'businessReality',
    valueType: 'select',
    options: BUSINESS_ARCHETYPE_OPTIONS,
    legacyPath: 'businessArchetype',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy', 'competition'],
    isCritical: true,
    aiProposable: true,
    aiPromptHint: 'Select: local, regional service, national retail, ecommerce, marketplace, or SaaS',
  },
  {
    key: 'businessReality.seasonalityNotes',
    label: 'Seasonality Notes',
    description: 'Notes on seasonal patterns (factual)',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: null,
    valueType: 'text',
    legacyPath: 'seasonalityNotes',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'businessReality.pricingRange',
    label: 'Pricing Range',
    description: 'Factual pricing (e.g., "$49-$199/mo")',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: null,
    valueType: 'text',
    legacyPath: 'priceRange',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'businessReality.geoFocus',
    label: 'Geographic Focus',
    shortLabel: 'Geography',
    description: 'Target geography (e.g., "US", "Pacific NW")',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: 'businessReality',
    valueType: 'text',
    legacyPath: 'geographicFootprint',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'businessReality.salesMotion',
    label: 'Sales Motion',
    description: 'How sales happen',
    domain: 'identity',
    zoneId: 'business-reality',
    category: 'businessReality',
    strategySection: null,
    valueType: 'select',
    options: SALES_MOTION_OPTIONS,
    legacyPath: 'salesMotion',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: self-serve, sales-led, hybrid, or unknown',
  },

  // ============================================================================
  // ZONE B: Audience/ICP (8 fields)
  // ============================================================================
  {
    key: 'audience.primaryAudience',
    label: 'Primary Audience',
    shortLabel: 'Audience',
    description: 'Primary target audience (role + descriptor, no messaging)',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: 'businessReality',
    valueType: 'text',
    legacyPath: 'primaryAudience',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    aiProposable: true,
    aiPromptHint: 'Role + descriptor only (e.g., "SMB marketing managers"). No messaging.',
  },
  {
    key: 'audience.icpDescription',
    label: 'ICP Description',
    shortLabel: 'ICP',
    description: 'Ideal Customer Profile - detailed description of your best-fit customer',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: 'businessReality',
    valueType: 'text',
    legacyPath: 'icpDescription',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    aiProposable: true,
    aiPromptHint: 'Describe your ideal customer in detail - industry, size, characteristics, behaviors.',
  },
  {
    key: 'audience.secondaryAudiences',
    label: 'Secondary Audiences',
    description: 'Other target audiences',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'secondaryAudience',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.customerPainPoints',
    label: 'Customer Pain Points',
    description: 'Problems customers face (phrased as problems, not solutions)',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'painPoints',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Phrase as problems, NOT solutions',
  },
  {
    key: 'audience.purchaseTriggers',
    label: 'Purchase Triggers',
    description: 'Events that cause buying',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'purchaseTriggers',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.decisionCriteria',
    label: 'Decision Criteria',
    description: 'What customers care about when deciding',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'decisionCriteria',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.commonObjections',
    label: 'Common Objections',
    description: 'Typical objections or concerns',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'commonObjections',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'audience.mediaHabits',
    label: 'Media Habits',
    description: 'Factual channels/platforms used',
    domain: 'audience',
    zoneId: 'audience',
    category: 'audience',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'mediaHabits',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Factual channels observed (e.g., "LinkedIn", "Google Search")',
  },

  // ============================================================================
  // ZONE C: Offer (6 fields)
  // ============================================================================
  {
    key: 'offer.productsServices',
    label: 'Products/Services',
    description: 'Named offerings',
    domain: 'productOffer',
    zoneId: 'offer',
    category: 'offer',
    strategySection: 'businessReality',
    valueType: 'list',
    legacyPath: 'primaryProducts',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy', 'websiteProgram'],
    isCritical: true,
    aiProposable: true,
  },
  {
    key: 'offer.primaryOffer',
    label: 'Primary Offer',
    description: 'Main offering (short text)',
    domain: 'productOffer',
    zoneId: 'offer',
    category: 'offer',
    strategySection: 'businessReality',
    valueType: 'text',
    legacyPath: 'primaryOffer',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'offer.pricingModel',
    label: 'Pricing Model',
    description: 'How pricing works',
    domain: 'productOffer',
    zoneId: 'offer',
    category: 'offer',
    strategySection: null,
    valueType: 'select',
    options: PRICING_MODEL_OPTIONS,
    legacyPath: 'pricingModel',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: subscription, one-time, usage, tiered, or unknown',
  },
  {
    key: 'offer.freeTrialOrFreemium',
    label: 'Free Trial / Freemium',
    description: 'Whether free trial or freemium is offered',
    domain: 'productOffer',
    zoneId: 'offer',
    category: 'offer',
    strategySection: null,
    valueType: 'select',
    options: YES_NO_UNKNOWN_OPTIONS,
    legacyPath: 'freeTrialOrFreemium',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: yes, no, or unknown',
  },
  {
    key: 'offer.coreOutcome',
    label: 'Core Outcome',
    description: 'What customer gets (not positioning)',
    domain: 'productOffer',
    zoneId: 'offer',
    category: 'offer',
    strategySection: 'businessReality',
    valueType: 'text',
    legacyPath: 'valueProposition',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    aiProposable: true,
    aiPromptHint: 'What customer achieves - factual outcome, not marketing copy',
  },
  {
    key: 'offer.differentiatorsObserved',
    label: 'Differentiators Observed',
    description: 'Factual differentiators (features, access, model)',
    domain: 'productOffer',
    zoneId: 'offer',
    category: 'offer',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'differentiators',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Factual differentiators only, not positioning claims',
  },

  // ============================================================================
  // ZONE D: Brand (6 fields) - NO toneOfVoice free-form
  // ============================================================================
  {
    key: 'brand.brandAttributes',
    label: 'Brand Attributes',
    description: 'Brand personality traits',
    domain: 'brand',
    zoneId: 'brand',
    category: 'brand',
    strategySection: null,
    valueType: 'multi-select',
    options: BRAND_ATTRIBUTE_OPTIONS,
    allowCustomOptions: true,
    legacyPath: 'brandAttributes',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select from: approachable, premium, playful, technical, authoritative, minimalist, bold, trustworthy, innovative, friendly. Can add custom.',
  },
  {
    key: 'brand.brandDos',
    label: 'Brand Dos',
    description: 'Things to do (e.g., "Use plain language")',
    domain: 'brand',
    zoneId: 'brand',
    category: 'brand',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'brandDos',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'brand.brandDonts',
    label: 'Brand Don\'ts',
    description: 'Things to avoid (e.g., "Avoid jargon")',
    domain: 'brand',
    zoneId: 'brand',
    category: 'brand',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'brandDonts',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'brand.approvedMessagingPillars',
    label: 'Approved Messaging Pillars',
    description: 'Pre-approved messaging themes (if known)',
    domain: 'brand',
    zoneId: 'brand',
    category: 'brand',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'messagingPillars',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'brand.existingBrandGuidelines',
    label: 'Existing Brand Guidelines',
    description: 'Whether brand guidelines exist',
    domain: 'brand',
    zoneId: 'brand',
    category: 'brand',
    strategySection: null,
    valueType: 'select',
    options: YES_NO_UNKNOWN_OPTIONS,
    legacyPath: 'existingBrandGuidelines',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: yes, no, or unknown',
  },
  {
    key: 'brand.brandGuidelinesLink',
    label: 'Brand Guidelines Link',
    description: 'URL to brand guidelines (if available)',
    domain: 'brand',
    zoneId: 'brand',
    category: 'brand',
    strategySection: null,
    valueType: 'url',
    legacyPath: 'brandGuidelinesLink',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },

  // ============================================================================
  // ZONE E: Go-to-Market (5 fields)
  // ============================================================================
  {
    key: 'gtm.activeChannels',
    label: 'Active Channels',
    description: 'Current marketing channels in use',
    domain: 'performanceMedia',
    zoneId: 'go-to-market',
    category: 'gtm',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'performanceMedia.activeChannels',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'gtm.salesChannels',
    label: 'Sales Channels',
    description: 'How sales happen (factual)',
    domain: 'productOffer',
    zoneId: 'go-to-market',
    category: 'gtm',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'salesChannels',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'gtm.conversionAction',
    label: 'Primary Conversion Action',
    shortLabel: 'Conversion',
    description: 'The single action a user must take for marketing to be considered successful (e.g., Book a demo, Start free trial, Request a quote, Complete purchase).',
    domain: 'productOffer',
    zoneId: 'go-to-market',
    category: 'gtm',
    strategySection: null,
    valueType: 'select',
    options: PRIMARY_CONVERSION_ACTION_OPTIONS,
    allowCustomOptions: true,
    legacyPath: 'primaryConversionAction',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['demandProgram'],
    isCritical: true,
    isRecommended: true,
    aiProposable: true,
    aiPromptHint: 'Select the main conversion action or enter a custom action verb phrase',
  },
  {
    key: 'gtm.currentFunnelMotion',
    label: 'Current Funnel Motion',
    description: 'Factual summary of current funnel (no advice)',
    domain: 'productOffer',
    zoneId: 'go-to-market',
    category: 'gtm',
    strategySection: null,
    valueType: 'text',
    legacyPath: 'currentFunnelMotion',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Factual summary only, no recommendations',
  },
  {
    key: 'gtm.partnerships',
    label: 'Partnerships',
    description: 'Known partnerships (if any)',
    domain: 'identity',
    zoneId: 'go-to-market',
    category: 'gtm',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'partnerships',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },

  // ============================================================================
  // ZONE F: Competitive Landscape (4 fields) - Facts only
  // ============================================================================
  {
    key: 'competitive.competitors',
    label: 'Competitors',
    description: 'Known competitors (names or domains)',
    domain: 'competitive',
    zoneId: 'competitive',
    category: 'competitive',
    strategySection: 'competition',
    valueType: 'list',
    legacyPath: 'competitors',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    isRecommended: true,
    aiProposable: true,
    aiPromptHint: 'List competitor names or domains',
  },
  {
    key: 'competitive.categoryAlternatives',
    label: 'Category Alternatives',
    description: 'Substitutes in the same category (e.g., "ClassPass", "Thumbtack")',
    domain: 'competitive',
    zoneId: 'competitive',
    category: 'competitive',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'categoryAlternatives',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'competitive.replacementAlternatives',
    label: 'Replacement Alternatives',
    description: 'Non-direct alternatives (spreadsheets, agencies, DIY)',
    domain: 'competitive',
    zoneId: 'competitive',
    category: 'competitive',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'replacementAlternatives',
    defaultStatus: 'proposed',
    defaultSource: 'ai',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'competitive.competitiveNotes',
    label: 'Competitive Notes',
    description: 'Factual competitive observations (no strategy recs)',
    domain: 'competitive',
    zoneId: 'competitive',
    category: 'competitive',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'competitorsNotes',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Factual comparisons ONLY - no strategy recommendations',
  },

  // ============================================================================
  // ZONE G: Constraints (6 fields) - All user-only (AI cannot propose)
  // ============================================================================
  {
    key: 'constraints.minBudget',
    label: 'Minimum Budget',
    shortLabel: 'Min Budget',
    description: 'Budget floor (factual)',
    domain: 'operationalConstraints',
    zoneId: 'constraints',
    category: 'constraints',
    strategySection: 'constraints',
    valueType: 'text',
    legacyPath: 'minBudget',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'constraints.maxBudget',
    label: 'Maximum Budget',
    shortLabel: 'Max Budget',
    description: 'Budget ceiling (factual)',
    domain: 'operationalConstraints',
    zoneId: 'constraints',
    category: 'constraints',
    strategySection: 'constraints',
    valueType: 'text',
    legacyPath: 'maxBudget',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'constraints.geoRestrictions',
    label: 'Geographic Restrictions',
    description: 'Geographic constraints (if any)',
    domain: 'operationalConstraints',
    zoneId: 'constraints',
    category: 'constraints',
    strategySection: 'constraints',
    valueType: 'text',
    legacyPath: 'geoRestrictions',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'constraints.complianceLegal',
    label: 'Compliance/Legal',
    description: 'Compliance or legal requirements',
    domain: 'operationalConstraints',
    zoneId: 'constraints',
    category: 'constraints',
    strategySection: 'constraints',
    valueType: 'list',
    legacyPath: 'complianceRequirements',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'constraints.timeConstraints',
    label: 'Time Constraints',
    description: 'Timeline or deadline constraints',
    domain: 'operationalConstraints',
    zoneId: 'constraints',
    category: 'constraints',
    strategySection: 'constraints',
    valueType: 'text',
    legacyPath: 'timeline',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'constraints.techConstraints',
    label: 'Tech Constraints',
    description: 'Technical constraints (e.g., "Webflow only", "No GTM")',
    domain: 'operationalConstraints',
    zoneId: 'constraints',
    category: 'constraints',
    strategySection: null,
    valueType: 'list',
    legacyPath: 'techConstraints',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },

  // ============================================================================
  // ZONE H: Execution Capabilities (5 fields)
  // ============================================================================
  {
    key: 'capabilities.teamCapacity',
    label: 'Team Capacity',
    description: 'Who can execute (factual)',
    domain: 'capabilities',
    zoneId: 'execution',
    category: 'capabilities',
    strategySection: 'executionCapabilities',
    valueType: 'text',
    legacyPath: 'teamCapacity',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'capabilities.inHouseSkills',
    label: 'In-House Skills',
    description: 'Available in-house skills',
    domain: 'capabilities',
    zoneId: 'execution',
    category: 'capabilities',
    strategySection: 'executionCapabilities',
    valueType: 'list',
    legacyPath: 'inHouseSkills',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: false, // User-only
  },
  {
    key: 'capabilities.toolsStack',
    label: 'Tools Stack',
    description: 'Current tools (GA4, HubSpot, Webflow, etc.)',
    domain: 'capabilities',
    zoneId: 'execution',
    category: 'capabilities',
    strategySection: 'executionCapabilities',
    valueType: 'list',
    legacyPath: 'toolsStack',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
  },
  {
    key: 'capabilities.brandAssetsAvailable',
    label: 'Brand Assets Available',
    description: 'Whether brand assets are available',
    domain: 'creative',
    zoneId: 'execution',
    category: 'capabilities',
    strategySection: null,
    valueType: 'select',
    options: YES_NO_PARTIAL_UNKNOWN_OPTIONS,
    legacyPath: 'brandAssetsAvailable',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: yes, no, partial, or unknown',
  },
  {
    key: 'capabilities.analyticsInstrumentation',
    label: 'Analytics Instrumentation',
    description: 'Quality of analytics setup',
    domain: 'capabilities',
    zoneId: 'execution',
    category: 'capabilities',
    strategySection: null,
    valueType: 'select',
    options: ANALYTICS_QUALITY_OPTIONS,
    legacyPath: 'analyticsInstrumentation',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    aiProposable: true,
    aiPromptHint: 'Select: good, partial, poor, or unknown',
  },
];

// Schema V2 lookup maps
export const SCHEMA_V2_BY_KEY = new Map<string, UnifiedFieldEntry>(
  CONTEXT_SCHEMA_V2_REGISTRY.map(entry => [entry.key, entry])
);

/**
 * Get Schema V2 registry entry by key
 */
export function getSchemaV2Entry(key: string): UnifiedFieldEntry | undefined {
  return SCHEMA_V2_BY_KEY.get(key);
}

/**
 * Get all Schema V2 fields for a zone
 */
export function getSchemaV2FieldsForZone(zoneId: ZoneId): UnifiedFieldEntry[] {
  return CONTEXT_SCHEMA_V2_REGISTRY.filter(entry => entry.zoneId === zoneId);
}

/**
 * Get all AI-proposable Schema V2 fields
 */
export function getSchemaV2AIProposableFields(): UnifiedFieldEntry[] {
  return CONTEXT_SCHEMA_V2_REGISTRY.filter(entry => entry.aiProposable);
}

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
    key: 'identity.businessArchetype',
    label: 'Business Archetype',
    shortLabel: 'Archetype',
    description: 'How the company competes (local service, regional service, national retail, ecommerce, marketplace, SaaS)',
    domain: 'identity',
    graphPath: 'identity.businessArchetype',
    zoneId: 'business-reality',
    category: 'identity',
    strategySection: 'businessReality',
    strategyField: 'businessArchetype',
    valueType: 'select',
    options: BUSINESS_ARCHETYPE_OPTIONS,
    legacyPath: 'businessArchetype',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy', 'competition'],
    isCritical: true,
    readinessWeight: 1,
    aiProposable: true,
    aiPromptHint: 'Select the archetype that best describes how this company competes',
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
  // NOTE: Positioning is a STRATEGIC conclusion, not raw context.
  // It should NOT block Context Map - users define positioning in Strategy Frame.
  // Context can contain differentiators, market alternatives, competitive notes,
  // but NOT a required "Positioning" statement that blocks workflow.
  {
    key: 'brand.positioning',
    label: 'Brand Positioning',
    shortLabel: 'Positioning',
    description: 'Unique market position and core value proposition (strategic - optional in context)',
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
    requiredFor: [], // REMOVED from strategy requirements - it's a strategic conclusion
    isRecommended: true, // Changed from isCritical - informational only
    readinessWeight: 0.5, // Reduced weight - not critical
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
  // NOTE: Budget is OPTIONAL context, not a hard blocker.
  // Context Budget = "Known budget constraints" (informational)
  // Strategy Budget = Strategy-level constraint (defined in Strategic Frame)
  // Budget can be inferred from context but is finalized in Strategy.
  {
    key: 'operationalConstraints.minBudget',
    label: 'Minimum Budget',
    shortLabel: 'Min Budget',
    description: 'Known budget floor (optional context, not required)',
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
    requiredFor: [], // REMOVED - budget is optional context
    isRecommended: true, // Changed from isCritical - informational only
    readinessWeight: 0.3, // Reduced weight - optional context
    aiProposable: false,
  },
  {
    key: 'operationalConstraints.maxBudget',
    label: 'Maximum Budget',
    shortLabel: 'Max Budget',
    description: 'Known budget ceiling (optional context, not required)',
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
    requiredFor: [], // REMOVED - budget is optional context
    isRecommended: true, // Changed from isCritical - informational only
    readinessWeight: 0.3, // Reduced weight - optional context
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
  // NOTE: Competitors is INFORMATIONAL context, not a hard blocker.
  // Having competitor info improves AI confidence but doesn't block workflow.
  // Context gaps inform AI confidence but do not halt workflow.
  {
    key: 'competitive.competitors',
    label: 'Competitors',
    description: 'Known competitors in the market (informational, improves AI confidence)',
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
    requiredFor: ['competition'], // Only required for Competition Lab, not strategy
    isRecommended: true, // Changed from isCritical - informational gap, not blocker
    readinessWeight: 0.5, // Reduced weight - affects confidence, not blocking
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
  // ZONE: Offer (What We Sell)
  // ============================================================================
  {
    key: 'productOffer.valueProposition',
    label: 'Value Proposition',
    shortLabel: 'Value Prop',
    description: 'Why customers choose this company over alternatives',
    domain: 'productOffer',
    graphPath: 'productOffer.valueProposition',
    zoneId: 'offer',
    category: 'productOffer',
    strategySection: 'businessReality',
    strategyField: 'valueProposition',
    valueType: 'string',
    legacyPath: 'valueProposition',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: ['strategy'],
    isCritical: true,
    readinessWeight: 1.0,
    aiProposable: true,
    aiPromptHint: 'Define the unique value and benefits offered to customers',
  },
  {
    key: 'productOffer.primaryProducts',
    label: 'Primary Products/Services',
    shortLabel: 'Offering',
    domain: 'productOffer',
    graphPath: 'productOffer.primaryProducts',
    zoneId: 'offer',
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
    key: 'productOffer.heroProducts',
    label: 'Hero Products',
    shortLabel: 'Hero Products',
    description: 'Flagship or best-selling products',
    domain: 'productOffer',
    graphPath: 'productOffer.heroProducts',
    zoneId: 'offer',
    category: 'productOffer',
    strategySection: null,
    valueType: 'array',
    legacyPath: 'heroProducts',
    defaultStatus: 'confirmed',
    defaultSource: 'user',
    requiredFor: [],
    isRecommended: true,
    aiProposable: true,
    aiPromptHint: 'Identify flagship or best-selling products',
  },

  // ============================================================================
  // ZONE: Go-to-Market (How We Sell)
  // ============================================================================
  // REMOVED: productOffer.primaryConversionAction - consolidated into gtm.conversionAction
  // See gtm.conversionAction in the Go-to-Market zone for the canonical field
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
