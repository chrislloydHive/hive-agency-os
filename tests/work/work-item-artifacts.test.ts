// tests/work/work-item-artifacts.test.ts
// Tests for Work Item Artifact Attachment
//
// Covers:
// - Type helper functions for artifact attachment
// - WorkItemArtifact snapshot creation
// - Add/remove artifact operations

import { describe, it, expect } from 'vitest';
import {
  addArtifactToWorkItem,
  removeArtifactFromWorkItem,
  getAttachedArtifacts,
  isArtifactAttached,
  createArtifactSnapshot,
  type WorkItem,
  type WorkItemArtifact,
} from '@/lib/types/work';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'work-item-123',
    title: 'Test Work Item',
    status: 'Backlog',
    companyId: 'company-123',
    ...overrides,
  };
}

function createMockArtifactSnapshot(overrides: Partial<WorkItemArtifact> = {}): WorkItemArtifact {
  return {
    artifactId: 'artifact-123',
    artifactTypeId: 'strategy_doc',
    artifactTitle: 'Test Strategy Doc',
    artifactStatus: 'draft',
    attachedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// createArtifactSnapshot Tests
// ============================================================================

describe('createArtifactSnapshot', () => {
  it('creates snapshot with all required fields', () => {
    const snapshot = createArtifactSnapshot(
      'art-1',
      'brief_doc',
      'Creative Brief',
      'final'
    );

    expect(snapshot.artifactId).toBe('art-1');
    expect(snapshot.artifactTypeId).toBe('brief_doc');
    expect(snapshot.artifactTitle).toBe('Creative Brief');
    expect(snapshot.artifactStatus).toBe('final');
    expect(snapshot.attachedAt).toBeDefined();
    expect(snapshot.attachedBy).toBeUndefined();
  });

  it('includes attachedBy when provided', () => {
    const snapshot = createArtifactSnapshot(
      'art-1',
      'qbr_slides',
      'Q1 QBR',
      'draft',
      'user-456'
    );

    expect(snapshot.attachedBy).toBe('user-456');
  });

  it('sets attachedAt to current timestamp', () => {
    const before = new Date().toISOString();
    const snapshot = createArtifactSnapshot(
      'art-1',
      'strategy_doc',
      'Test',
      'draft'
    );
    const after = new Date().toISOString();

    expect(snapshot.attachedAt >= before).toBe(true);
    expect(snapshot.attachedAt <= after).toBe(true);
  });
});

// ============================================================================
// addArtifactToWorkItem Tests
// ============================================================================

describe('addArtifactToWorkItem', () => {
  it('adds artifact to empty array', () => {
    const artifact = createMockArtifactSnapshot();
    const result = addArtifactToWorkItem(undefined, artifact);

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('artifact-123');
  });

  it('adds artifact to existing array', () => {
    const existing = [createMockArtifactSnapshot({ artifactId: 'existing-1' })];
    const newArtifact = createMockArtifactSnapshot({ artifactId: 'new-2' });
    const result = addArtifactToWorkItem(existing, newArtifact);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.artifactId)).toContain('existing-1');
    expect(result.map(a => a.artifactId)).toContain('new-2');
  });

  it('does not add duplicate artifacts', () => {
    const artifact = createMockArtifactSnapshot({ artifactId: 'dup-1' });
    const existing = [artifact];
    const duplicate = createMockArtifactSnapshot({ artifactId: 'dup-1' });
    const result = addArtifactToWorkItem(existing, duplicate);

    expect(result).toHaveLength(1);
    expect(result).toBe(existing); // Returns same array reference
  });

  it('does not mutate original array', () => {
    const existing = [createMockArtifactSnapshot({ artifactId: 'existing-1' })];
    const newArtifact = createMockArtifactSnapshot({ artifactId: 'new-2' });
    const result = addArtifactToWorkItem(existing, newArtifact);

    expect(existing).toHaveLength(1);
    expect(result).not.toBe(existing);
  });
});

// ============================================================================
// removeArtifactFromWorkItem Tests
// ============================================================================

describe('removeArtifactFromWorkItem', () => {
  it('removes artifact from array', () => {
    const existing = [
      createMockArtifactSnapshot({ artifactId: 'art-1' }),
      createMockArtifactSnapshot({ artifactId: 'art-2' }),
    ];
    const result = removeArtifactFromWorkItem(existing, 'art-1');

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-2');
  });

  it('returns empty array when removing last artifact', () => {
    const existing = [createMockArtifactSnapshot({ artifactId: 'art-1' })];
    const result = removeArtifactFromWorkItem(existing, 'art-1');

    expect(result).toHaveLength(0);
  });

  it('returns same content when artifact not found', () => {
    const existing = [createMockArtifactSnapshot({ artifactId: 'art-1' })];
    const result = removeArtifactFromWorkItem(existing, 'not-found');

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('art-1');
  });

  it('handles undefined artifacts array', () => {
    const result = removeArtifactFromWorkItem(undefined, 'any-id');

    expect(result).toHaveLength(0);
  });

  it('does not mutate original array', () => {
    const existing = [
      createMockArtifactSnapshot({ artifactId: 'art-1' }),
      createMockArtifactSnapshot({ artifactId: 'art-2' }),
    ];
    const result = removeArtifactFromWorkItem(existing, 'art-1');

    expect(existing).toHaveLength(2);
    expect(result).not.toBe(existing);
  });
});

