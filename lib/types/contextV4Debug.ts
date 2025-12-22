// lib/types/contextV4Debug.ts
// Shared types for Context V4 debugging and proposal diagnostics
//
// These types are used by:
// - POST /api/os/companies/[companyId]/context/v4/propose-website-lab
// - GET /api/os/companies/[companyId]/context/v4/inspect
// - ReviewQueueClient debug banner

// ============================================================================
// Proposal Reason Codes
// ============================================================================

/**
 * Reason codes for proposal outcomes.
 * Used to diagnose why proposedCount might be 0.
 */
export type ProposalReason =
  | 'SUCCESS'               // Proposals were created successfully
  | 'NO_RUN'               // No WebsiteLab diagnostic run found
  | 'FLAG_DISABLED'        // CONTEXT_V4_INGEST_WEBSITELAB is disabled
  | 'NO_CANDIDATES'        // Extraction succeeded but 0 candidates produced
  | 'EXTRACT_PATH_MISSING' // Could not find lab output in rawJson
  | 'ALL_DUPLICATES'       // Candidates existed but all were skipped (already proposed/confirmed)
  | 'STORE_WRITE_FAILED'   // Attempted write but store counts didn't change
  | 'STORE_UNAUTHORIZED'   // Airtable token lacks permission to access V4 store
  | 'STORE_NOT_FOUND'      // V4 store table does not exist
  | 'ERROR_STATE'          // Lab output contains error (HTTP 4xx/5xx, failed diagnostic)
  | 'UNKNOWN';             // Catch-all for unexpected states

/**
 * Error state type from WebsiteLab detection
 */
export type WebsiteLabErrorType =
  | 'HTTP_ERROR'
  | 'DIAGNOSTIC_FAILED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

/**
 * Human-readable labels for proposal reasons
 */
export const PROPOSAL_REASON_LABELS: Record<ProposalReason, string> = {
  SUCCESS: 'Proposals created successfully',
  NO_RUN: 'No WebsiteLab run found for this company',
  FLAG_DISABLED: 'V4 WebsiteLab ingestion is disabled (CONTEXT_V4_INGEST_WEBSITELAB)',
  NO_CANDIDATES: 'No candidates extracted from WebsiteLab output',
  EXTRACT_PATH_MISSING: 'Could not locate lab output in diagnostic run data',
  ALL_DUPLICATES: 'All candidates already exist (proposed or confirmed)',
  STORE_WRITE_FAILED: 'Store write attempted but no changes detected',
  STORE_UNAUTHORIZED: 'Airtable token lacks permission to access V4 store - check Personal Access Token scopes',
  STORE_NOT_FOUND: 'V4 store table does not exist in Airtable - create ContextFieldsV4 table',
  ERROR_STATE: 'WebsiteLab diagnostic failed - error output detected',
  UNKNOWN: 'Unknown state',
};

// ============================================================================
// V4 Store Counts
// ============================================================================

/** Error codes returned when loading V4 store fails */
export type V4StoreLoadErrorCode =
  | 'UNAUTHORIZED'   // 401/403 - token lacks permission
  | 'NOT_FOUND'      // 404 - table doesn't exist
  | 'NETWORK_ERROR'  // Network/connection issues
  | 'PARSE_ERROR'    // JSON parse failed
  | 'UNKNOWN';       // Other errors

/**
 * Field counts from the V4 store
 */
export interface V4StoreCounts {
  proposed: number;
  confirmed: number;
  rejected: number;
  total: number;
}

// ============================================================================
// Propose Endpoint Response
// ============================================================================

/**
 * Debug information included in proposal response
 */
export interface ProposeDebugInfo {
  /** Number of candidates extracted from rawJson */
  candidatesCount?: number;
  /** Sample of keys that were skipped (capped at 20) */
  skippedKeysSample?: string[];
  /** Store counts before proposal */
  storeBefore?: V4StoreCounts;
  /** Store counts after proposal */
  storeAfter?: V4StoreCounts;
  /** Top-level keys found in rawJson (for debugging extraction failures) */
  topLevelKeys?: string[];
  /** Reason for extraction failure (if any) */
  extractionFailureReason?: string;
}

/**
 * Response from POST /context/v4/propose-website-lab
 */
export interface ProposeWebsiteLabResponse {
  ok: boolean;
  /** Diagnostic run ID used */
  runId: string | null;
  /** When the run was created */
  runCreatedAt?: string | null;
  /** Number of fields that were proposed (new + replaced) */
  proposedCount: number;
  /** Number of new proposals created */
  createdCount: number;
  /** Number of candidates skipped (duplicates, confirmed, etc.) */
  skippedCount: number;
  /** Reason code for the outcome */
  reason: ProposalReason;
  /** Extraction path used to find lab output */
  extractionPath?: string;
  /** Feature flag status */
  flags?: {
    CONTEXT_V4_ENABLED: boolean;
    CONTEXT_V4_INGEST_WEBSITELAB: boolean;
  };
  /** Debug information */
  debug?: ProposeDebugInfo;
  /** Error message if ok=false */
  error?: string;
}

