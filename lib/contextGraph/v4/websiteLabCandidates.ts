// lib/contextGraph/v4/websiteLabCandidates.ts
// WebsiteLab Candidate Builder for V4 Proposals
//
// Extracts candidates from WebsiteUXLabResultV4 for V4 proposal flow.
// Only includes fields within authorized domains: website, digitalInfra.
// Cross-domain observations (brand, content, audience) are logged but skipped.

import type { LabCandidate } from './propose';
import { WEBSITE_LAB_MAPPINGS } from '@/lib/contextGraph/websiteLabWriter';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';

// ============================================================================
// Types
// ============================================================================

/**
 * Debug info for attempted mapping
 */
export interface AttemptedMappingDebug {
  /** Target field key (e.g., 'identity.businessModel') */
  fieldKey: string;
  /** Whether the source path was attempted */
  attempted: boolean;
  /** Whether a value was found */
  found: boolean;
  /** Reason for skipping (if not found) */
  reason?: 'empty_value' | 'wrong_domain' | 'transform_failed' | 'no_source_path';
}

/**
 * Detected schema variant for WebsiteLab data
 */
export type WebsiteLabSchemaVariant =
  | 'labResultV4'  // Traditional schema with siteAssessment, siteGraph, etc.
  | 'vNextRoot'    // New schema with score, summary, recommendations at root
  | 'unknown';     // Could not determine schema

/**
 * Debug info for NO_CANDIDATES diagnosis
 */
export interface WebsiteLabDebug {
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
  attemptedMappings: AttemptedMappingDebug[];
}

/**
 * Error state detection result
 */
export interface WebsiteLabErrorState {
  /** Whether an error state was detected */
  isError: boolean;
  /** Error type (for UI display) */
  errorType?: 'HTTP_ERROR' | 'DIAGNOSTIC_FAILED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
  /** Human-readable error message extracted from the data */
  errorMessage?: string;
  /** HTTP status code if detected */
  httpStatus?: number;
}

export interface BuildWebsiteLabCandidatesResult {
  /** The extraction path used (for debugging) */
  extractionPath: string;
  /** Number of raw keys found in the source data */
  rawKeysFound: number;
  /** Candidates ready for V4 proposal */
  candidates: LabCandidate[];
  /** Skipped counts for debugging */
  skipped: {
    wrongDomain: number;
    emptyValue: number;
    noMapping: number;
  };
  /** Keys that were skipped due to wrong domain */
  skippedWrongDomainKeys: string[];
  /** Top-level keys found in rawJson (for debugging extraction failures) */
  topLevelKeys?: string[];
  /** Reason for extraction failure (if any) */
  extractionFailureReason?: string;
  /** Debug info for NO_CANDIDATES diagnosis */
  debug?: WebsiteLabDebug;
  /** Error state if WebsiteLab failed (HTTP error, diagnostic failed, etc.) */
  errorState?: WebsiteLabErrorState;
}

// ============================================================================
// Authorized Domains for WebsiteLab
// ============================================================================

/**
 * WebsiteLab can propose to these domains.
 * Now includes identity and productOffer for baseline strategy fields.
 * Cross-domain observations (brand, content, audience, historical) are still skipped.
 */
const WEBSITELAB_AUTHORIZED_DOMAINS = new Set([
  'website',
  'digitalInfra',
  'identity',      // For businessModel inference
  'productOffer',  // For primaryProducts, valueProposition inference
]);

// ============================================================================
// WebsiteLab Root Finder
// ============================================================================

/**
 * Known fields that indicate a WebsiteLab payload
 */
const WEBSITELAB_SIGNATURE_FIELDS = new Set([
  'siteAssessment',
  'siteGraph',
  'pages',
  'heuristics',
  'personas',
  'trustAnalysis',
  'ctaIntelligence',
  'contentIntelligence',
  'visualBrandEvaluation',
  'impactMatrix',
  'strategistViews',
]);

/**
 * Secondary fields that might indicate WebsiteLab (less reliable)
 */
const WEBSITELAB_SECONDARY_FIELDS = new Set([
  'score',
  'scores',
  'summary',
  'executiveSummary',
  'uxScore',
  'seoScore',
  'conversionScore',
  'recommendations',
  'issues',
  'findings',
]);

/**
 * Result from findWebsiteLabRoot
 */
export interface FindWebsiteLabRootResult {
  root: Record<string, unknown>;
  path: string;
  matchedFields: string[];
}

/**
 * Robustly locate the WebsiteLab data root within rawJson.
 *
 * This function handles:
 * - JSON strings (parsed automatically)
 * - Multiple nesting patterns (rawEvidence.labResultV4, result, data, output, etc.)
 * - Fallback detection via WebsiteLab signature fields
 *
 * @param rawJson - The rawJson from a diagnostic run (may be string or object)
 * @returns The WebsiteLab root object and path, or null if not found
 */
