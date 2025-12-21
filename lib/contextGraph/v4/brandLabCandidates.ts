// lib/contextGraph/v4/brandLabCandidates.ts
// Brand Lab Candidate Builder for V4 Proposals
//
// Extracts candidates from BrandLabResult for V4 proposal flow.
// Maps Brand Lab findings to required strategy fields:
// - brand.positioning
// - productOffer.valueProposition
// - audience.primaryAudience
// - audience.icpDescription

import type { LabCandidate } from './propose';
import type { BrandLabResult, BrandLabFindings } from '@/lib/diagnostics/brand-lab/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Debug info for Brand Lab extraction
 */
export interface BrandLabDebug {
  /** Top-level keys found in the root */
  rootTopKeys: string[];
  /** Which paths were found */
  samplePathsFound: {
    findings: boolean;
    positioningStatement: boolean;
    valuePropHeadline: boolean;
    icpPrimaryAudience: boolean;
    audienceFit: boolean;
    dimensions: boolean;
  };
  /** Attempted mappings */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
}

export interface BuildBrandLabCandidatesResult {
  /** The extraction path used */
  extractionPath: string;
  /** Number of raw keys found */
  rawKeysFound: number;
  /** Candidates ready for V4 proposal */
  candidates: LabCandidate[];
  /** Top-level keys for debugging */
  topLevelKeys?: string[];
  /** Extraction failure reason */
  extractionFailureReason?: string;
  /** Debug info for NO_CANDIDATES diagnosis */
  debug?: BrandLabDebug;
}

// ============================================================================
// Brand Lab Signature Fields
// ============================================================================

const BRANDLAB_SIGNATURE_FIELDS = new Set([
  'overallScore',
  'maturityStage',
  'dimensions',
  'findings',
  'narrativeSummary',
  'dataConfidence',
  'issues',
  'quickWins',
  'projects',
]);

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
 * Check if a value is meaningful
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

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
  return undefined;
}

// ============================================================================
// Brand Lab Root Finder
// ============================================================================

interface FindBrandLabRootResult {
  root: Record<string, unknown>;
  path: string;
  matchedFields: string[];
}

/**
 * Find Brand Lab data root within rawJson
 */
