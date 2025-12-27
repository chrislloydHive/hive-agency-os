// lib/os/ui/discoverUiState.ts
// Discover Page UI State Selector
//
// Single source of truth for Discover page state derivation.
// Maps raw API data → discrete UI state → visibility rules.

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the Discover experience
 */
export type DiscoverState =
  | 'empty_no_runs'              // No labs run, no path selected
  | 'path_selected_not_started'  // Path selected but pack not started
  | 'running'                    // At least one lab is running
  | 'has_results';               // Has completed runs (stale_results treated as has_results)

/**
 * Starting path keys
 */
export type PathKey = 'baseline' | 'project' | 'rfp' | 'custom';

/**
 * Lab keys (matches LABS[].id in DiagnosticsControlCenter)
 */
export type LabKey =
  | 'gapSnapshot'
  | 'gapPlan'
  | 'websiteLab'
  | 'brandLab'
  | 'seoLab'
  | 'contentLab'
  | 'demandLab'
  | 'opsLab'
  | 'competitionLab'
  | 'analyticsLab';

/**
 * Surface visibility levels
 */
export type SurfaceVisibility = 'hidden' | 'secondary' | 'primary';

/**
 * Primary CTA configuration
 */
export interface DiscoverCTA {
  label: string;
  intentKey: 'select_path' | 'start_pack' | 'view_running' | 'run_more' | 'go_to_decide';
}

/**
 * Next Step CTA configuration (routes to Decide when eligible)
 */
export interface NextStepCTA {
  label: string;
  href: string;
}

/**
 * Suggested pack configuration
 */
export interface SuggestedPack {
  labs: LabKey[];
  /** Whether a GAP lab should be included */
  gap: boolean;
}

/**
 * Path definition (mirrors DiagnosticsControlCenter.PathDefinition)
 */
export interface PathDefinition {
  id: PathKey;
  name: string;
  description: string;
  primaryLab: LabKey | '';
  recommendedLabs: LabKey[];
  ctaLabel: string;
}

/**
 * Debug info for development
 */
export interface DiscoverDebugInfo {
  hasAnyRuns: boolean;
  hasRunning: boolean;
  hasCompleted: boolean;
  selectedPath: PathKey | null;
  packStarted: boolean;
  decideEligible: boolean;
}

/**
 * Full UI state derived from data
 */
export interface DiscoverUIState {
  state: DiscoverState;
  showStartingPaths: SurfaceVisibility;
  showPackRunner: SurfaceVisibility;
  showLabsGrid: SurfaceVisibility;
  showRecentRuns: SurfaceVisibility;
  showNextStepPanel: boolean;
  primaryCTA: DiscoverCTA;
  nextStepCTA: NextStepCTA | null;
  suggestedPack: SuggestedPack | null;
  debug: DiscoverDebugInfo;
}

/**
 * Raw data inputs for state derivation
 */
export interface DiscoverDataInput {
  hasAnyRuns: boolean;
  hasRunning: boolean;
  hasCompleted: boolean;
  selectedPath: PathKey | null;
  packStarted: boolean;
  /** Whether user is eligible for Next Step panel (e.g., website lab completed) */
  decideEligible: boolean;
}

// ============================================================================
// Path Definitions (mirrored for selector use)
// ============================================================================

/**
 * Authoritative path → labs mapping
 * Mirrors STARTING_PATHS in DiagnosticsControlCenter
 */
export const PATH_LABS: Record<PathKey, { primaryLab: LabKey | null; recommendedLabs: LabKey[] }> = {
  baseline: {
    primaryLab: 'gapPlan',
    recommendedLabs: ['websiteLab', 'brandLab', 'seoLab', 'contentLab', 'competitionLab'],
  },
  project: {
    primaryLab: 'websiteLab',
    recommendedLabs: ['brandLab', 'contentLab', 'competitionLab'],
  },
  rfp: {
    primaryLab: 'brandLab',
    recommendedLabs: ['competitionLab', 'websiteLab'],
  },
  custom: {
    primaryLab: null,
    recommendedLabs: [],
  },
};

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete DiscoverState from raw data
 *
 * STATE RESOLVER (authoritative):
 * - if !hasAnyRuns && !selectedPath -> empty_no_runs
 * - if !hasAnyRuns && selectedPath && !packStarted -> path_selected_not_started
 * - if hasRunning -> running
 * - if hasCompleted -> has_results
 * - else -> empty_no_runs
 */
export function deriveDiscoverState(input: DiscoverDataInput): DiscoverState {
  const { hasAnyRuns, hasRunning, hasCompleted, selectedPath, packStarted } = input;

  // No runs yet, no path selected
  if (!hasAnyRuns && !selectedPath) {
    return 'empty_no_runs';
  }

  // Path selected but pack not started
  if (!hasAnyRuns && selectedPath && !packStarted) {
    return 'path_selected_not_started';
  }

  // Labs are running
  if (hasRunning) {
    return 'running';
  }

  // Has completed results
  if (hasCompleted) {
    return 'has_results';
  }

  // Fallback
  return 'empty_no_runs';
}

// ============================================================================
// Visibility Matrix
// ============================================================================

