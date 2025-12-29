// tests/os/programArtifactPropagation.test.ts
// Tests for program artifact propagation to work items
//
// Tests:
// 1. Canonical relation type mapping
// 2. Propagation logic (which work item gets which artifact)

import { describe, it, expect } from 'vitest';
import {
  mapProgramLinkToCanonical,
  mapCanonicalToProgramLink,
  getProgramLinkTypeLabel,
  type ProgramArtifactLinkType,
  type CanonicalArtifactRelation,
} from '@/lib/types/program';

// ============================================================================
// Canonical Relation Mapping Tests
// ============================================================================

describe('Canonical Artifact Relation Mapping', () => {
  describe('mapProgramLinkToCanonical', () => {
    it('maps "output" to "produces"', () => {
      expect(mapProgramLinkToCanonical('output')).toBe('produces');
    });

    it('maps "input" to "requires"', () => {
      expect(mapProgramLinkToCanonical('input')).toBe('requires');
    });

    it('maps "reference" to "reference"', () => {
      expect(mapProgramLinkToCanonical('reference')).toBe('reference');
    });

    it('covers all program link types', () => {
      const allTypes: ProgramArtifactLinkType[] = ['output', 'input', 'reference'];
      for (const type of allTypes) {
        const result = mapProgramLinkToCanonical(type);
        expect(result).toBeDefined();
        expect(['produces', 'requires', 'reference']).toContain(result);
      }
    });
  });

  describe('mapCanonicalToProgramLink', () => {
    it('maps "produces" to "output"', () => {
      expect(mapCanonicalToProgramLink('produces')).toBe('output');
    });

    it('maps "requires" to "input"', () => {
      expect(mapCanonicalToProgramLink('requires')).toBe('input');
    });

    it('maps "reference" to "reference"', () => {
      expect(mapCanonicalToProgramLink('reference')).toBe('reference');
    });

    it('is the inverse of mapProgramLinkToCanonical', () => {
      const programTypes: ProgramArtifactLinkType[] = ['output', 'input', 'reference'];
      for (const type of programTypes) {
        const canonical = mapProgramLinkToCanonical(type);
        const backToProgram = mapCanonicalToProgramLink(canonical);
        expect(backToProgram).toBe(type);
      }
    });
  });

  describe('getProgramLinkTypeLabel', () => {
    it('returns "Output" for output type', () => {
      expect(getProgramLinkTypeLabel('output')).toBe('Output');
    });

    it('returns "Input" for input type', () => {
      expect(getProgramLinkTypeLabel('input')).toBe('Input');
    });

    it('returns "Reference" for reference type', () => {
      expect(getProgramLinkTypeLabel('reference')).toBe('Reference');
    });
  });
});

// ============================================================================
// Propagation Target Logic Tests
// ============================================================================

describe('Propagation Target Logic', () => {
  /**
   * The propagation logic determines which work item receives each artifact:
   * - produces (output): Last work item (final deliverable)
   * - requires (input): First work item (setup)
   * - reference: First work item
   *
   * These tests verify the target selection logic using pure functions.
   */

  interface MockWorkItem {
    id: string;
    title: string;
    index: number;
  }

  /**
   * Determine target work item based on relation type
   * This mirrors the logic in the propagate route
   */
  function getTargetWorkItem(
    relation: CanonicalArtifactRelation,
    workItems: MockWorkItem[]
  ): MockWorkItem | undefined {
    if (workItems.length === 0) return undefined;

    switch (relation) {
      case 'produces':
        // Output artifacts go to the last work item
        return workItems[workItems.length - 1];
      case 'requires':
      case 'reference':
      default:
        // Input and reference artifacts go to the first work item
        return workItems[0];
    }
  }

  const singleWorkItem: MockWorkItem[] = [
    { id: 'work-1', title: 'Only Work Item', index: 0 },
  ];

  const multipleWorkItems: MockWorkItem[] = [
    { id: 'work-1', title: 'Setup Work', index: 0 },
    { id: 'work-2', title: 'Middle Work', index: 1 },
    { id: 'work-3', title: 'Final Deliverable', index: 2 },
  ];

  describe('with single work item', () => {
    it('produces artifacts go to the single work item', () => {
      const target = getTargetWorkItem('produces', singleWorkItem);
      expect(target?.id).toBe('work-1');
    });

    it('requires artifacts go to the single work item', () => {
      const target = getTargetWorkItem('requires', singleWorkItem);
      expect(target?.id).toBe('work-1');
    });

    it('reference artifacts go to the single work item', () => {
      const target = getTargetWorkItem('reference', singleWorkItem);
      expect(target?.id).toBe('work-1');
    });
  });

  describe('with multiple work items', () => {
    it('produces artifacts go to the last work item', () => {
      const target = getTargetWorkItem('produces', multipleWorkItems);
      expect(target?.id).toBe('work-3');
      expect(target?.title).toBe('Final Deliverable');
    });

    it('requires artifacts go to the first work item', () => {
      const target = getTargetWorkItem('requires', multipleWorkItems);
      expect(target?.id).toBe('work-1');
      expect(target?.title).toBe('Setup Work');
    });

    it('reference artifacts go to the first work item', () => {
      const target = getTargetWorkItem('reference', multipleWorkItems);
      expect(target?.id).toBe('work-1');
      expect(target?.title).toBe('Setup Work');
    });
  });

  describe('with no work items', () => {
    it('returns undefined when no work items exist', () => {
      expect(getTargetWorkItem('produces', [])).toBeUndefined();
      expect(getTargetWorkItem('requires', [])).toBeUndefined();
      expect(getTargetWorkItem('reference', [])).toBeUndefined();
    });
  });
});