export function findWebsiteLabRoot(
  rawJson: unknown
): FindWebsiteLabRootResult | null {
  // Step 1: Normalize input - handle JSON strings
  let data: Record<string, unknown>;

  if (typeof rawJson === 'string') {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn('[findWebsiteLabRoot] JSON string parsed to non-object');
        return null;
      }
      data = parsed as Record<string, unknown>;
    } catch (e) {
      console.warn('[findWebsiteLabRoot] Failed to parse JSON string:', e);
      return null;
    }
  } else if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
    console.warn('[findWebsiteLabRoot] rawJson is not a valid object');
    return null;
  } else {
    data = rawJson as Record<string, unknown>;
  }

  // Helper to check if an object looks like WebsiteLab output
  const getMatchedSignatureFields = (obj: unknown): string[] => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o);
    return keys.filter(k => WEBSITELAB_SIGNATURE_FIELDS.has(k));
  };

  const getMatchedSecondaryFields = (obj: unknown): string[] => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o);
    return keys.filter(k => WEBSITELAB_SECONDARY_FIELDS.has(k));
  };

  const looksLikeWebsiteLab = (obj: unknown): boolean => {
    const signatureMatches = getMatchedSignatureFields(obj);
    if (signatureMatches.length > 0) return true;

    // If we have multiple secondary fields, it might still be WebsiteLab
    const secondaryMatches = getMatchedSecondaryFields(obj);
    return secondaryMatches.length >= 2;
  };

  // Step 2: Try known WebsiteLab paths in order of specificity
  const pathsToTry: Array<{ path: string; getter: () => unknown }> = [
    // New DiagnosticModuleResult format
    { path: 'rawEvidence.labResultV4', getter: () => (data.rawEvidence as Record<string, unknown>)?.labResultV4 },

    // WebsiteLab-specific containers
    { path: 'websiteLab', getter: () => data.websiteLab },
    { path: 'lab', getter: () => data.lab },
    { path: 'websiteLabV4', getter: () => data.websiteLabV4 },

    // Common wrapper paths
    { path: 'result', getter: () => data.result },
    { path: 'output', getter: () => data.output },
    { path: 'data', getter: () => data.data },

    // Nested wrappers
    { path: 'result.websiteLab', getter: () => (data.result as Record<string, unknown>)?.websiteLab },
    { path: 'result.lab', getter: () => (data.result as Record<string, unknown>)?.lab },
    { path: 'data.websiteLab', getter: () => (data.data as Record<string, unknown>)?.websiteLab },
    { path: 'output.websiteLab', getter: () => (data.output as Record<string, unknown>)?.websiteLab },

    // Evidence pack format (from Heavy GAP runs)
    { path: 'evidencePack.websiteLabV4', getter: () => (data.evidencePack as Record<string, unknown>)?.websiteLabV4 },

    // Direct format (root is the WebsiteLab payload)
    { path: 'direct', getter: () => data },
  ];

  for (const { path, getter } of pathsToTry) {
    try {
      const candidate = getter();
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        const matchedFields = getMatchedSignatureFields(candidate);
        if (matchedFields.length > 0) {
          console.log(`[findWebsiteLabRoot] Found at path '${path}', matched fields:`, matchedFields);
          return {
            root: candidate as Record<string, unknown>,
            path,
            matchedFields,
          };
        }
      }
    } catch (e) {
      // Ignore errors for individual path checks
    }
  }

  // Step 3: Fallback - check if any container looks like WebsiteLab (even without signature fields)
  const fallbackContainers = ['result', 'output', 'data', 'websiteLab', 'lab'];
  for (const containerName of fallbackContainers) {
    const container = data[containerName];
    if (container && typeof container === 'object' && !Array.isArray(container)) {
      if (looksLikeWebsiteLab(container)) {
        const matchedSecondary = getMatchedSecondaryFields(container);
        console.log(`[findWebsiteLabRoot] Fallback match at '${containerName}', secondary fields:`, matchedSecondary);
        return {
          root: container as Record<string, unknown>,
          path: `${containerName} (fallback)`,
          matchedFields: matchedSecondary,
        };
      }
    }
  }

  // Step 4: Last resort - check if root itself looks like WebsiteLab
  if (looksLikeWebsiteLab(data)) {
    const matched = [...getMatchedSignatureFields(data), ...getMatchedSecondaryFields(data)];
    console.log(`[findWebsiteLabRoot] Root looks like WebsiteLab, matched fields:`, matched);
    return {
      root: data,
      path: 'direct (fallback)',
      matchedFields: matched,
    };
  }

  // Failure - log debug info
  const topKeys = Object.keys(data).slice(0, 15);
  console.warn('[findWebsiteLabRoot] Could not locate WebsiteLab root');
  console.warn('[findWebsiteLabRoot] Top-level keys:', topKeys);

  // Log nested structure for debugging
  for (const key of ['rawEvidence', 'result', 'output', 'data']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      console.warn(`[findWebsiteLabRoot] ${key} keys:`, Object.keys(nested as object).slice(0, 10));
    }
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value is "meaningful" (not null, undefined, empty array, or empty string)
 * Note: numeric 0 IS considered meaningful (e.g., score=0 is valid)
 * Note: empty objects {} are NOT considered meaningful
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  // Empty objects are not meaningful
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) return false;
  // Numbers (including 0) are meaningful
  if (typeof value === 'number') return true;
  // Booleans are meaningful
  if (typeof value === 'boolean') return true;
  return true;
}

