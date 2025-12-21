// lib/contextGraph/v4/gapPlanCandidates.ts
// GAP Plan Candidate Builder for V4 Proposals
//
// Extracts candidates from GAP Plan dataJson for V4 proposal flow.
// Maps GAP Plan structured data to required strategy fields:
// - productOffer.primaryProducts ← gapStructured.primaryOffers[].name
// - productOffer.valueProposition ← gapStructured.primaryOffers[].description
// - audience.primaryAudience ← gapStructured.audienceSummary.icpDescription
// - audience.icpDescription ← gapStructured.audienceSummary.icpDescription
// - competitive.competitors ← gapStructured.competitors[].name
//
// Note: GAP Plan does NOT provide:
// - identity.businessModel
// - operationalConstraints.budgetCapsFloors
// - brand.positioning

import type { LabCandidate } from './propose';

// ============================================================================
// Types (mirrors gapPlanImporter.ts)
// ============================================================================

interface GapPlanOffer {
  name: string;
  description?: string;
  targetAudience?: string;
  priceTier?: 'low' | 'mid' | 'high' | 'unknown';
}

interface GapPlanCompetitor {
  name: string;
  domain?: string;
  positioningNote?: string;
}

interface GapPlanAudienceSummary {
  icpDescription: string;
  keyPainPoints: string[];
  buyingTriggers?: string[];
}

interface GapPlanStructured {
  scores?: {
    overall?: number;
    brand?: number;
    content?: number;
    seo?: number;
    website?: number;
    authority?: number;
    digitalFootprint?: number;
    technical?: number;
  };
  maturityStage?: string;
  primaryOffers?: GapPlanOffer[];
  competitors?: GapPlanCompetitor[];
  audienceSummary?: GapPlanAudienceSummary;
  brandIdentityNotes?: {
    tone?: string[];
    personality?: string[];
    differentiationSummary?: string;
  };
  keyFindings?: string[];
  kpisToWatch?: unknown[];
  unknowns?: string[];
}

interface GapPlanDataJson {
  companyName?: string;
  snapshotId?: string;
  labsRun?: string[];
  gapStructured?: GapPlanStructured;
  insights?: unknown[];
  durationMs?: number;
}

// ============================================================================
// Debug Types
// ============================================================================

export interface GapPlanDebug {
  /** Top-level keys found in the root */
  rootTopKeys: string[];
  /** Which paths were found */
  samplePathsFound: {
    gapStructured: boolean;
    primaryOffers: boolean;
    competitors: boolean;
    audienceSummary: boolean;
    brandIdentityNotes: boolean;
    scores: boolean;
  };
  /** Attempted mappings */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
}

export interface BuildGapPlanCandidatesResult {
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
  debug?: GapPlanDebug;
}

// ============================================================================
// GAP Plan Signature Fields
// ============================================================================

const GAPPLAN_SIGNATURE_FIELDS = new Set([
  'gapStructured',
  'insights',
  'labsRun',
  'snapshotId',
  'durationMs',
  'companyName',
]);

// ============================================================================
// Helper Functions
// ============================================================================

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

function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function extractSnippet(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.slice(0, 200);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).join(', ').slice(0, 200);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

// ============================================================================
// GAP Plan Root Finder
// ============================================================================

interface FindGapPlanRootResult {
  root: GapPlanDataJson;
  path: string;
  matchedFields: string[];
}

/**
 * Find GAP Plan data root within rawJson
 */
