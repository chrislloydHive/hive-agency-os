// tests/artifacts/artifact-lifecycle.test.ts
// Tests for Artifact Lifecycle - Status transitions and validation
//
// Covers:
// - Valid status transitions
// - Invalid transition rejection
// - Immutability checks for final/archived artifacts
// - Validation helpers

import { describe, it, expect } from 'vitest';
import {
  isValidStatusTransition,
  getAllowedNextStatuses,
  getTransitionError,
  isArtifactImmutable,
  validateUpdateImmutability,
  validateArtifactUpdate,
  canFinalize,
  canArchive,
  canEditContent,
} from '@/lib/os/artifacts/lifecycle';
import type { ArtifactStatus, UpdateArtifactInput } from '@/lib/types/artifact';
import { createArtifact } from '@/tests/helpers/factories';

// Alias for cleaner test code
const createMockArtifact = createArtifact;

// ============================================================================
// isValidStatusTransition Tests
// ============================================================================

describe('isValidStatusTransition', () => {
  describe('from draft', () => {
    it('allows transition to final', () => {
      expect(isValidStatusTransition('draft', 'final')).toBe(true);
    });

    it('allows transition to archived', () => {
      expect(isValidStatusTransition('draft', 'archived')).toBe(true);
    });

    it('allows staying at draft', () => {
      expect(isValidStatusTransition('draft', 'draft')).toBe(true);
    });
  });

  describe('from final', () => {
    it('allows transition to archived', () => {
      expect(isValidStatusTransition('final', 'archived')).toBe(true);
    });

    it('allows staying at final', () => {
      expect(isValidStatusTransition('final', 'final')).toBe(true);
    });

    it('rejects transition to draft', () => {
      expect(isValidStatusTransition('final', 'draft')).toBe(false);
    });
  });

  describe('from archived', () => {
    it('allows staying at archived', () => {
      expect(isValidStatusTransition('archived', 'archived')).toBe(true);
    });

    it('rejects transition to draft', () => {
      expect(isValidStatusTransition('archived', 'draft')).toBe(false);
    });

    it('rejects transition to final', () => {
      expect(isValidStatusTransition('archived', 'final')).toBe(false);
    });
  });
});

// ============================================================================
// getAllowedNextStatuses Tests
// ============================================================================

describe('getAllowedNextStatuses', () => {
  it('returns final and archived for draft', () => {
    const allowed = getAllowedNextStatuses('draft');
    expect(allowed).toContain('final');
    expect(allowed).toContain('archived');
    expect(allowed).toHaveLength(2);
  });

  it('returns only archived for final', () => {
    const allowed = getAllowedNextStatuses('final');
    expect(allowed).toEqual(['archived']);
  });

  it('returns empty array for archived', () => {
    const allowed = getAllowedNextStatuses('archived');
    expect(allowed).toEqual([]);
  });
});

// ============================================================================
// getTransitionError Tests
// ============================================================================

describe('getTransitionError', () => {
  it('returns message for archived to any', () => {
    expect(getTransitionError('archived', 'draft')).toBe(
      'Archived artifacts cannot change status'
    );
  });

  it('returns message for final to draft', () => {
    expect(getTransitionError('final', 'draft')).toBe(
      'Final artifacts cannot be reverted to draft'
    );
  });

  it('returns generic message for other invalid transitions', () => {
    // Use type assertion to test edge case
    expect(getTransitionError('draft' as ArtifactStatus, 'unknown' as ArtifactStatus)).toContain(
      'Cannot transition from'
    );
  });
});

// ============================================================================
// isArtifactImmutable Tests
// ============================================================================

describe('isArtifactImmutable', () => {
  it('returns false for draft', () => {
    expect(isArtifactImmutable('draft')).toBe(false);
  });

  it('returns true for final', () => {
    expect(isArtifactImmutable('final')).toBe(true);
  });

  it('returns true for archived', () => {
    expect(isArtifactImmutable('archived')).toBe(true);
  });
});

// ============================================================================
// validateUpdateImmutability Tests
// ============================================================================

