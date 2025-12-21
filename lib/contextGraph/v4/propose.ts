// lib/contextGraph/v4/propose.ts
// V4 Proposal Helper for Lab Ingestion
//
// This module provides helpers for proposing fields from lab results
// into the V4 Review Queue instead of writing directly to Context Graph.

import { createHash } from 'crypto';
import {
  proposeFieldV4,
  getOrCreateFieldStoreV4,
  saveContextFieldsV4,
  canPropose,
  truncateValueForPreview,
} from '@/lib/contextGraph/fieldStoreV4';
import type {
  ContextFieldV4,
  ContextFieldSourceV4,
  ContextFieldEvidenceV4,
  ContextFieldAlternativeV4,
} from '@/lib/types/contextField';
import { getSourcePriority } from '@/lib/types/contextField';

// ============================================================================
// Constants
// ============================================================================

/** Maximum alternatives per field to prevent unbounded growth */
export const MAX_ALTERNATIVES = 5;

// ============================================================================
// Types
// ============================================================================

export interface LabCandidate {
  /** Canonical key: domain.field (e.g., "website.websiteScore") */
  key: string;
  /** The field value */
  value: unknown;
  /** Confidence score 0-1 (defaults to 0.8 for lab) */
  confidence?: number;
  /** Evidence supporting this value */
  evidence?: {
    url?: string;
    snippet?: string;
    rawPath?: string;
    /** True if value was inferred (not directly mapped) */
    isInferred?: boolean;
  };
  /** ISO timestamp when the source run was created (for lineage) */
  runCreatedAt?: string;
  /** Schema variant used (e.g., "labResultV4", "vNextRoot") */
  schemaVariant?: string;
}

export interface ProposeFromLabResultParams {
  companyId: string;
  /** Importer identifier (e.g., "websiteLab", "brandLab") */
  importerId: string;
  /** Source category */
  source: ContextFieldSourceV4;
  /** Source run ID (diagnostic run ID) */
  sourceId: string;
  /** Extraction path for debugging (e.g., "rawEvidence.labResultV4") */
  extractionPath: string;
  /** Candidates to propose */
  candidates: LabCandidate[];
}

export interface ProposeFromLabResultSummary {
  /** Number of fields successfully proposed (as primary) */
  proposed: number;
  /** Number of fields blocked by merge rules */
  blocked: number;
  /** Number of fields that replaced existing proposals */
  replaced: number;
  /** Number of fields skipped because exact duplicate already exists */
  deduped: number;
  /** Number of fields blocked because a confirmed field exists (conflict) */
  conflicted: number;
  /** Number of fields added as alternatives (not primary) */
  alternativesAdded: number;
  /** Error messages for failed proposals */
  errors: string[];
  /** Keys that were proposed (as primary) */
  proposedKeys: string[];
  /** Keys that were blocked */
  blockedKeys: string[];
  /** Keys that were deduped (exact match already exists) */
  dedupedKeys: string[];
  /** Keys that conflicted with confirmed fields (subset of blockedKeys) */
  conflictedKeys: string[];
  /** Keys where an alternative was added */
  alternativeKeys: string[];
}

// ============================================================================
// DedupeKey Generation
// ============================================================================

/**
 * Normalize a value to a stable string for hashing.
 * Handles objects, arrays, and primitives consistently.
 */
function normalizeValueForHash(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    // Sort array elements for stable ordering
    return JSON.stringify(
      value.map(v => normalizeValueForHash(v)).sort()
    );
  }
  if (typeof value === 'object') {
    // Sort object keys for stable ordering
    const sortedObj: Record<string, unknown> = {};
    Object.keys(value as object).sort().forEach(k => {
      sortedObj[k] = normalizeValueForHash((value as Record<string, unknown>)[k]);
    });
    return JSON.stringify(sortedObj);
  }
  return String(value);
}

/**
 * Generate a stable dedupeKey for a proposal.
 *
 * The key is a SHA1 hash of: companyId + fieldKey + source + sourceId + normalizedValueHash
 *
 * This ensures:
 * - Same lab run proposing same field with same value = same dedupeKey (idempotent)
 * - Different value for same field = different dedupeKey (new proposal)
 * - Different source run = different dedupeKey (new evidence)
 */
export function generateDedupeKey(params: {
  companyId: string;
  fieldKey: string;
  source: ContextFieldSourceV4;
  sourceId: string;
  value: unknown;
}): string {
  const { companyId, fieldKey, source, sourceId, value } = params;
  const valueHash = normalizeValueForHash(value);

  const input = [companyId, fieldKey, source, sourceId, valueHash].join('|');
  return createHash('sha1').update(input).digest('hex');
}

// ============================================================================
// Default Confidence by Source
// ============================================================================

const DEFAULT_CONFIDENCE: Record<ContextFieldSourceV4, number> = {
  user: 1.0,
  crm: 0.9,
  lab: 0.8,
  gap: 0.7,
  ai: 0.6,
  import: 0.5,
};

// ============================================================================
// Alternatives Ranking and Eviction
// ============================================================================

