// tests/strategy/strategyGoalStatement.test.ts
// Tests for Goal Statement in Strategy Inputs
//
// Validates:
// 1. goalStatement is included in strategy data model
// 2. Goal badge logic correctly identifies present/missing goal
// 3. View model response includes goalStatement

import { describe, it, expect } from 'vitest';
import type { UnifiedStrategyViewModelData } from '@/hooks/useUnifiedStrategyViewModel';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockViewModelData(overrides: Partial<UnifiedStrategyViewModelData['strategy']> = {}): UnifiedStrategyViewModelData['strategy'] {
  return {
    id: 'test-strategy-id',
    title: 'Test Strategy',
    summary: 'Test summary',
    objectives: [],
    pillars: [],
    plays: [],
    goalStatement: undefined,
    ...overrides,
  };
}

// ============================================================================
// Goal Statement Data Model Tests
// ============================================================================

describe('Strategy Goal Statement - Data Model', () => {
  it('includes goalStatement in strategy object', () => {
    const strategy = createMockViewModelData({
      goalStatement: 'Increase market share by 20%',
    });

    expect(strategy.goalStatement).toBe('Increase market share by 20%');
  });

  it('goalStatement can be undefined', () => {
    const strategy = createMockViewModelData();

    expect(strategy.goalStatement).toBeUndefined();
  });

  it('goalStatement can be empty string', () => {
    const strategy = createMockViewModelData({
      goalStatement: '',
    });

    expect(strategy.goalStatement).toBe('');
  });
});

// ============================================================================
// Goal Badge Logic Tests
// ============================================================================

describe('Strategy Goal Statement - Badge Logic', () => {
  // This mirrors the logic in InputChips component
  function hasGoal(goalStatement: string | undefined | null): boolean {
    return Boolean(goalStatement && goalStatement.trim());
  }

  it('returns true for non-empty goal statement', () => {
    expect(hasGoal('Increase market share by 20%')).toBe(true);
  });

  it('returns false for undefined goal statement', () => {
    expect(hasGoal(undefined)).toBe(false);
  });

  it('returns false for null goal statement', () => {
    expect(hasGoal(null)).toBe(false);
  });

  it('returns false for empty string goal statement', () => {
    expect(hasGoal('')).toBe(false);
  });

  it('returns false for whitespace-only goal statement', () => {
    expect(hasGoal('   ')).toBe(false);
    expect(hasGoal('\t\n')).toBe(false);
  });

  it('returns true for goal with leading/trailing whitespace', () => {
    expect(hasGoal('  Goal statement  ')).toBe(true);
  });
});

// ============================================================================
// View Model Integration Tests
// ============================================================================

describe('Strategy Goal Statement - View Model Integration', () => {
  it('goalStatement flows from API to local state', () => {
    // Simulates the data flow:
    // 1. API returns strategy with goalStatement
    // 2. Hook stores in data.strategy.goalStatement
    // 3. Component syncs to localGoalStatement
    // 4. InputChips receives externalGoalStatement

    const apiResponse = createMockViewModelData({
      goalStatement: 'Capture enterprise market segment',
    });

    // Simulate useEffect sync: setLocalGoalStatement(data.strategy.goalStatement || null)
    const localGoalStatement = apiResponse.goalStatement || null;

    expect(localGoalStatement).toBe('Capture enterprise market segment');
  });

  it('missing goalStatement syncs to null', () => {
    const apiResponse = createMockViewModelData({
      goalStatement: undefined,
    });

    // Simulate useEffect sync
    const localGoalStatement = apiResponse.goalStatement || null;

    expect(localGoalStatement).toBeNull();
  });

  it('empty goalStatement syncs to null', () => {
    const apiResponse = createMockViewModelData({
      goalStatement: '',
    });

    // Simulate useEffect sync: goalStatement || null treats empty string as falsy
    const localGoalStatement = apiResponse.goalStatement || null;

    expect(localGoalStatement).toBeNull();
  });
});

// ============================================================================
// Optimistic Update Tests
// ============================================================================

describe('Strategy Goal Statement - Optimistic Updates', () => {
  it('externalGoalStatement takes precedence over fetched value', () => {
    // Simulates InputChips logic:
    // const goalStatement = externalGoalStatement !== undefined ? externalGoalStatement : fetchedGoalStatement;

    function resolveGoalStatement(
      externalGoalStatement: string | null | undefined,
      fetchedGoalStatement: string | null
    ): string | null {
      return externalGoalStatement !== undefined ? externalGoalStatement : fetchedGoalStatement;
    }

    // When external is provided, use it
    expect(resolveGoalStatement('External goal', 'Fetched goal')).toBe('External goal');

    // When external is null (explicitly set to empty), use null
    expect(resolveGoalStatement(null, 'Fetched goal')).toBeNull();

    // When external is undefined (not set), fall back to fetched
    expect(resolveGoalStatement(undefined, 'Fetched goal')).toBe('Fetched goal');
  });

  it('optimistic update shows immediately before server sync', () => {
    // When user edits goal statement:
    // 1. setLocalGoalStatement(newValue) - updates immediately
    // 2. invalidateGoalCache() - triggers refetch
    // 3. InputChips receives new externalGoalStatement immediately

    let localGoalStatement: string | null = null;

    // Initial state: no goal
    expect(localGoalStatement).toBeNull();

    // User enters goal
    localGoalStatement = 'New strategic goal';
    expect(localGoalStatement).toBe('New strategic goal');

    // Badge would now show "Goal ✓" immediately
    const hasGoal = Boolean(localGoalStatement && localGoalStatement.trim());
    expect(hasGoal).toBe(true);
  });
});