export function findBrandLabRoot(rawJson: unknown): FindBrandLabRootResult | null {
  // Handle JSON strings
  let data: Record<string, unknown>;

  if (typeof rawJson === 'string') {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      data = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
    return null;
  } else {
    data = rawJson as Record<string, unknown>;
  }

  // Helper to check for Brand Lab signature
  const getMatchedSignatureFields = (obj: unknown): string[] => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o);
    return keys.filter(k => BRANDLAB_SIGNATURE_FIELDS.has(k));
  };

  // Try known paths in order
  const pathsToTry: Array<{ path: string; getter: () => unknown }> = [
    // Direct format (most common for Brand Lab)
    { path: 'direct', getter: () => data },
    // Wrapped in result
    { path: 'result', getter: () => data.result },
    // Wrapped in data
    { path: 'data', getter: () => data.data },
    // Wrapped in report
    { path: 'report', getter: () => data.report },
    // Wrapped in brandLab
    { path: 'brandLab', getter: () => data.brandLab },
  ];

  for (const { path, getter } of pathsToTry) {
    try {
      const candidate = getter();
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        const matchedFields = getMatchedSignatureFields(candidate);
        if (matchedFields.length >= 2) {
          return {
            root: candidate as Record<string, unknown>,
            path,
            matchedFields,
          };
        }
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build V4 proposal candidates from a Brand Lab result.
 *
 * Maps:
 * - brand.positioning from findings.positioning.statement
 * - productOffer.valueProposition from findings.valueProp.headline + description
 * - audience.primaryAudience from findings.icp.primaryAudience
 * - audience.icpDescription from audienceFit dimension or findings.icp
 */
export function buildBrandLabCandidates(
  rawJson: unknown
): BuildBrandLabCandidatesResult {
  const result: BuildBrandLabCandidatesResult = {
    extractionPath: 'unknown',
    rawKeysFound: 0,
    candidates: [],
  };

  const attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }> = [];

  // Handle null/undefined
  if (rawJson === null || rawJson === undefined) {
    result.extractionFailureReason = 'rawJson is null or undefined';
    return result;
  }

  // Find Brand Lab root
  const rootResult = findBrandLabRoot(rawJson);

  if (!rootResult) {
    if (typeof rawJson === 'object' && !Array.isArray(rawJson)) {
      result.topLevelKeys = Object.keys(rawJson as object).slice(0, 20);
    }
    result.extractionFailureReason = `Could not locate Brand Lab output. Top-level keys: ${result.topLevelKeys?.join(', ') || '(none)'}`;
    return result;
  }

  const brandResult = rootResult.root as unknown as BrandLabResult;
  result.extractionPath = rootResult.path;
  result.topLevelKeys = Object.keys(brandResult).slice(0, 20);
  result.rawKeysFound = Object.keys(brandResult).length;

  console.log(`[buildBrandLabCandidates] Extraction path: ${result.extractionPath}, raw keys: ${result.rawKeysFound}`);

  const findings = brandResult.findings as BrandLabFindings | undefined;

  // ============================================================================
  // 1. brand.positioning from findings.positioning.statement
  // ============================================================================
  {
    const fieldKey = 'brand.positioning';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    // Try primary path: findings.positioning.statement
    let value = getNestedValue(brandResult, 'findings.positioning.statement') as string | undefined;
    let rawPath = 'findings.positioning.statement';
    let confidence = getNestedValue(brandResult, 'findings.positioning.confidence') as number | undefined;

    // Fallback: positioning.statement (direct)
    if (!isMeaningfulValue(value)) {
      value = getNestedValue(brandResult, 'positioning.statement') as string | undefined;
      rawPath = 'positioning.statement';
      confidence = getNestedValue(brandResult, 'positioning.confidence') as number | undefined;
    }

    if (isMeaningfulValue(value)) {
      result.candidates.push({
        key: fieldKey,
        value: value,
        confidence: confidence ?? 0.75,
        evidence: {
          rawPath,
          snippet: extractSnippet(value),
        },
      });
      attemptedMappings[attemptedMappings.length - 1].found = true;
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'empty_value';
    }
  }

  // ============================================================================
  // 2. productOffer.valueProposition from findings.valueProp
  // ============================================================================
  {
    const fieldKey = 'productOffer.valueProposition';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    // Try primary path: findings.valueProp
    let headline = getNestedValue(brandResult, 'findings.valueProp.headline') as string | undefined;
    let description = getNestedValue(brandResult, 'findings.valueProp.description') as string | undefined;
    let rawPath = 'findings.valueProp';
    let confidence = getNestedValue(brandResult, 'findings.valueProp.confidence') as number | undefined;

    // Fallback: valueProp (direct)
    if (!isMeaningfulValue(headline)) {
      headline = getNestedValue(brandResult, 'valueProp.headline') as string | undefined;
      description = getNestedValue(brandResult, 'valueProp.description') as string | undefined;
      rawPath = 'valueProp';
      confidence = getNestedValue(brandResult, 'valueProp.confidence') as number | undefined;
    }

    // Combine headline + description
    let value: string | undefined;
    if (isMeaningfulValue(headline)) {
      value = headline;
      if (isMeaningfulValue(description)) {
        value = `${headline}. ${description}`;
      }
    }

    if (isMeaningfulValue(value)) {
      result.candidates.push({
        key: fieldKey,
        value: value,
        confidence: confidence ?? 0.75,
        evidence: {
          rawPath,
          snippet: extractSnippet(value),
        },
      });
      attemptedMappings[attemptedMappings.length - 1].found = true;
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'empty_value';
    }
  }

  // ============================================================================
  // 3. audience.primaryAudience from findings.icp.primaryAudience
  // ============================================================================
  {
    const fieldKey = 'audience.primaryAudience';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    // Try primary path: findings.icp.primaryAudience
    let value = getNestedValue(brandResult, 'findings.icp.primaryAudience') as string | undefined;
    let rawPath = 'findings.icp.primaryAudience';
    let confidence = getNestedValue(brandResult, 'findings.icp.confidence') as number | undefined;

    // Fallback: icp.primaryAudience (direct)
    if (!isMeaningfulValue(value)) {
      value = getNestedValue(brandResult, 'icp.primaryAudience') as string | undefined;
      rawPath = 'icp.primaryAudience';
      confidence = getNestedValue(brandResult, 'icp.confidence') as number | undefined;
    }

    if (isMeaningfulValue(value)) {
      result.candidates.push({
        key: fieldKey,
        value: value,
        confidence: confidence ?? 0.7,
        evidence: {
          rawPath,
          snippet: extractSnippet(value),
        },
      });
      attemptedMappings[attemptedMappings.length - 1].found = true;
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'empty_value';
    }
  }

  // ============================================================================
  // 4. audience.icpDescription from audienceFit dimension or findings.icp
  // ============================================================================
  {
    const fieldKey = 'audience.icpDescription';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    let value: string | undefined;
    let rawPath = '';
    let confidence = 0.65;

    // Try audienceFit dimension summary first
    const dimensions = brandResult.dimensions;
    if (Array.isArray(dimensions)) {
      const audienceFitDim = dimensions.find(d => d.key === 'audienceFit');
      if (audienceFitDim && isMeaningfulValue(audienceFitDim.summary)) {
        value = audienceFitDim.summary;
        rawPath = 'dimensions[audienceFit].summary';
        // Use dimension score as proxy for confidence
        confidence = audienceFitDim.score ? audienceFitDim.score / 100 : 0.65;
      }
    }

    // Fallback: findings.audienceFit.primaryICPDescription
    if (!isMeaningfulValue(value)) {
      value = getNestedValue(brandResult, 'findings.audienceFit.primaryICPDescription') as string | undefined;
      rawPath = 'findings.audienceFit.primaryICPDescription';
    }

    // Fallback: reuse findings.icp.primaryAudience if nothing else
    if (!isMeaningfulValue(value)) {
      value = getNestedValue(brandResult, 'findings.icp.primaryAudience') as string | undefined;
      rawPath = 'findings.icp.primaryAudience (fallback)';
      confidence = 0.55; // Lower confidence for fallback
    }

    if (isMeaningfulValue(value)) {
      result.candidates.push({
        key: fieldKey,
        value: value,
        confidence,
        evidence: {
          rawPath,
          snippet: extractSnippet(value),
        },
      });
      attemptedMappings[attemptedMappings.length - 1].found = true;
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'empty_value';
    }
  }

  // Build debug info if no candidates
  if (result.candidates.length === 0) {
    result.debug = {
      rootTopKeys: Object.keys(brandResult).slice(0, 15),
      samplePathsFound: {
        findings: !!brandResult.findings,
        positioningStatement: !!getNestedValue(brandResult, 'findings.positioning.statement'),
        valuePropHeadline: !!getNestedValue(brandResult, 'findings.valueProp.headline'),
        icpPrimaryAudience: !!getNestedValue(brandResult, 'findings.icp.primaryAudience'),
        audienceFit: !!brandResult.dimensions?.find((d: any) => d.key === 'audienceFit'),
        dimensions: Array.isArray(brandResult.dimensions),
      },
      attemptedMappings,
    };
    console.warn('[buildBrandLabCandidates] NO_CANDIDATES - debug info attached');
  }

  console.log('[buildBrandLabCandidates] Complete:', {
    candidates: result.candidates.length,
    candidateKeys: result.candidates.map(c => c.key),
  });

  return result;
}

/**
 * Extract Brand Lab result from rawJson
 */
export function extractBrandLabResult(
  rawJson: unknown
): { result: BrandLabResult; extractionPath: string } | null {
  const rootResult = findBrandLabRoot(rawJson);
  if (!rootResult) {
    return null;
  }

  return {
    result: rootResult.root as unknown as BrandLabResult,
    extractionPath: rootResult.path,
  };
}
