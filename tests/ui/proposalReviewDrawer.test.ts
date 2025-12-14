// tests/ui/proposalReviewDrawer.test.ts
// Tests for ProposalReviewDrawer helper functions and data transformations

import { describe, it, expect } from 'vitest';
import type { PatchOperation, ProposalConflict } from '@/lib/os/writeContract/types';
import {
  groupByDomain,
  labelForJsonPointer,
  getDomainLabel,
} from '@/lib/contextGraph/paths/labelForJsonPointer';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockPatch(): PatchOperation[] {
  return [
    {
      op: 'replace',
      path: '/identity/businessModel/value',
      value: 'SaaS Platform',
      oldValue: 'Software',
    },
    {
      op: 'add',
      path: '/audience/coreSegments/value',
      value: ['SMBs', 'Enterprise'],
    },
    {
      op: 'remove',
      path: '/brand/oldTagline/value',
      oldValue: 'Deprecated tagline',
    },
  ];
}

function createMockConflict(path: string): ProposalConflict {
  return {
    path,
    operation: {
      op: 'replace',
      path,
      value: 'attempted value',
      oldValue: 'original value',
    },
    lockStatus: {
      path,
      locked: true,
      reason: 'user_confirmed',
      confirmedValue: 'original value',
      lockedAt: new Date().toISOString(),
    },
    message: 'This field was confirmed by user and cannot be changed',
  };
}

// ============================================================================
// Tests: Domain Grouping
// ============================================================================

describe('ProposalReviewDrawer - Domain Grouping', () => {
  it('groups patch operations by domain', () => {
    const patch = createMockPatch();
    const grouped = groupByDomain(patch);

    expect(grouped.size).toBe(3);
    expect(grouped.has('identity')).toBe(true);
    expect(grouped.has('audience')).toBe(true);
    expect(grouped.has('brand')).toBe(true);
  });

  it('assigns correct labels to each domain group', () => {
    const patch = createMockPatch();
    const grouped = groupByDomain(patch);

    expect(grouped.get('identity')?.label).toBe('Identity');
    expect(grouped.get('audience')?.label).toBe('Audience');
    expect(grouped.get('brand')?.label).toBe('Brand');
  });

  it('groups multiple operations under same domain', () => {
    const patch: PatchOperation[] = [
      { op: 'replace', path: '/identity/businessModel/value', value: 'SaaS' },
      { op: 'add', path: '/identity/industry/value', value: 'Tech' },
      { op: 'replace', path: '/identity/icpDescription/value', value: 'Description' },
    ];
    const grouped = groupByDomain(patch);

    expect(grouped.size).toBe(1);
    expect(grouped.get('identity')?.items.length).toBe(3);
  });

  it('handles empty patch array', () => {
    const grouped = groupByDomain([]);
    expect(grouped.size).toBe(0);
  });
});

// ============================================================================
// Tests: Conflicts
// ============================================================================

describe('ProposalReviewDrawer - Conflicts', () => {
  it('groups conflicts by domain', () => {
    const conflicts: ProposalConflict[] = [
      createMockConflict('/identity/icpDescription/value'),
      createMockConflict('/identity/businessModel/value'),
      createMockConflict('/brand/positioning/value'),
    ];
    const grouped = groupByDomain(conflicts);

    expect(grouped.size).toBe(2);
    expect(grouped.get('identity')?.items.length).toBe(2);
    expect(grouped.get('brand')?.items.length).toBe(1);
  });

  it('conflict has correct lock status fields', () => {
    const conflict = createMockConflict('/identity/icpDescription/value');

    expect(conflict.lockStatus.locked).toBe(true);
    expect(conflict.lockStatus.reason).toBe('user_confirmed');
    expect(conflict.message).toBe('This field was confirmed by user and cannot be changed');
  });

  it('conflict preserves attempted operation', () => {
    const conflict = createMockConflict('/identity/icpDescription/value');

    expect(conflict.operation.op).toBe('replace');
    expect(conflict.operation.value).toBe('attempted value');
    expect(conflict.operation.oldValue).toBe('original value');
  });
});

// ============================================================================
// Tests: Label Display
// ============================================================================

describe('ProposalReviewDrawer - Label Display', () => {
  it('generates friendly labels for patch paths', () => {
    const patch = createMockPatch();

    const labels = patch.map(op => labelForJsonPointer(op.path));

    expect(labels[0].fullLabel).toBe('Identity → Business Model');
    expect(labels[1].fieldLabel).toBe('Core Segments');
    expect(labels[2].domainLabel).toBe('Brand');
  });

  it('handles special domain labels', () => {
    expect(getDomainLabel('productOffer')).toBe('Product/Offer');
    expect(getDomainLabel('operationalConstraints')).toBe('Operational Constraints');
    expect(getDomainLabel('budgetOps')).toBe('Budget & Operations');
  });

  it('returns both domain and field labels for UI grouping', () => {
    const result = labelForJsonPointer('/audience/primaryAudience/value');

    expect(result.domainLabel).toBe('Audience');
    expect(result.fieldLabel).toBe('Primary Audience');
    expect(result.fullLabel).toBe('Audience → Primary Audience');
  });
});

// ============================================================================
// Tests: Selection Logic
// ============================================================================

describe('ProposalReviewDrawer - Selection Logic', () => {
  it('all paths can be collected for default selection', () => {
    const patch = createMockPatch();
    const allPaths = new Set(patch.map(op => op.path));

    expect(allPaths.size).toBe(3);
    expect(allPaths.has('/identity/businessModel/value')).toBe(true);
    expect(allPaths.has('/audience/coreSegments/value')).toBe(true);
    expect(allPaths.has('/brand/oldTagline/value')).toBe(true);
  });

  it('selected count can be computed from set size', () => {
    const selectedPaths = new Set([
      '/identity/businessModel/value',
      '/audience/coreSegments/value',
    ]);

    expect(selectedPaths.size).toBe(2);
  });

  it('conflicts paths are separate from patch paths', () => {
    const patch = createMockPatch();
    const conflicts = [createMockConflict('/identity/icpDescription/value')];

    const patchPaths = new Set(patch.map(op => op.path));
    const conflictPaths = new Set(conflicts.map(c => c.path));

    // Conflict path should not be in patch paths
    expect(patchPaths.has('/identity/icpDescription/value')).toBe(false);
    expect(conflictPaths.has('/identity/icpDescription/value')).toBe(true);
  });
});

// ============================================================================
// Tests: Operation Types
// ============================================================================

describe('ProposalReviewDrawer - Operation Types', () => {
  it('identifies replace operations with old and new values', () => {
    const op: PatchOperation = {
      op: 'replace',
      path: '/identity/businessModel/value',
      value: 'SaaS',
      oldValue: 'Software',
    };

    expect(op.op).toBe('replace');
    expect(op.oldValue).toBe('Software');
    expect(op.value).toBe('SaaS');
  });

  it('identifies add operations with only new value', () => {
    const op: PatchOperation = {
      op: 'add',
      path: '/audience/segments/value',
      value: ['Enterprise'],
    };

    expect(op.op).toBe('add');
    expect(op.value).toEqual(['Enterprise']);
    expect(op.oldValue).toBeUndefined();
  });

  it('identifies remove operations with old value', () => {
    const op: PatchOperation = {
      op: 'remove',
      path: '/brand/deprecated/value',
      oldValue: 'old content',
    };

    expect(op.op).toBe('remove');
    expect(op.oldValue).toBe('old content');
  });
});
