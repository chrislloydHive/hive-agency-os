// lib/competition-v4/types.ts
// Competition V4 - Classification Tree Approach
//
// V4 uses a sequential AI pipeline:
// 1. Business Decomposition (classify the business)
// 2. Category Definition (define what category this business is in)
// 3. Competitor Discovery (find competitors constrained by category)
// 4. Competitor Validation (prune invalid competitors)
// 5. Competitive Summary (optional strategic summary)
//
// This prevents the "everything becomes a marketing agency" failure mode
// by establishing category constraints BEFORE discovering competitors.

// ============================================================================
// Step 1: Business Decomposition
// ============================================================================

export type MarketOrientation = 'B2C' | 'B2B' | 'B2B2C' | 'Mixed' | 'Unknown';

export type EconomicModel =
  | 'Product'
  | 'Service'
  | 'Software'
  | 'Platform'
  | 'Marketplace'
  | 'Financial'
  | 'Media'
  | 'Agency'
  | 'Unknown';

export type OfferingType =
  | 'Physical Goods'
  | 'Digital Product'
  | 'Software'
  | 'Financial Product'
  | 'Labor-Based Service'
  | 'Hybrid'
  | 'Unknown';

export type BuyerUserRelationship = 'Same' | 'Different' | 'Mixed' | 'Unknown';

export type TransactionModel =
  | 'One-time'
  | 'Subscription'
  | 'Usage-based'
  | 'Commission'
  | 'Interest-based'
  | 'Advertising'
  | 'Mixed'
  | 'Unknown';

export type GeographicScope = 'Local' | 'Regional' | 'National' | 'Global' | 'Unknown';

export interface BusinessDecompositionResult {
  market_orientation: MarketOrientation;
  economic_model: EconomicModel;
  offering_type: OfferingType;
  buyer_user_relationship: BuyerUserRelationship;
  transaction_model: TransactionModel;
  primary_vertical: string;
  secondary_verticals: string[];
  geographic_scope: GeographicScope;
  confidence_notes: string;
}

// ============================================================================
// Step 2: Category Definition
// ============================================================================

export interface CategoryDefinition {
  category_slug: string;
  category_name: string;
  category_description: string;
  qualification_rules: string[];
  exclusion_rules: string[];
}

// ============================================================================
// Step 3: Competitor Discovery
// ============================================================================

export type CompetitorType = 'Direct' | 'Indirect' | 'Adjacent';

export interface ProposedCompetitor {
  name: string;
  domain: string;
  type: CompetitorType;
  reason: string;
  /** Confidence score for the competitor (0-100) */
  confidence?: number;
  /** Does competitor offer installation/service capability? */
  hasInstallation?: boolean;
  /** Does competitor have national reach? */
  hasNationalReach?: boolean;
  /** Is competitor a local/regional player? */
  isLocal?: boolean;
  /** Is this a major retailer (e.g., Best Buy, Walmart)? */
  isMajorRetailer?: boolean;
  /** Product categories offered */
  productCategories?: string[];
  /** Service categories offered */
  serviceCategories?: string[];
  /** Estimated brand trust score (0-100) */
  brandTrustScore?: number;
  /** Price positioning */
  pricePositioning?: 'budget' | 'mid' | 'premium';
}

export interface CompetitorDiscoveryResult {
  competitors: ProposedCompetitor[];
}

// ============================================================================
// Step 4: Competitor Validation
// ============================================================================

export interface RemovedCompetitor {
  name: string;
  domain: string;
  reason: string;
}

export interface CompetitorValidationResult {
  validated_competitors: ProposedCompetitor[];
  removed_competitors: RemovedCompetitor[];
  notes: string;
}

// ============================================================================
// Step 5: Competitive Summary (Optional)
// ============================================================================

export interface CompetitiveSummary {
  competitive_positioning: string;
  key_differentiation_axes: string[];
  competitive_risks: string[];
}

// ============================================================================
// Combined V4 Result
// ============================================================================

/**
 * Signals used for competitor classification (for UI transparency)
 */
export interface CompetitorSignalsUsed {
  installationCapability?: boolean;
  geographicOverlap?: 'local' | 'regional' | 'national';
  productOverlap?: boolean;
  serviceOverlap?: boolean;
  marketReach?: 'local' | 'regional' | 'national';
  pricePositioning?: 'budget' | 'mid' | 'premium' | 'unknown';
}

/** Competitor with overlap scoring applied */
export interface ScoredCompetitor extends ProposedCompetitor {
  /** Overlap scores computed by scoring model */
  overlapScore: number;
  /** Extended classification: primary | contextual | alternative | excluded */
  classification: 'primary' | 'contextual' | 'alternative' | 'excluded';
  /** Rules that were applied (trait-based, no hardcoded brands) */
  rulesApplied: string[];
  /** Reason for inclusion if exclusion was prevented */
  inclusionReason?: string;
  /** Confidence in scoring (0-100) based on signal completeness */
  confidence?: number;
  /** Human-readable explanation for UI */
  whyThisMatters?: string;
  /** Signals that drove the classification */
  signalsUsed?: CompetitorSignalsUsed;
  /** Short bullet reasons for inclusion */
  reasons?: string[];
}

/**
 * Excluded competitor record with explanation
 */
export interface ExcludedCompetitorRecord {
  name: string;
  domain: string;
  reason: string;
}

/**
 * Structured competitor buckets (canonical output shape)
 */
