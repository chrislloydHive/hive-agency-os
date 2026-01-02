// lib/types/labSummary.ts
// Lab Summary and Findings Types for Review Queue UX
//
// These types support the Lab Coverage Summary panel and Findings Viewer
// that allow users to see which labs ran, what they found, and promote
// specific findings to proposed facts.

// ============================================================================
// Lab Types
// ============================================================================

/**
 * Supported lab types in Hive OS
 */
export type LabKey =
  | 'websiteLab'
  | 'competitionLab'
  | 'brandLab'
  | 'gapPlan'
  | 'audienceLab';

/**
 * Lab run status
 */
export type LabRunStatus =
  | 'completed'
  | 'running'
  | 'failed'
  | 'pending'
  | 'not_run';

// ============================================================================
// Lab Summary (for Lab Coverage Panel)
// ============================================================================

/**
 * Summary of a single lab run for the coverage panel
 */
export interface LabRunSummary {
  /** Lab identifier */
  labKey: LabKey;

  /** Human-readable lab name */
  displayName: string;

  /** Current status */
  status: LabRunStatus;

  /** Run ID (from diagnostic runs table) */
  runId?: string;

  /** When the run completed (ISO timestamp) */
  completedAt?: string;

  /** Total raw findings extracted from the lab output */
  findingsCount: number;

  /** How many findings were promoted to proposed facts */
  proposedFactsCount: number;

  /** How many proposed facts are still pending review */
  pendingReviewCount: number;

  /** How many proposed facts were confirmed */
  confirmedCount: number;

  /** How many proposed facts were rejected */
  rejectedCount: number;

  /** Error message if status is 'failed' */
  errorMessage?: string;

  /** Error type for failed runs */
  errorType?: string;

  /** Brief description of what this lab does */
  description: string;

  /** Lab Quality Score (inline, if computed) */
  quality?: {
    /** Composite score (0-100) */
    score: number;
    /** Quality band classification */
    qualityBand: 'Excellent' | 'Good' | 'Weak' | 'Poor';
    /** Whether there are quality warnings */
    hasWarnings: boolean;
    /** Number of warnings */
    warningCount: number;
    /** Regression indicator */
    regression?: {
      isRegression: boolean;
      pointDifference: number;
    };
  };
}

/**
 * Response from /api/os/companies/[companyId]/labs/summary
 */
export interface LabCoverageSummaryResponse {
  ok: boolean;
  companyId: string;

  /** Summary for each lab */
  labs: LabRunSummary[];

  /** Total findings across all labs */
  totalFindings: number;

  /** Total proposed facts across all labs */
  totalProposedFacts: number;

  /** Total pending review across all labs */
  totalPendingReview: number;

  /** Any labs with 0 proposed facts despite having findings */
  labsWithUnmappedFindings: LabKey[];

  /** Last updated timestamp */
  lastUpdated: string;

  /** Error if any */
  error?: string;
}

// ============================================================================
// Lab Findings (for Findings Viewer)
// ============================================================================

/**
 * Finding severity/impact level
 */
export type FindingImpact = 'high' | 'medium' | 'low';

/**
 * Finding category/theme bucket
 */
export type FindingCategory =
  | 'conversion'
  | 'ux'
  | 'messaging'
  | 'local_seo'
  | 'competitors'
  | 'brand'
  | 'trust'
  | 'content'
  | 'technical'
  | 'strategy'
  | 'audience'
  | 'positioning'
  | 'other';

/**
 * Promotion status for a finding
 */
export type FindingPromotionStatus =
  | 'not_promoted'      // Finding has not been promoted
  | 'promoted_pending'  // Promoted but pending review
  | 'promoted_confirmed' // Promoted and confirmed
  | 'promoted_rejected'; // Promoted but rejected

/**
 * A single finding from a lab run
 */
export interface LabFinding {
  /** Unique finding ID (for deduplication and tracking) */
  findingId: string;

  /** Lab this finding came from */
  labKey: LabKey;

  /** Run ID that produced this finding */
  runId: string;

  /** Short title/summary (1 line) */
  title: string;

  /** Full finding text/description */
  description: string;

  /** Impact level */
  impact: FindingImpact;

  /** Category/theme */
  category: FindingCategory;

  /** Confidence score (0-1) */
  confidence: number;

  /** Evidence supporting this finding */
  evidence: FindingEvidence[];

  /** Canonical hash for deduplication */
  canonicalHash: string;

  /** Whether this finding has been promoted to a fact */
  promotionStatus: FindingPromotionStatus;

  /** Target field key if promoted */
  promotedToField?: string;

  /** Proposed fact key if promoted */
  proposedFactKey?: string;

  /** Recommended target fields for promotion */
  recommendedTargetFields: TargetFieldRecommendation[];

  /** Raw JSON path where this finding was extracted */
  rawPath?: string;

  /** Timestamp when finding was created */
  createdAt: string;
}

/**
 * Evidence supporting a finding
 */
