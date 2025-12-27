// tests/os/discoverUiState.test.ts
// Unit tests for Discover UI state selector

import { describe, it, expect } from 'vitest';
import {
  deriveDiscoverState,
  getDiscoverUIState,
  isVisible,
  isPrimary,
  PATH_LABS,
  type DiscoverDataInput,
  type DiscoverState,
} from '@/lib/os/ui/discoverUiState';

// ============================================================================
// Test Helpers
// ============================================================================

function makeInput(overrides: Partial<DiscoverDataInput> = {}): DiscoverDataInput {
  return {
    hasAnyRuns: false,
    hasRunning: false,
    hasCompleted: false,
    selectedPath: null,
    packStarted: false,
    decideEligible: false,
    ...overrides,
  };
}

// ============================================================================
// State Derivation Tests
// ============================================================================

describe('deriveDiscoverState', () => {
  describe('empty_no_runs state', () => {
    it('returns empty_no_runs when no runs and no path selected', () => {
      const input = makeInput({
        hasAnyRuns: false,
        selectedPath: null,
      });
      expect(deriveDiscoverState(input)).toBe('empty_no_runs');
    });

    it('returns empty_no_runs as fallback when no clear state matches', () => {
      // Edge case: hasAnyRuns true but hasRunning and hasCompleted both false
      const input = makeInput({
        hasAnyRuns: true,
        hasRunning: false,
        hasCompleted: false,
        selectedPath: null,
      });
      expect(deriveDiscoverState(input)).toBe('empty_no_runs');
    });
  });

  describe('path_selected_not_started state', () => {
    it('returns path_selected_not_started when path selected but pack not started', () => {
      const input = makeInput({
        hasAnyRuns: false,
        selectedPath: 'baseline',
        packStarted: false,
      });
      expect(deriveDiscoverState(input)).toBe('path_selected_not_started');
    });

    it('returns path_selected_not_started for rfp path', () => {
      const input = makeInput({
        hasAnyRuns: false,
        selectedPath: 'rfp',
        packStarted: false,
      });
      expect(deriveDiscoverState(input)).toBe('path_selected_not_started');
    });

    it('returns path_selected_not_started for custom path', () => {
      const input = makeInput({
        hasAnyRuns: false,
        selectedPath: 'custom',
        packStarted: false,
      });
      expect(deriveDiscoverState(input)).toBe('path_selected_not_started');
    });
  });

  describe('running state', () => {
    it('returns running when hasRunning is true', () => {
      const input = makeInput({
        hasAnyRuns: true,
        hasRunning: true,
        hasCompleted: false,
      });
      expect(deriveDiscoverState(input)).toBe('running');
    });

    it('returns running even if hasCompleted is also true', () => {
      // Running takes priority over completed
      const input = makeInput({
        hasAnyRuns: true,
        hasRunning: true,
        hasCompleted: true,
      });
      expect(deriveDiscoverState(input)).toBe('running');
    });

    it('returns running with path selected', () => {
      const input = makeInput({
        hasAnyRuns: true,
        hasRunning: true,
        selectedPath: 'project',
        packStarted: true,
      });
      expect(deriveDiscoverState(input)).toBe('running');
    });
  });

  describe('has_results state', () => {
    it('returns has_results when hasCompleted is true and not running', () => {
      const input = makeInput({
        hasAnyRuns: true,
        hasRunning: false,
        hasCompleted: true,
      });
      expect(deriveDiscoverState(input)).toBe('has_results');
    });

    it('returns has_results after pack completes', () => {
      const input = makeInput({
        hasAnyRuns: true,
        hasRunning: false,
        hasCompleted: true,
        selectedPath: 'baseline',
        packStarted: true,
      });
      expect(deriveDiscoverState(input)).toBe('has_results');
    });
  });
});

// ============================================================================
// Visibility Matrix Tests
// ============================================================================

