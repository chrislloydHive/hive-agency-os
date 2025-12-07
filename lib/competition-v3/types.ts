// lib/competition-v3/types.ts
// Competition Lab V3 - Core Types
//
// Complete redesign of competitive intelligence with:
// - Multi-source discovery
// - Six-category classification
// - Multi-dimension scoring
// - Context-driven positioning

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
