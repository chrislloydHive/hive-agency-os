// lib/os/context/strategyImpact.ts
// Context → Strategy Impact Detection
//
// Determines when Context changes should prompt Strategy review.
// Strategy is a decision artifact; Context is living input.
// Context changes create a SIGNAL, not automatic regeneration.

import type { CompanyContext } from '@/lib/types/context';
import type { CompanyContextV2 } from '@/lib/types/contextV2';

// ============================================================================
// Strategy-Impacting Fields (V1)
// ============================================================================

/**
 * Fields that materially affect strategic decisions.
 * Changes to these should trigger a strategy review recommendation.
 *
 * NOTE: Keep in sync with STRATEGY_CRITICAL_FIELDS and STRATEGY_RECOMMENDED_FIELDS
 * in lib/types/context.ts
 */
export const STRATEGY_IMPACTING_FIELDS = [
  // Critical (must have)
  'objectives',         // Goals / Objectives
  'primaryAudience',    // Target audience (primary)
  'businessModel',      // Business model
  'budget',             // Budget constraint
  // Recommended (improves quality)
  'companyCategory',    // Competitive category
  'constraints',        // Core constraints
  'timeline',           // Timeline constraint
  'geographicScope',    // Geographic footprint
  'avgOrderValue',      // Unit economics
  'primaryConversionAction', // What success means
] as const;

/**
 * Fields that do NOT affect strategy (safe to ignore).
 * Changes to these should NOT trigger review recommendation.
 */
export const NON_IMPACTING_FIELDS = [
  'notes',              // Free-form notes
  'secondaryAudience',  // Secondary audience (not primary driver)
  'icpDescription',     // Detailed ICP (elaboration, not strategy-changing)
  'valueProposition',   // Description, not decision
  'marketSignals',      // Signals, not decisions
  'differentiators',    // Descriptive, not decisional
  'competitorsNotes',   // Notes, not structure
  'keyMetrics',         // Measurement, not decision
] as const;

// ============================================================================
// Types
// ============================================================================

export type StrategyImpactingField = typeof STRATEGY_IMPACTING_FIELDS[number];

export interface ContextChangeResult {
  /** Whether the change affects strategy */
  affectsStrategy: boolean;
  /** Which strategy-impacting fields changed */
  changedFields: StrategyImpactingField[];
  /** Summary description of changes */
  changeSummary?: string;
}

export interface ContextVersionRef {
  /** Context updatedAt timestamp when strategy was generated */
  contextUpdatedAt: string;
  /** Optional hash of strategy-impacting fields */
  contextHash?: string;
}

// ============================================================================
// V1 Context Comparison
// ============================================================================

/**
 * Compare two V1 contexts and determine if changes affect strategy
 */
export function doesContextChangeAffectStrategy(
  previousContext: CompanyContext | null,
  updatedContext: CompanyContext | null
): ContextChangeResult {
  // No previous context - can't determine change
  if (!previousContext || !updatedContext) {
    return {
      affectsStrategy: false,
      changedFields: [],
    };
  }

  const changedFields: StrategyImpactingField[] = [];

  for (const field of STRATEGY_IMPACTING_FIELDS) {
    const oldValue = previousContext[field];
    const newValue = updatedContext[field];

    if (hasFieldChanged(oldValue, newValue)) {
      changedFields.push(field);
    }
  }

  const affectsStrategy = changedFields.length > 0;

  return {
    affectsStrategy,
    changedFields,
    changeSummary: affectsStrategy
      ? `Changed: ${formatChangedFields(changedFields)}`
      : undefined,
  };
}

/**
 * Check if a strategy should be reviewed based on context timestamp
 */
export function shouldRecommendStrategyReview(
  strategyContextVersion: ContextVersionRef | null,
  currentContext: CompanyContext | null
): boolean {
  if (!strategyContextVersion || !currentContext) {
    return false;
  }

  // Compare timestamps
  const strategyContextTime = new Date(strategyContextVersion.contextUpdatedAt).getTime();
  const currentContextTime = currentContext.updatedAt
    ? new Date(currentContext.updatedAt).getTime()
    : 0;

  // If current context is newer, may need review
  // (Full validation would require comparing actual field values)
  return currentContextTime > strategyContextTime;
}

/**
 * Create a context version reference from current context
 */
export function createContextVersionRef(
  context: CompanyContext | null
): ContextVersionRef | null {
  if (!context || !context.updatedAt) {
    return null;
  }

  return {
    contextUpdatedAt: context.updatedAt,
    contextHash: computeContextHash(context),
  };
}

/**
 * Full comparison: check if context has changed in strategy-impacting ways
 * since a strategy was generated
 */
