// lib/contextGraph/domains/competitive.ts
// Competitive Context Domain - EXPANDED
//
// Supports:
// - Enhanced competitor profiles with category, positioning, trajectory, threats
// - Positioning map with primary/secondary axes
// - Feature matrix for competitive comparison
// - Pricing landscape model
// - Messaging overlap analysis
// - Market cluster analysis
// - Threat modeling
// - Substitute/category-creep detection
// - Differentiation insights

import { z } from 'zod';
import { WithMeta, WithMetaArray, ProvenanceTag } from '../types';

// ============================================================================
// Competitor Types
// ============================================================================

/**
 * Competitive Modality - How customers compare and choose
 * This determines what types of competitors are relevant
 */
export const CompetitiveModality = z.enum([
  'Retail+Installation',      // Full-service retail with installation (e.g., Car Toys)
  'InstallationOnly',         // Service-only installers (e.g., local car audio shops)
  'RetailWithInstallAddon',   // Retail with optional installation (e.g., Best Buy)
  'ProductOnly',              // Pure product/retail, no services (e.g., Crutchfield)
  'InternalAlternative',      // DIY or in-house alternatives
]);

export type CompetitiveModality = z.infer<typeof CompetitiveModality>;

/**
 * Competitor classification for output grouping
 */
export const CompetitorClassification = z.enum([
  'primary',       // Direct revenue threats - customers actively compare
  'contextual',    // Comparison anchors - customers may reference but less direct
]);

export type CompetitorClassification = z.infer<typeof CompetitorClassification>;

/**
 * Competitor category for grouping
 */
export const CompetitorCategory = z.enum([
  'direct',          // Direct competitors in same market
  'indirect',        // Indirect competitors (alternative solutions)
  'aspirational',    // Aspirational competitors (market leaders)
  'emerging',        // Emerging competitors (new entrants)
  'own',             // The company itself (for positioning map)
]);

export type CompetitorCategory = z.infer<typeof CompetitorCategory>;

/**
 * Competitor trajectory direction
 */
export const CompetitorTrajectory = z.enum([
  'rising',          // Growing market share / momentum
  'falling',         // Losing market share / declining
  'stagnant',        // No significant movement
]);

export type CompetitorTrajectory = z.infer<typeof CompetitorTrajectory>;

/**
 * Price tier classification
 */
export const PriceTier = z.enum([
  'low',
  'medium',
  'high',
  'premium',
  'enterprise',
]);

export type PriceTier = z.infer<typeof PriceTier>;

/**
 * Provenance record for competitor-level tracking
 */