/**
 * Rank alternatives by:
 * 1. Source priority (higher is better)
 * 2. Confidence (higher is better)
 * 3. Recency (newer is better)
 *
 * @returns Negative if a should come before b (a is higher ranked)
 */
function compareAlternatives(a: ContextFieldAlternativeV4, b: ContextFieldAlternativeV4): number {
  // 1. Source priority (descending - higher priority first)
  const priorityDiff = getSourcePriority(b.source) - getSourcePriority(a.source);
  if (priorityDiff !== 0) return priorityDiff;

  // 2. Confidence (descending - higher confidence first)
  const confidenceDiff = b.confidence - a.confidence;
  if (Math.abs(confidenceDiff) > 0.001) return confidenceDiff;

  // 3. Recency (descending - newer first)
  const aTime = new Date(a.proposedAt).getTime();
  const bTime = new Date(b.proposedAt).getTime();
  return bTime - aTime;
}

/**
 * Rank and cap alternatives array.
 * Evicts lowest-ranked alternatives when exceeding MAX_ALTERNATIVES.
 *
 * @param alternatives - The alternatives array to rank and cap
 * @returns The ranked and capped alternatives array
 */
function rankAndCapAlternatives(
  alternatives: ContextFieldAlternativeV4[]
): ContextFieldAlternativeV4[] {
  if (alternatives.length === 0) return alternatives;

  // Sort by ranking
  const sorted = [...alternatives].sort(compareAlternatives);

  // Cap to MAX_ALTERNATIVES
  if (sorted.length > MAX_ALTERNATIVES) {
    const evicted = sorted.slice(MAX_ALTERNATIVES);
    console.log(
      `[proposeFromLabResult] Evicted ${evicted.length} low-ranked alternatives`
    );
    return sorted.slice(0, MAX_ALTERNATIVES);
  }

  return sorted;
}

// ============================================================================
// Main Proposal Function
// ============================================================================

/**
 * Propose multiple fields from a lab result into the V4 Review Queue.
 *
 * This function:
 * - Loads the existing V4 field store for the company
 * - Applies merge rules for each candidate
 * - Creates proposed fields with evidence attached
 * - Saves the store once after all proposals
 *
 * @returns Summary with counts and any errors
 */