// ============================================================================
// Error State Detection
// ============================================================================

/**
 * Error patterns to detect in WebsiteLab output.
 * These patterns indicate the diagnostic failed and should NOT be proposed as context.
 */
const ERROR_PATTERNS = {
  // HTTP error status codes
  httpErrorRegex: /\b(4\d{2}|5\d{2})\b.*\b(error|forbidden|unauthorized|not found|failed|denied|timeout)/i,

  // Explicit error messages
  errorKeywords: [
    'diagnostic failed',
    'failed to fetch',
    'http error',
    'access denied',
    'permission denied',
    'forbidden',
    '403 forbidden',
    '404 not found',
    '500 internal server error',
    '502 bad gateway',
    '503 service unavailable',
    'rate limit',
    'rate-limit',
    'too many requests',
    'authentication failed',
    'authorization failed',
    'connection refused',
    'connection timed out',
    'network error',
    'request failed',
    'could not complete',
    'unable to process',
    'retry later',
    'please try again',
  ],

  // Status field values that indicate failure
  failureStatuses: ['failed', 'error', 'aborted', 'timeout', 'cancelled'],
};

/**
 * Detect if the WebsiteLab output contains error state that should not be proposed.
 *
 * This checks for:
 * - HTTP 4xx/5xx error codes in messages
 * - Explicit error/failure messages
 * - Status fields indicating failure
 * - Common error patterns (forbidden, failed, retry)
 *
 * @param data - The parsed WebsiteLab data object
 * @returns WebsiteLabErrorState describing the error (if any)
 */
export function detectWebsiteLabErrorState(data: unknown): WebsiteLabErrorState {
  if (!data || typeof data !== 'object') {
    return { isError: false };
  }

  const obj = data as Record<string, unknown>;

  // Helper to stringify and check for error patterns
  const checkForErrorPatterns = (value: unknown): { found: boolean; message?: string } => {
    if (value === null || value === undefined) return { found: false };

    const str = typeof value === 'string' ? value : JSON.stringify(value);
    const lowerStr = str.toLowerCase();

    // Check for error keywords
    for (const keyword of ERROR_PATTERNS.errorKeywords) {
      if (lowerStr.includes(keyword.toLowerCase())) {
        return { found: true, message: str.slice(0, 500) };
      }
    }

    // Check for HTTP error patterns
    if (ERROR_PATTERNS.httpErrorRegex.test(str)) {
      return { found: true, message: str.slice(0, 500) };
    }

    return { found: false };
  };

  // Extract HTTP status if present
  const extractHttpStatus = (value: unknown): number | undefined => {
    if (typeof value === 'number' && value >= 400 && value < 600) {
      return value;
    }
    if (typeof value === 'string') {
      const match = value.match(/\b(4\d{2}|5\d{2})\b/);
      if (match) return parseInt(match[1], 10);
    }
    return undefined;
  };

  // Check explicit error/status fields
  const errorFields = ['error', 'errorMessage', 'err', 'message', 'status', 'statusMessage', 'reason'];
  for (const field of errorFields) {
    const value = obj[field];
    if (value !== undefined) {
      // Check status field for failure values
      if (field === 'status' && typeof value === 'string') {
        if (ERROR_PATTERNS.failureStatuses.includes(value.toLowerCase())) {
          return {
            isError: true,
            errorType: 'DIAGNOSTIC_FAILED',
            errorMessage: `Diagnostic status: ${value}`,
          };
        }
      }

      // Check for error patterns in message fields
      const check = checkForErrorPatterns(value);
      if (check.found) {
        const httpStatus = extractHttpStatus(value) || extractHttpStatus(obj.statusCode) || extractHttpStatus(obj.httpStatus);

        // Determine error type
        let errorType: WebsiteLabErrorState['errorType'] = 'UNKNOWN_ERROR';
        if (httpStatus === 403) errorType = 'FORBIDDEN';
        else if (httpStatus === 429) errorType = 'RATE_LIMITED';
        else if (httpStatus && httpStatus >= 400) errorType = 'HTTP_ERROR';
        else if (check.message?.toLowerCase().includes('forbidden')) errorType = 'FORBIDDEN';
        else if (check.message?.toLowerCase().includes('rate limit')) errorType = 'RATE_LIMITED';
        else if (check.message?.toLowerCase().includes('failed')) errorType = 'DIAGNOSTIC_FAILED';

        return {
          isError: true,
          errorType,
          errorMessage: check.message,
          httpStatus,
        };
      }
    }
  }

  // Check nested error object
  if (obj.error && typeof obj.error === 'object') {
    const errorObj = obj.error as Record<string, unknown>;
    const message = errorObj.message || errorObj.error || errorObj.reason;
    if (message) {
      const check = checkForErrorPatterns(message);
      if (check.found) {
        const httpStatus = extractHttpStatus(errorObj.status) || extractHttpStatus(errorObj.statusCode);
        return {
          isError: true,
          errorType: httpStatus === 403 ? 'FORBIDDEN' : httpStatus === 429 ? 'RATE_LIMITED' : 'DIAGNOSTIC_FAILED',
          errorMessage: check.message,
          httpStatus,
        };
      }
    }
  }

  // Check summary/executiveSummary for error content
  const summaryFields = ['summary', 'executiveSummary', 'result', 'output'];
  for (const field of summaryFields) {
    const value = obj[field];
    if (typeof value === 'string' && value.length < 1000) {
      const check = checkForErrorPatterns(value);
      if (check.found) {
        return {
          isError: true,
          errorType: 'DIAGNOSTIC_FAILED',
          errorMessage: check.message,
        };
      }
    }
  }

  // Check siteAssessment.executiveSummary for error content
  if (obj.siteAssessment && typeof obj.siteAssessment === 'object') {
    const siteAssessment = obj.siteAssessment as Record<string, unknown>;
    if (typeof siteAssessment.executiveSummary === 'string') {
      const check = checkForErrorPatterns(siteAssessment.executiveSummary);
      if (check.found) {
        return {
          isError: true,
          errorType: 'DIAGNOSTIC_FAILED',
          errorMessage: check.message,
        };
      }
    }
  }

  // No error detected
  return { isError: false };
}

