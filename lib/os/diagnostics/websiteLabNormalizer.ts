// lib/os/diagnostics/websiteLabNormalizer.ts
// Website Lab Run Normalizer - V5 Canonical Output Contract
//
// This module provides the SINGLE SOURCE OF TRUTH for normalizing Website Lab
// run JSON to the canonical V5 output format.
//
// CANONICAL OUTPUT SHAPE:
// {
//   module: "website",
//   status: "completed" | "failed",
//   score: number,                    // V5 score (or 0)
//   summary: string,                  // V5-derived summary
//   issues: string[],                 // V5 blocking issue descriptions
//   recommendations: string[],        // V5 quick win actions
//   v5Diagnostic: V5DiagnosticOutput, // TOP LEVEL; canonical
//   rawEvidence: { labResultV4?: ... } // legacy only; NEVER contains v5Diagnostic
// }
//
// USAGE:
// - Call normalizeWebsiteLabRun() on ALL read paths (API responses, UI rendering)
// - Call normalizeWebsiteLabRun() on ALL write paths (post-run hooks, saving)

import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';

// ============================================================================
// Types
// ============================================================================

/**
 * Canonical Website Lab run output shape.
 * This is the ONLY shape that should be returned from APIs and used in UIs.
 */
export interface CanonicalWebsiteLabOutput {
  module: 'website';
  status: 'completed' | 'failed';
  score: number;
  summary: string;
  issues: string[];
  recommendations: string[];
  v5Diagnostic: V5DiagnosticOutput | null;
  rawEvidence: {
    labResultV4?: Record<string, unknown>;
  };
  // Preserve any other top-level fields
  [key: string]: unknown;
}

/**
 * Raw Website Lab JSON as it may be stored (various legacy formats)
 */
type RawWebsiteLabJson = Record<string, unknown>;

// ============================================================================
// Legacy Path Extraction
// ============================================================================

/**
 * Legacy paths where v5Diagnostic may be nested.
 * Checked in order; first match wins.
 */
const V5_DIAGNOSTIC_LEGACY_PATHS = [
  // Direct top-level (already canonical)
  (raw: RawWebsiteLabJson) => raw.v5Diagnostic,
  // In labResult (some serialization formats)
  (raw: RawWebsiteLabJson) => (raw.labResult as Record<string, unknown>)?.v5Diagnostic,
  // In labResult.siteAssessment (older format)
  (raw: RawWebsiteLabJson) => {
    const lr = raw.labResult as Record<string, unknown>;
    const sa = lr?.siteAssessment as Record<string, unknown>;
    return sa?.v5Diagnostic;
  },
  // In siteAssessment (direct)
  (raw: RawWebsiteLabJson) => (raw.siteAssessment as Record<string, unknown>)?.v5Diagnostic,
  // In rawEvidence.labResultV4 (common legacy path)
  (raw: RawWebsiteLabJson) => {
    const re = raw.rawEvidence as Record<string, unknown>;
    const lr = re?.labResultV4 as Record<string, unknown>;
    return lr?.v5Diagnostic;
  },
  // In rawEvidence.labResultV4.siteAssessment (deepest legacy path)
  (raw: RawWebsiteLabJson) => {
    const re = raw.rawEvidence as Record<string, unknown>;
    const lr = re?.labResultV4 as Record<string, unknown>;
    const sa = lr?.siteAssessment as Record<string, unknown>;
    return sa?.v5Diagnostic;
  },
];

/**
 * Extract v5Diagnostic from any legacy path
 */
function extractV5Diagnostic(raw: RawWebsiteLabJson): V5DiagnosticOutput | null {
  for (const extractor of V5_DIAGNOSTIC_LEGACY_PATHS) {
    try {
      const result = extractor(raw);
      if (result && typeof result === 'object') {
        // Validate it has the expected V5 structure
        const v5 = result as V5DiagnosticOutput;
        if (
          Array.isArray(v5.observations) ||
          Array.isArray(v5.blockingIssues) ||
          typeof v5.score === 'number'
        ) {
          return v5;
        }
      }
    } catch {
      // Continue to next path
    }
  }
  return null;
}