export const CompetitorProvenance = z.object({
  field: z.string(),
  source: z.string(),
  updatedAt: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export type CompetitorProvenance = z.infer<typeof CompetitorProvenance>;

/**
 * Overlap scoring dimensions for competitor relevance
 * Each dimension is scored 0-100, with weights applied for final overlapScore
 */
export const OverlapScores = z.object({
  /** Does competitor offer installation/service capability? */
  installationCapability: z.number().min(0).max(100).default(0),
  /** Geographic proximity or overlap */
  geographicProximity: z.number().min(0).max(100).default(0),
  /** Brand trust and recognition level */
  brandTrust: z.number().min(0).max(100).default(0),
  /** Market reach / volume (national vs local) */
  marketReach: z.number().min(0).max(100).default(0),
  /** Likelihood customers substitute this for subject */
  serviceSubstitution: z.number().min(0).max(100).default(0),
  /** Product/offering overlap */
  productOverlap: z.number().min(0).max(100).default(0),
  /** Price positioning similarity */
  pricePositioning: z.number().min(0).max(100).default(0),
});

export type OverlapScores = z.infer<typeof OverlapScores>;

/**
 * Computed overall overlap with classification
 */
export const CompetitorOverlap = z.object({
  /** Individual dimension scores */
  scores: OverlapScores,
  /** Weighted overall overlap score (0-100) */
  overallScore: z.number().min(0).max(100),
  /** Classification based on score threshold */
  classification: CompetitorClassification,
  /** Why this competitor was included despite category mismatch */
  inclusionReason: z.string().nullable().default(null),
  /** Special rules that applied (e.g., "best-buy-rule") */
  rulesApplied: z.array(z.string()).default([]),
});

export type CompetitorOverlap = z.infer<typeof CompetitorOverlap>;

/**
 * Enhanced competitor profile with positioning data, trajectory, and confidence
 */
export const CompetitorProfile = z.object({
  /** Competitor name */
  name: z.string(),
  /** Domain/website */
  domain: z.string().nullable(),
  /** Legacy alias for domain */
  website: z.string().nullable(),
  /** Competitor category */
  category: CompetitorCategory.nullable(),
  /** Their positioning statement */
  positioning: z.string().nullable(),
  /** Estimated marketing budget */
  estimatedBudget: z.number().nullable(),
  /** Primary marketing channels */
  primaryChannels: z.array(z.string()).default([]),
  /** Key strengths */
  strengths: z.array(z.string()).default([]),
  /** Key weaknesses */
  weaknesses: z.array(z.string()).default([]),
  /** Unique claims made by this competitor */
  uniqueClaims: z.array(z.string()).default([]),
  /** Products/services offered */
  offers: z.array(z.string()).default([]),
  /** Pricing summary */
  pricingSummary: z.string().nullable(),
  /** Pricing notes (legacy) */
  pricingNotes: z.string().nullable(),
  /** General notes */
  notes: z.string().nullable(),
  /** Position on primary axis (-100 to +100, for positioning map) */
  xPosition: z.number().min(-100).max(100).nullable(),
  /** Position on secondary axis (-100 to +100, for positioning map) */
  yPosition: z.number().min(-100).max(100).nullable(),
  /** Position on primary axis (0-100, legacy) */
  positionPrimary: z.number().min(0).max(100).nullable(),
  /** Position on secondary axis (0-100, legacy) */
  positionSecondary: z.number().min(0).max(100).nullable(),

  // === NEW FIELDS ===

  /** Confidence score for this competitor data (0-1) */
  confidence: z.number().min(0).max(1).default(0.5),
  /** When this competitor data was last validated */
  lastValidatedAt: z.string().nullable().default(null),
  /** Trajectory direction */
  trajectory: CompetitorTrajectory.nullable().default(null),
  /** Reason for trajectory assessment */
  trajectoryReason: z.string().nullable().default(null),
  /** Per-field provenance tracking */
  provenance: z.array(CompetitorProvenance).default([]),
  /** Threat level (0-100) */
  threatLevel: z.number().min(0).max(100).nullable().default(null),
  /** Drivers of threat */
  threatDrivers: z.array(z.string()).default([]),
  /** Whether this competitor was auto-seeded by AI (not human-verified) */
  autoSeeded: z.boolean().default(false),

  // V3.5 Negative memory and signals (lightweight)
  businessModelCategory: z.string().nullable().default(null),
  jtbdMatches: z.number().min(0).max(1).nullable().default(null),
  offerOverlapScore: z.number().min(0).max(1).nullable().default(null),
  signalsVerified: z.number().nullable().default(null),

  // V3.5 Vertical category intelligence
  verticalCategory: z.enum(['retail', 'services', 'software', 'manufacturing', 'consumer-dtc', 'automotive', 'unknown']).nullable().default(null),
  subVertical: z.string().nullable().default(null),

  // V4 Overlap scoring (replaces strict category matching)
  /** Detailed overlap scoring across dimensions */
  overlap: CompetitorOverlap.nullable().default(null),
  /** Primary or contextual classification */
  competitorClassification: CompetitorClassification.nullable().default(null),
  /** Has installation/service capability */
  hasInstallation: z.boolean().default(false),
  /** Has national reach (Best Buy rule) */
  hasNationalReach: z.boolean().default(false),
});

export type CompetitorProfile = z.infer<typeof CompetitorProfile>;

/**
 * Durable list of invalid competitors (domains) to always exclude
 */
export const InvalidCompetitors = WithMetaArray(z.string());

// ============================================================================
// Feature Matrix Types
// ============================================================================

/**
 * Feature comparison entry in the matrix
 */
export const FeatureMatrixEntry = z.object({
  /** Feature name */
  featureName: z.string(),
  /** Feature description */
  description: z.string().nullable().default(null),
  /** Whether the company supports this feature */
  companySupport: z.boolean(),
  /** Competitor support for this feature */
  competitors: z.array(z.object({
    name: z.string(),
    hasFeature: z.boolean(),
    notes: z.string().nullable().default(null),
  })).default([]),
  /** Importance score (0-100) */
  importance: z.number().min(0).max(100).default(50),
});

export type FeatureMatrixEntry = z.infer<typeof FeatureMatrixEntry>;

// ============================================================================
// Pricing Landscape Types
// ============================================================================

/**
 * Pricing model for a competitor
 */
export const PricingModel = z.object({
  /** Competitor name */
  competitorName: z.string(),
  /** Price tier classification */
  priceTier: PriceTier,
  /** Detailed pricing notes */
  pricingNotes: z.string().nullable().default(null),
  /** Inferred price point (if available) */
  inferredPricePoint: z.number().nullable().default(null),
  /** Currency for price point */
  currency: z.string().default('USD'),
  /** Value for money score (0-100) */
  valueForMoneyScore: z.number().min(0).max(100).default(50),
  /** Pricing model type (subscription, one-time, freemium, etc.) */
  modelType: z.string().nullable().default(null),
});

export type PricingModel = z.infer<typeof PricingModel>;

// ============================================================================
// Messaging Overlap Types
// ============================================================================

/**
 * Messaging theme overlap analysis
 */
export const MessageOverlap = z.object({
  /** Theme or message */
  theme: z.string(),
  /** Competitors using this theme */
  competitorsUsingIt: z.array(z.string()).default([]),
  /** Overlap score (0-100) - higher means more saturated */
  overlapScore: z.number().min(0).max(100).default(0),
  /** Suggestion for differentiation */
  suggestion: z.string().nullable().default(null),
  /** Whether company is using this theme */
  companyUsing: z.boolean().default(false),
});

export type MessageOverlap = z.infer<typeof MessageOverlap>;

// ============================================================================
// Market Cluster Types
// ============================================================================

/**
 * Market cluster grouping competitors
 */
export const MarketCluster = z.object({
  /** Cluster name/label */
  clusterName: z.string(),
  /** Description of what defines this cluster */
  description: z.string().nullable().default(null),
  /** Competitors in this cluster */
  competitors: z.array(z.string()).default([]),
  /** Cluster center position on the map */
  clusterPosition: z.object({
    x: z.number().min(-100).max(100),
    y: z.number().min(-100).max(100),
  }),
  /** Threat level from this cluster (0-100) */
  threatLevel: z.number().min(0).max(100).default(50),
  /** Whitespace opportunity near this cluster */
  whitespaceOpportunity: z.string().nullable().default(null),
  /** Cluster color for visualization */
  color: z.string().nullable().default(null),
});

export type MarketCluster = z.infer<typeof MarketCluster>;

// ============================================================================
// Threat Score Types
// ============================================================================

/**
 * Threat score for a competitor
 */
export const ThreatScore = z.object({
  /** Competitor name */
  competitorName: z.string(),
  /** Overall threat level (0-100) */
  threatLevel: z.number().min(0).max(100),
  /** Drivers of this threat */
  threatDrivers: z.array(z.string()).default([]),
  /** Time horizon for threat ("immediate", "6-month", "1-year", "long-term") */
  timeHorizon: z.string().nullable().default(null),
  /** Recommended defensive actions */
  defensiveActions: z.array(z.string()).default([]),
});

export type ThreatScore = z.infer<typeof ThreatScore>;

// ============================================================================
// Substitute Types
// ============================================================================

/**
 * Substitute product/service that competes through category-creep
 */
export const Substitute = z.object({
  /** Substitute name */
  name: z.string(),
  /** Domain/website */
  domain: z.string().nullable().default(null),
  /** Reason customers choose this substitute */
  reasonCustomersChooseThem: z.string().nullable().default(null),
  /** Category they belong to */
  category: z.string().nullable().default(null),
  /** Threat level (0-100) */
  threatLevel: z.number().min(0).max(100).default(30),
  /** How to counter this substitute */
  counterStrategy: z.string().nullable().default(null),
});

export type Substitute = z.infer<typeof Substitute>;

// ============================================================================
// Whitespace Opportunity Types
// ============================================================================

/**
 * Whitespace opportunity on the positioning map
 */
export const WhitespaceOpportunity = z.object({
  /** Opportunity name/label */
  name: z.string(),
  /** Description */
  description: z.string().nullable().default(null),
  /** Position on the map */
  position: z.object({
    x: z.number().min(-100).max(100),
    y: z.number().min(-100).max(100),
  }),
  /** Size/importance of the opportunity (0-100) */
  size: z.number().min(0).max(100).default(50),
  /** Strategic fit score (0-100) */
  strategicFit: z.number().min(0).max(100).default(50),
  /** Actions to capture this whitespace */
  captureActions: z.array(z.string()).default([]),
});

export type WhitespaceOpportunity = z.infer<typeof WhitespaceOpportunity>;

// ============================================================================
// Positioning Map Types
// ============================================================================

/**
 * Positioning axis definition
 */
export const PositioningAxis = z.object({
  /** Axis label (e.g., "Premium ↔ Affordable") */
  label: z.string(),
  /** Low end label (e.g., "Affordable") */
  lowLabel: z.string(),
  /** High end label (e.g., "Premium") */
  highLabel: z.string(),
  /** Description of what this axis measures */
  description: z.string().nullable(),
});

export type PositioningAxis = z.infer<typeof PositioningAxis>;

/**
 * Positioning axes configuration
 */
export const PositioningAxes = z.object({
  /** Primary axis (horizontal) */
  primaryAxis: PositioningAxis.nullable(),
  /** Secondary axis (vertical) */
  secondaryAxis: PositioningAxis.nullable(),
});

export type PositioningAxes = z.infer<typeof PositioningAxes>;

// ============================================================================
// Competitive Domain Schema
// ============================================================================

/**
 * Competitive domain captures competitive intelligence and market positioning.
 * This informs competitive strategy and differentiation.
 */
export const CompetitiveDomain = z.object({
  // === COMPETITIVE MODALITY (V4) ===
  /** How customers compare and choose - determines competitor relevance */
  competitiveModality: WithMeta(CompetitiveModality),
  /** Customer comparison modes selected in pre-run */
  customerComparisonModes: WithMetaArray(z.enum([
    'national_retailers',
    'local_installers',
    'diy_online',
    'direct_competitors',
    'big_box_stores',
  ])),
  /** Overlap score threshold for inclusion (default 40) */
  overlapThreshold: WithMeta(z.number().min(0).max(100)),

  // === CONFIDENCE & FRESHNESS ===
  /** Overall data confidence score (0-1) */
  dataConfidence: WithMeta(z.number().min(0).max(1)),
  /** When competitive data was last validated */
  lastValidatedAt: WithMeta(z.string()),

  // === MARKET POSITION ===
  shareOfVoice: WithMeta(z.string()),
  marketPosition: WithMeta(z.string()),
  competitiveAdvantages: WithMetaArray(z.string()),

  // === POSITIONING MAP ===
  primaryAxis: WithMeta(z.string()),
  secondaryAxis: WithMeta(z.string()),
  positionSummary: WithMeta(z.string()),
  whitespaceOpportunities: WithMetaArray(z.string()),
  /** Structured whitespace opportunities with positions */
  whitespaceMap: WithMetaArray(WhitespaceOpportunity),

  // === COMPETITOR ANALYSIS ===
  competitors: WithMetaArray(CompetitorProfile),
  primaryCompetitors: WithMetaArray(CompetitorProfile), // Legacy alias for competitors

  competitorMediaMix: WithMeta(z.string()),
  competitorBudgets: WithMeta(z.string()),
  competitorSearchStrategy: WithMeta(z.string()),
  competitorCreativeThemes: WithMetaArray(z.string()),

  // === BENCHMARKS ===
  categoryBenchmarks: WithMeta(z.string()),
  categoryCpa: WithMeta(z.number()),
  categoryRoas: WithMeta(z.number()),
  categoryCtr: WithMeta(z.number()),

  // === THREATS & OPPORTUNITIES ===
  competitiveThreats: WithMetaArray(z.string()),
  competitiveOpportunities: WithMetaArray(z.string()),
  marketTrends: WithMetaArray(z.string()),

  // === DIFFERENTIATION ===
  differentiationStrategy: WithMeta(z.string()),
  uniqueValueProps: WithMetaArray(z.string()),

  // === POSITIONING MAP (LEGACY) ===
  positioningAxes: WithMeta(PositioningAxes),
  ownPositionPrimary: WithMeta(z.number().min(0).max(100)),
  ownPositionSecondary: WithMeta(z.number().min(0).max(100)),
  positioningSummary: WithMeta(z.string()),

  // === NEW: FEATURE MATRIX ===
  /** Feature comparison matrix */
  featuresMatrix: WithMetaArray(FeatureMatrixEntry),

  // === NEW: PRICING LANDSCAPE ===
  /** Pricing models for competitors */
  pricingModels: WithMetaArray(PricingModel),
  /** Own company's price tier */
  ownPriceTier: WithMeta(PriceTier),
  /** Category median price point */
  categoryMedianPrice: WithMeta(z.number()),

  // === NEW: MESSAGING OVERLAP ===
  /** Messaging theme overlap analysis */
  messageOverlap: WithMetaArray(MessageOverlap),
  /** Overall messaging differentiation score (0-100) */
  messagingDifferentiationScore: WithMeta(z.number().min(0).max(100)),

  // === NEW: MARKET CLUSTERS ===
  /** Market cluster analysis */
  marketClusters: WithMetaArray(MarketCluster),

  // === NEW: THREAT MODELING ===
  /** Detailed threat scores per competitor */
  threatScores: WithMetaArray(ThreatScore),
  /** Overall market threat level (0-100) */
  overallThreatLevel: WithMeta(z.number().min(0).max(100)),

  // === NEW: SUBSTITUTES / CATEGORY-CREEP ===
  /** Substitute products/services that compete */
  substitutes: WithMetaArray(Substitute),

  // === NEGATIVE MEMORY ===
  /** Durable list of invalid competitor domains to always exclude from analysis */
  invalidCompetitors: InvalidCompetitors,
});

export type CompetitiveDomain = z.infer<typeof CompetitiveDomain>;

// ============================================================================
// Critical Fields for Context Health
// ============================================================================

/**
 * Critical competitive fields that must be populated for health scoring
 */
export const CRITICAL_COMPETITIVE_FIELDS = [
  'competitors',
  'positioningAxes',
  'primaryAxis',
  'secondaryAxis',
  'featuresMatrix',
  'pricingModels',
  'positionSummary',
  'whitespaceOpportunities',
] as const;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty Competitive domain
 */
export function createEmptyCompetitiveDomain(): CompetitiveDomain {
  return {
    // Competitive Modality (V4)
    competitiveModality: { value: null, provenance: [] },
    customerComparisonModes: { value: [], provenance: [] },
    overlapThreshold: { value: 40, provenance: [] }, // Default threshold

    // Confidence & Freshness
    dataConfidence: { value: null, provenance: [] },
    lastValidatedAt: { value: null, provenance: [] },

    // Market Position
    shareOfVoice: { value: null, provenance: [] },
    marketPosition: { value: null, provenance: [] },
    competitiveAdvantages: { value: [], provenance: [] },

    // Positioning Map
    primaryAxis: { value: null, provenance: [] },
    secondaryAxis: { value: null, provenance: [] },
    positionSummary: { value: null, provenance: [] },
    whitespaceOpportunities: { value: [], provenance: [] },
    whitespaceMap: { value: [], provenance: [] },

    // Competitor Analysis
    competitors: { value: [], provenance: [] },
    primaryCompetitors: { value: [], provenance: [] },
    competitorMediaMix: { value: null, provenance: [] },
    competitorBudgets: { value: null, provenance: [] },
    competitorSearchStrategy: { value: null, provenance: [] },
    competitorCreativeThemes: { value: [], provenance: [] },

    // Benchmarks
    categoryBenchmarks: { value: null, provenance: [] },
    categoryCpa: { value: null, provenance: [] },
    categoryRoas: { value: null, provenance: [] },
    categoryCtr: { value: null, provenance: [] },

    // Threats & Opportunities
    competitiveThreats: { value: [], provenance: [] },
    competitiveOpportunities: { value: [], provenance: [] },
    marketTrends: { value: [], provenance: [] },

    // Differentiation
    differentiationStrategy: { value: null, provenance: [] },
    uniqueValueProps: { value: [], provenance: [] },

    // Legacy Positioning
    positioningAxes: { value: null, provenance: [] },
    ownPositionPrimary: { value: null, provenance: [] },
    ownPositionSecondary: { value: null, provenance: [] },
    positioningSummary: { value: null, provenance: [] },

    // Feature Matrix
    featuresMatrix: { value: [], provenance: [] },

    // Pricing Landscape
    pricingModels: { value: [], provenance: [] },
    ownPriceTier: { value: null, provenance: [] },
    categoryMedianPrice: { value: null, provenance: [] },

    // Messaging Overlap
    messageOverlap: { value: [], provenance: [] },
    messagingDifferentiationScore: { value: null, provenance: [] },

    // Market Clusters
    marketClusters: { value: [], provenance: [] },

    // Threat Modeling
    threatScores: { value: [], provenance: [] },
    overallThreatLevel: { value: null, provenance: [] },

    // Substitutes
    substitutes: { value: [], provenance: [] },

  // Negative competitor memory
  invalidCompetitors: { value: [], provenance: [] },
  };
}

/**
 * Create a default competitor profile
 */
export function createDefaultCompetitorProfile(name: string): CompetitorProfile {
  return {
    name,
    domain: null,
    website: null,
    category: null,
    positioning: null,
    estimatedBudget: null,
    primaryChannels: [],
    strengths: [],
    weaknesses: [],
    uniqueClaims: [],
    offers: [],
    pricingSummary: null,
    pricingNotes: null,
    notes: null,
    xPosition: null,
    yPosition: null,
    positionPrimary: null,
    positionSecondary: null,
    confidence: 0.5,
    lastValidatedAt: null,
    trajectory: null,
    trajectoryReason: null,
    provenance: [],
    threatLevel: null,
    threatDrivers: [],
    autoSeeded: false,
    // V3.5 fields
    businessModelCategory: null,
    jtbdMatches: null,
    offerOverlapScore: null,
    signalsVerified: null,
    // Vertical classification
    verticalCategory: null,
    subVertical: null,
    // V4 Overlap scoring
    overlap: null,
    competitorClassification: null,
    hasInstallation: false,
    hasNationalReach: false,
  };
}

/**
 * Create a default feature matrix entry
 */
export function createDefaultFeatureEntry(featureName: string): FeatureMatrixEntry {
  return {
    featureName,
    description: null,
    companySupport: false,
    competitors: [],
    importance: 50,
  };
}

/**
 * Create a default pricing model
 */
export function createDefaultPricingModel(competitorName: string): PricingModel {
  return {
    competitorName,
    priceTier: 'medium',
    pricingNotes: null,
    inferredPricePoint: null,
    currency: 'USD',
    valueForMoneyScore: 50,
    modelType: null,
  };
}

/**
 * Create a default market cluster
 */
export function createDefaultMarketCluster(clusterName: string): MarketCluster {
  return {
    clusterName,
    description: null,
    competitors: [],
    clusterPosition: { x: 0, y: 0 },
    threatLevel: 50,
    whitespaceOpportunity: null,
    color: null,
  };
}

/**
 * Create a default substitute
 */
export function createDefaultSubstitute(name: string): Substitute {
  return {
    name,
    domain: null,
    reasonCustomersChooseThem: null,
    category: null,
    threatLevel: 30,
    counterStrategy: null,
  };
}