// ============================================================================
// Schema Detection
// ============================================================================

/**
 * Detect which schema variant the WebsiteLab data follows.
 *
 * - 'labResultV4': Traditional schema with siteAssessment, siteGraph, etc.
 * - 'vNextRoot': New schema with score, summary, recommendations at root
 * - 'unknown': Could not determine schema
 */
function detectSchemaVariant(root: Record<string, unknown>): WebsiteLabSchemaVariant {
  const keys = Object.keys(root);

  // Check for traditional labResultV4 schema (has siteAssessment or other signature fields)
  const hasLabResultV4Signature =
    'siteAssessment' in root ||
    'siteGraph' in root ||
    'contentIntelligence' in root ||
    'trustAnalysis' in root ||
    'ctaIntelligence' in root ||
    'visualBrandEvaluation' in root;

  if (hasLabResultV4Signature) {
    return 'labResultV4';
  }

  // Check for vNext schema (has score at root AND summary or recommendations)
  const hasScore = 'score' in root && (typeof root.score === 'number' || root.score !== null);
  const hasSummary = 'summary' in root;
  const hasRecommendations = 'recommendations' in root;
  const hasIssues = 'issues' in root;

  if (hasScore && (hasSummary || hasRecommendations || hasIssues)) {
    return 'vNextRoot';
  }

  return 'unknown';
}

// ============================================================================
// vNext Schema Mappings
// ============================================================================

/**
 * Mapping for vNext schema fields (root-level score, summary, recommendations)
 */
interface VNextMapping {
  /** Source key at root level */
  sourceKey: string;
  /** Target path in Context Graph (domain.field) */
  target: string;
  /** Transform function */
  transform?: (value: unknown) => unknown;
  /** Base confidence */
  confidence: number;
}

/**
 * Mappings for vNext schema variant.
 * These extract from root-level fields like score, summary, recommendations.
 */
const VNEXT_MAPPINGS: VNextMapping[] = [
  // website.websiteScore <- raw.score
  {
    sourceKey: 'score',
    target: 'website.websiteScore',
    confidence: 0.8,
  },
  // website.websiteSummary <- raw.summary (stringify if object)
  {
    sourceKey: 'summary',
    target: 'website.websiteSummary',
    transform: (value) => {
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null) {
        // Try to extract text from common shapes
        const obj = value as Record<string, unknown>;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.content === 'string') return obj.content;
        if (typeof obj.message === 'string') return obj.message;
        // Fallback: stringify
        return JSON.stringify(value);
      }
      return String(value);
    },
    confidence: 0.75,
  },
  // website.recommendations <- raw.recommendations (normalize to array of strings)
  {
    sourceKey: 'recommendations',
    target: 'website.recommendations',
    transform: (value) => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            // Try common field names for recommendation text
            return obj.title || obj.text || obj.description || obj.recommendation || obj.message || JSON.stringify(item);
          }
          return String(item);
        });
      }
      // Single recommendation as string
      if (typeof value === 'string') return [value];
      return [];
    },
    confidence: 0.75,
  },
  // website.quickWins <- first 5 recommendations (or those tagged quickWin)
  {
    sourceKey: 'recommendations',
    target: 'website.quickWins',
    transform: (value) => {
      if (!value || !Array.isArray(value)) return [];
      // Look for items tagged as quickWin first
      const quickWins = value.filter((item) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return obj.quickWin === true || obj.isQuickWin === true || obj.priority === 'quick' || obj.type === 'quickWin';
        }
        return false;
      });
      if (quickWins.length > 0) {
        return quickWins.slice(0, 5).map((item) => {
          const obj = item as Record<string, unknown>;
          return obj.title || obj.text || obj.description || JSON.stringify(item);
        });
      }
      // Fallback: first 5 recommendations
      return value.slice(0, 5).map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return obj.title || obj.text || obj.description || JSON.stringify(item);
        }
        return String(item);
      });
    },
    confidence: 0.7,
  },
  // website.conversionBlocks <- raw.issues (if present)
  {
    sourceKey: 'issues',
    target: 'website.conversionBlocks',
    transform: (value) => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            return obj.title || obj.issue || obj.description || obj.message || JSON.stringify(item);
          }
          return String(item);
        });
      }
      if (typeof value === 'string') return [value];
      return [];
    },
    confidence: 0.75,
  },
  // website.pageAssessments <- derive from raw.issues if it contains page/url info
  {
    sourceKey: 'issues',
    target: 'website.pageAssessments',
    transform: (value) => {
      if (!value || !Array.isArray(value)) return null;
      // Only extract if issues have page/url info
      const pageIssues = value.filter((item) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return obj.page || obj.url || obj.path;
        }
        return false;
      });
      if (pageIssues.length === 0) return null;
      // Group issues by page
      const pageMap = new Map<string, { url: string; issues: string[] }>();
      for (const item of pageIssues) {
        const obj = item as Record<string, unknown>;
        const url = String(obj.page || obj.url || obj.path);
        if (!pageMap.has(url)) {
          pageMap.set(url, { url, issues: [] });
        }
        const issueText = String(obj.title || obj.issue || obj.description || obj.message || '');
        if (issueText) {
          pageMap.get(url)!.issues.push(issueText);
        }
      }
      return Array.from(pageMap.values()).map((p) => ({
        url: p.url,
        pageType: null,
        score: null,
        issues: p.issues,
        recommendations: [],
      }));
    },
    confidence: 0.65,
  },
];