export function detectContextStrategyMismatch(
  strategyContextVersion: ContextVersionRef | null,
  currentContext: CompanyContext | null
): ContextChangeResult {
  // No version tracking - can't determine
  if (!strategyContextVersion || !currentContext) {
    return {
      affectsStrategy: false,
      changedFields: [],
    };
  }

  // Quick timestamp check first
  const strategyTime = new Date(strategyContextVersion.contextUpdatedAt).getTime();
  const currentTime = currentContext.updatedAt
    ? new Date(currentContext.updatedAt).getTime()
    : 0;

  // Context hasn't changed since strategy was created
  if (currentTime <= strategyTime) {
    return {
      affectsStrategy: false,
      changedFields: [],
    };
  }

  // Context is newer - check hash if available
  if (strategyContextVersion.contextHash) {
    const currentHash = computeContextHash(currentContext);
    if (currentHash === strategyContextVersion.contextHash) {
      // Hash matches - only non-impacting fields changed
      return {
        affectsStrategy: false,
        changedFields: [],
      };
    }
  }

  // Context is newer and hash differs (or no hash) - flag for review
  // We can't determine specific changed fields without previous context
  return {
    affectsStrategy: true,
    changedFields: [], // Unknown which specific fields changed
    changeSummary: 'Context has been updated since this strategy was created',
  };
}

// ============================================================================
// V2 Context Comparison
// ============================================================================

/**
 * Compare two V2 contexts and determine if changes affect strategy
 */
export function doesContextV2ChangeAffectStrategy(
  previousContext: CompanyContextV2 | null,
  updatedContext: CompanyContextV2 | null
): ContextChangeResult {
  if (!previousContext || !updatedContext) {
    return {
      affectsStrategy: false,
      changedFields: [],
    };
  }

  const changedFields: StrategyImpactingField[] = [];

  // Check Company Reality
  if (hasFieldChanged(
    previousContext.companyReality.businessModel?.value,
    updatedContext.companyReality.businessModel?.value
  )) {
    changedFields.push('businessModel');
  }

  if (hasFieldChanged(
    previousContext.companyReality.category?.value,
    updatedContext.companyReality.category?.value
  )) {
    changedFields.push('companyCategory');
  }

  // Check Market Reality
  if (hasFieldChanged(
    previousContext.marketReality.primaryAudience?.value,
    updatedContext.marketReality.primaryAudience?.value
  )) {
    changedFields.push('primaryAudience');
  }

  // Check Strategic Intent
  if (hasFieldChanged(
    previousContext.strategicIntent.primaryObjectives?.value,
    updatedContext.strategicIntent.primaryObjectives?.value
  )) {
    changedFields.push('objectives');
  }

  // Check Constraints
  if (hasFieldChanged(
    previousContext.constraints.budget?.value,
    updatedContext.constraints.budget?.value
  )) {
    changedFields.push('budget');
  }

  if (hasFieldChanged(
    previousContext.constraints.constraints?.value,
    updatedContext.constraints.constraints?.value
  )) {
    changedFields.push('constraints');
  }

  if (hasFieldChanged(
    previousContext.constraints.timeline?.value,
    updatedContext.constraints.timeline?.value
  )) {
    changedFields.push('timeline');
  }

  const affectsStrategy = changedFields.length > 0;

  return {
    affectsStrategy,
    changedFields,
    changeSummary: affectsStrategy
      ? `Changed: ${formatChangedFields(changedFields)}`
      : undefined,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a field value has meaningfully changed
 */
function hasFieldChanged(
  oldValue: unknown,
  newValue: unknown
): boolean {
  // Both empty = no change
  if (isEmpty(oldValue) && isEmpty(newValue)) {
    return false;
  }

  // One empty, one not = change
  if (isEmpty(oldValue) !== isEmpty(newValue)) {
    return true;
  }

  // Both strings - compare trimmed
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    return oldValue.trim().toLowerCase() !== newValue.trim().toLowerCase();
  }

  // Both arrays - compare content
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length !== newValue.length) {
      return true;
    }
    // Simple comparison - join and compare
    return oldValue.sort().join('|') !== newValue.sort().join('|');
  }

  // Fallback to JSON comparison
  return JSON.stringify(oldValue) !== JSON.stringify(newValue);
}

/**
 * Check if a value is empty
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

/**
 * Compute a hash of strategy-impacting fields for quick comparison
 */
function computeContextHash(context: CompanyContext): string {
  const impactingValues = STRATEGY_IMPACTING_FIELDS.map(field => {
    const value = context[field];
    if (isEmpty(value)) return '';
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (Array.isArray(value)) return value.sort().join('|');
    return JSON.stringify(value);
  });

  // Simple hash - join values and create a checksum
  const combined = impactingValues.join('|||');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Format changed fields for display
 */
function formatChangedFields(fields: StrategyImpactingField[]): string {
  const labels: Record<StrategyImpactingField, string> = {
    objectives: 'Goals',
    primaryAudience: 'Target Audience',
    businessModel: 'Business Model',
    companyCategory: 'Category',
    budget: 'Budget',
    constraints: 'Constraints',
    timeline: 'Timeline',
    geographicScope: 'Geography',
    avgOrderValue: 'Order Value',
    primaryConversionAction: 'Conversion Action',
  };

  return fields.map(f => labels[f] || f).join(', ');
}

// ============================================================================
// Exports
// ============================================================================

export {
  computeContextHash as _computeContextHash, // Export for testing
  formatChangedFields as _formatChangedFields,
};
