// lib/contextGraph/nodes/strategyProposals.ts
// Hard-Gate: Strategy → Context Write Path
//
// DOCTRINE: Strategy can NEVER write context directly.
// All context from Strategy must go through proposals → human confirmation.
//
// This is the ONLY authorized path for Strategy to create context data.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getRegistryEntry } from '@/lib/contextGraph/unifiedRegistry';
import { getFieldStatus, getFieldFromPath } from './protection';
import { createProposalBatch, saveProposalBatch } from './proposalStorage';
import type { ContextProposal, ContextProposalBatch } from './types';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * A single context proposal from Strategy
 */
export interface StrategyContextProposal {
  /** Field key - MUST exist in unified registry */
  key: string;
  /** Proposed value */
  value: unknown;
  /** Confidence 0-1 */
  confidence: number;
  /** Short rationale for the proposal */
  rationale: string;
  /** Source: 'ai' for AI-generated, 'user' for manually entered in Strategy UI */
  source: 'ai' | 'user';
}

/**
 * Provenance tracking for Strategy proposals
 */
export interface StrategyProposalProvenance {
  /** ID of the Strategy artifact that triggered these proposals */
  strategyArtifactId?: string;
  /** Strategy run/generation ID */
  strategyRunId?: string;
  /** Who created: 'ai' for AI generation, 'user' for manual entry */
  createdBy: 'ai' | 'user';
  /** Optional description of context */
  description?: string;
}

/**
 * Result of creating proposals
 */
