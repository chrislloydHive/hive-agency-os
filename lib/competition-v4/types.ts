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
  confidence: number;
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

  /** Step 3 & 4: Competitors */
  competitors: {
    validated: ProposedCompetitor[];
    removed: RemovedCompetitor[];
  };

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

export interface CompetitionV4Input {
  companyId: string;
  companyName?: string;
  domain?: string;
  websiteText?: string;
  diagnosticsSummary?: string;
  baselineSignals?: Record<string, unknown>;
  /** Skip the summary step (faster) */
  skipSummary?: boolean;
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