export interface FindingEvidence {
  /** Type of evidence */
  type: 'screenshot' | 'url' | 'quote' | 'data';

  /** URL (for screenshot or url type) */
  url?: string;

  /** Text excerpt (for quote type) */
  text?: string;

  /** Data value (for data type) */
  value?: unknown;

  /** Optional label */
  label?: string;
}

/**
 * Recommended target field for promoting a finding
 */
export interface TargetFieldRecommendation {
  /** Target field key (e.g., "website.executiveSummary") */
  fieldKey: string;

  /** Human-readable field label */
  fieldLabel: string;

  /** Why this field is recommended */
  reason: string;

  /** Match score (0-100) */
  matchScore: number;

  /** Whether this field already has a confirmed value */
  hasConfirmedValue: boolean;

  /** Whether this field already has a proposed value */
  hasProposedValue: boolean;
}

/**
 * Grouped findings by category
 */
export interface FindingsGroup {
  /** Category key */
  category: FindingCategory;

  /** Human-readable category label */
  label: string;

  /** Findings in this category */
  findings: LabFinding[];

  /** Count of high-impact findings */
  highImpactCount: number;
}

/**
 * Response from /api/os/companies/[companyId]/labs/[labKey]/findings
 */
export interface LabFindingsResponse {
  ok: boolean;
  companyId: string;
  labKey: LabKey;

  /** Run ID for this lab's findings */
  runId?: string;

  /** When the run completed */
  completedAt?: string;

  /** Total findings count */
  totalFindings: number;

  /** Findings grouped by category */
  groups: FindingsGroup[];

  /** Flat list of all findings (for alternative display) */
  findings: LabFinding[];

  /** Summary stats */
  stats: {
    byImpact: Record<FindingImpact, number>;
    byCategory: Record<FindingCategory, number>;
    promoted: number;
    notPromoted: number;
  };

  /** Error if any */
  error?: string;
}

// ============================================================================
// Promote to Fact (for promotion flow)
// ============================================================================

/**
 * Request to promote a finding to a proposed fact
 */
export interface PromoteToFactRequest {
  /** Lab key where the finding came from */
  labKey: LabKey;

  /** Finding ID to promote */
  findingId: string;

  /** Target field key (e.g., "website.executiveSummary") */
  targetFieldKey: string;

  /** Short summary (1-2 lines) - can be edited by user */
  summary: string;

  /** Detailed text (optional, collapsible) */
  detailedText?: string;

  /** Evidence references to include */
  evidenceRefs?: string[];

  /** Confidence override (optional) */
  confidence?: number;
}

/**
 * Response from promote-to-fact endpoint
 */
export interface PromoteToFactResponse {
  ok: boolean;

  /** The created proposed fact */
  proposedFact?: {
    key: string;
    value: unknown;
    dedupeKey: string;
  };

  /** Whether this was a duplicate (already promoted) */
  duplicate?: boolean;

  /** Whether promotion was blocked (confirmed field exists) */
  blocked?: boolean;
  blockReason?: string;

  /** Error message */
  error?: string;
}

// ============================================================================
// Dedupe Group (for Review Queue UX)
// ============================================================================

/**
 * A group of proposed facts that share the same canonical finding
 */
export interface DedupeGroup {
  /** Canonical hash that groups these facts */
  canonicalHash: string;

  /** Source lab */
  labKey: LabKey;

  /** Short display title */
  title: string;

  /** Full text value */
  text: string;

  /** All target field keys that this text populates */
  targetFieldKeys: string[];

  /** Count of fields */
  fieldCount: number;

  /** Confirmation action: which fields to populate on confirm */
  confirmationTargets: string[];

  /** The primary proposed fact (first one) */
  primaryFactKey: string;

  /** All proposed fact keys in this group */
  allFactKeys: string[];
}

// ============================================================================
// Category Labels
// ============================================================================

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  conversion: 'Conversion',
  ux: 'User Experience',
  messaging: 'Messaging',
  local_seo: 'Local SEO',
  competitors: 'Competitors',
  brand: 'Brand',
  trust: 'Trust & Credibility',
  content: 'Content',
  technical: 'Technical',
  strategy: 'Strategy',
  audience: 'Audience',
  positioning: 'Positioning',
  other: 'Other',
};

export const FINDING_IMPACT_LABELS: Record<FindingImpact, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const LAB_DISPLAY_NAMES: Record<LabKey, string> = {
  websiteLab: 'Website Lab',
  competitionLab: 'Competition Lab',
  brandLab: 'Brand Lab',
  gapPlan: 'GAP Plan',
  audienceLab: 'Audience Lab',
};

export const LAB_DESCRIPTIONS: Record<LabKey, string> = {
  websiteLab: 'Analyzes website for UX, conversion, messaging, and technical issues',
  competitionLab: 'Identifies and analyzes competitor landscape and positioning',
  brandLab: 'Evaluates brand positioning, value proposition, and audience fit',
  gapPlan: 'Strategic growth analysis and opportunity identification',
  audienceLab: 'Identifies and segments target audience based on website signals',
};