export interface ProposeFromStrategyResult {
  success: boolean;
  /** Batch ID for the proposals */
  proposalBatchId: string;
  /** Proposals that were created */
  createdProposals: Array<{
    key: string;
    value: unknown;
    status: 'created' | 'skipped_identical' | 'skipped_confirmed' | 'rejected_invalid_key';
    reason?: string;
  }>;
  /** Count of proposals requiring review */
  pendingCount: number;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a key exists in the unified registry
 */
export function isValidRegistryKey(key: string): boolean {
  const entry = getRegistryEntry(key);
  return entry !== undefined;
}

/**
 * Get all valid registry keys for Strategy inputs
 * (fields that have strategySection !== null)
 */
export function getStrategyInputKeys(): string[] {
  // Import inline to avoid circular dependency
  const { UNIFIED_FIELD_REGISTRY } = require('@/lib/contextGraph/unifiedRegistry');
  return UNIFIED_FIELD_REGISTRY
    .filter((entry: { strategySection: string | null }) => entry.strategySection !== null)
    .map((entry: { key: string }) => entry.key);
}

// ============================================================================
// Core Function: proposeContextFromStrategy
// ============================================================================

/**
 * Create context proposals from Strategy.
 *
 * This is the ONLY authorized path for Strategy to create context data.
 * All proposals are created with status='proposed' and require human confirmation.
 *
 * Rules:
 * 1. Key must exist in unified registry
 * 2. Identical confirmed values are skipped (no duplicate proposals)
 * 3. Confirmed values can have alternative proposals alongside
 * 4. Source is always 'ai' or 'user' - never auto-confirmed
 */
export async function proposeContextFromStrategy(
  companyId: string,
  proposals: StrategyContextProposal[],
  provenance: StrategyProposalProvenance
): Promise<ProposeFromStrategyResult> {
  // Load current context graph for deduplication
  const graph = await loadContextGraph(companyId);

  const results: ProposeFromStrategyResult['createdProposals'] = [];
  const validProposals: Array<{
    fieldPath: string;
    fieldLabel: string;
    proposedValue: unknown;
    currentValue: unknown | null;
    reasoning: string;
    confidence: number;
  }> = [];

  for (const proposal of proposals) {
    // 1. Validate key exists in registry
    const entry = getRegistryEntry(proposal.key);
    if (!entry) {
      results.push({
        key: proposal.key,
        value: proposal.value,
        status: 'rejected_invalid_key',
        reason: `Key "${proposal.key}" not found in context registry`,
      });
      continue;
    }

    // 2. Check current value in graph
    const field = graph ? getFieldFromPath(graph, proposal.key) : null;
    const currentValue = field?.value ?? null;
    const fieldStatus = field ? getFieldStatus(field) : 'proposed';

    // 3. Skip if identical confirmed value exists
    if (fieldStatus === 'confirmed' && currentValue !== null) {
      const isIdentical = JSON.stringify(currentValue) === JSON.stringify(proposal.value);
      if (isIdentical) {
        results.push({
          key: proposal.key,
          value: proposal.value,
          status: 'skipped_identical',
          reason: 'Identical confirmed value already exists',
        });
        continue;
      }
      // Different value for confirmed field - create as "alternative interpretation"
      // User will see both values and can choose
    }

    // 4. Create the proposal
    validProposals.push({
      fieldPath: proposal.key,
      fieldLabel: entry.label,
      proposedValue: proposal.value,
      currentValue,
      reasoning: buildRationale(proposal, fieldStatus, provenance),
      confidence: Math.min(0.95, Math.max(0.3, proposal.confidence)),
    });

    results.push({
      key: proposal.key,
      value: proposal.value,
      status: 'created',
    });
  }

  // If no valid proposals, return early
  if (validProposals.length === 0) {
    return {
      success: true,
      proposalBatchId: '',
      createdProposals: results,
      pendingCount: 0,
    };
  }

  // Create and save proposal batch
  const batch = createProposalBatch(
    companyId,
    validProposals,
    'strategy_gap', // Trigger type
    buildBatchReasoning(provenance),
    provenance.strategyArtifactId || provenance.strategyRunId || 'strategy'
  );

  // Save to storage
  let savedBatchId = batch.id;
  try {
    const saved = await saveProposalBatch(batch);
    if (saved) {
      savedBatchId = saved.batchId;
    }
  } catch (error) {
    console.error('[proposeContextFromStrategy] Failed to save batch:', error);
    // Continue - proposals still valid even if not persisted
  }

  return {
    success: true,
    proposalBatchId: savedBatchId,
    createdProposals: results,
    pendingCount: validProposals.length,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build rationale string for a proposal
 */
function buildRationale(
  proposal: StrategyContextProposal,
  fieldStatus: 'confirmed' | 'proposed' | 'empty' | 'missing',
  provenance: StrategyProposalProvenance
): string {
  const parts: string[] = [];

  // Add user's rationale
  if (proposal.rationale) {
    parts.push(proposal.rationale);
  }

  // Add context about source
  if (provenance.createdBy === 'ai') {
    parts.push('(AI-generated from Strategy analysis)');
  } else {
    parts.push('(Manually entered in Strategy)');
  }

  // Note if this is an alternative to confirmed value
  if (fieldStatus === 'confirmed') {
    parts.push('[Alternative interpretation - existing confirmed value differs]');
  }

  return parts.join(' ');
}

/**
 * Build batch reasoning
 */
function buildBatchReasoning(provenance: StrategyProposalProvenance): string {
  const parts: string[] = [];

  if (provenance.description) {
    parts.push(provenance.description);
  }

  if (provenance.strategyArtifactId) {
    parts.push(`From Strategy artifact: ${provenance.strategyArtifactId}`);
  }

  if (provenance.strategyRunId) {
    parts.push(`Strategy run: ${provenance.strategyRunId}`);
  }

  return parts.join(' | ') || 'Strategy-generated context proposals';
}

// ============================================================================
// Guardrails
// ============================================================================

/**
 * Runtime check: Throw if Strategy tries to persist a registry key directly.
 * Call this in dev mode before any Strategy storage operation.
 */
export function assertNotContextKey(
  fieldName: string,
  storageLocation: string
): void {
  if (process.env.NODE_ENV !== 'development') {
    return; // Only throw in dev
  }

  if (isValidRegistryKey(fieldName)) {
    throw new Error(
      `[CONTEXT-STRATEGY GUARDRAIL VIOLATION] ` +
      `Attempted to store registry key "${fieldName}" in ${storageLocation}. ` +
      `Context keys must go through proposeContextFromStrategy(), not direct storage. ` +
      `Use resolveContextValue() for reads.`
    );
  }
}

/**
 * Check multiple fields at once
 */
export function assertNoContextKeys(
  fields: Record<string, unknown>,
  storageLocation: string
): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  for (const key of Object.keys(fields)) {
    assertNotContextKey(key, storageLocation);
  }
}

/**
 * Get list of registry keys found in an object (for drift detection)
 */
export function findContextKeysInObject(
  obj: Record<string, unknown>,
  path: string = ''
): string[] {
  const found: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;

    // Check if this path is a registry key
    if (isValidRegistryKey(fullPath)) {
      found.push(fullPath);
    }

    // Recurse into objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      found.push(...findContextKeysInObject(value as Record<string, unknown>, fullPath));
    }
  }

  return found;
}