export interface CompetitorBucketsV4 {
  /** Primary competitors - direct revenue threats */
  primary: ScoredCompetitor[];
  /** Contextual competitors - comparison anchors */
  contextual: ScoredCompetitor[];
  /** Alternative competitors - secondary considerations */
  alternatives: ScoredCompetitor[];
  /** Excluded competitors with reasons */
  excluded: ExcludedCompetitorRecord[];
}

/**
 * Modality inference result for UI transparency
 */
export interface ModalityInferenceInfo {
  /** Inferred modality */
  modality: CompetitiveModalityType;
  /** Confidence in inference (0-100) */
  confidence: number;
  /** Signals that drove the inference */
  signals: string[];
  /** Explanation of inference */
  explanation: string;
  /** Service emphasis (0-1) */
  serviceEmphasis: number;
  /** Product emphasis (0-1) */
  productEmphasis: number;
  /** Missing signals that reduced confidence */
  missingSignals?: string[];
}

/**
 * Candidate expansion stats for debugging
 */
export interface CandidateExpansionStats {
  /** Initial candidates before expansion */
  initialCandidates: number;
  /** Candidates after expansion */
  expandedCandidates: number;
  /** Candidates after deduplication */
  dedupedCandidates: number;
  /** Candidates kept after filtering */
  keptAfterFilter: number;
  /** Queries used for expansion */
  expansionQueries?: string[];
  /** Cities/regions used for expansion */
  serviceAreas?: string[];
}

export interface CompetitionV4Result {
  /** Pipeline version */
  version: 4;

  /** Run ID for tracking */
  runId: string;

  /** Company ID */
  companyId: string;

  /** Company name used for analysis */
  companyName: string;

  /** Domain analyzed */
  domain: string | null;

  /** Step 1: Business classification */
  decomposition: BusinessDecompositionResult;

  /** Step 2: Category definition */
  category: CategoryDefinition;

  /** Step 3 & 4: Competitors (legacy format) */
  competitors: {
    validated: ProposedCompetitor[];
    removed: RemovedCompetitor[];
  };

  /** V4.1: Scored and classified competitors (canonical buckets) */
  scoredCompetitors?: {
    /** Direct revenue threats - customers actively compare */
    primary: ScoredCompetitor[];
    /** Comparison anchors - customers may reference but less direct */
    contextual: ScoredCompetitor[];
    /** Secondary considerations */
    alternatives: ScoredCompetitor[];
    /** Excluded competitors with explanations */
    excluded: ExcludedCompetitorRecord[];
    /** Overlap threshold used */
    threshold: number;
    /** Competitive modality used for scoring */
    modality: CompetitiveModalityType | null;
    /** Confidence in modality inference (0-100) */
    modalityConfidence?: number;
    /** Clarifying question if modality confidence was low */
    clarifyingQuestion?: {
      question: string;
      yesImplies: CompetitiveModalityType;
      noImplies: CompetitiveModalityType;
      context: string;
    };
    /** Top trait rules that drove inclusion */
    topTraitRules?: string[];
  };

  /** V4.2: Modality inference details for UI */
  modalityInference?: ModalityInferenceInfo;

  /** V4.2: Candidate expansion stats */
  candidateExpansion?: CandidateExpansionStats;

  /** Step 5: Optional summary */
  summary?: CompetitiveSummary;

  /** Pipeline execution details */
  execution: {
    status: 'completed' | 'failed' | 'partial';
    startedAt: string;
    completedAt: string | null;
    durationMs: number;
    stepsCompleted: number;
    error?: string;
    stepErrors?: {
      step: string;
      error: string;
    }[];
  };
}

// ============================================================================
// Input Types
// ============================================================================

export type CustomerComparisonMode =
  | 'national_retailers'
  | 'local_installers'
  | 'diy_online'
  | 'direct_competitors'
  | 'big_box_stores';

export type CompetitiveModalityType =
  | 'Retail+Installation'
  | 'InstallationOnly'
  | 'RetailWithInstallAddon'
  | 'ProductOnly'
  | 'InternalAlternative';

export interface CompetitionV4Input {
  companyId: string;
  companyName?: string;
  domain?: string;
  websiteText?: string;
  diagnosticsSummary?: string;
  baselineSignals?: Record<string, unknown>;
  /** Skip the summary step (faster) */
  skipSummary?: boolean;
  /** Pre-selected competitive modality from context or UI */
  competitiveModality?: CompetitiveModalityType;
  /** How customers compare - selected in pre-run UI */
  customerComparisonModes?: CustomerComparisonMode[];
  /** Override overlap threshold (default 40) */
  overlapThreshold?: number;
  /** Subject's product categories for overlap scoring */
  productCategories?: string[];
  /** Subject's service categories for overlap scoring */
  serviceCategories?: string[];
  /** Subject offers installation? */
  hasInstallation?: boolean;
  /** Subject's geographic scope */
  geographicScope?: 'local' | 'regional' | 'national';
  /** Subject's price positioning */
  pricePositioning?: 'budget' | 'mid' | 'premium';
  /** Subject's service areas (cities, states, regions) */
  serviceAreas?: string[];
}

// ============================================================================
// Feature Flag
// ============================================================================

export type CompetitionEngine = 'v3' | 'v4' | 'both';

export function getCompetitionEngine(): CompetitionEngine {
  const env = process.env.COMPETITION_ENGINE;
  if (env === 'v4' || env === 'both') {
    return env;
  }
  return 'v3'; // Default
}

export function shouldRunV3(): boolean {
  const engine = getCompetitionEngine();
  return engine === 'v3' || engine === 'both';
}

export function shouldRunV4(): boolean {
  const engine = getCompetitionEngine();
  return engine === 'v4' || engine === 'both';
}