describe('getDiscoverUIState visibility matrix', () => {
  const companyId = 'test-company';

  describe('empty_no_runs visibility', () => {
    it('shows Starting Paths as primary', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showStartingPaths).toBe('primary');
    });

    it('hides Pack Runner', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showPackRunner).toBe('hidden');
    });

    it('shows Labs Grid as primary', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showLabsGrid).toBe('primary');
    });

    it('hides Recent Runs', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showRecentRuns).toBe('hidden');
    });

    it('hides Next Step Panel', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showNextStepPanel).toBe(false);
    });
  });

  describe('path_selected_not_started visibility', () => {
    it('shows Starting Paths as primary', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: 'baseline', packStarted: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showStartingPaths).toBe('primary');
    });

    it('shows Pack Runner as primary', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: 'baseline', packStarted: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showPackRunner).toBe('primary');
    });

    it('shows Labs Grid as secondary', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: 'baseline', packStarted: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showLabsGrid).toBe('secondary');
    });

    it('hides Recent Runs', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: 'baseline', packStarted: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showRecentRuns).toBe('hidden');
    });
  });

  describe('running visibility', () => {
    it('shows Starting Paths as secondary', () => {
      const input = makeInput({ hasAnyRuns: true, hasRunning: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showStartingPaths).toBe('secondary');
    });

    it('shows Pack Runner as primary', () => {
      const input = makeInput({ hasAnyRuns: true, hasRunning: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showPackRunner).toBe('primary');
    });

    it('shows Labs Grid as secondary', () => {
      const input = makeInput({ hasAnyRuns: true, hasRunning: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showLabsGrid).toBe('secondary');
    });

    it('shows Recent Runs as primary', () => {
      const input = makeInput({ hasAnyRuns: true, hasRunning: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showRecentRuns).toBe('primary');
    });

    it('hides Next Step Panel even if decideEligible', () => {
      const input = makeInput({ hasAnyRuns: true, hasRunning: true, decideEligible: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showNextStepPanel).toBe(false);
    });
  });

  describe('has_results visibility', () => {
    it('shows Starting Paths as secondary', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showStartingPaths).toBe('secondary');
    });

    it('hides Pack Runner', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showPackRunner).toBe('hidden');
    });

    it('shows Labs Grid as primary', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showLabsGrid).toBe('primary');
    });

    it('shows Recent Runs as primary', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showRecentRuns).toBe('primary');
    });

    it('shows Next Step Panel when decideEligible', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true, decideEligible: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showNextStepPanel).toBe(true);
    });

    it('hides Next Step Panel when not decideEligible', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true, decideEligible: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.showNextStepPanel).toBe(false);
    });
  });
});

// ============================================================================
// CTA Tests
// ============================================================================

describe('getDiscoverUIState CTAs', () => {
  const companyId = 'test-company';

  describe('primaryCTA', () => {
    it('returns select_path intent for empty_no_runs', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null });
      const state = getDiscoverUIState(input, companyId);

      expect(state.primaryCTA.intentKey).toBe('select_path');
      expect(state.primaryCTA.label).toBe('Choose a Starting Path');
    });

    it('returns start_pack intent for path_selected_not_started', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: 'project', packStarted: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.primaryCTA.intentKey).toBe('start_pack');
      expect(state.primaryCTA.label).toBe('Start Pack');
    });

    it('returns view_running intent for running', () => {
      const input = makeInput({ hasAnyRuns: true, hasRunning: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.primaryCTA.intentKey).toBe('view_running');
      expect(state.primaryCTA.label).toBe('View Progress');
    });

    it('returns run_more intent for has_results', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.primaryCTA.intentKey).toBe('run_more');
      expect(state.primaryCTA.label).toBe('Run More Labs');
    });
  });

  describe('nextStepCTA', () => {
    it('returns null when not in has_results state', () => {
      const input = makeInput({ hasAnyRuns: false, selectedPath: null, decideEligible: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.nextStepCTA).toBeNull();
    });

    it('returns null when in has_results but not decideEligible', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true, decideEligible: false });
      const state = getDiscoverUIState(input, companyId);

      expect(state.nextStepCTA).toBeNull();
    });

    it('returns Decide CTA when has_results and decideEligible', () => {
      const input = makeInput({ hasAnyRuns: true, hasCompleted: true, decideEligible: true });
      const state = getDiscoverUIState(input, companyId);

      expect(state.nextStepCTA).not.toBeNull();
      expect(state.nextStepCTA!.label).toBe('Review Context in Decide');
      expect(state.nextStepCTA!.href).toBe('/c/test-company/decide');
    });
  });
});

// ============================================================================
// Suggested Pack Tests
// ============================================================================