/**
 * Extract a snippet from a value for evidence
 */
function extractSnippet(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.slice(0, 200);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string') {
      return first.slice(0, 200);
    }
    return JSON.stringify(first).slice(0, 200);
  }
  return undefined;
}

// ============================================================================
// Inference Mappings for Baseline Strategy Fields
// ============================================================================

/**
 * Inference mapping for baseline strategy fields.
 * These are attempted when standard mappings don't produce candidates.
 */
interface InferenceMapping {
  /** Target field key */
  target: string;
  /** Source paths to try (in priority order) */
  sourcePaths: string[];
  /** Transform function (optional) */
  transform?: (value: unknown, root: Record<string, unknown>) => unknown;
  /** Base confidence for inferred values */
  confidence: number;
  /** Whether this is inferred (lower confidence) */
  isInferred: boolean;
}

/**
 * Inference mappings for baseline strategy fields.
 * These produce candidates from WebsiteLab data even when not explicitly mapped.
 */
const INFERENCE_MAPPINGS: InferenceMapping[] = [
  // ============================================================================
  // identity.businessModel - Infer from site type, categories, structure
  // ============================================================================
  {
    target: 'identity.businessModel',
    sourcePaths: [
      'siteAssessment.businessModel',
      'siteAssessment.siteType',
      'contentIntelligence.businessType',
      'siteGraph.siteType',
      'strategistViews.copywriting.differentiationAnalysis.businessType',
    ],
    confidence: 0.55,
    isInferred: true,
  },

  // ============================================================================
  // productOffer.primaryProducts - Infer from navigation, categories, hero content
  // ============================================================================
  {
    target: 'productOffer.primaryProducts',
    sourcePaths: [
      'siteGraph.productCategories',
      'siteGraph.navigation',
      'contentIntelligence.products',
      'contentIntelligence.services',
      'siteAssessment.offerings',
      'strategistViews.copywriting.toneAnalysis.offerings',
    ],
    transform: (value: unknown, root: Record<string, unknown>) => {
      // Try to extract product/service names from various structures
      if (Array.isArray(value)) {
        return value.slice(0, 10).map(v =>
          typeof v === 'string' ? v : (v as Record<string, unknown>)?.name || (v as Record<string, unknown>)?.title || String(v)
        );
      }
      if (typeof value === 'string') {
        return [value];
      }
      // Fallback: try to extract from navigation
      const nav = getNestedValue(root, 'siteGraph.navigation');
      if (Array.isArray(nav)) {
        const items = nav.slice(0, 8).map((n: unknown) =>
          typeof n === 'string' ? n : (n as Record<string, unknown>)?.label || (n as Record<string, unknown>)?.text || ''
        ).filter(Boolean);
        if (items.length > 0) return items;
      }
      return null;
    },
    confidence: 0.45,
    isInferred: true,
  },

  // ============================================================================
  // productOffer.valueProposition - Infer from hero, headline, summary
  // ============================================================================
  {
    target: 'productOffer.valueProposition',
    sourcePaths: [
      'contentIntelligence.valueProposition',
      'contentIntelligence.headline',
      'siteAssessment.executiveSummary',
      'siteGraph.heroText',
      'siteGraph.tagline',
      'strategistViews.copywriting.toneAnalysis.mainMessage',
      'ctaIntelligence.narrative',
    ],
    transform: (value: unknown) => {
      if (typeof value === 'string' && value.length > 10) {
        // Truncate if too long
        return value.slice(0, 500);
      }
      return value;
    },
    confidence: 0.50,
    isInferred: true,
  },

  // ============================================================================
  // identity.companyDescription - Infer from about, summary, executive summary
  // ============================================================================
  {
    target: 'identity.companyDescription',
    sourcePaths: [
      'contentIntelligence.aboutContent',
      'siteAssessment.executiveSummary',
      'contentIntelligence.narrative',
      'siteGraph.aboutText',
      'trustAnalysis.narrative',
    ],
    transform: (value: unknown) => {
      if (typeof value === 'string' && value.length > 20) {
        return value.slice(0, 500);
      }
      return null;
    },
    confidence: 0.45,
    isInferred: true,
  },
];