// ============================================================================
// Inspect Endpoint Response
// ============================================================================

/**
 * Detected schema variant for WebsiteLab data
 */
export type WebsiteLabSchemaVariant =
  | 'labResultV4'  // Traditional schema with siteAssessment, siteGraph, etc.
  | 'vNextRoot'    // New schema with score, summary, recommendations at root
  | 'unknown';     // Could not determine schema

/**
 * Debug info for NO_CANDIDATES diagnosis (mirrors WebsiteLabDebug)
 */
export interface WebsiteLabDebugInfo {
  /** Top-level keys of the detected root */
  rootTopKeys: string[];
  /** Detected schema variant */
  detectedSchema: WebsiteLabSchemaVariant;
  /** Length of summary field (if present) */
  summaryLen?: number;
  /** Count of recommendations (if present) */
  recommendationsCount?: number;
  /** Count of issues (if present) */
  issuesCount?: number;
  /** Sample paths found in the data */
  samplePathsFound: {
    executiveSummary: boolean;
    score: boolean;
    pages: boolean;
    summary: boolean;
    findings: boolean;
    recommendations: boolean;
    siteAssessment: boolean;
    contentIntelligence: boolean;
    trustAnalysis: boolean;
  };
  /** Attempted mappings for required/important fields */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
}

/**
 * Error state info for WebsiteLab
 */
export interface WebsiteLabErrorStateInfo {
  isError: boolean;
  errorType?: WebsiteLabErrorType;
  errorMessage?: string;
  httpStatus?: number;
}

/**
 * Latest WebsiteLab run info for inspect endpoint
 */
export interface LatestWebsiteLabInfo {
  runId: string | null;
  createdAt: string | null;
  status: string | null;
  score: number | null;
  hasRawJson: boolean;
  extractionPathOk: boolean;
  extractionPath: string | null;
  candidatesCount: number | null;
  /** Debug info when candidatesCount === 0 (NO_CANDIDATES) */
  debug?: WebsiteLabDebugInfo;
  /** Error state if WebsiteLab output contains error content */
  errorState?: WebsiteLabErrorStateInfo;
}

/**
 * Debug info for Brand Lab NO_CANDIDATES diagnosis
 */
export interface BrandLabDebugInfo {
  /** Top-level keys of the detected root */
  rootTopKeys: string[];
  /** Sample paths found in the data */
  samplePathsFound: {
    findings: boolean;
    positioningStatement: boolean;
    valuePropHeadline: boolean;
    icpPrimaryAudience: boolean;
    audienceFit: boolean;
    dimensions: boolean;
  };
  /** Attempted mappings for required/important fields */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
}

/**
 * Latest Brand Lab run info for inspect endpoint
 */
export interface LatestBrandLabInfo {
  runId: string | null;
  createdAt: string | null;
  status: string | null;
  score: number | null;
  hasRawJson: boolean;
  extractionPathOk: boolean;
  extractionPath: string | null;
  candidatesCount: number | null;
  /** Debug info when candidatesCount === 0 (NO_CANDIDATES) */
  debug?: BrandLabDebugInfo;
}

/**
 * Debug info for GAP Plan NO_CANDIDATES diagnosis
 */
export interface GapPlanDebugInfo {
  /** Top-level keys of the detected root */
  rootTopKeys: string[];
  /** Sample paths found in the data */
  samplePathsFound: {
    gapStructured: boolean;
    primaryOffers: boolean;
    competitors: boolean;
    audienceSummary: boolean;
    brandIdentityNotes: boolean;
    scores: boolean;
  };
  /** Attempted mappings for required/important fields */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
}

/**
 * Latest GAP Plan run info for inspect endpoint
 */
export interface LatestGapPlanInfo {
  runId: string | null;
  createdAt: string | null;
  status: string | null;
  overallScore: number | null;
  hasDataJson: boolean;
  extractionPathOk: boolean;
  extractionPath: string | null;
  candidatesCount: number | null;
  /** Debug info when candidatesCount === 0 (NO_CANDIDATES) */
  debug?: GapPlanDebugInfo;
}

/**
 * Debug info for Competition Lab NO_CANDIDATES diagnosis
 */
export interface CompetitionLabDebugInfo {
  /** Top-level keys found in the run */
  rootTopKeys: string[];
  /** Sample paths found in the data */
  samplePathsFound: {
    competitors: boolean;
    status: boolean;
    stats: boolean;
    querySummary: boolean;
    discoveredCandidates: boolean;
    dataConfidenceScore: boolean;
  };
  /** Competitor count */
  competitorCount: number;
  /** Whether SERP evidence was found */
  hasSerpEvidence: boolean;
  /** Whether competitor URLs are present */
  hasUrls: boolean;
  /** Attempted mappings */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
}

/**
 * Error state for Competition Lab
 */
