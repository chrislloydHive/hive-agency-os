// lib/competition-v3/types.ts
// Competition Lab V3 - Core Types
//
// Complete redesign of competitive intelligence with:
// - Multi-source discovery
// - Six-category classification
// - Multi-dimension scoring
// - Context-driven positioning
// - Vertical category intelligence (V3.5)

// ============================================================================
// Vertical Category Intelligence
// ============================================================================

/**
 * Primary vertical category for business classification
 * Used to drive vertical-specific competitor filtering, narratives, and recommendations
 */
export type VerticalCategory =
  | 'retail'              // Physical retail stores, shops
  | 'services'            // Agencies, consultancies, professional services
  | 'software'            // SaaS, platforms, software products
  | 'manufacturing'       // Manufacturing, industrial, B2B product companies
  | 'consumer-dtc'        // Direct-to-consumer brands (online-first)
  | 'automotive'          // Automotive retail, service, aftermarket
  | 'marketplace'         // Two-sided marketplaces (fitness, services, rentals, etc.)
  | 'financial-services'  // Banks, credit unions, lending, insurance, wealth management
  | 'unknown';            // Unable to determine

// ============================================================================
// Company Archetype Intelligence
// ============================================================================

// Competition-required archetype (confirmed by operator)
export type BusinessArchetype =
  | 'local_service'
  | 'regional_multi_location_service'
  | 'national_retail_brand'
  | 'ecommerce_only'
  | 'marketplace'
  | 'saas';

/**
 * Company archetype based on business model structure
 * Provides higher-level classification than vertical for understanding competitive dynamics
 */
export type CompanyArchetype =
  | 'two_sided_marketplace'  // Connects supply + demand (TrainrHub, Airbnb, Uber)
  | 'saas'                   // Software as a Service
  | 'directory'              // Directory/listing site with monetization
  | 'agency'                 // Service agency (marketing, design, etc.)
  | 'consultancy'            // Professional consulting
  | 'ecommerce'              // Online retail/DTC
  | 'local_service'          // Local service business (plumber, salon, etc.)
  | 'content_platform'       // Content/media platform
  | 'enterprise_software'    // Enterprise B2B software
  | 'unknown';               // Unable to determine

/**
 * Archetype detection result with reasoning
 */
export interface ArchetypeDetectionResult {
  archetype: CompanyArchetype;
  confidence: number;
  reasoning: string;
  signals: string[];
}

/**
 * Combined archetype + vertical detection result
 */
export interface CompanyClassificationResult {
  archetype: ArchetypeDetectionResult;
  vertical: VerticalDetectionResult;
}

/**
 * Vertical detection result with reasoning
 */
export interface VerticalDetectionResult {
  verticalCategory: VerticalCategory;
  subVertical: string | null;
  confidence: number;
  reasoning: string;
  signals: string[];
}

/**
 * Competitor types allowed per vertical
 */
export const VERTICAL_ALLOWED_TYPES: Record<VerticalCategory, CompetitorType[]> = {
  'retail': ['direct', 'partial', 'platform'],
  'services': ['direct', 'partial', 'fractional', 'internal', 'platform'],
  'software': ['direct', 'partial', 'platform'],
  'manufacturing': ['direct', 'partial', 'platform'],
  'consumer-dtc': ['direct', 'partial', 'platform'],
  'automotive': ['direct', 'partial', 'platform'],
  'marketplace': ['direct', 'partial', 'platform'],  // Marketplaces compete with other marketplaces and platforms
  'financial-services': ['direct', 'partial', 'platform'],  // Banks compete with other banks, credit unions, fintechs
  'unknown': ['direct', 'partial', 'fractional', 'internal', 'platform'],
};

/**
 * Competitor types NOT allowed per vertical
 */
export const VERTICAL_DISALLOWED_TYPES: Record<VerticalCategory, CompetitorType[]> = {
  'retail': ['fractional', 'internal', 'irrelevant'],
  'services': ['irrelevant'],
  'software': ['fractional', 'internal', 'irrelevant'],
  'manufacturing': ['fractional', 'internal', 'irrelevant'],
  'consumer-dtc': ['fractional', 'internal', 'irrelevant'],
  'automotive': ['fractional', 'internal', 'irrelevant'],
  'marketplace': ['fractional', 'internal', 'irrelevant'],  // Marketplaces don't compete with fractional execs
  'financial-services': ['fractional', 'internal', 'irrelevant'],  // Banks don't compete with marketing agencies
  'unknown': ['irrelevant'],
};

