// lib/os/diagnostics/moduleResult.ts
// Universal Lab ModuleResult Contract
//
// Ensures every lab always writes a structured output payload to Airtable,
// even on failure. This prevents blank/null output fields.
//
// Status definitions:
// - completed: Full analysis with sufficient evidence
// - completed_shallow: Analysis ran but insufficient data for high confidence
// - failed: Error occurred during analysis

import type { DiagnosticToolId } from './runs';

// ============================================================================
// Types
// ============================================================================

/**
 * Module status - determines completeness and confidence
 *
 * - completed: Full analysis with sufficient evidence set
 * - completed_shallow: Analysis ran but insufficient data (e.g., no blog detected)
 * - failed: Error occurred during analysis
 */
export type ModuleStatus = 'completed' | 'completed_shallow' | 'failed';

/**
 * Data confidence level
 */
export type DataConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Data confidence assessment
 */
export interface DataConfidence {
  score: number; // 0-100
  level: DataConfidenceLevel;
  reason: string;
}

/**
 * Structured error for failed modules
 */
export interface ModuleError {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
}

/**
 * Minimum evidence set required for "completed" status
 */
export interface MinimumEvidenceSet {
  /** Has at least one data source */
  hasDataSource: boolean;
  /** Has at least one finding or metric */
  hasFindings: boolean;
  /** Score is non-null and within valid range */
  hasValidScore: boolean;
}

/**
 * Universal ModuleResult contract
 * Every lab MUST write a result conforming to this structure
 */
export interface ModuleResult<TRawEvidence = unknown> {
  // =========================================================================
  // Required Fields (MUST always be present)
  // =========================================================================

  /** Lab identifier (e.g., 'seoLab', 'contentLab') */
  module: DiagnosticToolId;

  /** Status determines how to interpret the result */
  status: ModuleStatus;

  /** ISO timestamp when analysis started */
  startedAt: string;

  /** ISO timestamp when analysis completed/failed */
  completedAt: string;

  /** Input URL provided by user */
  inputUrl: string;

  /** Normalized URL used for analysis (https://, trailing slash) */
  normalizedUrl: string | null;

  // =========================================================================
  // Conditional Fields (based on status)
  // =========================================================================

  /** Overall score (0-100), null if failed */
  score: number | null;

  /** Human-readable summary, always present */
  summary: string;

  /** Data confidence assessment */
  dataConfidence: DataConfidence;

  /** Raw evidence from the analysis (lab-specific structure) */
  rawEvidence?: TRawEvidence;

  // =========================================================================
  // Error Fields (only for status: failed)
  // =========================================================================

  /** Structured error (only for status: failed) */
  error?: ModuleError;

  // =========================================================================
  // Shallow Completion Fields (only for status: completed_shallow)
  // =========================================================================

  /** Reason for shallow completion */
  shallowReason?: string;