// ============================================================================
// getAttachedArtifacts Tests
// ============================================================================

describe('getAttachedArtifacts', () => {
  it('returns artifacts array when present', () => {
    const workItem = createMockWorkItem({
      artifacts: [
        createMockArtifactSnapshot({ artifactId: 'art-1' }),
        createMockArtifactSnapshot({ artifactId: 'art-2' }),
      ],
    });

    const result = getAttachedArtifacts(workItem);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no artifacts', () => {
    const workItem = createMockWorkItem();
    const result = getAttachedArtifacts(workItem);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array for undefined artifacts', () => {
    const workItem = createMockWorkItem({ artifacts: undefined });
    const result = getAttachedArtifacts(workItem);

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// isArtifactAttached Tests
// ============================================================================

describe('isArtifactAttached', () => {
  it('returns true when artifact is attached', () => {
    const workItem = createMockWorkItem({
      artifacts: [
        createMockArtifactSnapshot({ artifactId: 'art-1' }),
        createMockArtifactSnapshot({ artifactId: 'art-2' }),
      ],
    });

    expect(isArtifactAttached(workItem, 'art-1')).toBe(true);
    expect(isArtifactAttached(workItem, 'art-2')).toBe(true);
  });

  it('returns false when artifact is not attached', () => {
    const workItem = createMockWorkItem({
      artifacts: [createMockArtifactSnapshot({ artifactId: 'art-1' })],
    });

    expect(isArtifactAttached(workItem, 'not-attached')).toBe(false);
  });

  it('returns false when no artifacts', () => {
    const workItem = createMockWorkItem();

    expect(isArtifactAttached(workItem, 'any-id')).toBe(false);
  });
});

// ============================================================================
// WorkItemArtifact Type Tests
// ============================================================================

describe('WorkItemArtifact type', () => {
  it('accepts valid artifact statuses', () => {
    const draftArtifact = createMockArtifactSnapshot({ artifactStatus: 'draft' });
    const finalArtifact = createMockArtifactSnapshot({ artifactStatus: 'final' });
    const archivedArtifact = createMockArtifactSnapshot({ artifactStatus: 'archived' });

    expect(draftArtifact.artifactStatus).toBe('draft');
    expect(finalArtifact.artifactStatus).toBe('final');
    expect(archivedArtifact.artifactStatus).toBe('archived');
  });

  it('stores artifact type id', () => {
    const artifact = createMockArtifactSnapshot({
      artifactTypeId: 'media_plan',
    });

    expect(artifact.artifactTypeId).toBe('media_plan');
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('Artifact Attachment Scenarios', () => {
  it('tracks artifact at time of attachment (snapshot behavior)', () => {
    // Create artifact with draft status
    const snapshot = createArtifactSnapshot(
      'art-1',
      'strategy_doc',
      'My Strategy',
      'draft',
      'user-1'
    );

    // Add to work item
    const workItem = createMockWorkItem();
    const updatedArtifacts = addArtifactToWorkItem(workItem.artifacts, snapshot);

    // Verify snapshot preserves the status at time of attachment
    expect(updatedArtifacts[0].artifactStatus).toBe('draft');
    expect(updatedArtifacts[0].artifactTitle).toBe('My Strategy');
    expect(updatedArtifacts[0].attachedBy).toBe('user-1');
  });

  it('allows multiple artifacts of different types', () => {
    let artifacts: WorkItemArtifact[] = [];

    artifacts = addArtifactToWorkItem(
      artifacts,
      createMockArtifactSnapshot({ artifactId: 'doc-1', artifactTypeId: 'strategy_doc' })
    );
    artifacts = addArtifactToWorkItem(
      artifacts,
      createMockArtifactSnapshot({ artifactId: 'slides-1', artifactTypeId: 'qbr_slides' })
    );
    artifacts = addArtifactToWorkItem(
      artifacts,
      createMockArtifactSnapshot({ artifactId: 'brief-1', artifactTypeId: 'brief_doc' })
    );

    expect(artifacts).toHaveLength(3);
    expect(artifacts.map(a => a.artifactTypeId)).toEqual([
      'strategy_doc',
      'qbr_slides',
      'brief_doc',
    ]);
  });

  it('supports attach/detach workflow', () => {
    let artifacts: WorkItemArtifact[] = [];

    // Attach two artifacts
    artifacts = addArtifactToWorkItem(
      artifacts,
      createMockArtifactSnapshot({ artifactId: 'art-1' })
    );
    artifacts = addArtifactToWorkItem(
      artifacts,
      createMockArtifactSnapshot({ artifactId: 'art-2' })
    );
    expect(artifacts).toHaveLength(2);

    // Detach one
    artifacts = removeArtifactFromWorkItem(artifacts, 'art-1');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifactId).toBe('art-2');

    // Attach another
    artifacts = addArtifactToWorkItem(
      artifacts,
      createMockArtifactSnapshot({ artifactId: 'art-3' })
    );
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map(a => a.artifactId)).toEqual(['art-2', 'art-3']);
  });
});