/**
 * Build debug info for NO_CANDIDATES diagnosis
 */
function buildDebugInfo(
  root: Record<string, unknown>,
  attemptedMappings: AttemptedMappingDebug[],
  schemaVariant: WebsiteLabSchemaVariant
): WebsiteLabDebug {
  // Calculate summary length
  let summaryLen: number | undefined;
  const summary = root.summary || getNestedValue(root, 'siteAssessment.executiveSummary');
  if (typeof summary === 'string') {
    summaryLen = summary.length;
  } else if (typeof summary === 'object' && summary !== null) {
    summaryLen = JSON.stringify(summary).length;
  }

  // Calculate recommendations count
  let recommendationsCount: number | undefined;
  const recs = root.recommendations || getNestedValue(root, 'ctaIntelligence.recommendations');
  if (Array.isArray(recs)) {
    recommendationsCount = recs.length;
  }

  // Calculate issues count
  let issuesCount: number | undefined;
  const issues = root.issues || getNestedValue(root, 'siteAssessment.keyIssues');
  if (Array.isArray(issues)) {
    issuesCount = issues.length;
  }

  return {
    rootTopKeys: Object.keys(root).slice(0, 15),
    detectedSchema: schemaVariant,
    summaryLen,
    recommendationsCount,
    issuesCount,
    samplePathsFound: {
      executiveSummary: !!getNestedValue(root, 'siteAssessment.executiveSummary'),
      score: !!getNestedValue(root, 'siteAssessment.score') || !!root.score || root.score === 0,
      pages: !!getNestedValue(root, 'siteGraph.pages') || !!root.pages,
      summary: !!root.summary || !!getNestedValue(root, 'contentIntelligence.narrative'),
      findings: !!root.findings || !!getNestedValue(root, 'siteAssessment.keyIssues'),
      recommendations: !!root.recommendations || !!getNestedValue(root, 'ctaIntelligence.recommendations'),
      siteAssessment: !!root.siteAssessment,
      contentIntelligence: !!root.contentIntelligence,
      trustAnalysis: !!root.trustAnalysis,
    },
    attemptedMappings: attemptedMappings.slice(0, 20), // Cap at 20 for payload size
  };
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build V4 proposal candidates from a WebsiteLab result.
 *
 * This function:
 * - Extracts data from rawEvidence.labResultV4 (or legacy paths)
 * - Applies WEBSITE_LAB_MAPPINGS to map source paths to canonical keys
 * - Applies INFERENCE_MAPPINGS for baseline strategy fields (with lower confidence)
 * - Filters to authorized domains (website, digitalInfra, identity, productOffer)
 * - Returns candidates ready for proposeFromLabResult()
 * - Includes debug info when candidatesCount === 0
 *
 * @param rawJson - The rawJson from a diagnostic run (may contain rawEvidence.labResultV4)
 * @returns BuildWebsiteLabCandidatesResult with candidates and debug info
 */
export function buildWebsiteLabCandidates(
  rawJson: unknown
): BuildWebsiteLabCandidatesResult {
  const result: BuildWebsiteLabCandidatesResult = {
    extractionPath: 'unknown',
    rawKeysFound: 0,
    candidates: [],
    skipped: {
      wrongDomain: 0,
      emptyValue: 0,
      noMapping: 0,
    },
    skippedWrongDomainKeys: [],
  };

  // Track attempted mappings for debug
  const attemptedMappings: AttemptedMappingDebug[] = [];

  // Handle null/undefined
  if (rawJson === null || rawJson === undefined) {
    console.warn('[buildWebsiteLabCandidates] No rawJson provided');
    result.extractionFailureReason = 'rawJson is null or undefined';
    return result;
  }

  // ============================================================================
  // ERROR STATE DETECTION - Check before processing
  // Prevents error messages from being proposed as context
  // ============================================================================
  const errorState = detectWebsiteLabErrorState(rawJson);
  if (errorState.isError) {
    console.warn('[buildWebsiteLabCandidates] ERROR STATE DETECTED:', {
      errorType: errorState.errorType,
      httpStatus: errorState.httpStatus,
      message: errorState.errorMessage?.slice(0, 100),
    });
    result.errorState = errorState;
    result.extractionFailureReason = `WebsiteLab error state: ${errorState.errorType}`;
    // Return empty candidates - do NOT propose error content
    return result;
  }

  // Use the robust root finder (handles strings, multiple paths, fallbacks)
  const rootResult = findWebsiteLabRoot(rawJson);

  if (!rootResult) {
    // Get top-level keys for debugging
    if (typeof rawJson === 'object' && !Array.isArray(rawJson)) {
      result.topLevelKeys = Object.keys(rawJson as object).slice(0, 20);
    }
    result.extractionFailureReason = `Could not locate lab output. Top-level keys: ${result.topLevelKeys?.join(', ') || '(none)'}`;
    console.warn('[buildWebsiteLabCandidates] Extraction failed:', result.extractionFailureReason);
    return result;
  }

  const websiteResult = rootResult.root;
  result.extractionPath = rootResult.path;
  result.topLevelKeys = Object.keys(websiteResult).slice(0, 20);

  // Count raw keys for debugging
  result.rawKeysFound = Object.keys(websiteResult).length;

  // ============================================================================
  // ERROR STATE DETECTION - Check extracted root too
  // The error might be nested inside the lab result structure
  // ============================================================================
  const nestedErrorState = detectWebsiteLabErrorState(websiteResult);
  if (nestedErrorState.isError) {
    console.warn('[buildWebsiteLabCandidates] ERROR STATE in extracted root:', {
      errorType: nestedErrorState.errorType,
      httpStatus: nestedErrorState.httpStatus,
      message: nestedErrorState.errorMessage?.slice(0, 100),
    });
    result.errorState = nestedErrorState;
    result.extractionFailureReason = `WebsiteLab error state: ${nestedErrorState.errorType}`;
    return result;
  }

  // Detect schema variant
  const schemaVariant = detectSchemaVariant(websiteResult);

  console.log(`[buildWebsiteLabCandidates] Extraction path: ${result.extractionPath}, raw keys: ${result.rawKeysFound}, schema: ${schemaVariant}`);

  // Track which keys we've already added (to avoid duplicates)
  const addedKeys = new Set<string>();

  // ============================================================================
  // Phase 0: Process vNext schema mappings (if detected)
  // ============================================================================
  if (schemaVariant === 'vNextRoot') {
    console.log('[buildWebsiteLabCandidates] Processing vNextRoot schema mappings');

    for (const vNextMapping of VNEXT_MAPPINGS) {
      // Skip if already added (e.g., from a previous attempt)
      if (addedKeys.has(vNextMapping.target)) {
        continue;
      }

      // Get source value from root
      const rawValue = websiteResult[vNextMapping.sourceKey];

      // Skip if no meaningful value
      if (!isMeaningfulValue(rawValue)) {
        result.skipped.emptyValue++;
        attemptedMappings.push({
          fieldKey: vNextMapping.target,
          attempted: true,
          found: false,
          reason: 'empty_value',
        });
        continue;
      }

      // Apply transform if defined
      let value = rawValue;
      if (vNextMapping.transform) {
        try {
          value = vNextMapping.transform(rawValue);
          // Check again after transform
          if (!isMeaningfulValue(value)) {
            result.skipped.emptyValue++;
            attemptedMappings.push({
              fieldKey: vNextMapping.target,
              attempted: true,
              found: false,
              reason: 'empty_value',
            });
            continue;
          }
        } catch (transformError) {
          console.warn(`[buildWebsiteLabCandidates] vNext transform failed for ${vNextMapping.target}:`, transformError);
          attemptedMappings.push({
            fieldKey: vNextMapping.target,
            attempted: true,
            found: false,
            reason: 'transform_failed',
          });
          continue;
        }
      }

      // Build candidate
      const candidate: LabCandidate = {
        key: vNextMapping.target,
        value,
        confidence: vNextMapping.confidence,
        evidence: {
          rawPath: vNextMapping.sourceKey,
          snippet: extractSnippet(value),
        },
      };

      result.candidates.push(candidate);
      addedKeys.add(vNextMapping.target);
      attemptedMappings.push({
        fieldKey: vNextMapping.target,
        attempted: true,
        found: true,
      });

      console.log(`[buildWebsiteLabCandidates] vNext mapped ${vNextMapping.sourceKey} -> ${vNextMapping.target}`);
    }
  }

  // ============================================================================
  // Phase 1: Process standard WEBSITE_LAB_MAPPINGS
  // (Also runs for vNextRoot in case of hybrid data with nested fields)
  // ============================================================================
  for (const mapping of WEBSITE_LAB_MAPPINGS) {
    // Skip if already added from vNext mappings
    if (addedKeys.has(mapping.target)) {
      continue;
    }

    const targetDomain = mapping.target.split('.')[0];

    // Check domain authorization
    if (!WEBSITELAB_AUTHORIZED_DOMAINS.has(targetDomain)) {
      result.skipped.wrongDomain++;
      result.skippedWrongDomainKeys.push(mapping.target);
      attemptedMappings.push({
        fieldKey: mapping.target,
        attempted: true,
        found: false,
        reason: 'wrong_domain',
      });
      continue;
    }

    // Get source value
    let value = getNestedValue(websiteResult, mapping.source);

    // Skip if no meaningful value
    if (!isMeaningfulValue(value)) {
      result.skipped.emptyValue++;
      attemptedMappings.push({
        fieldKey: mapping.target,
        attempted: true,
        found: false,
        reason: 'empty_value',
      });
      continue;
    }

    // Apply transform if defined
    if (mapping.transform) {
      try {
        value = mapping.transform(value);
        // Check again after transform
        if (!isMeaningfulValue(value)) {
          result.skipped.emptyValue++;
          attemptedMappings.push({
            fieldKey: mapping.target,
            attempted: true,
            found: false,
            reason: 'empty_value',
          });
          continue;
        }
      } catch (transformError) {
        console.warn(`[buildWebsiteLabCandidates] Transform failed for ${mapping.target}:`, transformError);
        attemptedMappings.push({
          fieldKey: mapping.target,
          attempted: true,
          found: false,
          reason: 'transform_failed',
        });
        continue;
      }
    }

    // Calculate confidence
    const baseConfidence = 0.8; // Lab default
    const confidence = mapping.confidenceMultiplier
      ? baseConfidence * mapping.confidenceMultiplier
      : baseConfidence;

    // Build candidate
    const candidate: LabCandidate = {
      key: mapping.target,
      value,
      confidence,
      evidence: {
        rawPath: mapping.source,
        snippet: extractSnippet(value),
      },
    };

    result.candidates.push(candidate);
    addedKeys.add(mapping.target);
    attemptedMappings.push({
      fieldKey: mapping.target,
      attempted: true,
      found: true,
    });
  }

  // ============================================================================
  // Phase 2: Apply INFERENCE_MAPPINGS for baseline strategy fields
  // These produce lower-confidence candidates when standard mappings don't
  // ============================================================================
  for (const inference of INFERENCE_MAPPINGS) {
    // Skip if we already have this key from standard mappings
    if (addedKeys.has(inference.target)) {
      continue;
    }

    let foundValue: unknown = null;
    let foundPath: string | null = null;

    // Try each source path in priority order
    for (const sourcePath of inference.sourcePaths) {
      const value = getNestedValue(websiteResult, sourcePath);
      if (isMeaningfulValue(value)) {
        foundValue = value;
        foundPath = sourcePath;
        break;
      }
    }

    // Apply transform if we have a value
    if (foundValue !== null && inference.transform) {
      try {
        foundValue = inference.transform(foundValue, websiteResult);
      } catch (e) {
        console.warn(`[buildWebsiteLabCandidates] Inference transform failed for ${inference.target}:`, e);
        foundValue = null;
      }
    }

    // Skip if still no meaningful value
    if (!isMeaningfulValue(foundValue)) {
      attemptedMappings.push({
        fieldKey: inference.target,
        attempted: true,
        found: false,
        reason: 'empty_value',
      });
      continue;
    }

    // Build inferred candidate with lower confidence
    const candidate: LabCandidate = {
      key: inference.target,
      value: foundValue,
      confidence: inference.confidence,
      evidence: {
        rawPath: foundPath || 'inferred',
        snippet: extractSnippet(foundValue),
        isInferred: true,
      },
    };

    result.candidates.push(candidate);
    addedKeys.add(inference.target);
    attemptedMappings.push({
      fieldKey: inference.target,
      attempted: true,
      found: true,
    });

    console.log(`[buildWebsiteLabCandidates] Inferred ${inference.target} from ${foundPath} (confidence: ${inference.confidence})`);
  }

  // ============================================================================
  // Phase 3: Add debug info if no candidates were produced
  // ============================================================================
  if (result.candidates.length === 0) {
    result.debug = buildDebugInfo(websiteResult, attemptedMappings, schemaVariant);
    console.warn('[buildWebsiteLabCandidates] NO_CANDIDATES - debug info attached:', {
      rootTopKeys: result.debug.rootTopKeys,
      detectedSchema: result.debug.detectedSchema,
      summaryLen: result.debug.summaryLen,
      recommendationsCount: result.debug.recommendationsCount,
      issuesCount: result.debug.issuesCount,
      samplePathsFound: result.debug.samplePathsFound,
      attemptedCount: attemptedMappings.length,
    });
  }

  console.log('[buildWebsiteLabCandidates] Complete:', {
    candidates: result.candidates.length,
    skippedWrongDomain: result.skipped.wrongDomain,
    skippedEmptyValue: result.skipped.emptyValue,
    inferred: result.candidates.filter(c => c.evidence?.isInferred).length,
  });

  return result;
}

/**
 * Result type for extractWebsiteLabResult with debug info
 */
export interface ExtractWebsiteLabResultOutput {
  result: WebsiteUXLabResultV4;
  extractionPath: string;
  topLevelKeys?: string[];
}

/**
 * Extract WebsiteUXLabResultV4 from rawJson using robust extraction.
 * Returns null if extraction fails.
 *
 * This function uses findWebsiteLabRoot() which handles:
 * - JSON strings (parsed automatically)
 * - Multiple nesting patterns
 * - Fallback detection via signature fields
 */
export function extractWebsiteLabResult(
  rawJson: unknown
): ExtractWebsiteLabResultOutput | null {
  // Use the robust root finder
  const rootResult = findWebsiteLabRoot(rawJson);

  if (!rootResult) {
    return null;
  }

  return {
    result: rootResult.root as unknown as WebsiteUXLabResultV4,
    extractionPath: rootResult.path,
    topLevelKeys: Object.keys(rootResult.root).slice(0, 20),
  };
}

/**
 * Get the list of authorized domains for WebsiteLab V4 proposals
 */
export function getWebsiteLabAuthorizedDomains(): string[] {
  return Array.from(WEBSITELAB_AUTHORIZED_DOMAINS);
}