export interface CompetitionLabErrorStateInfo {
  isError: boolean;
  errorType?: 'FAILED' | 'INCOMPLETE' | 'NO_COMPETITORS' | 'UNKNOWN_ERROR';
  errorMessage?: string;
}

/**
 * Latest Competition Lab run info for inspect endpoint
 */
export interface LatestCompetitionLabInfo {
  runId: string | null;
  createdAt: string | null;
  status: string | null;
  competitorCount: number | null;
  hasRun: boolean;
  extractionPathOk: boolean;
  extractionPath: string | null;
  candidatesCount: number | null;
  /** Debug info when candidatesCount === 0 (NO_CANDIDATES) */
  debug?: CompetitionLabDebugInfo;
  /** Error state if competition run has errors */
  errorState?: CompetitionLabErrorStateInfo;
}

/**
 * Proposal summary for inspect endpoint (computed if cheap)
 */
export interface ProposeSummary {
  wouldPropose: number;
  reason: ProposalReason;
}

/**
 * Response from GET /context/v4/inspect
 */
export interface InspectV4Response {
  ok: boolean;
  /** API version for contract stability */
  inspectVersion: 1;
  companyId: string;
  companyName: string;
  timestamp: string;

  // Feature flags
  flags: {
    CONTEXT_V4_ENABLED: boolean;
    CONTEXT_V4_INGEST_WEBSITELAB: boolean;
    CONTEXT_V4_INGEST_BRANDLAB?: boolean;
    CONTEXT_V4_INGEST_GAPPLAN?: boolean;
    CONTEXT_V4_INGEST_COMPETITIONLAB?: boolean;
    envVars: {
      CONTEXT_V4_ENABLED: string | undefined;
      CONTEXT_V4_INGEST_WEBSITELAB: string | undefined;
      CONTEXT_V4_INGEST_BRANDLAB?: string | undefined;
      CONTEXT_V4_INGEST_GAPPLAN?: string | undefined;
      CONTEXT_V4_INGEST_COMPETITIONLAB?: string | undefined;
    };
  };

  // Latest WebsiteLab run info
  latestWebsiteLab: LatestWebsiteLabInfo;

  // Latest Brand Lab run info
  latestBrandLab?: LatestBrandLabInfo;

  // Latest GAP Plan run info
  latestGapPlan?: LatestGapPlanInfo;

  // Latest Competition Lab run info
  latestCompetitionLab?: LatestCompetitionLabInfo;

  // V4 store counts
  v4StoreCounts: V4StoreCounts & {
    storeExists: boolean;
    /** Error code if store load failed */
    loadErrorCode?: V4StoreLoadErrorCode | null;
    /** Error message if store load failed */
    loadErrorMessage?: string | null;
  };

  // Proposed fields by source
  proposedBySource: Record<string, number>;

  // Sample of proposed fields from WebsiteLab
  proposedWebsiteLabSample: Array<{
    key: string;
    domain: string;
    status: string;
    confidence: number;
    updatedAt: string;
    evidence: {
      runId?: string;
      rawPath?: string;
      importerId?: string;
    };
  }>;

  // Legacy context graph snapshot
  materializedGraphSnapshot: {
    websiteKeysPresent: number;
    sampleKeys: string[];
    graphExists: boolean;
  };

  // Caching hints
  cachingHints: {
    dynamicRoute: boolean;
    noStoreFetchUsed: boolean;
  };

  // Runtime env consistency (for debugging authorization issues)
  envConsistency?: {
    v4Store: {
      baseId: string | undefined;
      tableName: string;
      tokenEnvVar: string;
    };
    proposalStore: {
      baseId: string | undefined;
      tableName: string;
      tokenEnvVar: string;
    };
    /** True if both stores use same baseId and tokenEnvVar */
    consistent: boolean;
  };

  // Proposal summaries per source
  /** @deprecated Use proposeSummaryWebsiteLab instead */
  proposeSummary?: ProposeSummary;
  /** WebsiteLab-specific proposal summary */
  proposeSummaryWebsiteLab?: ProposeSummary;
  /** BrandLab-specific proposal summary */
  proposeSummaryBrandLab?: ProposeSummary;
  /** GAP Plan-specific proposal summary */
  proposeSummaryGapPlan?: ProposeSummary;
  /** Competition Lab-specific proposal summary */
  proposeSummaryCompetitionLab?: ProposeSummary;

  // Next action hint (when wouldPropose > 0 but persisted = 0)
  nextAction?: {
    type: 'GENERATE_PROPOSALS' | 'REVIEW_PROPOSALS' | 'FIX_STORE_ACCESS';
    message: string;
    endpoint: string | null;
  };

  // Proposal persistence tracking
  /** Number of proposals currently persisted in V4 store (same as v4StoreCounts.proposed) */
  persistedProposalsCount?: number;
  /** ISO timestamp of most recent auto-proposed field (from postRunHooks) */
  lastAutoProposeAt?: string | null;
  /** Number of proposals auto-generated by postRunHooks (as opposed to manual trigger) */
  autoProposedCount?: number;

  // Error
  error?: string;
}