// ============================================================================
// Propagation Idempotency Concept Tests
// ============================================================================

describe('Propagation Idempotency Concept', () => {
  /**
   * The propagation endpoint relies on attachArtifactToWorkItem's upsert behavior:
   * - If artifact not attached: attach (new)
   * - If artifact already attached with same data: unchanged
   * - If artifact already attached with different data: updated
   *
   * These tests verify the counting logic.
   */

  type AttachAction = 'attached' | 'updated' | 'unchanged';

  interface PropagationResult {
    attached: number;
    updated: number;
    unchanged: number;
  }

  function countResults(actions: AttachAction[]): PropagationResult {
    return {
      attached: actions.filter(a => a === 'attached').length,
      updated: actions.filter(a => a === 'updated').length,
      unchanged: actions.filter(a => a === 'unchanged').length,
    };
  }

  it('counts fresh attachments correctly', () => {
    const actions: AttachAction[] = ['attached', 'attached', 'attached'];
    const result = countResults(actions);
    expect(result.attached).toBe(3);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
  });

  it('counts repeat propagation as unchanged', () => {
    const actions: AttachAction[] = ['unchanged', 'unchanged'];
    const result = countResults(actions);
    expect(result.attached).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(2);
  });

  it('counts mixed results correctly', () => {
    const actions: AttachAction[] = ['attached', 'unchanged', 'updated', 'attached'];
    const result = countResults(actions);
    expect(result.attached).toBe(2);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(1);
  });

  it('handles empty propagation', () => {
    const actions: AttachAction[] = [];
    const result = countResults(actions);
    expect(result.attached).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
  });
});

// ============================================================================
// Relation Type Round-Trip Tests
// ============================================================================

describe('Relation Type Round-Trip', () => {
  /**
   * Verify that program artifacts linked with 'output', 'input', or 'reference'
   * can be correctly mapped to canonical relations for work item attachment.
   */

  it('output → produces mapping is consistent', () => {
    // When a program artifact is linked as 'output'
    // It should be attached to work items with 'produces' relation
    const programLinkType: ProgramArtifactLinkType = 'output';
    const canonical = mapProgramLinkToCanonical(programLinkType);
    expect(canonical).toBe('produces');

    // The UI should still show 'Output' label
    const label = getProgramLinkTypeLabel(programLinkType);
    expect(label).toBe('Output');
  });

  it('input → requires mapping is consistent', () => {
    const programLinkType: ProgramArtifactLinkType = 'input';
    const canonical = mapProgramLinkToCanonical(programLinkType);
    expect(canonical).toBe('requires');

    const label = getProgramLinkTypeLabel(programLinkType);
    expect(label).toBe('Input');
  });

  it('reference → reference mapping is consistent', () => {
    const programLinkType: ProgramArtifactLinkType = 'reference';
    const canonical = mapProgramLinkToCanonical(programLinkType);
    expect(canonical).toBe('reference');

    const label = getProgramLinkTypeLabel(programLinkType);
    expect(label).toBe('Reference');
  });
});
