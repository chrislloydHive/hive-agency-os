// lib/artifacts/stalenessDetection.ts
// Staleness Detection Service for Workspace Artifacts
//
// Detects when artifacts may be stale due to:
// - Context graph updates (new values, confirmed fields)
// - Strategy updates (new version, field changes)
// - Time-based staleness (e.g., >30 days since creation)

import {
  getArtifactsForCompany,
  getStaleArtifactsForCompany,
  markArtifactStale,
  markArtifactFresh,
} from '@/lib/airtable/artifacts';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { Artifact, StalenessCheckResult } from '@/lib/types/artifact';

// ============================================================================
// Constants
// ============================================================================

/** Default staleness threshold in days */
const DEFAULT_STALENESS_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

export interface StalenessContext {
  /** Current context graph updated timestamp */
  contextUpdatedAt?: string;
  /** Current strategy version */
  strategyVersion?: number;
  /** Current strategy updated timestamp */
  strategyUpdatedAt?: string;
}

export interface CheckStalenessResult {
  /** Total artifacts checked */
  totalChecked: number;
  /** Artifacts marked as stale */
  newlyStale: number;
  /** Artifacts marked as fresh */
  newlyFresh: number;
  /** Details per artifact */
  details: Array<{
    artifactId: string;
    artifactTitle: string;
    isStale: boolean;
    reason: string | null;
  }>;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check and update staleness for all artifacts of a company
 */
export async function checkAndUpdateStaleness(
  companyId: string,
  context?: StalenessContext
): Promise<CheckStalenessResult> {
  const artifacts = await getArtifactsForCompany(companyId);

  // Get strategy context if not provided
  let staleness = context || {};
  if (!staleness.strategyVersion || !staleness.strategyUpdatedAt) {
    const strategy = await getActiveStrategy(companyId);
    if (strategy) {
      staleness.strategyVersion = strategy.version || 1;
      staleness.strategyUpdatedAt = strategy.updatedAt;
    }
  }

  const result: CheckStalenessResult = {
    totalChecked: 0,
    newlyStale: 0,
    newlyFresh: 0,
    details: [],
  };

  for (const artifact of artifacts) {
    // Skip archived artifacts
    if (artifact.status === 'archived') {
      continue;
    }

    result.totalChecked++;

    const check = checkArtifactStaleness(artifact, staleness);

    if (check.isStale && !artifact.isStale) {
      // Newly stale
      await markArtifactStale(artifact.id, check.reason || 'Content may be outdated');
      result.newlyStale++;
    } else if (!check.isStale && artifact.isStale) {
      // Now fresh (manually refreshed)
      await markArtifactFresh(artifact.id);
      result.newlyFresh++;
    }

    result.details.push({
      artifactId: artifact.id,
      artifactTitle: artifact.title,
      isStale: check.isStale,
      reason: check.reason,
    });
  }

  return result;
}

/**
 * Check staleness for a single artifact
 */
export function checkArtifactStaleness(
  artifact: Artifact,
  context: StalenessContext
): StalenessCheckResult {
  const now = new Date();
  const checkedAt = now.toISOString();

  // Check strategy version staleness (for strategy_doc artifacts)
  if (artifact.type === 'strategy_doc' && artifact.strategyVersionAtCreation !== null) {
    if (context.strategyVersion && context.strategyVersion > artifact.strategyVersionAtCreation) {
      return {
        isStale: true,
        reason: `Strategy has been updated since this document was created (v${artifact.strategyVersionAtCreation} → v${context.strategyVersion})`,
        checkedAt,
        details: {
          currentStrategyVersion: context.strategyVersion,
          artifactStrategyVersion: artifact.strategyVersionAtCreation,
        },
      };
    }
  }

  // Check context version staleness
  if (artifact.contextVersionAtCreation !== null) {
    // For now, we'll use time-based detection since we don't track context versions
    // In a full implementation, we'd compare context revision IDs
  }

  // Check time-based staleness
  const createdAt = new Date(artifact.createdAt);
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceCreation > DEFAULT_STALENESS_DAYS) {
    return {
      isStale: true,
      reason: `Artifact is ${daysSinceCreation} days old. Consider refreshing to ensure content is current.`,
      checkedAt,
      details: {},
    };
  }

  // Check if source was updated after artifact creation
  if (context.strategyUpdatedAt && artifact.type === 'strategy_doc') {
    const strategyUpdated = new Date(context.strategyUpdatedAt);
    if (strategyUpdated > createdAt) {
      return {
        isStale: true,
        reason: 'Strategy was updated after this document was created',
        checkedAt,
        details: {},
      };
    }
  }

  // Artifact is fresh
  return {
    isStale: false,
    reason: null,
    checkedAt,
    details: {},
  };
}

/**
 * Get staleness summary for a company
 */
export async function getStalenessSnapshot(companyId: string): Promise<{
  total: number;
  stale: number;
  fresh: number;
  staleArtifacts: Artifact[];
}> {
  const [all, stale] = await Promise.all([
    getArtifactsForCompany(companyId),
    getStaleArtifactsForCompany(companyId),
  ]);

  const activeArtifacts = all.filter(a => a.status !== 'archived');

  return {
    total: activeArtifacts.length,
    stale: stale.length,
    fresh: activeArtifacts.length - stale.length,
    staleArtifacts: stale,
  };
}

/**
 * Mark artifact as refreshed (manually updated to match current context)
 */
export async function markAsRefreshed(artifactId: string): Promise<void> {
  await markArtifactFresh(artifactId);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get suggested actions for a stale artifact
 */
export function getStalenessActions(artifact: Artifact): Array<{
  action: string;
  label: string;
  priority: 'primary' | 'secondary';
}> {
  const actions: Array<{
    action: string;
    label: string;
    priority: 'primary' | 'secondary';
  }> = [];

  switch (artifact.type) {
    case 'strategy_doc':
      actions.push({
        action: 'regenerate',
        label: 'Regenerate from Strategy',
        priority: 'primary',
      });
      actions.push({
        action: 'dismiss',
        label: 'Mark as Current',
        priority: 'secondary',
      });
      break;

    case 'qbr_slides':
      actions.push({
        action: 'regenerate',
        label: 'Regenerate from QBR',
        priority: 'primary',
      });
      actions.push({
        action: 'dismiss',
        label: 'Mark as Current',
        priority: 'secondary',
      });
      break;

    case 'brief_doc':
      actions.push({
        action: 'regenerate',
        label: 'Regenerate from Brief',
        priority: 'primary',
      });
      actions.push({
        action: 'dismiss',
        label: 'Mark as Current',
        priority: 'secondary',
      });
      break;

    default:
      actions.push({
        action: 'dismiss',
        label: 'Mark as Current',
        priority: 'primary',
      });
  }

  return actions;
}
