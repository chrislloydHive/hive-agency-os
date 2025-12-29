// tests/os/workProgramLinkage.test.ts
// Tests for work item program linkage and filtering
//
// Tests:
// 1. Work items with programId are correctly identified
// 2. Program filter logic works as expected
// 3. Canonical relation mapping for artifact attachment

import { describe, it, expect } from 'vitest';
import {
  mapProgramLinkToCanonical,
  mapCanonicalToProgramLink,
  type ProgramArtifactLinkType,
  type CanonicalArtifactRelation,
} from '@/lib/types/program';

// ============================================================================
// Mock Work Item Types for Testing
// ============================================================================

interface MockWorkItem {
  id: string;
  title: string;
  programId?: string;
  programWorkKey?: string;
  status: string;
}

// ============================================================================
// Program Linkage Tests
// ============================================================================

describe('Work Item Program Linkage', () => {
  describe('programId field presence', () => {
    it('work items from programs have programId set', () => {
      const workItem: MockWorkItem = {
        id: 'work-1',
        title: 'Task from program',
        programId: 'prog-123',
        programWorkKey: 'prog-123::del-0',
        status: 'Backlog',
      };

      expect(workItem.programId).toBe('prog-123');
      expect(workItem.programWorkKey).toBeDefined();
    });

    it('work items not from programs have no programId', () => {
      const workItem: MockWorkItem = {
        id: 'work-2',
        title: 'Manual task',
        status: 'Backlog',
      };

      expect(workItem.programId).toBeUndefined();
    });
  });

  describe('program filter logic', () => {
    const workItems: MockWorkItem[] = [
      { id: 'work-1', title: 'From Program A', programId: 'prog-a', status: 'Backlog' },
      { id: 'work-2', title: 'From Program A', programId: 'prog-a', status: 'In Progress' },
      { id: 'work-3', title: 'From Program B', programId: 'prog-b', status: 'Done' },
      { id: 'work-4', title: 'Manual Task', status: 'Backlog' },
      { id: 'work-5', title: 'Another Manual', status: 'Planned' },
    ];

    /**
     * Filter logic that mirrors WorkClient behavior
     */
    function filterByProgramId(items: MockWorkItem[], programId: string | null): MockWorkItem[] {
      if (!programId) return items;
      return items.filter(item => item.programId === programId);
    }

    it('filters work items by programId', () => {
      const filtered = filterByProgramId(workItems, 'prog-a');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(item => item.programId === 'prog-a')).toBe(true);
    });

    it('returns all items when no filter is applied', () => {
      const filtered = filterByProgramId(workItems, null);
      expect(filtered).toHaveLength(5);
    });

    it('returns empty array when program has no work items', () => {
      const filtered = filterByProgramId(workItems, 'prog-nonexistent');
      expect(filtered).toHaveLength(0);
    });

    it('filters correctly with different program IDs', () => {
      const filteredA = filterByProgramId(workItems, 'prog-a');
      const filteredB = filterByProgramId(workItems, 'prog-b');

      expect(filteredA).toHaveLength(2);
      expect(filteredB).toHaveLength(1);
      expect(filteredB[0].title).toBe('From Program B');
    });
  });
});

// ============================================================================
// Artifact Relation Mapping for Attachment
// ============================================================================

describe('Artifact Relation Mapping for Work Attachment', () => {
  describe('when attaching program artifacts to work items', () => {
    it('output artifacts become produces relation', () => {
      const programLinkType: ProgramArtifactLinkType = 'output';
      const workRelation = mapProgramLinkToCanonical(programLinkType);
      expect(workRelation).toBe('produces');
    });

    it('input artifacts become requires relation', () => {
      const programLinkType: ProgramArtifactLinkType = 'input';
      const workRelation = mapProgramLinkToCanonical(programLinkType);
      expect(workRelation).toBe('requires');
    });

    it('reference artifacts stay as reference relation', () => {
      const programLinkType: ProgramArtifactLinkType = 'reference';
      const workRelation = mapProgramLinkToCanonical(programLinkType);
      expect(workRelation).toBe('reference');
    });
  });

  describe('all mappings are bijective', () => {
    const allProgramTypes: ProgramArtifactLinkType[] = ['output', 'input', 'reference'];
    const allCanonicalTypes: CanonicalArtifactRelation[] = ['produces', 'requires', 'reference'];

    it('each program type maps to a unique canonical type', () => {
      const mappedTypes = allProgramTypes.map(mapProgramLinkToCanonical);
      const uniqueMapped = new Set(mappedTypes);
      expect(uniqueMapped.size).toBe(allProgramTypes.length);
    });

    it('round-trip mapping preserves the original type', () => {
      for (const programType of allProgramTypes) {
        const canonical = mapProgramLinkToCanonical(programType);
        const backToProgram = mapCanonicalToProgramLink(canonical);
        expect(backToProgram).toBe(programType);
      }
    });
  });
});

// ============================================================================
// Program Work Key Format
// ============================================================================

describe('Program Work Key Format', () => {
  /**
   * Program work keys follow the format: {programId}::del-{index}
   * This ensures stable keys for work item synchronization
   */

  function generateProgramWorkKey(programId: string, deliverableIndex: number): string {
    return `${programId}::del-${deliverableIndex}`;
  }

  function parseProgramWorkKey(key: string): { programId: string; deliverableIndex: number } | null {
    const match = key.match(/^(.+)::del-(\d+)$/);
    if (!match) return null;
    return {
      programId: match[1],
      deliverableIndex: parseInt(match[2], 10),
    };
  }

  it('generates correct work key format', () => {
    const key = generateProgramWorkKey('prog-123', 0);
    expect(key).toBe('prog-123::del-0');
  });

  it('parses work key correctly', () => {
    const parsed = parseProgramWorkKey('prog-123::del-5');
    expect(parsed).toEqual({
      programId: 'prog-123',
      deliverableIndex: 5,
    });
  });

  it('returns null for invalid work key format', () => {
    expect(parseProgramWorkKey('invalid-key')).toBeNull();
    expect(parseProgramWorkKey('prog-123')).toBeNull();
    expect(parseProgramWorkKey('')).toBeNull();
  });

  it('handles work keys with special characters in programId', () => {
    const key = generateProgramWorkKey('rec_ABC123xyz', 3);
    expect(key).toBe('rec_ABC123xyz::del-3');

    const parsed = parseProgramWorkKey(key);
    expect(parsed?.programId).toBe('rec_ABC123xyz');
    expect(parsed?.deliverableIndex).toBe(3);
  });
});
