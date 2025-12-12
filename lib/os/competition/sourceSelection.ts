// lib/os/competition/sourceSelection.ts
// Competition Source Selection
//
// Ensures proper V4 vs V3 selection with mutual exclusivity.
// V4 is always preferred when available. V3 is fallback only.
// Never mix V3 and V4 results in the same analysis.

// ============================================================================
// Types
// ============================================================================

/**
 * Competition source version
 */
export type CompetitionVersion = 'v4' | 'v3' | 'none';

/**
 * Result of source selection
 */
export interface CompetitionSourceSelection {
  /** Which version to use */
  version: CompetitionVersion;
  /** Source ID for provenance tracking */
  sourceId: 'competition_v4' | 'competition_lab' | null;
  /** Run ID if available */
  runId: string | null;
  /** Why this source was selected */
  reason: string;
  /** When the selected run was created */
  runDate: string | null;
}

/**
 * Competition run info (minimal for selection)
 */
export interface CompetitionRunInfo {
  id: string;
  version: 'v3' | 'v4';
  createdAt: string;
  status?: 'completed' | 'failed' | 'in_progress';
}

// ============================================================================
// Source Selection Logic
// ============================================================================

/**
 * Select the best competition source for a company
 *
 * Selection rules (in order):
 * 1. V4 completed run exists -> use V4
 * 2. No V4 but V3 completed run exists -> use V3
 * 3. No completed runs -> return 'none'
 *
 * IMPORTANT: Never mix V3 and V4 results. Use one source only.
 *
 * @param v4Runs - V4 competition runs for the company
 * @param v3Runs - V3 competition runs for the company
 */
export function selectCompetitionSource(
  v4Runs: CompetitionRunInfo[],
  v3Runs: CompetitionRunInfo[]
): CompetitionSourceSelection {
  // Filter to completed runs only
  const completedV4 = v4Runs.filter(r => r.status === 'completed' || !r.status);
  const completedV3 = v3Runs.filter(r => r.status === 'completed' || !r.status);

  // Sort by date (most recent first)
  const sortByDate = (a: CompetitionRunInfo, b: CompetitionRunInfo) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  completedV4.sort(sortByDate);
  completedV3.sort(sortByDate);

  // Rule 1: Prefer V4 if available
  if (completedV4.length > 0) {
    const latest = completedV4[0];
    return {
      version: 'v4',
      sourceId: 'competition_v4',
      runId: latest.id,
      reason: 'V4 run available - using preferred source',
      runDate: latest.createdAt,
    };
  }

  // Rule 2: Fall back to V3
  if (completedV3.length > 0) {
    const latest = completedV3[0];
    return {
      version: 'v3',
      sourceId: 'competition_lab',
      runId: latest.id,
      reason: 'No V4 run available - using V3 fallback',
      runDate: latest.createdAt,
    };
  }

  // Rule 3: No runs available
  return {
    version: 'none',
    sourceId: null,
    runId: null,
    reason: 'No completed competition runs available',
    runDate: null,
  };
}

/**
 * Check if a V4 run should replace existing V3 data
 *
 * When a new V4 run completes, it should replace V3 data because:
 * 1. V4 is always preferred
 * 2. V3 and V4 should never be mixed
 */
export function shouldV4ReplaceV3(
  existingSource: 'competition_v4' | 'competition_lab' | null,
  newV4Run: CompetitionRunInfo
): boolean {
  // If existing is null or V3, V4 should replace
  if (!existingSource || existingSource === 'competition_lab') {
    return true;
  }

  // If existing is V4, check if new run is more recent
  // (handled elsewhere by comparing run dates)
  return false;
}

/**
 * Validate that competition data is from a single source
 *
 * Returns an error if data appears to mix V3 and V4 sources.
 */
export function validateCompetitionDataConsistency(
  sources: Array<'competition_v4' | 'competition_lab' | string>
): { valid: boolean; error?: string } {
  const hasV4 = sources.includes('competition_v4');
  const hasV3 = sources.includes('competition_lab');

  if (hasV4 && hasV3) {
    return {
      valid: false,
      error: 'Competition data mixes V4 and V3 sources. This is not allowed. Use a single source only.',
    };
  }

  return { valid: true };
}

// ============================================================================
// Source Recommendation
// ============================================================================

/**
 * Recommend whether to run V4 competition analysis
 */
export function recommendCompetitionRun(
  selection: CompetitionSourceSelection,
  options?: {
    /** Max age in days before recommending refresh */
    maxAgeDays?: number;
    /** Force recommendation regardless of existing data */
    force?: boolean;
  }
): {
  recommended: boolean;
  reason: string;
  priority: 'high' | 'medium' | 'low' | 'none';
} {
  const maxAge = options?.maxAgeDays ?? 90; // Default 90 days

  if (options?.force) {
    return {
      recommended: true,
      reason: 'Force flag set - recommending V4 run',
      priority: 'medium',
    };
  }

  // No competition data at all
  if (selection.version === 'none') {
    return {
      recommended: true,
      reason: 'No competition data available - V4 analysis recommended',
      priority: 'high',
    };
  }

  // Using V3 - recommend upgrade to V4
  if (selection.version === 'v3') {
    return {
      recommended: true,
      reason: 'Currently using V3 data - V4 upgrade recommended for better analysis',
      priority: 'medium',
    };
  }

  // V4 data exists - check age
  if (selection.runDate) {
    const age = Date.now() - new Date(selection.runDate).getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);

    if (ageDays > maxAge) {
      return {
        recommended: true,
        reason: `V4 data is ${Math.round(ageDays)} days old - refresh recommended`,
        priority: 'low',
      };
    }
  }

  return {
    recommended: false,
    reason: 'V4 data is current',
    priority: 'none',
  };
}

// ============================================================================
// Context Integration Helpers
// ============================================================================

/**
 * Get the source ID for provenance tracking based on version
 */
export function getCompetitionSourceId(version: CompetitionVersion): 'competition_v4' | 'competition_lab' | null {
  switch (version) {
    case 'v4':
      return 'competition_v4';
    case 'v3':
      return 'competition_lab';
    case 'none':
      return null;
  }
}

/**
 * Map a generic competition source to version
 */
export function sourceIdToVersion(sourceId: string): CompetitionVersion {
  if (sourceId === 'competition_v4') return 'v4';
  if (sourceId === 'competition_lab') return 'v3';
  return 'none';
}

/**
 * Check if source ID is for competition data
 */
export function isCompetitionSource(sourceId: string): boolean {
  return sourceId === 'competition_v4' || sourceId === 'competition_lab';
}