/**
 * Get surface visibility for a given state
 *
 * Authoritative visibility matrix:
 * | State                     | Starting Paths | Pack Runner | Labs Grid | Recent Runs | Next Step Panel |
 * |---------------------------|----------------|-------------|-----------|-------------|-----------------|
 * | empty_no_runs             | ✅ primary     | ❌ hidden   | ✅ primary| ❌ hidden   | ❌              |
 * | path_selected_not_started | ✅ primary     | ✅ primary  | ⚪ second | ❌ hidden   | ❌              |
 * | running                   | ⚪ secondary   | ✅ primary  | ⚪ second | ✅ primary  | ❌              |
 * | has_results               | ⚪ secondary   | ⚪ hidden   | ✅ primary| ✅ primary  | ✅ (if eligible)|
 */
interface VisibilityConfig {
  startingPaths: SurfaceVisibility;
  packRunner: SurfaceVisibility;
  labsGrid: SurfaceVisibility;
  recentRuns: SurfaceVisibility;
}

function getVisibilityConfig(state: DiscoverState): VisibilityConfig {
  const matrix: Record<DiscoverState, VisibilityConfig> = {
    empty_no_runs: {
      startingPaths: 'primary',
      packRunner: 'hidden',
      labsGrid: 'primary',
      recentRuns: 'hidden',
    },
    path_selected_not_started: {
      startingPaths: 'primary',
      packRunner: 'primary',
      labsGrid: 'secondary',
      recentRuns: 'hidden',
    },
    running: {
      startingPaths: 'secondary',
      packRunner: 'primary',
      labsGrid: 'secondary',
      recentRuns: 'primary',
    },
    has_results: {
      startingPaths: 'secondary',
      packRunner: 'hidden',
      labsGrid: 'primary',
      recentRuns: 'primary',
    },
  };

  return matrix[state];
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get the primary CTA for a state
 */
function getPrimaryCTA(state: DiscoverState): DiscoverCTA {
  switch (state) {
    case 'empty_no_runs':
      return {
        label: 'Choose a Starting Path',
        intentKey: 'select_path',
      };

    case 'path_selected_not_started':
      return {
        label: 'Start Pack',
        intentKey: 'start_pack',
      };

    case 'running':
      return {
        label: 'View Progress',
        intentKey: 'view_running',
      };

    case 'has_results':
      return {
        label: 'Run More Labs',
        intentKey: 'run_more',
      };
  }
}

/**
 * Get the Next Step CTA when eligible
 */
function getNextStepCTA(
  state: DiscoverState,
  decideEligible: boolean,
  companyId: string
): NextStepCTA | null {
  // Only show in has_results state when eligible
  if (state !== 'has_results' || !decideEligible) {
    return null;
  }

  return {
    label: 'Review Context in Decide',
    href: `/c/${companyId}/decide`,
  };
}

// ============================================================================
// Suggested Pack
// ============================================================================

/**
 * Get suggested pack for selected path
 */
function getSuggestedPack(selectedPath: PathKey | null): SuggestedPack | null {
  if (!selectedPath) {
    return null;
  }

  const pathConfig = PATH_LABS[selectedPath];

  // Custom path has no suggested pack
  if (selectedPath === 'custom') {
    return {
      labs: [],
      gap: false,
    };
  }

  const labs: LabKey[] = [];

  // Add primary lab if exists
  if (pathConfig.primaryLab) {
    labs.push(pathConfig.primaryLab);
  }

  // Add recommended labs
  labs.push(...pathConfig.recommendedLabs);

  // Check if pack includes a GAP lab
  const gap = labs.includes('gapSnapshot') || labs.includes('gapPlan');

  return {
    labs,
    gap,
  };
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete Discover UI state from raw data
 *
 * This is the single source of truth for all Discover page UI decisions.
 * All conditional rendering should flow from this selector.
 *
 * @param input - Raw data from component state
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getDiscoverUIState(
  input: DiscoverDataInput,
  companyId: string
): DiscoverUIState {
  const {
    hasAnyRuns,
    hasRunning,
    hasCompleted,
    selectedPath,
    packStarted,
    decideEligible,
  } = input;

  // Derive state
  const state = deriveDiscoverState(input);

  // Get visibility config
  const visibility = getVisibilityConfig(state);

  // Get CTAs
  const primaryCTA = getPrimaryCTA(state);
  const nextStepCTA = getNextStepCTA(state, decideEligible, companyId);

  // Get suggested pack
  const suggestedPack = getSuggestedPack(selectedPath);

  // Next Step panel visibility
  const showNextStepPanel = state === 'has_results' && decideEligible;

  return {
    state,
    showStartingPaths: visibility.startingPaths,
    showPackRunner: visibility.packRunner,
    showLabsGrid: visibility.labsGrid,
    showRecentRuns: visibility.recentRuns,
    showNextStepPanel,
    primaryCTA,
    nextStepCTA,
    suggestedPack,
    debug: {
      hasAnyRuns,
      hasRunning,
      hasCompleted,
      selectedPath,
      packStarted,
      decideEligible,
    },
  };
}

/**
 * Helper to check if a surface should be shown (not hidden)
 */
export function isVisible(visibility: SurfaceVisibility): boolean {
  return visibility !== 'hidden';
}

/**
 * Helper to check if a surface is primary
 */
export function isPrimary(visibility: SurfaceVisibility): boolean {
  return visibility === 'primary';
}
