// lib/labs/competitor/mergeCompetitors.ts
// Competitor Merge & Dedupe Engine
//
// Provides utilities for:
// - Normalizing competitor names
// - Merging competitor records from multiple sources
// - Deduplicating competitor lists with fuzzy matching
// - Logging merge operations for diagnostics

import type { CompetitorProfile, CompetitorProvenance } from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

export interface MergeOperation {
  type: 'merge' | 'skip' | 'add';
  competitorA: string;
  competitorB?: string;
  reason: string;
  timestamp: string;
}

export interface DedupeResult {
  competitors: CompetitorProfile[];
  mergeOperations: MergeOperation[];
  duplicatesFound: number;
  finalCount: number;
}

export interface MergeStats {
  competitorsAdded: number;
  competitorsMerged: number;
  fieldsUpdated: number;
  mergeOperations: MergeOperation[];
}

// ============================================================================
// Constants
// ============================================================================

/** Common suffixes to strip when normalizing */
const COMMON_SUFFIXES = [
  ' inc',
  ' inc.',
  ' incorporated',
  ' llc',
  ' ltd',
  ' ltd.',
  ' limited',
  ' corp',
  ' corp.',
  ' corporation',
  ' co',
  ' co.',
  ' company',
  ' group',
  ' holdings',
  ' international',
  ' global',
  ' solutions',
  ' services',
  ' technologies',
  ' technology',
  ' software',
  ' systems',
  ' enterprises',
  ' partners',
  ' consulting',
];

/** Similarity threshold for fuzzy matching (0.78 = 78% match) */
const SIMILARITY_THRESHOLD = 0.78;

// ============================================================================
// Name Normalization
// ============================================================================

/**
 * Normalize a competitor name for comparison
 * - Lowercase
 * - Remove punctuation
 * - Strip common suffixes
 * - Trim whitespace
 */
export function normalizeCompetitorName(name: string): string {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove punctuation except hyphens
  normalized = normalized.replace(/[^\w\s-]/g, '');

  // Strip common suffixes
  for (const suffix of COMMON_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length).trim();
      break; // Only strip one suffix
    }
  }

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Extract domain from URL or return as-is if already a domain
 */
export function normalizeDomain(domainOrUrl: string | null): string | null {
  if (!domainOrUrl) return null;

  try {
    // If it looks like a URL, parse it
    if (domainOrUrl.includes('://') || domainOrUrl.includes('www.')) {
      const url = new URL(
        domainOrUrl.startsWith('http') ? domainOrUrl : `https://${domainOrUrl}`
      );
      return url.hostname.replace(/^www\./, '').toLowerCase();
    }
    // Otherwise treat as domain
    return domainOrUrl.replace(/^www\./, '').toLowerCase();
  } catch {
    return domainOrUrl.toLowerCase();
  }
}

// ============================================================================
// String Similarity
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Build the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const normA = normalizeCompetitorName(a);
  const normB = normalizeCompetitorName(b);

  if (normA === normB) return 1;

  const maxLength = Math.max(normA.length, normB.length);
  if (maxLength === 0) return 0;

  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLength;
}

/**
 * Check if two competitor names are similar enough to be considered duplicates
 */
export function areCompetitorsSimilar(
  a: CompetitorProfile,
  b: CompetitorProfile,
  threshold: number = SIMILARITY_THRESHOLD
): boolean {
  // Check name similarity
  const nameSimilarity = stringSimilarity(a.name, b.name);
  if (nameSimilarity >= threshold) return true;

  // Check domain match (if both have domains)
  const domainA = normalizeDomain(a.domain || a.website);
  const domainB = normalizeDomain(b.domain || b.website);
  if (domainA && domainB && domainA === domainB) return true;

  return false;
}

// ============================================================================
// Merge Logic
// ============================================================================

/**
 * Merge two competitor records, keeping the best data from each
 *
 * Priority:
 * - Prefer higher confidence values
 * - Prefer non-null over null
 * - Prefer longer strings (more detail)
 * - Merge arrays (union with dedup)
 * - Merge provenance (union)
 */