/**
 * Count pages analyzed from siteGraph
 */
function countPagesAnalyzed(raw: RawWebsiteLabJson): number {
  // Try direct siteGraph
  const siteGraph = raw.siteGraph as Record<string, unknown>;
  if (siteGraph?.pages && Array.isArray(siteGraph.pages)) {
    return siteGraph.pages.length;
  }

  // Try rawEvidence.labResultV4.siteGraph
  const re = raw.rawEvidence as Record<string, unknown>;
  const lr = re?.labResultV4 as Record<string, unknown>;
  const sg = lr?.siteGraph as Record<string, unknown>;
  if (sg?.pages && Array.isArray(sg.pages)) {
    return sg.pages.length;
  }

  // Try labResult.siteGraph
  const lrDirect = raw.labResult as Record<string, unknown>;
  const sgDirect = lrDirect?.siteGraph as Record<string, unknown>;
  if (sgDirect?.pages && Array.isArray(sgDirect.pages)) {
    return sgDirect.pages.length;
  }

  return 0;
}

/**
 * Remove v5Diagnostic from nested legacy paths to keep rawEvidence clean
 */
function cleanRawEvidence(rawEvidence: Record<string, unknown>): Record<string, unknown> {
  if (!rawEvidence || typeof rawEvidence !== 'object') {
    return rawEvidence;
  }

  const cleaned = { ...rawEvidence };

  // Clean labResultV4.v5Diagnostic
  if (cleaned.labResultV4 && typeof cleaned.labResultV4 === 'object') {
    const labResult = { ...(cleaned.labResultV4 as Record<string, unknown>) };
    delete labResult.v5Diagnostic;

    // Also clean labResultV4.siteAssessment.v5Diagnostic
    if (labResult.siteAssessment && typeof labResult.siteAssessment === 'object') {
      const sa = { ...(labResult.siteAssessment as Record<string, unknown>) };
      delete sa.v5Diagnostic;
      labResult.siteAssessment = sa;
    }

    cleaned.labResultV4 = labResult;
  }

  return cleaned;
}

// ============================================================================
// Main Normalizer
// ============================================================================

/**
 * Normalize Website Lab run JSON to canonical V5 output format.
 *
 * This is the SINGLE SOURCE OF TRUTH for normalizing Website Lab data.
 * Use this function on ALL read paths and write paths.
 *
 * Transformations:
 * 1. Lifts v5Diagnostic from legacy nested paths to top-level
 * 2. Removes nested v5Diagnostic from rawEvidence to keep legacy bucket clean
 * 3. Aligns score/summary/issues/recommendations to V5 data when available
 * 4. Logs ERROR if V5 is missing despite pages being analyzed
 *
 * @param rawJson - The raw Website Lab run JSON (any format)
 * @param options - Optional context for logging
 * @returns Normalized canonical output
 */
