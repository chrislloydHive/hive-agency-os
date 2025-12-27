// lib/os/plans/planSnapshots.ts
// Hash utilities for plan staleness detection
//
// Plans track a "source snapshot" containing hashes of the context and strategy
// state at the time the plan was last updated. When these upstream sources change,
// the plan is marked as stale and can receive AI-generated update proposals.

import crypto from 'crypto';
import type { PlanSourceSnapshot, MediaPlan, ContentPlan } from '@/lib/types/plan';
import type { ContextFieldStoreV4 } from '@/lib/types/contextField';
import type { CompanyStrategy } from '@/lib/types/strategy';

type Plan = MediaPlan | ContentPlan;

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Create a deterministic hash of any JSON-serializable object.
 * Uses sorted keys to ensure consistent ordering.
 */
export function hashObject(obj: unknown): string {
  if (!obj || typeof obj !== 'object') {
    return 'empty';
  }
  const str = stableStringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Stable JSON stringify with sorted keys for deterministic hashing
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ':' + stableStringify(value);
  });
  return '{' + pairs.join(',') + '}';
}

// ============================================================================
// Context Hash
// ============================================================================

/**
 * Compute a hash of the confirmed context fields relevant to plans.
 * Focuses on businessDefinition fields that drive plan content.
 *
 * Uses a relaxed type that accepts both ContextFieldStoreV4 and
 * the dynamic context graph structure from loadContextGraph.
 */
export function computeContextHash(context: ContextFieldStoreV4 | Record<string, unknown> | null): string {
  if (!context) return 'empty';

  // Use type assertion for flexible access
  const ctx = context as Record<string, Record<string, { value?: unknown }>>;

  // Extract businessDefinition fields used in plan generation
  const relevantFields = {
    // Identity
    businessModel: ctx.identity?.businessModel?.value,
    missionStatement: ctx.identity?.missionStatement?.value,

    // Audience
    primaryAudience: ctx.audience?.primaryAudience?.value,
    icpDescription: ctx.audience?.icpDescription?.value,
    buyerPersonas: ctx.audience?.buyerPersonas?.value,

    // Brand
    positioning: ctx.brand?.positioning?.value,
    toneOfVoice: ctx.brand?.toneOfVoice?.value,
    differentiators: ctx.brand?.differentiators?.value,

    // Product/Offer
    valueProposition: ctx.productOffer?.valueProposition?.value,
    keyBenefits: ctx.productOffer?.keyBenefits?.value,
    pricingModel: ctx.productOffer?.pricingModel?.value,

    // GTM (relevant to media plans)
    gtmChannels: ctx.gtm?.activeChannels?.value,
    marketingBudget: ctx.gtm?.marketingBudget?.value,

    // Competition
    competitivePosition: ctx.competition?.competitivePosition?.value,
    competitors: ctx.competition?.mainCompetitors?.value,
  };

  return hashObject(relevantFields);
}

// ============================================================================
// Strategy Hash
// ============================================================================

/**
 * Compute a hash of the strategy fields relevant to plans.
 * Includes frame, objectives, accepted bets, and goal statement.
 */
export function computeStrategyHash(strategy: CompanyStrategy | null): string {
  if (!strategy) return 'empty';

  // Extract strategy fields used in plan generation
  const relevantFields = {
    // Goal statement is primary driver
    goalStatement: strategy.goalStatement,

    // Strategy frame
    strategyFrame: strategy.strategyFrame,

    // Objectives - handle both string[] and StrategyObjective[] formats
    objectives: strategy.objectives?.map((o) => {
      if (typeof o === 'string') {
        return { text: o };
      }
      return {
        id: o.id,
        text: o.text,
        metric: o.metric,
        target: o.target,
        timeframe: o.timeframe,
      };
    }),

    // Strategic pillars
    pillars: strategy.pillars?.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
    })),
  };

  return hashObject(relevantFields);
}

// ============================================================================
// Source Snapshot
// ============================================================================