export function mergeCompetitorRecord(
  a: CompetitorProfile,
  b: CompetitorProfile,
  source: string = 'merge'
): CompetitorProfile {
  const now = new Date().toISOString();

  // Helper: pick the better string value
  const pickString = (aVal: string | null, bVal: string | null): string | null => {
    if (!aVal && !bVal) return null;
    if (!aVal) return bVal;
    if (!bVal) return aVal;
    // Prefer longer, more detailed string
    return aVal.length >= bVal.length ? aVal : bVal;
  };

  // Helper: pick the better number (prefer non-null, then higher confidence)
  const pickNumber = (aVal: number | null, bVal: number | null): number | null => {
    if (aVal === null && bVal === null) return null;
    if (aVal === null) return bVal;
    if (bVal === null) return aVal;
    // For positions, use weighted average based on confidence
    const confA = a.confidence ?? 0.5;
    const confB = b.confidence ?? 0.5;
    return Math.round((aVal * confA + bVal * confB) / (confA + confB) * 100) / 100;
  };

  // Helper: merge arrays (union with dedup)
  const mergeArrays = (aArr: string[], bArr: string[]): string[] => {
    const set = new Set([...aArr, ...bArr]);
    return Array.from(set);
  };

  // Merge provenance
  const mergeProvenance = (
    aProv: CompetitorProvenance[],
    bProv: CompetitorProvenance[]
  ): CompetitorProvenance[] => {
    const combined = [...aProv, ...bProv];
    // Add merge provenance entry
    combined.push({
      field: '*',
      source,
      updatedAt: now,
      confidence: Math.max(a.confidence ?? 0.5, b.confidence ?? 0.5),
    });
    return combined;
  };

  // Pick the better name (prefer the one with more detail or higher confidence)
  const name = (a.confidence ?? 0.5) >= (b.confidence ?? 0.5) ? a.name : b.name;

  return {
    name,
    domain: pickString(a.domain, b.domain),
    website: pickString(a.website, b.website),
    category: a.category || b.category,
    positioning: pickString(a.positioning, b.positioning),
    estimatedBudget: pickNumber(a.estimatedBudget, b.estimatedBudget),
    primaryChannels: mergeArrays(a.primaryChannels || [], b.primaryChannels || []),
    strengths: mergeArrays(a.strengths || [], b.strengths || []),
    weaknesses: mergeArrays(a.weaknesses || [], b.weaknesses || []),
    uniqueClaims: mergeArrays(a.uniqueClaims || [], b.uniqueClaims || []),
    offers: mergeArrays(a.offers || [], b.offers || []),
    pricingSummary: pickString(a.pricingSummary, b.pricingSummary),
    pricingNotes: pickString(a.pricingNotes, b.pricingNotes),
    notes: pickString(a.notes, b.notes),
    xPosition: pickNumber(a.xPosition, b.xPosition),
    yPosition: pickNumber(a.yPosition, b.yPosition),
    positionPrimary: pickNumber(a.positionPrimary, b.positionPrimary),
    positionSecondary: pickNumber(a.positionSecondary, b.positionSecondary),
    confidence: Math.max(a.confidence ?? 0.5, b.confidence ?? 0.5),
    lastValidatedAt: now,
    trajectory: a.trajectory || b.trajectory,
    trajectoryReason: pickString(a.trajectoryReason, b.trajectoryReason),
    provenance: mergeProvenance(a.provenance || [], b.provenance || []),
    threatLevel: pickNumber(a.threatLevel, b.threatLevel),
    threatDrivers: mergeArrays(a.threatDrivers || [], b.threatDrivers || []),
    // If either is human-verified (not autoSeeded), the result is human-verified
    autoSeeded: (a.autoSeeded ?? true) && (b.autoSeeded ?? true),
    // V3.5 fields - pick better values where available
    businessModelCategory: a.businessModelCategory || b.businessModelCategory || null,
    jtbdMatches: pickNumber(a.jtbdMatches, b.jtbdMatches),
    offerOverlapScore: pickNumber(a.offerOverlapScore, b.offerOverlapScore),
    signalsVerified: pickNumber(a.signalsVerified, b.signalsVerified),
    // Vertical classification
    verticalCategory: a.verticalCategory || b.verticalCategory || null,
    subVertical: pickString(a.subVertical, b.subVertical),
  };
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Deduplicate a list of competitors using fuzzy matching
 * Returns merged list and merge operations log
 */
export function dedupeCompetitors(
  competitors: CompetitorProfile[],
  options: {
    threshold?: number;
    source?: string;
  } = {}
): DedupeResult {
  const { threshold = SIMILARITY_THRESHOLD, source = 'dedupe' } = options;
  const mergeOperations: MergeOperation[] = [];
  const now = new Date().toISOString();

  if (!competitors || competitors.length === 0) {
    return {
      competitors: [],
      mergeOperations: [],
      duplicatesFound: 0,
      finalCount: 0,
    };
  }

  // Track which competitors have been merged
  const merged = new Set<number>();
  const result: CompetitorProfile[] = [];

  for (let i = 0; i < competitors.length; i++) {
    if (merged.has(i)) continue;

    let current = competitors[i];
    const duplicateIndices: number[] = [];

    // Find all duplicates of this competitor
    for (let j = i + 1; j < competitors.length; j++) {
      if (merged.has(j)) continue;

      if (areCompetitorsSimilar(current, competitors[j], threshold)) {
        duplicateIndices.push(j);
        merged.add(j);

        mergeOperations.push({
          type: 'merge',
          competitorA: current.name,
          competitorB: competitors[j].name,
          reason: `Name similarity: ${stringSimilarity(current.name, competitors[j].name).toFixed(2)}`,
          timestamp: now,
        });
      }
    }

    // Merge all duplicates into current
    for (const idx of duplicateIndices) {
      current = mergeCompetitorRecord(current, competitors[idx], source);
    }

    result.push(current);
  }

  // Log non-merged competitors
  for (let i = 0; i < competitors.length; i++) {
    if (!merged.has(i) && !result.some(r => r.name === competitors[i].name)) {
      mergeOperations.push({
        type: 'add',
        competitorA: competitors[i].name,
        reason: 'New competitor added',
        timestamp: now,
      });
    }
  }

  return {
    competitors: result,
    mergeOperations,
    duplicatesFound: competitors.length - result.length,
    finalCount: result.length,
  };
}

/**
 * Merge new competitors into existing list
 * Deduplicates and merges matching records
 */
export function mergeCompetitorLists(
  existing: CompetitorProfile[],
  incoming: CompetitorProfile[],
  options: {
    threshold?: number;
    source?: string;
  } = {}
): MergeStats {
  const { threshold = SIMILARITY_THRESHOLD, source = 'merge' } = options;
  const now = new Date().toISOString();
  const mergeOperations: MergeOperation[] = [];
  let competitorsAdded = 0;
  let competitorsMerged = 0;
  let fieldsUpdated = 0;

  const result = [...existing];

  for (const newComp of incoming) {
    // Find matching existing competitor
    const matchIndex = result.findIndex(
      existing => areCompetitorsSimilar(existing, newComp, threshold)
    );

    if (matchIndex >= 0) {
      // Merge with existing
      const merged = mergeCompetitorRecord(result[matchIndex], newComp, source);
      result[matchIndex] = merged;
      competitorsMerged++;

      // Count updated fields
      const original = existing[matchIndex];
      for (const key of Object.keys(merged) as (keyof CompetitorProfile)[]) {
        if (merged[key] !== original[key]) {
          fieldsUpdated++;
        }
      }

      mergeOperations.push({
        type: 'merge',
        competitorA: result[matchIndex].name,
        competitorB: newComp.name,
        reason: `Merged with similarity: ${stringSimilarity(result[matchIndex].name, newComp.name).toFixed(2)}`,
        timestamp: now,
      });
    } else {
      // Add as new
      result.push(newComp);
      competitorsAdded++;

      mergeOperations.push({
        type: 'add',
        competitorA: newComp.name,
        reason: 'New competitor added',
        timestamp: now,
      });
    }
  }

  // Update the existing array in place
  existing.length = 0;
  existing.push(...result);

  return {
    competitorsAdded,
    competitorsMerged,
    fieldsUpdated,
    mergeOperations,
  };
}

// ============================================================================
// Self-Competitor Detection
// ============================================================================

/**
 * Normalize a domain for comparison
 */
function normalizeDomainForComparison(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let normalized = domain.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.split('/')[0];
  return normalized || null;
}

/**
 * Check if a competitor is likely the same company (self-competitor)
 * Handles cases like "Crunchbase Pro" being listed as competitor for "Crunchbase"
 */
export function isSelfCompetitor(
  competitorName: string,
  competitorDomain: string | null | undefined,
  companyName: string | null,
  companyDomain: string | null
): { isSelf: boolean; reason?: string } {
  const normCompetitorDomain = normalizeDomainForComparison(competitorDomain);
  const normCompanyDomain = normalizeDomainForComparison(companyDomain);

  // 1. Domain match (exact or subdomain)
  if (normCompetitorDomain && normCompanyDomain) {
    // Exact match
    if (normCompetitorDomain === normCompanyDomain) {
      return { isSelf: true, reason: 'exact domain match' };
    }
    // Subdomain of company (e.g., pro.crunchbase.com for crunchbase.com)
    if (normCompetitorDomain.endsWith(`.${normCompanyDomain}`)) {
      return { isSelf: true, reason: 'subdomain of company' };
    }
    // Company is subdomain of competitor
    if (normCompanyDomain.endsWith(`.${normCompetitorDomain}`)) {
      return { isSelf: true, reason: 'company is subdomain' };
    }
  }

  // 2. Name contains company name strongly
  if (companyName) {
    const normalizedCompetitorName = competitorName.toLowerCase().trim();
    const normalizedCompanyName = companyName.toLowerCase().trim();

    // Skip very short company names (avoid false positives)
    if (normalizedCompanyName.length >= 3) {
      // Competitor name starts with company name (e.g., "Crunchbase Pro" for "Crunchbase")
      if (normalizedCompetitorName.startsWith(normalizedCompanyName + ' ') ||
          normalizedCompetitorName.startsWith(normalizedCompanyName + '-')) {
        return { isSelf: true, reason: `name starts with company name: "${companyName}"` };
      }

      // Exact name match
      if (normalizedCompetitorName === normalizedCompanyName) {
        return { isSelf: true, reason: 'exact name match' };
      }
    }
  }

  return { isSelf: false };
}

/**
 * Filter out self-competitors from a competitor list
 */
export function filterOutSelfCompetitors(
  competitors: CompetitorProfile[],
  companyName: string | null,
  companyDomain: string | null
): {
  competitors: CompetitorProfile[];
  rejectedSelf: { competitor: CompetitorProfile; reason: string }[];
} {
  const filtered: CompetitorProfile[] = [];
  const rejectedSelf: { competitor: CompetitorProfile; reason: string }[] = [];

  for (const comp of competitors) {
    const result = isSelfCompetitor(comp.name, comp.domain || comp.website, companyName, companyDomain);
    if (result.isSelf) {
      rejectedSelf.push({
        competitor: comp,
        reason: result.reason || 'Matched self patterns',
      });
    } else {
      filtered.push(comp);
    }
  }

  return { competitors: filtered, rejectedSelf };
}

// ============================================================================
// Agency / Service Provider Filtering
// ============================================================================

/**
 * Nav patterns that indicate an agency or service provider (not a true competitor)
 * These are typically found in the primary navigation or positioning of agencies
 */
const AGENCY_NAV_PATTERNS = [
  // Primary nav patterns
  /\bservices?\b/i,
  /\bportfolio\b/i,
  /\bclient[s]?\b/i,
  /\bcase stud(y|ies)\b/i,
  /\bour work\b/i,
  /\bwork with us\b/i,
  /\bhire us\b/i,
  /\bcontact us\b/i,
  // Agency-specific terms
  /\bagency\b/i,
  /\bconsulting\b/i,
  /\bconsultants?\b/i,
  /\bfreelance\b/i,
  /\bwe help (companies|businesses|brands)\b/i,
  /\byour (partner|agency)\b/i,
  /\bbespoke\b/i,
  /\btailored solutions\b/i,
  /\bcustom (solutions|services)\b/i,
];

/**
 * Name patterns that strongly indicate an agency
 */
const AGENCY_NAME_PATTERNS = [
  /agency$/i,
  /\bagency\b/i,
  /\bconsulting$/i,
  /\bconsultants?$/i,
  /\bmedia group$/i,
  /\bdigital group$/i,
  /\bcreative group$/i,
  /\bcreative studio$/i,
  /\bdesign studio$/i,
  /\bstudio$/i,
  /\bsolutions$/i,
  /\bservices$/i,
];

/**
 * Industry/category patterns that indicate a B2B service provider
 */
const SERVICE_PROVIDER_CATEGORIES = [
  /marketing agency/i,
  /digital agency/i,
  /creative agency/i,
  /web design/i,
  /seo agency/i,
  /ppc agency/i,
  /pr agency/i,
  /advertising agency/i,
  /branding agency/i,
  /consulting firm/i,
  /professional services/i,
];

export interface AgencyFilterResult {
  isAgency: boolean;
  reason: string | null;
  signals: string[];
}

/**
 * Check if a competitor profile looks like an agency or service provider
 * rather than a true product/SaaS competitor
 *
 * Uses "category fingerprint" pattern matching on:
 * - Competitor name
 * - Positioning text
 * - Unique claims
 * - Offers
 *
 * Agencies typically have:
 * - "Services" / "Portfolio" / "Clients" in their nav/positioning
 * - Names ending in "Agency", "Consulting", "Studio", "Solutions"
 * - Positioning about helping other businesses
 */
export function isLikelyAgencyOrServiceProvider(comp: Partial<CompetitorProfile>): AgencyFilterResult {
  const signals: string[] = [];

  const textToCheck = [
    comp.name || '',
    comp.positioning || '',
    ...(comp.uniqueClaims || []),
    ...(comp.offers || []),
    comp.notes || '',
  ].join(' ');

  // Check name patterns
  for (const pattern of AGENCY_NAME_PATTERNS) {
    if (pattern.test(comp.name || '')) {
      signals.push(`name matches agency pattern: ${pattern.source}`);
    }
  }

  // Check nav/positioning patterns
  for (const pattern of AGENCY_NAV_PATTERNS) {
    if (pattern.test(textToCheck)) {
      signals.push(`text matches agency fingerprint: ${pattern.source}`);
    }
  }

  // Check service provider categories
  const category = comp.positioning || '';
  for (const pattern of SERVICE_PROVIDER_CATEGORIES) {
    if (pattern.test(category)) {
      signals.push(`category indicates service provider: ${pattern.source}`);
    }
  }

  // Decision: If we have 2+ signals, classify as agency
  // 1 signal could be a false positive (e.g., a SaaS company mentioning "services" page)
  const isAgency = signals.length >= 2;

  return {
    isAgency,
    reason: isAgency ? `Likely agency/service provider based on ${signals.length} signals` : null,
    signals,
  };
}

/**
 * Filter out agencies and service providers from a competitor list
 * Returns both the filtered list and the rejected agencies
 */
export function filterOutAgencies(
  competitors: CompetitorProfile[]
): {
  competitors: CompetitorProfile[];
  rejectedAgencies: { competitor: CompetitorProfile; reason: string }[];
} {
  const filtered: CompetitorProfile[] = [];
  const rejectedAgencies: { competitor: CompetitorProfile; reason: string }[] = [];

  for (const comp of competitors) {
    const result = isLikelyAgencyOrServiceProvider(comp);
    if (result.isAgency) {
      rejectedAgencies.push({
        competitor: comp,
        reason: result.reason || 'Matched agency patterns',
      });
    } else {
      filtered.push(comp);
    }
  }

  return { competitors: filtered, rejectedAgencies };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a competitor profile has minimum required fields
 */
export function isValidCompetitorProfile(comp: Partial<CompetitorProfile>): boolean {
  // Name is required
  if (!comp.name || typeof comp.name !== 'string' || comp.name.trim().length === 0) {
    return false;
  }

  // If xPosition/yPosition are provided, they must be in range
  if (comp.xPosition !== null && comp.xPosition !== undefined) {
    if (typeof comp.xPosition !== 'number' || comp.xPosition < -100 || comp.xPosition > 100) {
      return false;
    }
  }

  if (comp.yPosition !== null && comp.yPosition !== undefined) {
    if (typeof comp.yPosition !== 'number' || comp.yPosition < -100 || comp.yPosition > 100) {
      return false;
    }
  }

  // Confidence must be 0-1
  if (comp.confidence !== null && comp.confidence !== undefined) {
    if (typeof comp.confidence !== 'number' || comp.confidence < 0 || comp.confidence > 1) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize a competitor profile, ensuring all fields are valid
 */
export function sanitizeCompetitorProfile(comp: Partial<CompetitorProfile>): CompetitorProfile {
  return {
    name: (comp.name || 'Unknown').trim(),
    domain: comp.domain || null,
    website: comp.website || null,
    category: comp.category || null,
    positioning: comp.positioning || null,
    estimatedBudget: typeof comp.estimatedBudget === 'number' ? comp.estimatedBudget : null,
    primaryChannels: Array.isArray(comp.primaryChannels) ? comp.primaryChannels : [],
    strengths: Array.isArray(comp.strengths) ? comp.strengths : [],
    weaknesses: Array.isArray(comp.weaknesses) ? comp.weaknesses : [],
    uniqueClaims: Array.isArray(comp.uniqueClaims) ? comp.uniqueClaims : [],
    offers: Array.isArray(comp.offers) ? comp.offers : [],
    pricingSummary: comp.pricingSummary || null,
    pricingNotes: comp.pricingNotes || null,
    notes: comp.notes || null,
    xPosition: clampPosition(comp.xPosition),
    yPosition: clampPosition(comp.yPosition),
    positionPrimary: clampLegacyPosition(comp.positionPrimary),
    positionSecondary: clampLegacyPosition(comp.positionSecondary),
    confidence: clampConfidence(comp.confidence),
    lastValidatedAt: comp.lastValidatedAt || null,
    trajectory: comp.trajectory || null,
    trajectoryReason: comp.trajectoryReason || null,
    provenance: Array.isArray(comp.provenance) ? comp.provenance : [],
    threatLevel: clampThreatLevel(comp.threatLevel),
    threatDrivers: Array.isArray(comp.threatDrivers) ? comp.threatDrivers : [],
    autoSeeded: comp.autoSeeded ?? false,
    // V3.5 fields
    businessModelCategory: comp.businessModelCategory || null,
    jtbdMatches: typeof comp.jtbdMatches === 'number' ? comp.jtbdMatches : null,
    offerOverlapScore: typeof comp.offerOverlapScore === 'number' ? comp.offerOverlapScore : null,
    signalsVerified: typeof comp.signalsVerified === 'number' ? comp.signalsVerified : null,
    // Vertical classification
    verticalCategory: comp.verticalCategory || null,
    subVertical: comp.subVertical || null,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function clampPosition(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return Math.max(-100, Math.min(100, val));
}

function clampLegacyPosition(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return Math.max(0, Math.min(100, val));
}

function clampConfidence(val: number | null | undefined): number {
  if (val === null || val === undefined) return 0.5;
  return Math.max(0, Math.min(1, val));
}

function clampThreatLevel(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return Math.max(0, Math.min(100, val));
}