// ============================================================================
// Competitor Classification
// ============================================================================

/**
 * Six-category competitor classification system
 */
export type CompetitorType =
  | 'direct'      // Same business model + same ICP + overlapping services
  | 'partial'     // Category neighbor - shares ICP or services but not both
  | 'fractional'  // Fractional executive competitor (CMO, growth advisor)
  | 'internal'    // Internal hire / DIY alternative
  | 'platform'    // SaaS tools that replace part of the service
  | 'irrelevant'; // Filtered out - not a real competitor

/**
 * Discovery source tracking
 */
export type DiscoverySource =
  | 'google_search'
  | 'clutch'
  | 'manifest'
  | 'upcity'
  | 'g2'
  | 'context_graph'   // From existing Context Graph data
  | 'manual'          // User-provided
  | 'ai_inference';   // AI-generated based on context

// ============================================================================
// Discovery Types
// ============================================================================

/**
 * Raw candidate from discovery phase (before enrichment)
 */
export interface DiscoveryCandidate {
  // Basic info
  name: string;
  domain: string | null;
  homepageUrl: string | null;

  // Discovery metadata
  source: DiscoverySource;
  sourceUrl: string | null;        // Where we found them
  sourceRank: number | null;       // Position in search results
  queryMatched: string | null;     // Which query found them

  // Initial signals (pre-enrichment)
  snippet: string | null;          // Search result snippet
  directoryRating: number | null;  // Clutch/G2 rating if available
  directoryReviews: number | null; // Review count

  // Deduplication
  frequency: number;               // How many sources found this
}

/**
 * Query generation context from Context Graph
 */
export interface QueryContext {
  businessName: string;
  domain: string | null;

  // Identity
  industry: string | null;
  businessModel: string | null;
  businessModelCategory: 'B2B' | 'B2C' | 'Hybrid' | null;

  // V3.5: Vertical Category Intelligence
  verticalCategory?: VerticalCategory;
  subVertical?: string | null;

  // V3.6: Company Archetype Intelligence
  archetype?: CompanyArchetype;
  marketplaceVertical?: string | null;  // For marketplaces: fitness, services, rentals, etc.
  // V4 Archetype (confirmed)
  businessArchetype?: BusinessArchetype | null;

  // Audience
  icpDescription: string | null;
  icpStage: 'startup' | 'growth' | 'mid-market' | 'enterprise' | null;
  targetIndustries: string[];

  // Product/Offer
  primaryOffers: string[];
  serviceModel: string | null;       // retainer, project, hybrid
  pricePositioning: string | null;   // budget, mid, premium, enterprise

  // Brand/Positioning
  valueProposition: string | null;
  differentiators: string[];

  // Geographic
  geography: string | null;
  serviceRegions: string[];

  // Strategic
  aiOrientation: 'ai-first' | 'ai-augmented' | 'traditional' | null;

  // V3.5: durable excludes and signals
  invalidCompetitors?: string[];
}

// ============================================================================
// Enrichment Types
// ============================================================================

/**
 * Crawled website content
 */
export interface CrawledContent {
  domain: string;
  homepage: {
    title: string | null;
    h1: string | null;
    description: string | null;
    keywords: string[];
  };
  services: {
    found: boolean;
    offerings: string[];
    keywords: string[];
  };
  about: {
    found: boolean;
    teamSize: string | null;
    founded: string | null;
    location: string | null;
  };
  pricing: {
    found: boolean;
    indicators: string[];
    tier: 'budget' | 'mid' | 'premium' | 'enterprise' | null;
  };
  industries: string[];
  testimonials: string[];
  techStack: string[];
}

/**
 * Extracted company metadata
 */
export interface CompanyMetadata {
  teamSize: 'solo' | 'small' | 'medium' | 'large' | 'enterprise' | null;
  teamSizeEstimate: number | null;
  foundedYear: number | null;
  headquarters: string | null;
  serviceRegions: string[];

  // Tech signals
  techStack: string[];
  hasAICapabilities: boolean;
  hasAutomation: boolean;

  // Business signals
  pricingTier: 'budget' | 'mid' | 'premium' | 'enterprise' | null;
  businessModel: 'agency' | 'consultancy' | 'saas' | 'marketplace' | 'hybrid' | null;
  serviceModel: 'retainer' | 'project' | 'hourly' | 'subscription' | 'hybrid' | null;
}

/**
 * Semantic similarity scores
 */