describe('validateUpdateImmutability', () => {
  describe('draft artifacts', () => {
    it('allows all updates', () => {
      const artifact = createMockArtifact({ status: 'draft' });
      const updates: UpdateArtifactInput = {
        title: 'New Title',
        generatedContent: { new: 'content' },
        generatedMarkdown: 'New markdown',
      };

      const result = validateUpdateImmutability(artifact, updates);
      expect(result.valid).toBe(true);
      expect(result.blockedFields).toHaveLength(0);
    });
  });

  describe('final artifacts', () => {
    it('blocks content updates', () => {
      const artifact = createMockArtifact({ status: 'final' });
      const updates: UpdateArtifactInput = {
        generatedContent: { new: 'content' },
      };

      const result = validateUpdateImmutability(artifact, updates);
      expect(result.valid).toBe(false);
      expect(result.blockedFields).toContain('generatedContent');
    });

    it('blocks title updates', () => {
      const artifact = createMockArtifact({ status: 'final' });
      const updates: UpdateArtifactInput = {
        title: 'New Title',
      };

      const result = validateUpdateImmutability(artifact, updates);
      expect(result.valid).toBe(false);
      expect(result.blockedFields).toContain('title');
    });

    it('blocks markdown updates', () => {
      const artifact = createMockArtifact({ status: 'final' });
      const updates: UpdateArtifactInput = {
        generatedMarkdown: 'New markdown',
      };

      const result = validateUpdateImmutability(artifact, updates);
      expect(result.valid).toBe(false);
      expect(result.blockedFields).toContain('generatedMarkdown');
    });

    it('allows staleness updates', () => {
      const artifact = createMockArtifact({ status: 'final' });
      const updates: UpdateArtifactInput = {
        isStale: true,
        stalenessReason: 'Context changed',
      };

      const result = validateUpdateImmutability(artifact, updates);
      expect(result.valid).toBe(true);
    });
  });

  describe('archived artifacts', () => {
    it('blocks all content updates', () => {
      const artifact = createMockArtifact({ status: 'archived' });
      const updates: UpdateArtifactInput = {
        title: 'New Title',
        generatedContent: { new: 'content' },
      };

      const result = validateUpdateImmutability(artifact, updates);
      expect(result.valid).toBe(false);
      expect(result.blockedFields).toContain('title');
      expect(result.blockedFields).toContain('generatedContent');
    });
  });
});

// ============================================================================
// validateArtifactUpdate Tests
// ============================================================================

describe('validateArtifactUpdate', () => {
  it('allows valid transition with no content changes', () => {
    const artifact = createMockArtifact({ status: 'draft' });
    const updates: UpdateArtifactInput = {
      status: 'final',
    };

    const result = validateArtifactUpdate(artifact, updates);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid transition', () => {
    const artifact = createMockArtifact({ status: 'archived' });
    const updates: UpdateArtifactInput = {
      status: 'draft',
    };

    const result = validateArtifactUpdate(artifact, updates);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Archived artifacts cannot change status');
  });

  it('rejects content updates on final artifacts', () => {
    const artifact = createMockArtifact({ status: 'final' });
    const updates: UpdateArtifactInput = {
      generatedContent: { new: 'content' },
    };

    const result = validateArtifactUpdate(artifact, updates);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Cannot modify');
  });

  it('allows archive transition with reason', () => {
    const artifact = createMockArtifact({ status: 'final' });
    const updates: UpdateArtifactInput = {
      status: 'archived',
      archivedReason: 'No longer needed',
      archivedAt: new Date().toISOString(),
      archivedBy: 'user-123',
    };

    const result = validateArtifactUpdate(artifact, updates);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// canFinalize Tests
// ============================================================================

describe('canFinalize', () => {
  it('allows finalizing draft artifacts', () => {
    const artifact = createMockArtifact({ status: 'draft' });
    const result = canFinalize(artifact);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects finalizing final artifacts', () => {
    const artifact = createMockArtifact({ status: 'final' });
    const result = canFinalize(artifact);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only draft artifacts can be finalized');
  });

  it('rejects finalizing archived artifacts', () => {
    const artifact = createMockArtifact({ status: 'archived' });
    const result = canFinalize(artifact);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only draft artifacts can be finalized');
  });
});

// ============================================================================
// canArchive Tests
// ============================================================================

describe('canArchive', () => {
  it('allows archiving draft artifacts', () => {
    const artifact = createMockArtifact({ status: 'draft' });
    const result = canArchive(artifact);
    expect(result.allowed).toBe(true);
  });

  it('allows archiving final artifacts', () => {
    const artifact = createMockArtifact({ status: 'final' });
    const result = canArchive(artifact);
    expect(result.allowed).toBe(true);
  });

  it('rejects archiving already archived artifacts', () => {
    const artifact = createMockArtifact({ status: 'archived' });
    const result = canArchive(artifact);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Artifact is already archived');
  });
});

// ============================================================================
// canEditContent Tests
// ============================================================================

describe('canEditContent', () => {
  it('allows editing draft artifacts', () => {
    const artifact = createMockArtifact({ status: 'draft' });
    const result = canEditContent(artifact);
    expect(result.allowed).toBe(true);
  });

  it('rejects editing final artifacts', () => {
    const artifact = createMockArtifact({ status: 'final' });
    const result = canEditContent(artifact);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Final artifacts cannot be edited');
  });

  it('rejects editing archived artifacts', () => {
    const artifact = createMockArtifact({ status: 'archived' });
    const result = canEditContent(artifact);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Archived artifacts cannot be edited');
  });
});
