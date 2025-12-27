// tests/os/tacticDefaults.test.ts
// Tests for tactic default selection logic

import { describe, test, expect } from 'vitest';
import {
  getDefaultSelectedTacticIds,
  isTacticDefaultSelected,
  groupTacticsByDefaultSelection,
  isTacticLive,
} from '@/lib/os/strategy/tacticDefaults';
import type { Tactic } from '@/lib/types/strategy';

// Helper to create mock tactics
function createMockTactic(
  id: string,
  status: Tactic['status'] | undefined
): Tactic {
  return {
    id,
    title: `Tactic ${id}`,
    description: 'Test tactic',
    linkedBetIds: [],
    isDerived: false,
    status,
  };
}

describe('tacticDefaults', () => {
  describe('getDefaultSelectedTacticIds', () => {
    test('returns active tactic IDs (ON by default)', () => {
      const tactics = [
        createMockTactic('t1', 'active'),
        createMockTactic('t2', 'proposed'),
        createMockTactic('t3', 'active'),
      ];

      const result = getDefaultSelectedTacticIds(tactics);

      expect(result).toEqual(['t1', 't3']);
    });

    test('returns completed tactic IDs (ON by default)', () => {
      const tactics = [
        createMockTactic('t1', 'completed'),
        createMockTactic('t2', 'proposed'),
        createMockTactic('t3', 'completed'),
      ];

      const result = getDefaultSelectedTacticIds(tactics);

      expect(result).toEqual(['t1', 't3']);
    });

    test('excludes proposed tactics (OFF by default)', () => {
      const tactics = [
        createMockTactic('t1', 'proposed'),
        createMockTactic('t2', 'proposed'),
      ];

      const result = getDefaultSelectedTacticIds(tactics);

      expect(result).toEqual([]);
    });

    test('excludes rejected tactics (OFF by default)', () => {
      const tactics = [
        createMockTactic('t1', 'rejected'),
        createMockTactic('t2', 'active'),
      ];

      const result = getDefaultSelectedTacticIds(tactics);

      expect(result).toEqual(['t2']);
    });

    test('excludes tactics without status (treated as proposed)', () => {
      const tactics = [
        createMockTactic('t1', undefined),
        createMockTactic('t2', 'active'),
      ];

      const result = getDefaultSelectedTacticIds(tactics);

      expect(result).toEqual(['t2']);
    });

    test('handles empty array', () => {
      const result = getDefaultSelectedTacticIds([]);

      expect(result).toEqual([]);
    });

    test('handles null/undefined input', () => {
      expect(getDefaultSelectedTacticIds(null as any)).toEqual([]);
      expect(getDefaultSelectedTacticIds(undefined as any)).toEqual([]);
    });

    test('handles mixed statuses correctly', () => {
      const tactics = [
        createMockTactic('t1', 'active'),
        createMockTactic('t2', 'proposed'),
        createMockTactic('t3', 'completed'),
        createMockTactic('t4', 'rejected'),
        createMockTactic('t5', undefined),
        createMockTactic('t6', 'active'),
      ];

      const result = getDefaultSelectedTacticIds(tactics);

      // Only active and completed should be selected
      expect(result).toEqual(['t1', 't3', 't6']);
    });
  });

  describe('isTacticDefaultSelected', () => {
    test('returns true for active status', () => {
      const tactic = createMockTactic('t1', 'active');
      expect(isTacticDefaultSelected(tactic)).toBe(true);
    });

    test('returns true for completed status', () => {
      const tactic = createMockTactic('t1', 'completed');
      expect(isTacticDefaultSelected(tactic)).toBe(true);
    });

    test('returns false for proposed status', () => {
      const tactic = createMockTactic('t1', 'proposed');
      expect(isTacticDefaultSelected(tactic)).toBe(false);
    });

    test('returns false for rejected status', () => {
      const tactic = createMockTactic('t1', 'rejected');
      expect(isTacticDefaultSelected(tactic)).toBe(false);
    });

    test('returns false for undefined status', () => {
      const tactic = createMockTactic('t1', undefined);
      expect(isTacticDefaultSelected(tactic)).toBe(false);
    });
  });

  describe('groupTacticsByDefaultSelection', () => {
    test('groups tactics by default selection state', () => {
      const tactics = [
        createMockTactic('t1', 'active'),
        createMockTactic('t2', 'proposed'),
        createMockTactic('t3', 'completed'),
        createMockTactic('t4', 'rejected'),
      ];

      const result = groupTacticsByDefaultSelection(tactics);

      expect(result.defaultOn.map(t => t.id)).toEqual(['t1', 't3']);
      expect(result.defaultOff.map(t => t.id)).toEqual(['t2', 't4']);
    });

    test('handles empty array', () => {
      const result = groupTacticsByDefaultSelection([]);

      expect(result.defaultOn).toEqual([]);
      expect(result.defaultOff).toEqual([]);
    });

    test('handles all active tactics', () => {
      const tactics = [
        createMockTactic('t1', 'active'),
        createMockTactic('t2', 'active'),
      ];

      const result = groupTacticsByDefaultSelection(tactics);

      expect(result.defaultOn.length).toBe(2);
      expect(result.defaultOff.length).toBe(0);
    });

    test('handles all proposed tactics', () => {
      const tactics = [
        createMockTactic('t1', 'proposed'),
        createMockTactic('t2', 'proposed'),
      ];

      const result = groupTacticsByDefaultSelection(tactics);

      expect(result.defaultOn.length).toBe(0);
      expect(result.defaultOff.length).toBe(2);
    });
  });

  describe('isTacticLive', () => {
    test('returns true for active status', () => {
      expect(isTacticLive('active')).toBe(true);
    });

    test('returns true for completed status', () => {
      expect(isTacticLive('completed')).toBe(true);
    });

    test('returns false for proposed status', () => {
      expect(isTacticLive('proposed')).toBe(false);
    });

    test('returns false for rejected status', () => {
      expect(isTacticLive('rejected')).toBe(false);
    });

    test('returns false for undefined status', () => {
      expect(isTacticLive(undefined)).toBe(false);
    });
  });
});