/**
 * Compute a complete source snapshot for a plan.
 * This captures the current state of context and strategy for staleness comparison.
 */
export function computeSourceSnapshot(
  context: ContextFieldStoreV4 | Record<string, unknown> | null,
  strategy: CompanyStrategy | null
): PlanSourceSnapshot {
  return {
    contextHash: computeContextHash(context),
    strategyHash: computeStrategyHash(strategy),
    contextConfirmedAt: new Date().toISOString(),
    strategyLockedAt: strategy?.updatedAt ?? null,
  };
}

// ============================================================================
// Staleness Detection
// ============================================================================

/**
 * Result of staleness check
 */
export interface StalenessResult {
  isStale: boolean;
  contextStale: boolean;
  strategyStale: boolean;
  reason: string | null;
}

/**
 * Check if a plan is stale by comparing its snapshot to current hashes.
 */
export function checkPlanStaleness(
  plan: Pick<Plan, 'sourceSnapshot' | 'status'>,
  currentContextHash: string,
  currentStrategyHash: string
): StalenessResult {
  const { sourceSnapshot, status } = plan;

  // Only approved plans can be stale (drafts are still being edited)
  if (status !== 'approved') {
    return {
      isStale: false,
      contextStale: false,
      strategyStale: false,
      reason: null,
    };
  }

  const contextStale = sourceSnapshot.contextHash !== currentContextHash;
  const strategyStale = sourceSnapshot.strategyHash !== currentStrategyHash;
  const isStale = contextStale || strategyStale;

  let reason: string | null = null;
  if (isStale) {
    const reasons: string[] = [];
    if (contextStale) {
      reasons.push('Context has changed');
    }
    if (strategyStale) {
      reasons.push('Strategy has changed');
    }
    reason = reasons.join(' and ');
  }

  return {
    isStale,
    contextStale,
    strategyStale,
    reason,
  };
}

/**
 * Convenience function to check staleness with full objects
 */
export function isPlanStale(
  plan: Pick<Plan, 'sourceSnapshot' | 'status'>,
  context: ContextFieldStoreV4 | Record<string, unknown> | null,
  strategy: CompanyStrategy | null
): StalenessResult {
  const currentContextHash = computeContextHash(context);
  const currentStrategyHash = computeStrategyHash(strategy);
  return checkPlanStaleness(plan, currentContextHash, currentStrategyHash);
}

// ============================================================================
// Change Detection (for proposal generation)
// ============================================================================

/**
 * Detailed change information for proposal generation
 */
export interface PlanChangeDetails {
  hasChanges: boolean;
  contextChanges: {
    changed: boolean;
    affectedKeys: string[];
  };
  strategyChanges: {
    changed: boolean;
    affectedKeys: string[];
  };
}

/**
 * Detect detailed changes between stored snapshot and current state.
 * Used to generate targeted update proposals.
 */
export function detectPlanChanges(
  storedSnapshot: PlanSourceSnapshot,
  context: ContextFieldStoreV4 | Record<string, unknown> | null,
  strategy: CompanyStrategy | null
): PlanChangeDetails {
  const currentContextHash = computeContextHash(context);
  const currentStrategyHash = computeStrategyHash(strategy);

  const contextChanged = storedSnapshot.contextHash !== currentContextHash;
  const strategyChanged = storedSnapshot.strategyHash !== currentStrategyHash;

  // TODO: Implement more granular change detection by comparing individual fields
  // For now, we just track that something changed
  const contextAffectedKeys: string[] = contextChanged
    ? ['context'] // Placeholder - could be more specific
    : [];
  const strategyAffectedKeys: string[] = strategyChanged
    ? ['strategy'] // Placeholder - could be more specific
    : [];

  return {
    hasChanges: contextChanged || strategyChanged,
    contextChanges: {
      changed: contextChanged,
      affectedKeys: contextAffectedKeys,
    },
    strategyChanges: {
      changed: strategyChanged,
      affectedKeys: strategyAffectedKeys,
    },
  };
}
