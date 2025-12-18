// lib/os/strategy/hashes.ts
// Hash utilities for staleness detection
//
// CAUSALITY CHAIN (one-directional):
//   Context → Objectives → Strategy → Tactics
//
// When something changes, downstream items become stale:
//   - Context changed    → objectives, strategy, tactics all stale
//   - Objectives changed → strategy, tactics stale (but NOT context)
//   - Strategy changed   → tactics stale (but NOT objectives/context)
//   - Tactics changed    → nothing upstream is affected
//
// Why: Each layer builds on the previous. AI-generated content at layer N
// was based on a snapshot of layers 0..(N-1). If those inputs changed,
// the generated content may no longer be appropriate.

import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface StrategyHashes {
  contextHash: string;
  objectivesHash: string;
  strategyHash: string;
  tacticsHash: string;
  // Derived-from hashes (what was used to generate each component)
  objectivesDerivedFromContextHash?: string;
  strategyDerivedFromObjectivesHash?: string;
  tacticsDerivedFromStrategyHash?: string;
}

export interface StalenessIndicators {
  contextChanged: boolean;
  objectivesStale: boolean;     // Context changed since objectives were generated
  strategyStale: boolean;       // Objectives changed since strategy was generated
  tacticsStale: boolean;        // Strategy changed since tactics were generated
  staleSummary: string[];       // Human-readable summary
}

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Create a deterministic hash of any JSON-serializable object
 */
export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj, Object.keys(obj as object).sort());
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Hash context data for staleness comparison
 */
export function hashContext(context: unknown): string {
  if (!context) return 'empty';
  // Extract relevant context fields for hashing
  const ctx = context as Record<string, unknown>;
  const relevantFields = {
    identity: ctx.identity,
    audience: ctx.audience,
    productOffer: ctx.productOffer,
    competition: ctx.competition,
    operationalConstraints: ctx.operationalConstraints,
  };
  return hashObject(relevantFields);
}

/**
 * Hash objectives array
 */
export function hashObjectives(objectives: unknown[]): string {
  if (!objectives || objectives.length === 0) return 'empty';
  // Sort by ID for deterministic hashing
  const sorted = [...objectives].sort((a, b) => {
    const aId = (a as Record<string, unknown>).id as string || '';
    const bId = (b as Record<string, unknown>).id as string || '';
    return aId.localeCompare(bId);
  });
  return hashObject(sorted);
}

/**
 * Hash strategy core (title, summary, pillars)
 */
export function hashStrategy(strategy: {
  title?: string;
  summary?: string;
  pillars?: unknown[];
  strategyFrame?: unknown;
  tradeoffs?: unknown;
}): string {
  if (!strategy) return 'empty';
  const relevantFields = {
    title: strategy.title,
    summary: strategy.summary,
    pillars: strategy.pillars,
    strategyFrame: strategy.strategyFrame,
    tradeoffs: strategy.tradeoffs,
  };
  return hashObject(relevantFields);
}

/**
 * Hash tactics array
 */
export function hashTactics(tactics: unknown[]): string {
  if (!tactics || tactics.length === 0) return 'empty';
  // Sort by ID for deterministic hashing
  const sorted = [...tactics].sort((a, b) => {
    const aId = (a as Record<string, unknown>).id as string || '';
    const bId = (b as Record<string, unknown>).id as string || '';
    return aId.localeCompare(bId);
  });
  return hashObject(sorted);
}

// ============================================================================
// Staleness Detection
// ============================================================================

/**
 * Compute staleness indicators by comparing current hashes to derived-from hashes.
 *
 * CASCADE RULES (enforced here):
 * - Objectives stale when: context changed since objectives were generated
 * - Strategy stale when: objectives changed since strategy was generated
 * - Tactics stale when: strategy changed since tactics were generated
 *
 * Tactics changes do NOT invalidate strategy/objectives (no upstream cascade).
 */
export function computeStaleness(
  currentHashes: StrategyHashes,
  derivedFromHashes?: Partial<StrategyHashes>
): StalenessIndicators {
  const staleSummary: string[] = [];

  // Context changed: tracked separately (requires previous context hash from storage)
  const contextChanged = false;

  // LAYER 1: Objectives stale if context changed since generation
  // Why: Objectives are informed by audience/constraints/reality from Context.
  const objectivesStale = derivedFromHashes?.objectivesDerivedFromContextHash
    ? derivedFromHashes.objectivesDerivedFromContextHash !== currentHashes.contextHash
    : false;

  if (objectivesStale) {
    staleSummary.push('Context has changed - objectives may need review');
  }

  // LAYER 2: Strategy stale if objectives changed since generation
  // Why: Strategic priorities are designed to achieve specific objectives.
  const strategyStale = derivedFromHashes?.strategyDerivedFromObjectivesHash
    ? derivedFromHashes.strategyDerivedFromObjectivesHash !== currentHashes.objectivesHash
    : false;

  if (strategyStale) {
    staleSummary.push('Objectives have changed - strategy may need regeneration');
  }

  // LAYER 3: Tactics stale if strategy changed since generation
  // Why: Tactics implement specific strategic priorities.
  const tacticsStale = derivedFromHashes?.tacticsDerivedFromStrategyHash
    ? derivedFromHashes.tacticsDerivedFromStrategyHash !== currentHashes.strategyHash
    : false;

  if (tacticsStale) {
    staleSummary.push('Strategy has changed - tactics may need regeneration');
  }

  // NOTE: Tactics changes do NOT invalidate objectives or strategy.
  // The cascade is strictly one-directional: Context → Objectives → Strategy → Tactics

  return {
    contextChanged,
    objectivesStale,
    strategyStale,
    tacticsStale,
    staleSummary,
  };
}

/**
 * Compute all hashes for current state
 */
export function computeAllHashes(
  context: unknown,
  objectives: unknown[],
  strategy: { title?: string; summary?: string; pillars?: unknown[]; strategyFrame?: unknown; tradeoffs?: unknown },
  tactics: unknown[]
): StrategyHashes {
  return {
    contextHash: hashContext(context),
    objectivesHash: hashObjectives(objectives),
    strategyHash: hashStrategy(strategy),
    tacticsHash: hashTactics(tactics),
  };
}