describe('getDiscoverUIState suggestedPack', () => {
  const companyId = 'test-company';

  it('returns null when no path selected', () => {
    const input = makeInput({ selectedPath: null });
    const state = getDiscoverUIState(input, companyId);

    expect(state.suggestedPack).toBeNull();
  });

  it('returns baseline pack with GAP', () => {
    const input = makeInput({ hasAnyRuns: false, selectedPath: 'baseline', packStarted: false });
    const state = getDiscoverUIState(input, companyId);

    expect(state.suggestedPack).not.toBeNull();
    expect(state.suggestedPack!.gap).toBe(true);
    expect(state.suggestedPack!.labs).toContain('gapPlan');
    expect(state.suggestedPack!.labs).toContain('websiteLab');
  });

  it('returns project pack without GAP', () => {
    const input = makeInput({ hasAnyRuns: false, selectedPath: 'project', packStarted: false });
    const state = getDiscoverUIState(input, companyId);

    expect(state.suggestedPack).not.toBeNull();
    expect(state.suggestedPack!.gap).toBe(false);
    expect(state.suggestedPack!.labs).toContain('websiteLab');
    expect(state.suggestedPack!.labs).not.toContain('gapPlan');
  });

  it('returns rfp pack without GAP', () => {
    const input = makeInput({ hasAnyRuns: false, selectedPath: 'rfp', packStarted: false });
    const state = getDiscoverUIState(input, companyId);

    expect(state.suggestedPack).not.toBeNull();
    expect(state.suggestedPack!.gap).toBe(false);
    expect(state.suggestedPack!.labs).toContain('brandLab');
    expect(state.suggestedPack!.labs).toContain('competitionLab');
  });

  it('returns empty pack for custom path', () => {
    const input = makeInput({ hasAnyRuns: false, selectedPath: 'custom', packStarted: false });
    const state = getDiscoverUIState(input, companyId);

    expect(state.suggestedPack).not.toBeNull();
    expect(state.suggestedPack!.labs).toHaveLength(0);
    expect(state.suggestedPack!.gap).toBe(false);
  });
});

// ============================================================================
// Debug Info Tests
// ============================================================================

describe('getDiscoverUIState debug info', () => {
  const companyId = 'test-company';

  it('includes all input values in debug', () => {
    const input = makeInput({
      hasAnyRuns: true,
      hasRunning: false,
      hasCompleted: true,
      selectedPath: 'baseline',
      packStarted: true,
      decideEligible: true,
    });
    const state = getDiscoverUIState(input, companyId);

    expect(state.debug.hasAnyRuns).toBe(true);
    expect(state.debug.hasRunning).toBe(false);
    expect(state.debug.hasCompleted).toBe(true);
    expect(state.debug.selectedPath).toBe('baseline');
    expect(state.debug.packStarted).toBe(true);
    expect(state.debug.decideEligible).toBe(true);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('visibility helpers', () => {
  describe('isVisible', () => {
    it('returns false for hidden', () => {
      expect(isVisible('hidden')).toBe(false);
    });

    it('returns true for secondary', () => {
      expect(isVisible('secondary')).toBe(true);
    });

    it('returns true for primary', () => {
      expect(isVisible('primary')).toBe(true);
    });
  });

  describe('isPrimary', () => {
    it('returns false for hidden', () => {
      expect(isPrimary('hidden')).toBe(false);
    });

    it('returns false for secondary', () => {
      expect(isPrimary('secondary')).toBe(false);
    });

    it('returns true for primary', () => {
      expect(isPrimary('primary')).toBe(true);
    });
  });
});

// ============================================================================
// PATH_LABS Constant Tests
// ============================================================================

describe('PATH_LABS constant', () => {
  it('baseline has gapPlan as primary', () => {
    expect(PATH_LABS.baseline.primaryLab).toBe('gapPlan');
  });

  it('baseline has expected recommended labs', () => {
    expect(PATH_LABS.baseline.recommendedLabs).toContain('websiteLab');
    expect(PATH_LABS.baseline.recommendedLabs).toContain('brandLab');
    expect(PATH_LABS.baseline.recommendedLabs).toContain('seoLab');
    expect(PATH_LABS.baseline.recommendedLabs).toContain('contentLab');
    expect(PATH_LABS.baseline.recommendedLabs).toContain('competitionLab');
  });

  it('project has websiteLab as primary', () => {
    expect(PATH_LABS.project.primaryLab).toBe('websiteLab');
  });

  it('rfp has brandLab as primary', () => {
    expect(PATH_LABS.rfp.primaryLab).toBe('brandLab');
  });

  it('custom has no primary lab', () => {
    expect(PATH_LABS.custom.primaryLab).toBeNull();
  });

  it('custom has empty recommended labs', () => {
    expect(PATH_LABS.custom.recommendedLabs).toHaveLength(0);
  });
});