export function normalizeWebsiteLabRun(
  rawJson: unknown,
  options?: { runId?: string; companyId?: string }
): CanonicalWebsiteLabOutput {
  const raw = (rawJson || {}) as RawWebsiteLabJson;

  // Extract V5 diagnostic from any legacy path
  const v5Diagnostic = extractV5Diagnostic(raw);

  // Count pages analyzed for guard logging
  const pagesAnalyzed = countPagesAnalyzed(raw);

  // GUARD LOG: Error if V5 is missing when pages were analyzed
  if (!v5Diagnostic && pagesAnalyzed > 0) {
    console.error('[WebsiteLabNormalizer] ERROR: V5 diagnostic missing despite pages analyzed', {
      runId: options?.runId || 'unknown',
      companyId: options?.companyId || 'unknown',
      pagesAnalyzed,
      topLevelKeys: Object.keys(raw).slice(0, 10),
    });
  }

  // Clean rawEvidence to remove nested v5Diagnostic
  const rawEvidence = raw.rawEvidence as Record<string, unknown> | undefined;
  const cleanedRawEvidence: Record<string, unknown> = rawEvidence ? cleanRawEvidence(rawEvidence) : {};

  // Derive issues from V5 blocking issues
  const issues: string[] = v5Diagnostic?.blockingIssues?.map(
    (issue) => issue.whyItBlocks
  ) || (raw.issues as string[]) || [];

  // Derive recommendations from V5 quick wins
  const recommendations: string[] = v5Diagnostic?.quickWins?.map(
    (qw) => qw.action
  ) || (raw.recommendations as string[]) || [];

  // Build summary from V5 score
  let summary = (raw.summary as string) || '';
  if (v5Diagnostic) {
    const v5Score = v5Diagnostic.score || 0;
    const justification = v5Diagnostic.scoreJustification || '';
    summary = `V5 Diagnostic: ${v5Score}/100. ${justification}`.trim();
  }

  // Build canonical output
  const canonical: CanonicalWebsiteLabOutput = {
    // Preserve existing top-level fields (except ones we override)
    ...raw,

    // Canonical fields
    module: 'website',
    status: (raw.status as 'completed' | 'failed') || (v5Diagnostic ? 'completed' : 'failed'),
    score: v5Diagnostic?.score ?? (raw.score as number) ?? 0,
    summary,
    issues,
    recommendations,

    // V5 at TOP LEVEL (canonical)
    v5Diagnostic,

    // Clean rawEvidence (no nested v5Diagnostic)
    rawEvidence: {
      labResultV4: (cleanedRawEvidence.labResultV4 as Record<string, unknown>) || undefined,
      ...Object.fromEntries(
        Object.entries(cleanedRawEvidence).filter(([k]) => k !== 'labResultV4')
      ),
    },
  };

  // Remove any other nested v5Diagnostic fields that might exist
  delete (canonical as Record<string, unknown>).labResult;
  if (canonical.siteAssessment) {
    const sa = canonical.siteAssessment as Record<string, unknown>;
    delete sa.v5Diagnostic;
  }

  return canonical;
}

/**
 * Check if raw JSON has V5 diagnostic data available.
 * Use this for quick checks without full normalization.
 */
export function hasV5Diagnostic(rawJson: unknown): boolean {
  return extractV5Diagnostic((rawJson || {}) as RawWebsiteLabJson) !== null;
}

/**
 * Validate that normalized output conforms to canonical shape.
 * Throws if validation fails.
 */
export function validateCanonicalOutput(output: CanonicalWebsiteLabOutput): void {
  if (output.module !== 'website') {
    throw new Error(`[WebsiteLabNormalizer] Invalid module: ${output.module}`);
  }

  if (!['completed', 'failed'].includes(output.status)) {
    throw new Error(`[WebsiteLabNormalizer] Invalid status: ${output.status}`);
  }

  if (typeof output.score !== 'number') {
    throw new Error(`[WebsiteLabNormalizer] Invalid score: ${output.score}`);
  }

  // V5 validation: if v5Diagnostic exists, it must have the expected structure
  if (output.v5Diagnostic) {
    const v5 = output.v5Diagnostic;
    if (!Array.isArray(v5.observations)) {
      throw new Error('[WebsiteLabNormalizer] v5Diagnostic.observations is not an array');
    }
    if (!Array.isArray(v5.blockingIssues)) {
      throw new Error('[WebsiteLabNormalizer] v5Diagnostic.blockingIssues is not an array');
    }
    if (typeof v5.score !== 'number') {
      throw new Error('[WebsiteLabNormalizer] v5Diagnostic.score is not a number');
    }
  }

  // Ensure rawEvidence doesn't contain v5Diagnostic
  const re = output.rawEvidence as Record<string, unknown>;
  if (re?.v5Diagnostic) {
    throw new Error('[WebsiteLabNormalizer] rawEvidence contains v5Diagnostic (should be at top level)');
  }
  const lr = re?.labResultV4 as Record<string, unknown>;
  if (lr?.v5Diagnostic) {
    throw new Error('[WebsiteLabNormalizer] rawEvidence.labResultV4 contains v5Diagnostic (should be at top level)');
  }
  const sa = lr?.siteAssessment as Record<string, unknown>;
  if (sa?.v5Diagnostic) {
    throw new Error('[WebsiteLabNormalizer] rawEvidence.labResultV4.siteAssessment contains v5Diagnostic (should be at top level)');
  }
}
