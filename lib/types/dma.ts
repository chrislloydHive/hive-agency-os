// lib/types/dma.ts
// Types for DMA Activity / Intent Radar system
// Provides normalized view of GAP-IA and GAP-Plan (Full GAP) runs

/**
 * Run type identifier
 */
export type DMARunType = 'GAP_IA' | 'GAP_FULL';

/**
 * Source of the run
 */
export type DMASource = 'DMA' | 'HiveOS' | 'Unknown';

/**
 * Score band classification
 */
export type ScoreBand = 'High' | 'Mid' | 'Low' | 'NA';

/**
 * Intent level classification
 */
export type IntentLevel = 'High' | 'Medium' | 'Low' | 'None';

/**
 * Normalized DMA Run record
 * Unifies GAP-IA and GAP-Plan run data into a single shape
 */
export interface DMARun {
  /** Airtable record ID */
  id: string;
  /** Company Airtable record ID (may be null if unlinked) */
  companyId: string | null;
  /** Company name (for display) */
  companyName: string | null;
  /** Company domain (for matching unlinked runs) */
  domain: string | null;
  /** Type of run */
  runType: DMARunType;
  /** Overall score (0-100 or null) */
  score: number | null;
  /** ISO timestamp of run creation */
  createdAt: string;
  /** Source of the run */
  source: DMASource;
  /** URL to view run output (if available) */
  runUrl: string | null;
  /** Notes or summary from run */
  notes: string | null;
  /** Website URL that was analyzed */
  websiteUrl: string | null;

  // Derived fields
  /** Score band classification */
  scoreBand: ScoreBand;
  /** True if company has more than one run total */
  isRerun: boolean;
  /** Days since the previous run for this company (null if first run) */
  daysSincePreviousRun: number | null;
}

/**
 * Aggregated DMA summary per company
 */
export interface DMACompanySummary {
  /** Company Airtable record ID */
  companyId: string;
  /** Company name */
  companyName: string;
  /** Company domain */
  domain: string | null;
  /** ISO timestamp of most recent run */
  lastRunAt: string | null;
  /** Type of most recent run */
  lastRunType: DMARunType | null;
  /** Total number of runs across all types */
  totalRuns: number;
  /** Score from most recent run */
  latestScore: number | null;
  /** Score band of latest score */
  latestScoreBand: ScoreBand;
  /** Derived intent level */
  intentLevel: IntentLevel;
  /** Reasons for the intent level (for UI display) */
  intentReasons: string[];
  /** True if there's a run within the last 7 days */
  hasRecentRun: boolean;
  /** All runs for this company (sorted desc by createdAt) */
  runs: DMARun[];
}

/**
 * Result from deriveIntentLevel function
 */
export interface IntentResult {
  level: IntentLevel;
  reasons: string[];
}

/**
 * API response for DMA activity list
 */
export interface DMAActivityResponse {
  ok: boolean;
  runs: DMARun[];
  totalCount: number;
  /** Counts by run type */
  countByType: {
    GAP_IA: number;
    GAP_FULL: number;
  };
  /** Counts by intent level (company-level) */
  countByIntent: {
    High: number;
    Medium: number;
    Low: number;
    None: number;
  };
}

/**
 * API response for company DMA runs
 */
export interface CompanyDMARuns {
  ok: boolean;
  companyId: string;
  summary: DMACompanySummary;
  runs: DMARun[];
}

/**
 * Filter options for DMA activity
 */
export interface DMAActivityFilter {
  /** Number of days to look back (default 7) */
  days?: number;
  /** Filter by run type */
  runType?: DMARunType | 'all';
  /** Filter by intent level */
  intentLevel?: IntentLevel | 'all';
  /** Limit number of results */
  limit?: number;
}