export interface SemanticSimilarity {
  positioningSimilarity: number;   // 0-1: How similar is their positioning?
  icpSimilarity: number;           // 0-1: How similar is their ICP?
  valueModelSimilarity: number;    // 0-1: How similar is their value model?
  offeringSimilarity: number;      // 0-1: How similar are their offerings?
  overallSimilarity: number;       // 0-1: Weighted composite
}

/**
 * Enriched candidate (after crawling, metadata extraction, embedding)
 */
export interface EnrichedCandidate extends DiscoveryCandidate {
  // Enrichment status
  enrichmentStatus: 'pending' | 'completed' | 'failed';
  enrichmentError: string | null;

  // Crawled content
  crawledContent: CrawledContent | null;

  // Extracted metadata
  metadata: CompanyMetadata | null;

  // Semantic analysis
  semanticSimilarity: SemanticSimilarity | null;

  // AI-generated insights
  aiSummary: string | null;
  aiStrengths: string[];
  aiWeaknesses: string[];
  aiWhyCompetitor: string | null;

  // V3.5 signal extraction
  businessModelCategory?: 'retail-service' | 'retail-product' | 'ecommerce' | 'agency' | 'saas' | 'other';
  jtbdMatches?: number;            // 0-1
  offerOverlapScore?: number;      // 0-1
  signalsVerified?: number;        // count of signals satisfied
  geoScore?: number;               // 0-1
  customerTypeMatch?: boolean;     // consumer vs B2B heuristic
  offerGraph?: {
    audioInstall: boolean;
    remoteStart: boolean;
    tinting: boolean;
    dashcamInstall: boolean;
    carElectronics: boolean;
    detailing: boolean;
    customFab: boolean;
  };

  // V3.5 vertical category (detected during enrichment)
  verticalCategory?: VerticalCategory;
  subVertical?: string | null;
}

// ============================================================================
// Classification & Scoring Types
// ============================================================================

/**
 * Classification result with reasoning
 */
export interface ClassificationResult {
  type: CompetitorType;
  confidence: number;           // 0-1
  reasoning: string;
  signals: {
    businessModelMatch: boolean;
    icpOverlap: boolean;
    serviceOverlap: boolean;
    sameMarket: boolean;
    isPlatform: boolean;
    isFractional: boolean;
    isInternalAlt: boolean;
  };
}

/**
 * Multi-dimension scoring model
 */
export interface CompetitorScores {
  // Core dimensions (0-100)
  icpFit: number;
  businessModelFit: number;
  serviceOverlap: number;
  valueModelFit: number;
  icpStageMatch: number;
  aiOrientation: number;
  geographyFit: number;

  // Derived scores
  threatScore: number;      // Weighted composite
  relevanceScore: number;   // How relevant as competitor

  // Score explanations
  scoringNotes?: {
    icpNotes: string | null;
    businessModelNotes: string | null;
    serviceNotes: string | null;
    valueModelNotes: string | null;
    threatNotes: string | null;
  };

  // V3.5 signals
  jtbdMatches?: number;          // 0-1
  offerOverlapScore?: number;    // 0-1
  signalsVerified?: number;      // integer
  businessModelCategory?: string;
  geoScore?: number;
}

// ============================================================================
// Positioning Types
// ============================================================================

/**
 * Map quadrants for positioning
 */
export type MapQuadrant = 'direct-threat' | 'different-value' | 'different-icp' | 'distant';

/**
 * Position on the competitive map
 */
export interface PositioningCoordinates {
  x: number;  // 0-100: Value Model Alignment
  y: number;  // 0-100: ICP Alignment

  // Quadrant classification
  quadrant: MapQuadrant;

  // Visual properties
  bubbleSize: 'small' | 'medium' | 'large';
  clusterGroup: string;
}

// ============================================================================
// Final Competitor Profile
// ============================================================================

/**
 * Complete competitor profile for V3
 */
export interface CompetitorProfileV3 {
  // Identity
  id: string;
  runId: string;
  name: string;
  domain: string | null;
  homepageUrl: string | null;
  logoUrl: string | null;

  // Summary
  summary: string;

  // Classification
  classification: ClassificationResult;

  // Scores
  scores: CompetitorScores;

  // Positioning
  positioning: PositioningCoordinates;

  // Metadata
  metadata: CompanyMetadata;

  // Discovery info
  discovery: {
    source: DiscoverySource;
    sourceUrl: string | null;
    frequency: number;
    directoryRating: number | null;
    directoryReviews: number | null;
  };

