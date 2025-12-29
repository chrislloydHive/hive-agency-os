// tests/artifacts/workItemArtifacts.test.ts
// Tests for work item artifact attachment logic
//
// Verifies:
// - Attach is idempotent (no duplicates)
// - Detach removes only the requested artifactId
// - Artifact snapshot creation
// - Attachment state checking

import { describe, it, expect } from 'vitest';
import {
  addArtifactToWorkItem,
  removeArtifactFromWorkItem,
  isArtifactAttached,
  createArtifactSnapshot,
  getAttachedArtifacts,
} from '@/lib/types/work';
import type { WorkItemArtifact, WorkItem } from '@/lib/types/work';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestArtifact(
  id: string,
  overrides: Partial<WorkItemArtifact> = {}
): WorkItemArtifact {
  return {
    artifactId: id,
    artifactTypeId: 'strategy_doc',
    artifactTitle: `Test Artifact ${id}`,
    artifactStatus: 'draft',
    relation: 'produces',
    attachedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestWorkItem(
  artifacts: WorkItemArtifact[] = []
): WorkItem {
  return {
    id: 'work-item-123',
    title: 'Test Work Item',
    status: 'Backlog',
    companyId: 'company-123',
    artifacts,
  };
}

// ============================================================================
// addArtifactToWorkItem Tests
// ============================================================================

describe('addArtifactToWorkItem', () => {
  it('adds artifact to empty array', () => {
    const artifact = createTestArtifact('art-1');
    const result = addArtifactToWorkItem([], artifact);

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-1');
  });

  it('adds artifact to undefined (treats as empty)', () => {
    const artifact = createTestArtifact('art-1');
    const result = addArtifactToWorkItem(undefined, artifact);

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-1');
  });

  it('adds artifact to existing array', () => {
    const existing = [createTestArtifact('art-1')];
    const newArtifact = createTestArtifact('art-2');
    const result = addArtifactToWorkItem(existing, newArtifact);

    expect(result).toHaveLength(2);
    expect(result[0].artifactId).toBe('art-1');
    expect(result[1].artifactId).toBe('art-2');
  });

  it('is idempotent - does not create duplicates', () => {
    const existing = [createTestArtifact('art-1')];
    const duplicate = createTestArtifact('art-1', { artifactTitle: 'Duplicate Title' });
    const result = addArtifactToWorkItem(existing, duplicate);

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-1');
    // Should keep original, not replace with duplicate
    expect(result[0].artifactTitle).toBe('Test Artifact art-1');
  });

  it('is idempotent - multiple adds of same artifact', () => {
    const artifact = createTestArtifact('art-1');

    let result = addArtifactToWorkItem([], artifact);
    result = addArtifactToWorkItem(result, artifact);
    result = addArtifactToWorkItem(result, artifact);

    expect(result).toHaveLength(1);
  });

  it('allows different artifacts with different IDs', () => {
    const art1 = createTestArtifact('art-1');
    const art2 = createTestArtifact('art-2');
    const art3 = createTestArtifact('art-3');

    let result = addArtifactToWorkItem([], art1);
    result = addArtifactToWorkItem(result, art2);
    result = addArtifactToWorkItem(result, art3);

    expect(result).toHaveLength(3);
    expect(result.map(a => a.artifactId)).toEqual(['art-1', 'art-2', 'art-3']);
  });

  it('does not mutate original array', () => {
    const original = [createTestArtifact('art-1')];
    const originalCopy = [...original];
    const newArtifact = createTestArtifact('art-2');

    addArtifactToWorkItem(original, newArtifact);

    expect(original).toEqual(originalCopy);
  });
});

// ============================================================================
// removeArtifactFromWorkItem Tests
// ============================================================================

describe('removeArtifactFromWorkItem', () => {
  it('removes only the specified artifact', () => {
    const artifacts = [
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
      createTestArtifact('art-3'),
    ];

    const result = removeArtifactFromWorkItem(artifacts, 'art-2');

    expect(result).toHaveLength(2);
    expect(result.map(a => a.artifactId)).toEqual(['art-1', 'art-3']);
  });

  it('removes first artifact correctly', () => {
    const artifacts = [
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
    ];

    const result = removeArtifactFromWorkItem(artifacts, 'art-1');

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-2');
  });

  it('removes last artifact correctly', () => {
    const artifacts = [
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
    ];

    const result = removeArtifactFromWorkItem(artifacts, 'art-2');

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-1');
  });

  it('returns empty array when removing only artifact', () => {
    const artifacts = [createTestArtifact('art-1')];

    const result = removeArtifactFromWorkItem(artifacts, 'art-1');

    expect(result).toHaveLength(0);
  });

  it('returns same array when artifact not found', () => {
    const artifacts = [
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
    ];

    const result = removeArtifactFromWorkItem(artifacts, 'art-999');

    expect(result).toHaveLength(2);
    expect(result.map(a => a.artifactId)).toEqual(['art-1', 'art-2']);
  });

  it('handles undefined input', () => {
    const result = removeArtifactFromWorkItem(undefined, 'art-1');

    expect(result).toEqual([]);
  });

  it('handles empty array input', () => {
    const result = removeArtifactFromWorkItem([], 'art-1');

    expect(result).toEqual([]);
  });

  it('does not mutate original array', () => {
    const original = [
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
    ];
    const originalCopy = [...original];

    removeArtifactFromWorkItem(original, 'art-1');

    expect(original).toEqual(originalCopy);
  });

  it('preserves artifact metadata when removing others', () => {
    const artifacts = [
      createTestArtifact('art-1', {
        artifactTitle: 'Strategy Doc',
        artifactStatus: 'final',
        attachedBy: 'user-123',
      }),
      createTestArtifact('art-2'),
    ];

    const result = removeArtifactFromWorkItem(artifacts, 'art-2');

    expect(result[0].artifactTitle).toBe('Strategy Doc');
    expect(result[0].artifactStatus).toBe('final');
    expect(result[0].attachedBy).toBe('user-123');
  });
});

// ============================================================================
// isArtifactAttached Tests
// ============================================================================

describe('isArtifactAttached', () => {
  it('returns true when artifact is attached', () => {
    const workItem = createTestWorkItem([createTestArtifact('art-1')]);

    expect(isArtifactAttached(workItem, 'art-1')).toBe(true);
  });

  it('returns false when artifact is not attached', () => {
    const workItem = createTestWorkItem([createTestArtifact('art-1')]);

    expect(isArtifactAttached(workItem, 'art-999')).toBe(false);
  });

  it('returns false for empty artifacts array', () => {
    const workItem = createTestWorkItem([]);

    expect(isArtifactAttached(workItem, 'art-1')).toBe(false);
  });

  it('returns false for undefined artifacts', () => {
    const workItem: WorkItem = {
      id: 'work-item-123',
      title: 'Test Work Item',
      status: 'Backlog',
      // artifacts is undefined
    };

    expect(isArtifactAttached(workItem, 'art-1')).toBe(false);
  });

  it('finds artifact among multiple', () => {
    const workItem = createTestWorkItem([
      createTestArtifact('art-1'),
      createTestArtifact('art-2'),
      createTestArtifact('art-3'),
    ]);

    expect(isArtifactAttached(workItem, 'art-2')).toBe(true);
  });
});

// ============================================================================
// getAttachedArtifacts Tests
// ============================================================================

describe('getAttachedArtifacts', () => {
  it('returns artifacts array', () => {
    const artifacts = [createTestArtifact('art-1'), createTestArtifact('art-2')];
    const workItem = createTestWorkItem(artifacts);

    const result = getAttachedArtifacts(workItem);

    expect(result).toHaveLength(2);
    expect(result).toEqual(artifacts);
  });

  it('returns empty array for undefined', () => {
    const workItem: WorkItem = {
      id: 'work-item-123',
      title: 'Test Work Item',
      status: 'Backlog',
    };

    const result = getAttachedArtifacts(workItem);

    expect(result).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    const workItem = createTestWorkItem([]);

    const result = getAttachedArtifacts(workItem);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// createArtifactSnapshot Tests
// ============================================================================

describe('createArtifactSnapshot', () => {
  it('creates snapshot with all required fields', () => {
    const snapshot = createArtifactSnapshot(
      'art-123',
      'strategy_doc',
      'My Strategy Doc',
      'draft'
    );

    expect(snapshot.artifactId).toBe('art-123');
    expect(snapshot.artifactTypeId).toBe('strategy_doc');
    expect(snapshot.artifactTitle).toBe('My Strategy Doc');
    expect(snapshot.artifactStatus).toBe('draft');
    expect(snapshot.attachedAt).toBeDefined();
    expect(new Date(snapshot.attachedAt).getTime()).toBeGreaterThan(0);
  });

  it('includes attachedBy when provided', () => {
    const snapshot = createArtifactSnapshot(
      'art-123',
      'strategy_doc',
      'My Strategy Doc',
      'final',
      'produces',
      'user-456'
    );

    expect(snapshot.attachedBy).toBe('user-456');
  });

  it('attachedBy is undefined when not provided', () => {
    const snapshot = createArtifactSnapshot(
      'art-123',
      'strategy_doc',
      'My Strategy Doc',
      'draft'
    );

    expect(snapshot.attachedBy).toBeUndefined();
  });

  it('handles all artifact statuses', () => {
    const statuses = ['draft', 'final', 'archived'] as const;

    for (const status of statuses) {
      const snapshot = createArtifactSnapshot('art-123', 'qbr_slides', 'Test', status);
      expect(snapshot.artifactStatus).toBe(status);
    }
  });

  it('handles different artifact types', () => {
    const types = ['strategy_doc', 'qbr_slides', 'brief_doc', 'media_plan', 'custom'];

    for (const type of types) {
      const snapshot = createArtifactSnapshot('art-123', type, 'Test', 'draft');
      expect(snapshot.artifactTypeId).toBe(type);
    }
  });
});

// ============================================================================
// Integration: Add then Remove
// ============================================================================

describe('Add/Remove Integration', () => {
  it('add then remove returns to original state', () => {
    const original = [createTestArtifact('art-1')];
    const newArtifact = createTestArtifact('art-2');

    const afterAdd = addArtifactToWorkItem(original, newArtifact);
    expect(afterAdd).toHaveLength(2);

    const afterRemove = removeArtifactFromWorkItem(afterAdd, 'art-2');
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].artifactId).toBe('art-1');
  });

  it('multiple adds and removes work correctly', () => {
    let artifacts: WorkItemArtifact[] = [];

    // Add 3 artifacts
    artifacts = addArtifactToWorkItem(artifacts, createTestArtifact('art-1'));
    artifacts = addArtifactToWorkItem(artifacts, createTestArtifact('art-2'));
    artifacts = addArtifactToWorkItem(artifacts, createTestArtifact('art-3'));
    expect(artifacts).toHaveLength(3);

    // Remove middle one
    artifacts = removeArtifactFromWorkItem(artifacts, 'art-2');
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map(a => a.artifactId)).toEqual(['art-1', 'art-3']);

    // Try to add art-1 again (should be no-op)
    artifacts = addArtifactToWorkItem(artifacts, createTestArtifact('art-1'));
    expect(artifacts).toHaveLength(2);

    // Add art-4
    artifacts = addArtifactToWorkItem(artifacts, createTestArtifact('art-4'));
    expect(artifacts).toHaveLength(3);
    expect(artifacts.map(a => a.artifactId)).toEqual(['art-1', 'art-3', 'art-4']);

    // Remove first
    artifacts = removeArtifactFromWorkItem(artifacts, 'art-1');
    expect(artifacts.map(a => a.artifactId)).toEqual(['art-3', 'art-4']);
  });

  it('removing non-existent artifact is safe', () => {
    let artifacts = [createTestArtifact('art-1')];

    artifacts = removeArtifactFromWorkItem(artifacts, 'art-999');
    artifacts = removeArtifactFromWorkItem(artifacts, 'art-998');

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifactId).toBe('art-1');
  });
});