  /** What data was missing or insufficient */
  missingData?: string[];
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard error codes for lab failures
 */
export const MODULE_ERROR_CODES = {
  // URL errors
  INVALID_URL: 'INVALID_URL',
  URL_UNREACHABLE: 'URL_UNREACHABLE',
  URL_BLOCKED: 'URL_BLOCKED',

  // Data errors
  NO_DATA: 'NO_DATA',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  API_ERROR: 'API_ERROR',

  // Processing errors
  CRAWL_FAILED: 'CRAWL_FAILED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  TIMEOUT: 'TIMEOUT',

  // Generic
  UNKNOWN: 'UNKNOWN',
} as const;

export type ModuleErrorCode = keyof typeof MODULE_ERROR_CODES;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a failed ModuleResult
 *
 * Use when:
 * - URL is invalid or unreachable
 * - Crawl or analysis fails
 * - Any unexpected error occurs
 */
export function buildFailedModuleResult(
  module: DiagnosticToolId,
  inputUrl: string,
  normalizedUrl: string | null,
  error: string | Error,
  code: ModuleErrorCode = 'UNKNOWN',
  startedAt?: string
): ModuleResult {
  const errorMessage = error instanceof Error ? error.message : error;

  return {
    module,
    status: 'failed',
    startedAt: startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    inputUrl,
    normalizedUrl,
    score: null,
    summary: `Analysis failed: ${errorMessage}`,
    dataConfidence: {
      score: 0,
      level: 'low',
      reason: 'Analysis failed before data collection.',
    },
    error: {
      code,
      message: errorMessage,
      retryable: isRetryableError(code),
    },
  };
}

/**
 * Build a shallow completion ModuleResult
 *
 * Use when:
 * - No blog detected but homepage scanned
 * - Only partial data available
 * - Analysis completed but with low confidence
 */
export function buildShallowModuleResult(
  module: DiagnosticToolId,
  inputUrl: string,
  normalizedUrl: string,
  score: number,
  summary: string,
  shallowReason: string,
  missingData: string[],
  rawEvidence?: unknown,
  startedAt?: string
): ModuleResult {
  return {
    module,
    status: 'completed_shallow',
    startedAt: startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    inputUrl,
    normalizedUrl,
    score,
    summary,
    dataConfidence: {
      score: 30, // Low confidence for shallow completion
      level: 'low',
      reason: shallowReason,
    },
    shallowReason,
    missingData,
    rawEvidence,
  };
}

/**
 * Build a completed ModuleResult
 *
 * Use when:
 * - Full analysis completed with sufficient evidence
 */
export function buildCompletedModuleResult<T>(
  module: DiagnosticToolId,
  inputUrl: string,
  normalizedUrl: string,
  score: number,
  summary: string,
  dataConfidence: DataConfidence,
  rawEvidence: T,
  startedAt?: string
): ModuleResult<T> {
  return {
    module,
    status: 'completed',
    startedAt: startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    inputUrl,
    normalizedUrl,
    score,
    summary,
    dataConfidence,
    rawEvidence,
  };
}

/**
 * Check if module has minimum evidence for "completed" status
 */
export function hasMinimumEvidence(result: ModuleResult): MinimumEvidenceSet {
  const hasDataSource = !!result.rawEvidence &&
    typeof result.rawEvidence === 'object' &&
    Object.keys(result.rawEvidence as object).length > 0;

  // Check for any findings in the rawEvidence
  const evidence = result.rawEvidence as Record<string, unknown> | undefined;
  const hasFindings = !!(
    (Array.isArray(evidence?.issues) && (evidence.issues as unknown[]).length > 0) ||
    evidence?.findings ||
    (Array.isArray(evidence?.dimensions) && (evidence.dimensions as unknown[]).length > 0) ||
    (Array.isArray(evidence?.subscores) && (evidence.subscores as unknown[]).length > 0)
  );

  const hasValidScore = result.score !== null &&
    result.score >= 0 &&
    result.score <= 100;

  return {
    hasDataSource,
    hasFindings,
    hasValidScore,
  };
}

/**
 * Validate and possibly downgrade status based on evidence
 *
 * If status is "completed" but evidence is insufficient, downgrade to "completed_shallow"
 */
export function validateModuleResult(result: ModuleResult): ModuleResult {
  if (result.status === 'completed') {
    const evidence = hasMinimumEvidence(result);

    if (!evidence.hasDataSource || !evidence.hasFindings) {
      return {
        ...result,
        status: 'completed_shallow',
        shallowReason: 'Insufficient evidence for full completion',
        missingData: [
          ...(!evidence.hasDataSource ? ['No raw data collected'] : []),
          ...(!evidence.hasFindings ? ['No findings or metrics generated'] : []),
        ],
        dataConfidence: {
          ...result.dataConfidence,
          level: 'low',
          score: Math.min(result.dataConfidence.score, 30),
        },
      };
    }
  }

  return result;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(code: ModuleErrorCode): boolean {
  const retryableCodes: ModuleErrorCode[] = [
    'URL_UNREACHABLE',
    'API_ERROR',
    'CRAWL_FAILED',
    'TIMEOUT',
  ];
  return retryableCodes.includes(code);
}

/**
 * Get error code from error message
 */
export function detectModuleErrorCode(message: string): ModuleErrorCode {
  const lowered = message.toLowerCase();

  if (lowered.includes('invalid url') || lowered.includes('invalid_url')) {
    return 'INVALID_URL';
  }
  if (lowered.includes('unreachable') || lowered.includes('enotfound') || lowered.includes('econnrefused')) {
    return 'URL_UNREACHABLE';
  }
  if (lowered.includes('blocked') || lowered.includes('403') || lowered.includes('forbidden')) {
    return 'URL_BLOCKED';
  }
  if (lowered.includes('timeout') || lowered.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (lowered.includes('no data') || lowered.includes('no results')) {
    return 'NO_DATA';
  }
  if (lowered.includes('insufficient') || lowered.includes('not enough')) {
    return 'INSUFFICIENT_DATA';
  }
  if (lowered.includes('api error') || lowered.includes('api_error')) {
    return 'API_ERROR';
  }
  if (lowered.includes('crawl') && lowered.includes('fail')) {
    return 'CRAWL_FAILED';
  }
  if (lowered.includes('analysis') && lowered.includes('fail')) {
    return 'ANALYSIS_FAILED';
  }

  return 'UNKNOWN';
}

/**
 * Determine if Content Lab result should be marked as shallow
 *
 * Returns true when:
 * - No blog detected and only homepage scanned
 * - Article count is 0
 * - No internal crawl performed
 */
export function shouldBeShallowContentResult(analysis: {
  hasBlog: boolean;
  articleCount: number;
  contentUrls?: string[];
}): { isShallow: boolean; reason?: string; missingData?: string[] } {
  const missingData: string[] = [];

  if (!analysis.hasBlog) {
    missingData.push('No blog section detected');
  }

  if (analysis.articleCount === 0) {
    missingData.push('No articles or content pages found');
  }

  const hasOnlyHomepage = !analysis.contentUrls || analysis.contentUrls.length <= 1;
  if (hasOnlyHomepage) {
    missingData.push('Only homepage scanned (no internal crawl)');
  }

  const isShallow = missingData.length > 0;

  return {
    isShallow,
    reason: isShallow
      ? 'Limited content signals available. Scores represent best estimate from available data.'
      : undefined,
    missingData: isShallow ? missingData : undefined,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a result is a completed module result
 */
export function isCompletedResult(result: ModuleResult): boolean {
  return result.status === 'completed';
}

/**
 * Check if a result is a shallow completion
 */
export function isShallowResult(result: ModuleResult): boolean {
  return result.status === 'completed_shallow';
}

/**
 * Check if a result is a failure
 */
export function isFailedResult(result: ModuleResult): boolean {
  return result.status === 'failed';
}

/**
 * Check if a result has usable data (completed or completed_shallow)
 */
export function hasUsableData(result: ModuleResult): boolean {
  return result.status === 'completed' || result.status === 'completed_shallow';
}