  // Analysis
  analysis: {
    strengths: string[];
    weaknesses: string[];
    whyCompetitor: string | null;
    differentiators: string[];
    opportunities: string[];
  };

  // V3.5 signals
  jtbdMatches?: number;
  offerOverlapScore?: number;
  signalsVerified?: number;
  businessModelCategory?: string;
  geoScore?: number;

  // V3.5 vertical category
  verticalCategory?: VerticalCategory;
  subVertical?: string | null;
}

// ============================================================================
// Run & Results Types
// ============================================================================

/**
 * Step status tracking
 */
export interface RunStepStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  candidatesFound?: number;
  enrichedCount?: number;
}

// ============================================================================
// Scoring Strategy & Debug Types
// ============================================================================

/**
 * Scoring strategy used for a competition run
 */
export type ScoringStrategy =
  | 'deterministic'           // Computed from signals + evidence
  | 'llm'                     // LLM-based scoring
  | 'fallback_low_confidence' // LOW_CONFIDENCE_CONTEXT error state
  | 'fallback_error';         // General error fallback

/**
 * Debug info for scoring
 */
export interface ScoringDebug {
  strategy: ScoringStrategy;
  version: string;
  computedAt: string;
  notes: string[];
  missingInputs: string[];
  signalCoverage: {
    businessModelMatch: number;  // % of competitors with this signal
    icpOverlap: number;
    serviceOverlap: number;
    sameMarket: number;
  };
  scoreDistribution: {
    threatScoreMin: number;
    threatScoreMax: number;
    threatScoreAvg: number;
    relevanceScoreMin: number;
    relevanceScoreMax: number;
    relevanceScoreAvg: number;
  };
}

/**
 * Complete V3 run result
 */
export interface CompetitionRunV3 {
  // Run identity
  id: string;
  companyId: string;
  version: 3;

  // Status
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;

  // Step tracking
  steps: {
    queryGeneration: RunStepStatus;
    discovery: RunStepStatus & { candidatesFound: number };
    enrichment: RunStepStatus & { enrichedCount: number };
    classification: RunStepStatus;
    scoring: RunStepStatus;
    positioning: RunStepStatus;
    narrative: RunStepStatus;
  };

  // Summary stats
  summary: {
    totalCandidates: number;
    totalCompetitors: number;
    byType: {
      direct: number;
      partial: number;
      fractional: number;
      platform: number;
      internal: number;
    };
    avgThreatScore: number;
    quadrantDistribution: Record<string, number>;
    // V3.1: Scoring debug
    scoring?: ScoringDebug;
  };
}

// ============================================================================
// Narrative Types
// ============================================================================

/**
 * Landscape insight
 */
export interface LandscapeInsight {
  id: string;
  category: 'threat' | 'opportunity' | 'trend' | 'white-space';
  title: string;
  description: string;
  evidence: string[];
  competitors: string[];
  severity: 'high' | 'medium' | 'low';
}

/**
 * Strategic recommendation
 */
export interface StrategicRecommendation {
  id: string;
  priority: number;  // 1-4, 1 = highest
  type: 'positioning' | 'differentiation' | 'defense' | 'expansion';
  title: string;
  description: string;
  actions: string[];
  targetCompetitors: string[];
  expectedOutcome: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for competitor type
 */
export function getCompetitorTypeColor(type: CompetitorType): string {
  switch (type) {
    case 'direct': return '#ef4444';      // red
    case 'partial': return '#f97316';     // orange
    case 'fractional': return '#14b8a6';  // teal
    case 'internal': return '#3b82f6';    // blue
    case 'platform': return '#eab308';    // yellow
    case 'irrelevant': return '#6b7280';  // gray
    default: return '#6b7280';
  }
}

/**
 * Get label for competitor type
 */
export function getCompetitorTypeLabel(type: CompetitorType): string {
  switch (type) {
    case 'direct': return 'Direct Competitor';
    case 'partial': return 'Category Neighbor';
    case 'fractional': return 'Fractional Executive';
    case 'internal': return 'Internal Alternative';
    case 'platform': return 'Platform Alternative';
    case 'irrelevant': return 'Not a Competitor';
    default: return 'Unknown';
  }
}

/**
 * Get description for quadrant
 */
export function getQuadrantLabel(quadrant: MapQuadrant): string {
  switch (quadrant) {
    case 'direct-threat': return 'Direct Threats';
    case 'different-value': return 'Different Value Model';
    case 'different-icp': return 'Different ICP';
    case 'distant': return 'Distant Competitors';
    default: return 'Unknown';
  }
}
