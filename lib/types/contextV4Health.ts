// lib/types/contextV4Health.ts
// Context V4 Healthcheck types and labels
//
// Used by:
// - GET /api/os/companies/[companyId]/context/v4/health
// - ReviewQueueClient status pill

import type { ProposalReason } from './contextV4Debug';

// ============================================================================
// Health Status
// ============================================================================

/**
 * Overall health status for V4.
 * - GREEN: Healthy and ready
 * - YELLOW: Needs attention but not broken
 * - RED: Broken or disabled
 */
export type V4HealthStatus = 'GREEN' | 'YELLOW' | 'RED';

// ============================================================================
// Health Reasons
// ============================================================================

/**
 * Specific reasons for health status.
 * Multiple reasons can apply simultaneously.
 */
export type V4HealthReason =
  | 'FLAG_DISABLED'                    // CONTEXT_V4_INGEST_WEBSITELAB is disabled
  | 'NO_V4_STORE'                      // V4 store unavailable or unreadable
  | 'NO_WEBSITELAB_RUN'                // No WebsiteLab diagnostic run exists
  | 'WEBSITELAB_STALE'                 // WebsiteLab run is older than threshold
  | 'PROPOSE_ZERO_NO_CANDIDATES'       // Last propose had 0 candidates
  | 'PROPOSE_ZERO_EXTRACT_MISSING'     // Last propose couldn't extract from rawJson
  | 'PROPOSE_ZERO_ALL_DUPLICATES'      // Last propose skipped all as duplicates
  | 'PROPOSE_ZERO_STORE_WRITE_FAILED'  // Last propose failed to write to store
  | 'PROPOSE_ENDPOINT_ERROR'           // Propose endpoint errored
  | 'INSPECT_UNAVAILABLE'              // Inspect logic failed internally
  | 'UNKNOWN';                         // Catch-all

/**
 * Human-readable labels for health reasons
 */
export const V4_HEALTH_REASON_LABELS: Record<V4HealthReason, string> = {
  FLAG_DISABLED: 'V4 WebsiteLab ingestion is disabled',
  NO_V4_STORE: 'V4 store is unavailable',
  NO_WEBSITELAB_RUN: 'No WebsiteLab run found',
  WEBSITELAB_STALE: 'WebsiteLab run is stale (>7 days old)',
  PROPOSE_ZERO_NO_CANDIDATES: 'Last proposal extracted 0 candidates',
  PROPOSE_ZERO_EXTRACT_MISSING: 'Last proposal couldn\'t find lab output in data',
  PROPOSE_ZERO_ALL_DUPLICATES: 'All candidates already exist (duplicates)',
  PROPOSE_ZERO_STORE_WRITE_FAILED: 'Store write failed during proposal',
  PROPOSE_ENDPOINT_ERROR: 'Proposal endpoint encountered an error',
  INSPECT_UNAVAILABLE: 'Health inspection failed internally',
  UNKNOWN: 'Unknown issue',
};

/**
 * Status label mapping
 */
export const V4_HEALTH_STATUS_LABELS: Record<V4HealthStatus, string> = {
  GREEN: 'V4 Healthy',
  YELLOW: 'Needs Attention',
  RED: 'Broken',
};

// ============================================================================
// Health Response
// ============================================================================

/**
 * WebsiteLab run info for health response
 */
export interface V4HealthWebsiteLabInfo {
  hasRun: boolean;
  runId: string | null;
  createdAt: string | null; // ISO
  ageMinutes: number | null;
  staleThresholdMinutes: number;
}

/**
 * Last proposal info for health response
 */
export interface V4HealthProposeInfo {
  lastReason: ProposalReason | null;
  proposedCount: number | null;
  createdCount: number | null;
  skippedCount: number | null;
  lastRunId: string | null;
}

/**
 * V4 store counts for health response
 */
export interface V4HealthStoreInfo {
  total: number | null;
  proposed: number | null;
  confirmed: number | null;
  rejected: number | null;
}

/**
 * Links for actions
 */
export interface V4HealthLinks {
  inspectorPath: string;
  proposeApiPath: string;
}

/**
 * Full health response from GET /context/v4/health
 */
export interface V4HealthResponse {
  healthVersion: 1;
  companyId: string;
  timestamp: string;

  status: V4HealthStatus;
  reasons: V4HealthReason[];

  flags: {
    CONTEXT_V4_ENABLED: boolean;
    CONTEXT_V4_INGEST_WEBSITELAB: boolean;
  };

  websiteLab: V4HealthWebsiteLabInfo;
  propose: V4HealthProposeInfo;
  store: V4HealthStoreInfo;
  links: V4HealthLinks;

  // Error info if applicable
  error?: string;
}

// ============================================================================
// Competition Health
// ============================================================================

/**
 * Competition confidence level
 */
export type CompetitionConfidence = 'high' | 'low' | 'missing';

/**
 * Competition health status for V4
 */
export type CompetitionHealthStatus = 'healthy' | 'warning' | 'unknown';

/**
 * Competition health info for V4 health response
 */
export interface V4CompetitionHealthInfo {
  /** Whether a competition run exists */
  hasRun: boolean;
  /** Status of competition health */
  status: CompetitionHealthStatus;
  /** Confidence level */
  confidence: CompetitionConfidence;
  /** Run ID if available */
  runId: string | null;
  /** Run date if available */
  runDate: string | null;
  /** Whether the run has LOW_CONFIDENCE_CONTEXT error */
  hasLowConfidenceError: boolean;
  /** Number of competitors found */
  competitorCount: number | null;
  /** Age of the run in days */
  ageDays: number | null;
}

/**
 * Labels for competition health reasons
 */
export const COMPETITION_HEALTH_REASON_LABELS: Record<string, string> = {
  COMPETITION_MISSING: 'No competition analysis available',
  COMPETITION_LOW_CONFIDENCE: 'Competition analysis has low confidence',
  COMPETITION_STALE: 'Competition analysis is outdated (>30 days)',
  COMPETITION_EMPTY: 'Competition analysis found no competitors',
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Default stale threshold for WebsiteLab runs (7 days in minutes)
 */
export const WEBSITELAB_STALE_THRESHOLD_MINUTES = 10080; // 7 * 24 * 60

/**
 * Default stale threshold for Competition runs (30 days)
 */
export const COMPETITION_STALE_THRESHOLD_DAYS = 30;