export async function proposeFromLabResult(
  params: ProposeFromLabResultParams
): Promise<ProposeFromLabResultSummary> {
  const { companyId, importerId, source, sourceId, extractionPath, candidates } = params;

  console.log(`[proposeFromLabResult] Starting: companyId=${companyId}, importerId=${importerId}, candidates=${candidates.length}`);

  const summary: ProposeFromLabResultSummary = {
    proposed: 0,
    blocked: 0,
    replaced: 0,
    deduped: 0,
    conflicted: 0,
    alternativesAdded: 0,
    errors: [],
    proposedKeys: [],
    blockedKeys: [],
    dedupedKeys: [],
    conflictedKeys: [],
    alternativeKeys: [],
  };

  if (candidates.length === 0) {
    console.log('[proposeFromLabResult] No candidates to propose');
    return summary;
  }

  try {
    // Load existing store
    const store = await getOrCreateFieldStoreV4(companyId);
    const now = new Date().toISOString();
    const defaultConfidence = DEFAULT_CONFIDENCE[source] ?? 0.8;

    for (const candidate of candidates) {
      try {
        // Validate key format
        if (!candidate.key || !candidate.key.includes('.')) {
          summary.errors.push(`Invalid key format: ${candidate.key}`);
          continue;
        }

        // Skip empty values
        if (candidate.value === null || candidate.value === undefined) {
          continue;
        }
        if (typeof candidate.value === 'string' && candidate.value.trim() === '') {
          continue;
        }
        if (Array.isArray(candidate.value) && candidate.value.length === 0) {
          continue;
        }

        const domain = candidate.key.split('.')[0];
        const confidence = candidate.confidence ?? defaultConfidence;

        // Generate stable dedupeKey for idempotency
        const dedupeKey = generateDedupeKey({
          companyId,
          fieldKey: candidate.key,
          source,
          sourceId,
          value: candidate.value,
        });

        // Check for exact duplicate by dedupeKey
        const existing = store.fields[candidate.key];
        if (existing?.dedupeKey === dedupeKey) {
          // Exact same proposal already exists - skip silently (idempotent)
          summary.deduped++;
          summary.dedupedKeys.push(candidate.key);
          continue;
        }

        // Build evidence
        const evidence: ContextFieldEvidenceV4 = {
          runId: sourceId,
          importerId,
          rawPath: candidate.evidence?.rawPath || extractionPath,
          url: candidate.evidence?.url,
          snippet: candidate.evidence?.snippet?.slice(0, 500),
          originalSource: importerId,
        };

        // Build incoming field (without status for merge check)
        const incoming = {
          key: candidate.key,
          domain,
          value: candidate.value,
          source,
          sourceId,
          confidence,
          updatedAt: now,
          evidence,
        };

        // Check merge rules
        const check = canPropose(existing, incoming);

        if (!check.canPropose) {
          summary.blocked++;
          summary.blockedKeys.push(candidate.key);

          // Track conflicts with confirmed fields separately
          if (check.reason === 'existing_confirmed' || check.reason === 'human_confirmed') {
            summary.conflicted++;
            summary.conflictedKeys.push(candidate.key);
            console.log(`[proposeFromLabResult] Conflict: ${candidate.key} blocked by confirmed field`);
          } else {
            console.log(`[proposeFromLabResult] Blocked: ${candidate.key} - ${check.reason}`);
          }
          continue;
        }

        // Handle alternatives: add to existing field's alternatives array
        if (check.addAsAlternative && existing?.status === 'proposed') {
          // Create alternative entry
          const alternative: ContextFieldAlternativeV4 = {
            value: candidate.value,
            source,
            sourceId,
            confidence,
            proposedAt: now,
            evidence,
            dedupeKey,
            runCreatedAt: candidate.runCreatedAt,
            importerId,
          };

          // Check if this alternative already exists (by dedupeKey)
          const existingAlts = existing.alternatives || [];
          const altExists = existingAlts.some(a => a.dedupeKey === dedupeKey);
          if (altExists) {
            summary.deduped++;
            summary.dedupedKeys.push(candidate.key);
            continue;
          }

          // Add alternative, rank, and cap to MAX_ALTERNATIVES
          existingAlts.push(alternative);
          existing.alternatives = rankAndCapAlternatives(existingAlts);

          summary.alternativesAdded++;
          summary.alternativeKeys.push(candidate.key);
          console.log(`[proposeFromLabResult] Alternative added: ${candidate.key} from ${source} (${existing.alternatives.length}/${MAX_ALTERNATIVES})`);
          continue;
        }

        // Track if replacing and move existing to alternatives
        let inheritedAlternatives: ContextFieldAlternativeV4[] | undefined;
        if (existing?.status === 'proposed' && (check.reason === 'higher_confidence' || check.reason === 'higher_priority_source')) {
          summary.replaced++;
          // Move existing to alternatives
          if (existing.value !== undefined) {
            const movedAlt: ContextFieldAlternativeV4 = {
              value: existing.value,
              source: existing.source,
              sourceId: existing.sourceId,
              confidence: existing.confidence,
              proposedAt: existing.updatedAt,
              evidence: existing.evidence,
              dedupeKey: existing.dedupeKey || '',
              runCreatedAt: existing.runCreatedAt,
              importerId: existing.importerId,
            };
            const allAlts = existing.alternatives || [];
            allAlts.push(movedAlt);
            // Rank and cap to MAX_ALTERNATIVES
            inheritedAlternatives = rankAndCapAlternatives(allAlts);
          }
        }

        // Create the proposed field with dedupeKey and lineage
        const field: ContextFieldV4 = {
          ...incoming,
          status: 'proposed',
          dedupeKey,
          previousValue: existing?.value,
          previousSource: existing?.source,
          // Lineage fields
          runCreatedAt: candidate.runCreatedAt,
          schemaVariant: candidate.schemaVariant,
          importerId,
          // Conflict metadata (if applicable)
          conflictsWithConfirmed: check.conflictsWithConfirmed,
          confirmedValuePreview: check.confirmedValuePreview,
          confirmedValue: check.conflictsWithConfirmed ? existing?.value : undefined,
          // Inherited alternatives (if replacing)
          alternatives: inheritedAlternatives,
        };

        store.fields[candidate.key] = field;
        summary.proposed++;
        summary.proposedKeys.push(candidate.key);

      } catch (fieldError) {
        const errorMsg = fieldError instanceof Error ? fieldError.message : String(fieldError);
        summary.errors.push(`Field ${candidate.key}: ${errorMsg}`);
      }
    }

    // Save store if any changes
    if (summary.proposed > 0 || summary.replaced > 0 || summary.alternativesAdded > 0) {
      await saveContextFieldsV4(companyId, store);
    }

    console.log('[proposeFromLabResult] Complete:', {
      proposed: summary.proposed,
      blocked: summary.blocked,
      replaced: summary.replaced,
      deduped: summary.deduped,
      conflicted: summary.conflicted,
      alternativesAdded: summary.alternativesAdded,
      errors: summary.errors.length,
    });

    return summary;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[proposeFromLabResult] Failed:', errorMsg);
    summary.errors.push(`Store error: ${errorMsg}`);
    return summary;
  }
}

/**
 * Propose a single field from a lab result.
 * Convenience wrapper around proposeFromLabResult for single-field proposals.
 */
export async function proposeSingleField(
  companyId: string,
  importerId: string,
  sourceId: string,
  candidate: LabCandidate
): Promise<{ proposed: boolean; reason: string }> {
  const result = await proposeFromLabResult({
    companyId,
    importerId,
    source: 'lab',
    sourceId,
    extractionPath: importerId,
    candidates: [candidate],
  });

  if (result.proposed > 0) {
    return { proposed: true, reason: 'success' };
  }

  if (result.blocked > 0) {
    return { proposed: false, reason: 'blocked' };
  }

  return { proposed: false, reason: result.errors[0] || 'unknown' };
}