export function findGapPlanRoot(rawJson: unknown): FindGapPlanRootResult | null {
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

  // Helper to check for GAP Plan signature
  const getMatchedSignatureFields = (obj: unknown): string[] => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o);
    return keys.filter(k => GAPPLAN_SIGNATURE_FIELDS.has(k));
  };

  // Try known paths in order
  const pathsToTry: Array<{ path: string; getter: () => unknown }> = [
    // Direct format (most common for GAP Plan)
    { path: 'direct', getter: () => data },
    // Wrapped in result
    { path: 'result', getter: () => data.result },
    // Wrapped in data
    { path: 'data', getter: () => data.data },
    // Wrapped in dataJson
    { path: 'dataJson', getter: () => data.dataJson },
    // Wrapped in gapPlan
    { path: 'gapPlan', getter: () => data.gapPlan },
  ];

  for (const { path, getter } of pathsToTry) {
    try {
      const candidate = getter();
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        const matchedFields = getMatchedSignatureFields(candidate);
        // GAP Plan requires at least gapStructured
        if (matchedFields.length >= 1 && (matchedFields.includes('gapStructured') || matchedFields.includes('insights'))) {
          return {
            root: candidate as GapPlanDataJson,
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
 * Build V4 proposal candidates from a GAP Plan result.
 *
 * Maps:
 * - productOffer.primaryProducts from gapStructured.primaryOffers[].name
 * - productOffer.valueProposition from gapStructured.primaryOffers[].description
 * - audience.primaryAudience from gapStructured.audienceSummary.icpDescription
 * - audience.icpDescription from gapStructured.audienceSummary.icpDescription
 * - competitive.competitors from gapStructured.competitors[].name
 */
export function buildGapPlanCandidates(
  rawJson: unknown
): BuildGapPlanCandidatesResult {
  const result: BuildGapPlanCandidatesResult = {
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

  // Find GAP Plan root
  const rootResult = findGapPlanRoot(rawJson);

  if (!rootResult) {
    if (typeof rawJson === 'object' && !Array.isArray(rawJson)) {
      result.topLevelKeys = Object.keys(rawJson as object).slice(0, 20);
    }
    result.extractionFailureReason = `Could not locate GAP Plan output. Top-level keys: ${result.topLevelKeys?.join(', ') || '(none)'}`;
    return result;
  }

  const gapData = rootResult.root;
  result.extractionPath = rootResult.path;
  result.topLevelKeys = Object.keys(gapData).slice(0, 20);
  result.rawKeysFound = Object.keys(gapData).length;

  console.log(`[buildGapPlanCandidates] Extraction path: ${result.extractionPath}, raw keys: ${result.rawKeysFound}`);

  const structured = gapData.gapStructured;
  if (!structured) {
    result.extractionFailureReason = 'gapStructured is missing from GAP Plan data';
    return result;
  }

  // ============================================================================
  // 1. productOffer.primaryProducts from gapStructured.primaryOffers[].name
  // ============================================================================
  {
    const fieldKey = 'productOffer.primaryProducts';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    const offers = structured.primaryOffers;
    if (Array.isArray(offers) && offers.length > 0) {
      const productNames = offers
        .map((o) => o.name)
        .filter((name): name is string => isMeaningfulValue(name));

      if (productNames.length > 0) {
        result.candidates.push({
          key: fieldKey,
          value: productNames,
          confidence: 0.7, // GAP source default
          evidence: {
            rawPath: 'gapStructured.primaryOffers[].name',
            snippet: extractSnippet(productNames),
          },
        });
        attemptedMappings[attemptedMappings.length - 1].found = true;
      } else {
        attemptedMappings[attemptedMappings.length - 1].reason = 'empty_names';
      }
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'no_offers';
    }
  }

  // ============================================================================
  // 2. productOffer.valueProposition from gapStructured.primaryOffers[].description
  // ============================================================================
  {
    const fieldKey = 'productOffer.valueProposition';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    const offers = structured.primaryOffers;
    if (Array.isArray(offers) && offers.length > 0) {
      // Use the first offer with a description
      const offerWithDesc = offers.find((o) => isMeaningfulValue(o.description));
      if (offerWithDesc && offerWithDesc.description) {
        result.candidates.push({
          key: fieldKey,
          value: offerWithDesc.description,
          confidence: 0.65, // Slightly lower - derived from offer desc
          evidence: {
            rawPath: 'gapStructured.primaryOffers[0].description',
            snippet: extractSnippet(offerWithDesc.description),
          },
        });
        attemptedMappings[attemptedMappings.length - 1].found = true;
      } else {
        attemptedMappings[attemptedMappings.length - 1].reason = 'no_description';
      }
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'no_offers';
    }
  }

  // ============================================================================
  // 3. audience.primaryAudience from gapStructured.audienceSummary.icpDescription
  // ============================================================================
  {
    const fieldKey = 'audience.primaryAudience';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    const icpDesc = structured.audienceSummary?.icpDescription;
    if (isMeaningfulValue(icpDesc)) {
      result.candidates.push({
        key: fieldKey,
        value: icpDesc,
        confidence: 0.7,
        evidence: {
          rawPath: 'gapStructured.audienceSummary.icpDescription',
          snippet: extractSnippet(icpDesc),
        },
      });
      attemptedMappings[attemptedMappings.length - 1].found = true;
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'empty_value';
    }
  }

  // ============================================================================
  // 4. audience.icpDescription from gapStructured.audienceSummary.icpDescription
  // ============================================================================
  {
    const fieldKey = 'audience.icpDescription';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    const icpDesc = structured.audienceSummary?.icpDescription;
    if (isMeaningfulValue(icpDesc)) {
      result.candidates.push({
        key: fieldKey,
        value: icpDesc,
        confidence: 0.7,
        evidence: {
          rawPath: 'gapStructured.audienceSummary.icpDescription',
          snippet: extractSnippet(icpDesc),
        },
      });
      attemptedMappings[attemptedMappings.length - 1].found = true;
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'empty_value';
    }
  }

  // ============================================================================
  // 5. competitive.competitors from gapStructured.competitors[].name
  // ============================================================================
  {
    const fieldKey = 'competitive.competitors';
    attemptedMappings.push({ fieldKey, attempted: true, found: false });

    const competitors = structured.competitors;
    if (Array.isArray(competitors) && competitors.length > 0) {
      const competitorNames = competitors
        .map((c) => c.name)
        .filter((name): name is string => isMeaningfulValue(name));

      if (competitorNames.length > 0) {
        result.candidates.push({
          key: fieldKey,
          value: competitorNames,
          confidence: 0.7,
          evidence: {
            rawPath: 'gapStructured.competitors[].name',
            snippet: extractSnippet(competitorNames),
          },
        });
        attemptedMappings[attemptedMappings.length - 1].found = true;
      } else {
        attemptedMappings[attemptedMappings.length - 1].reason = 'empty_names';
      }
    } else {
      attemptedMappings[attemptedMappings.length - 1].reason = 'no_competitors';
    }
  }

  // Build debug info if no candidates
  if (result.candidates.length === 0) {
    result.debug = {
      rootTopKeys: Object.keys(gapData).slice(0, 15),
      samplePathsFound: {
        gapStructured: !!structured,
        primaryOffers: Array.isArray(structured?.primaryOffers) && structured.primaryOffers.length > 0,
        competitors: Array.isArray(structured?.competitors) && structured.competitors.length > 0,
        audienceSummary: !!structured?.audienceSummary,
        brandIdentityNotes: !!structured?.brandIdentityNotes,
        scores: !!structured?.scores,
      },
      attemptedMappings,
    };
    console.warn('[buildGapPlanCandidates] NO_CANDIDATES - debug info attached');
  }

  console.log('[buildGapPlanCandidates] Complete:', {
    candidates: result.candidates.length,
    candidateKeys: result.candidates.map(c => c.key),
  });

  return result;
}

/**
 * Extract GAP Plan structured data from rawJson
 */
export function extractGapPlanStructured(
  rawJson: unknown
): { result: GapPlanStructured; extractionPath: string } | null {
  const rootResult = findGapPlanRoot(rawJson);
  if (!rootResult || !rootResult.root.gapStructured) {
    return null;
  }

  return {
    result: rootResult.root.gapStructured,
    extractionPath: rootResult.path,
  };
}
