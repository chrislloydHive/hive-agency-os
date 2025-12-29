// tests/os/strategyEvolution.test.ts
// Tests for Strategy Evolution History & Diff Intelligence
//
// Tests cover:
// - Snapshot creation and hashing
// - Deterministic diff engine
// - Impact score calculation
// - Risk flag detection
// - Helper functions

import { describe, it, expect } from 'vitest';
import {
  createStrategySnapshot,
  stableStringifySnapshot,
  hashSnapshot,
  generateEvolutionEventId,
  generateVersionId,
  getRiskFlagLabel,
  getImpactScoreColorClass,
  getImpactScoreLabel,
  getTriggerColorClass,
  type StrategySnapshot,
  type SnapshotObjective,
  type SnapshotPillar,
  type SnapshotTactic,
} from '@/lib/types/strategyEvolution';
import {
  diffStrategySnapshots,
  snapshotsEqual,
  getSnapshotSummary,
} from '@/lib/os/strategy/evolution/diff';
import type { CompanyStrategy } from '@/lib/types/strategy';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestStrategy(overrides?: Partial<CompanyStrategy>): CompanyStrategy {
  return {
    id: 'strat_test',
    companyId: 'comp_test',
    title: 'Test Strategy',
    summary: 'A test strategy for unit tests',
    status: 'active',
    goalStatement: 'Increase market share by 20%',
    objectives: [
      { id: 'obj_1', text: 'Grow revenue', metric: 'Revenue', target: '$1M', status: 'active' },
      { id: 'obj_2', text: 'Expand market', metric: 'Markets', target: '5', status: 'active' },
    ],
    pillars: [
      { id: 'pillar_1', title: 'Brand Awareness', description: 'Build brand', priority: 'high', order: 0 },
      { id: 'pillar_2', title: 'Customer Acquisition', description: 'Get customers', priority: 'medium', order: 1 },
    ],
    plays: [
      { id: 'play_1', title: 'Launch campaign', description: 'Marketing campaign', status: 'active' },
      { id: 'play_2', title: 'Partner outreach', description: 'Find partners', status: 'proposed', channels: ['email', 'linkedin'] },
    ],
    strategyFrame: {
      audience: 'B2B SaaS companies',
      offering: 'Marketing automation',
      valueProp: 'Save time and money',
      positioning: 'Premium solution',
    },
    ...overrides,
  } as CompanyStrategy;
}

function createTestSnapshot(overrides?: Partial<StrategySnapshot>): StrategySnapshot {
  return {
    strategyId: 'strat_test',
    title: 'Test Strategy',
    summary: 'A test strategy',
    status: 'active',
    goalStatement: 'Increase market share',
    objectives: [
      { id: 'obj_1', text: 'Grow revenue' },
      { id: 'obj_2', text: 'Expand market' },
    ],
    pillars: [
      { id: 'pillar_1', title: 'Brand', description: 'Build brand', priority: 'high' },
    ],
    tactics: [
      { id: 'tactic_1', title: 'Campaign', description: 'Marketing' },
    ],
    ...overrides,
  };
}

// ============================================================================
// Snapshot Creation Tests
// ============================================================================

describe('createStrategySnapshot', () => {
  it('should create a snapshot from a strategy', () => {
    const strategy = createTestStrategy();
    const snapshot = createStrategySnapshot(strategy);

    expect(snapshot.strategyId).toBe('strat_test');
    expect(snapshot.title).toBe('Test Strategy');
    expect(snapshot.goalStatement).toBe('Increase market share by 20%');
    expect(snapshot.objectives).toHaveLength(2);
    expect(snapshot.pillars).toHaveLength(2);
    expect(snapshot.tactics).toHaveLength(2);
  });

  it('should sort objectives by id', () => {
    const strategy = createTestStrategy({
      objectives: [
        { id: 'obj_z', text: 'Z objective' },
        { id: 'obj_a', text: 'A objective' },
        { id: 'obj_m', text: 'M objective' },
      ],
    });
    const snapshot = createStrategySnapshot(strategy);

    expect(snapshot.objectives[0].id).toBe('obj_a');
    expect(snapshot.objectives[1].id).toBe('obj_m');
    expect(snapshot.objectives[2].id).toBe('obj_z');
  });

  it('should sort pillars by id', () => {
    const strategy = createTestStrategy({
      pillars: [
        { id: 'pillar_c', title: 'C', description: '', priority: 'low', order: 0 },
        { id: 'pillar_a', title: 'A', description: '', priority: 'high', order: 1 },
      ],
    });
    const snapshot = createStrategySnapshot(strategy);

    expect(snapshot.pillars[0].id).toBe('pillar_a');
    expect(snapshot.pillars[1].id).toBe('pillar_c');
  });

  it('should handle legacy string objectives', () => {
    const strategy = createTestStrategy({
      objectives: ['Legacy objective 1', 'Legacy objective 2'] as any,
    });
    const snapshot = createStrategySnapshot(strategy);

    expect(snapshot.objectives).toHaveLength(2);
    expect(snapshot.objectives[0].text).toBe('Legacy objective 1');
    expect(snapshot.objectives[0].id).toContain('legacy_');
  });

  it('should normalize frame fields', () => {
    const strategy = createTestStrategy({
      strategyFrame: {
        targetAudience: 'Target audience text',
        audience: undefined,
        primaryOffering: 'Primary offering text',
        valueProposition: 'Value prop text',
      },
    });
    const snapshot = createStrategySnapshot(strategy);

    expect(snapshot.frame?.audience).toBe('Target audience text');
    expect(snapshot.frame?.offering).toBe('Primary offering text');
    expect(snapshot.frame?.valueProp).toBe('Value prop text');
  });
});

// ============================================================================
// Snapshot Hashing Tests
// ============================================================================

describe('hashSnapshot', () => {
  it('should produce consistent hashes for identical snapshots', () => {
    const snapshot1 = createTestSnapshot();
    const snapshot2 = createTestSnapshot();

    const hash1 = hashSnapshot(snapshot1);
    const hash2 = hashSnapshot(snapshot2);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different snapshots', () => {
    const snapshot1 = createTestSnapshot({ goalStatement: 'Goal A' });
    const snapshot2 = createTestSnapshot({ goalStatement: 'Goal B' });

    const hash1 = hashSnapshot(snapshot1);
    const hash2 = hashSnapshot(snapshot2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce same hash regardless of object key order', () => {
    const snapshot1 = {
      strategyId: 'test',
      title: 'Test',
      summary: 'Summary',
      status: 'active',
      objectives: [],
      pillars: [],
      tactics: [],
    } as StrategySnapshot;

    const snapshot2 = {
      tactics: [],
      pillars: [],
      objectives: [],
      status: 'active',
      summary: 'Summary',
      title: 'Test',
      strategyId: 'test',
    } as StrategySnapshot;

    const hash1 = hashSnapshot(snapshot1);
    const hash2 = hashSnapshot(snapshot2);

    expect(hash1).toBe(hash2);
  });

  it('should return 16-character hex hash', () => {
    const snapshot = createTestSnapshot();
    const hash = hashSnapshot(snapshot);

    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

// ============================================================================
// Stable Stringify Tests
// ============================================================================

describe('stableStringifySnapshot', () => {
  it('should produce deterministic output', () => {
    const snapshot = createTestSnapshot();
    const str1 = stableStringifySnapshot(snapshot);
    const str2 = stableStringifySnapshot(snapshot);

    expect(str1).toBe(str2);
  });

  it('should sort object keys', () => {
    const snapshot = createTestSnapshot();
    const str = stableStringifySnapshot(snapshot);

    // The keys should be sorted alphabetically
    expect(str.indexOf('"goalStatement"')).toBeLessThan(str.indexOf('"objectives"'));
    expect(str.indexOf('"objectives"')).toBeLessThan(str.indexOf('"pillars"'));
  });
});

// ============================================================================
// Diff Engine Tests
// ============================================================================

describe('diffStrategySnapshots', () => {
  it('should detect no changes for identical snapshots', () => {
    const before = createTestSnapshot();
    const after = createTestSnapshot();

    const diff = diffStrategySnapshots(before, after);

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.modified).toBe(0);
    expect(diff.changes).toHaveLength(0);
    expect(diff.impactScore).toBe(0);
  });

  it('should detect goal statement change', () => {
    const before = createTestSnapshot({ goalStatement: 'Old goal' });
    const after = createTestSnapshot({ goalStatement: 'New goal' });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.modified).toBe(1);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].target).toBe('goalStatement');
    expect(diff.changes[0].type).toBe('modify');
    expect(diff.riskFlags).toContain('goal_changed');
  });

  it('should detect added objectives', () => {
    const before = createTestSnapshot({
      objectives: [{ id: 'obj_1', text: 'Existing' }],
    });
    const after = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'Existing' },
        { id: 'obj_2', text: 'New objective' },
      ],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.added).toBe(1);
    expect(diff.changes.some(c => c.type === 'add' && c.target === 'objectives')).toBe(true);
  });

  it('should detect removed objectives with risk flag', () => {
    const before = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'Keep' },
        { id: 'obj_2', text: 'Remove' },
      ],
    });
    const after = createTestSnapshot({
      objectives: [{ id: 'obj_1', text: 'Keep' }],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.removed).toBe(1);
    expect(diff.riskFlags).toContain('objective_removed');
  });

  it('should detect modified pillars (strategic bets)', () => {
    const before = createTestSnapshot({
      pillars: [{ id: 'p_1', title: 'Old title', description: 'Old desc', priority: 'medium' }],
    });
    const after = createTestSnapshot({
      pillars: [{ id: 'p_1', title: 'New title', description: 'Old desc', priority: 'medium' }],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.modified).toBe(1);
    expect(diff.changes.some(c => c.type === 'modify' && c.target === 'strategicBets')).toBe(true);
  });

  it('should flag high-priority pillar changes', () => {
    const before = createTestSnapshot({
      pillars: [{ id: 'p_1', title: 'Important', description: 'Desc', priority: 'high' }],
    });
    const after = createTestSnapshot({
      pillars: [{ id: 'p_1', title: 'Changed Important', description: 'Desc', priority: 'high' }],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.riskFlags).toContain('high_priority_pillar_changed');
  });

  it('should flag many tactics changes', () => {
    const before = createTestSnapshot({
      tactics: [
        { id: 't_1', title: 'T1' },
        { id: 't_2', title: 'T2' },
        { id: 't_3', title: 'T3' },
        { id: 't_4', title: 'T4' },
        { id: 't_5', title: 'T5' },
      ],
    });
    const after = createTestSnapshot({
      tactics: [], // Remove all 5
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.removed).toBe(5);
    expect(diff.riskFlags).toContain('many_tactics_changed');
  });

  it('should flag multiple objectives changed', () => {
    const before = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'A' },
        { id: 'obj_2', text: 'B' },
      ],
    });
    const after = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'Modified A' },
        { id: 'obj_2', text: 'Modified B' },
      ],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.modified).toBe(2);
    expect(diff.riskFlags).toContain('multiple_objectives_changed');
  });

  it('should detect frame changes', () => {
    const before = createTestSnapshot({
      frame: { audience: 'Old audience' },
    });
    const after = createTestSnapshot({
      frame: { audience: 'New audience' },
    });

    const diff = diffStrategySnapshots(before, after);

    // Frame changes are reported as their corresponding target (audience, valueProp, etc.)
    expect(diff.changes.some(c => c.target === 'audience')).toBe(true);
  });

  it('should flag significant frame changes', () => {
    const before = createTestSnapshot({
      frame: {
        audience: 'Old audience',
        offering: 'Old offering',
        valueProp: 'Old value prop',
      },
    });
    const after = createTestSnapshot({
      frame: {
        audience: 'New audience',
        offering: 'New offering',
        valueProp: 'New value prop',
      },
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.riskFlags).toContain('frame_significantly_changed');
  });
});

// ============================================================================
// Impact Score Tests
// ============================================================================

describe('impact score calculation', () => {
  it('should return 0 for no changes', () => {
    const snapshot = createTestSnapshot();
    const diff = diffStrategySnapshots(snapshot, snapshot);

    expect(diff.impactScore).toBe(0);
  });

  it('should weight goal changes higher', () => {
    const before = createTestSnapshot({ goalStatement: 'Old' });
    const after = createTestSnapshot({ goalStatement: 'New' });

    const diff = diffStrategySnapshots(before, after);

    // Goal changes have 3.0 weight, modify is 10 points, so 30/3 = 10
    expect(diff.impactScore).toBeGreaterThan(0);
    expect(diff.impactScore).toBeLessThanOrEqual(100);
  });

  it('should weight removals higher than additions', () => {
    // Add one objective
    const beforeAdd = createTestSnapshot({ objectives: [] });
    const afterAdd = createTestSnapshot({
      objectives: [{ id: 'obj_1', text: 'New' }],
    });

    // Remove one objective
    const beforeRemove = createTestSnapshot({
      objectives: [{ id: 'obj_1', text: 'Existing' }],
    });
    const afterRemove = createTestSnapshot({ objectives: [] });

    const addDiff = diffStrategySnapshots(beforeAdd, afterAdd);
    const removeDiff = diffStrategySnapshots(beforeRemove, afterRemove);

    expect(removeDiff.impactScore).toBeGreaterThan(addDiff.impactScore);
  });

  it('should cap impact score at 100', () => {
    // Create a massive change
    const before = createTestSnapshot({
      goalStatement: 'Old goal',
      objectives: Array.from({ length: 10 }, (_, i) => ({ id: `obj_${i}`, text: `Obj ${i}` })),
      pillars: Array.from({ length: 10 }, (_, i) => ({
        id: `p_${i}`,
        title: `P ${i}`,
        description: '',
        priority: 'high' as const,
      })),
      tactics: Array.from({ length: 10 }, (_, i) => ({ id: `t_${i}`, title: `T ${i}` })),
    });

    const after = createTestSnapshot({
      goalStatement: 'Completely new goal',
      objectives: [],
      pillars: [],
      tactics: [],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.impactScore).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('snapshotsEqual', () => {
  it('should return true for identical snapshots', () => {
    const a = createTestSnapshot();
    const b = createTestSnapshot();

    expect(snapshotsEqual(a, b)).toBe(true);
  });

  it('should return false for different snapshots', () => {
    const a = createTestSnapshot({ title: 'A' });
    const b = createTestSnapshot({ title: 'B' });

    expect(snapshotsEqual(a, b)).toBe(false);
  });
});

describe('getSnapshotSummary', () => {
  it('should return human-readable summary', () => {
    const snapshot = createTestSnapshot({
      objectives: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }],
      pillars: [{ id: '1', title: 'P', description: '', priority: 'high' }],
      tactics: [{ id: '1', title: 'T' }, { id: '2', title: 'T2' }, { id: '3', title: 'T3' }],
    });

    const summary = getSnapshotSummary(snapshot);

    expect(summary).toBe('2 objectives, 1 pillars, 3 tactics');
  });
});

describe('ID generators', () => {
  it('generateEvolutionEventId should produce unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateEvolutionEventId());
    }
    expect(ids.size).toBe(100);
  });

  it('generateVersionId should produce unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateVersionId());
    }
    expect(ids.size).toBe(100);
  });

  it('generateEvolutionEventId should have evo_ prefix', () => {
    const id = generateEvolutionEventId();
    expect(id.startsWith('evo_')).toBe(true);
  });

  it('generateVersionId should have ver_ prefix', () => {
    const id = generateVersionId();
    expect(id.startsWith('ver_')).toBe(true);
  });
});

describe('UI helper functions', () => {
  it('getRiskFlagLabel should return human-readable labels', () => {
    expect(getRiskFlagLabel('goal_changed')).toBe('Goal statement changed');
    expect(getRiskFlagLabel('objective_removed')).toBe('Objective removed');
    expect(getRiskFlagLabel('high_priority_pillar_changed')).toBe('High priority bet changed');
  });

  it('getImpactScoreColorClass should return appropriate colors', () => {
    expect(getImpactScoreColorClass(80)).toContain('red');
    expect(getImpactScoreColorClass(50)).toContain('amber');
    expect(getImpactScoreColorClass(20)).toContain('emerald');
  });

  it('getImpactScoreLabel should return appropriate labels', () => {
    expect(getImpactScoreLabel(80)).toBe('High Impact');
    expect(getImpactScoreLabel(50)).toBe('Medium Impact');
    expect(getImpactScoreLabel(20)).toBe('Low Impact');
  });

  it('getTriggerColorClass should return colors for all triggers', () => {
    expect(getTriggerColorClass('proposal')).toContain('purple');
    expect(getTriggerColorClass('rollback')).toContain('amber');
    expect(getTriggerColorClass('manual')).toContain('blue');
    expect(getTriggerColorClass('initial')).toContain('slate');
  });
});

// ============================================================================
// Diff Summary Generation Tests
// ============================================================================

describe('diff summary generation', () => {
  it('should generate accurate summary text', () => {
    const before = createTestSnapshot({
      objectives: [{ id: 'obj_1', text: 'Keep' }],
      tactics: [],
    });
    const after = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'Keep' },
        { id: 'obj_2', text: 'New' },
      ],
      tactics: [{ id: 't_1', title: 'New tactic' }],
    });

    const diff = diffStrategySnapshots(before, after);

    expect(diff.summary).toContain('added');
    expect(diff.summary).toContain('objectives');
    expect(diff.summary).toContain('tactics');
  });

  it('should report no changes detected for identical snapshots', () => {
    const snapshot = createTestSnapshot();
    const diff = diffStrategySnapshots(snapshot, snapshot);

    expect(diff.summary).toBe('No changes detected');
  });
});

// ============================================================================
// Phase 23.1 Hardening Tests
// ============================================================================

import {
  generateDeterministicEventId,
  generateDeterministicRollbackEventId,
} from '@/lib/types/strategyEvolution';

describe('deterministic event ID generation (idempotency)', () => {
  it('should produce identical IDs for same inputs', () => {
    const id1 = generateDeterministicEventId(
      'strat_123',
      'prop_456',
      'hash_before',
      'hash_after'
    );
    const id2 = generateDeterministicEventId(
      'strat_123',
      'prop_456',
      'hash_before',
      'hash_after'
    );

    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different inputs', () => {
    const id1 = generateDeterministicEventId(
      'strat_123',
      'prop_456',
      'hash_before',
      'hash_after'
    );
    const id2 = generateDeterministicEventId(
      'strat_123',
      'prop_789', // Different proposal
      'hash_before',
      'hash_after'
    );

    expect(id1).not.toBe(id2);
  });

  it('should handle undefined proposalId consistently', () => {
    const id1 = generateDeterministicEventId(
      'strat_123',
      undefined,
      'hash_before',
      'hash_after'
    );
    const id2 = generateDeterministicEventId(
      'strat_123',
      undefined,
      'hash_before',
      'hash_after'
    );

    expect(id1).toBe(id2);
  });

  it('should have evo_ prefix', () => {
    const id = generateDeterministicEventId(
      'strat_123',
      'prop_456',
      'hash_before',
      'hash_after'
    );

    expect(id.startsWith('evo_')).toBe(true);
    expect(id).toHaveLength(20); // evo_ + 16 hex chars
  });
});

describe('deterministic rollback event ID generation', () => {
  it('should produce identical IDs for same inputs', () => {
    const id1 = generateDeterministicRollbackEventId(
      'strat_123',
      'evo_original',
      'hash_before',
      'hash_after'
    );
    const id2 = generateDeterministicRollbackEventId(
      'strat_123',
      'evo_original',
      'hash_before',
      'hash_after'
    );

    expect(id1).toBe(id2);
  });

  it('should have evo_rb_ prefix', () => {
    const id = generateDeterministicRollbackEventId(
      'strat_123',
      'evo_original',
      'hash_before',
      'hash_after'
    );

    expect(id.startsWith('evo_rb_')).toBe(true);
    expect(id).toHaveLength(23); // evo_rb_ + 16 hex chars
  });

  it('should differ from regular event IDs with same hashes', () => {
    const regularId = generateDeterministicEventId(
      'strat_123',
      'evo_original', // Same as rollbackOfEventId below
      'hash_before',
      'hash_after'
    );
    const rollbackId = generateDeterministicRollbackEventId(
      'strat_123',
      'evo_original',
      'hash_before',
      'hash_after'
    );

    expect(regularId).not.toBe(rollbackId);
  });
});

describe('diff changes array stability', () => {
  it('should produce stable ordering regardless of input order', () => {
    // Create a snapshot that will produce changes in different orders
    const before = createTestSnapshot({
      goalStatement: 'Old goal',
      objectives: [
        { id: 'obj_z', text: 'Z objective' },
        { id: 'obj_a', text: 'A objective' },
      ],
      pillars: [
        { id: 'pillar_b', title: 'B pillar', description: '', priority: 'high' },
      ],
      tactics: [
        { id: 'tactic_m', title: 'M tactic' },
      ],
    });

    const after = createTestSnapshot({
      goalStatement: 'New goal', // Modified
      objectives: [
        { id: 'obj_z', text: 'Modified Z' }, // Modified
        { id: 'obj_a', text: 'Modified A' }, // Modified
        { id: 'obj_new', text: 'New obj' }, // Added
      ],
      pillars: [], // Removed pillar_b
      tactics: [
        { id: 'tactic_m', title: 'Modified M' }, // Modified
        { id: 'tactic_new', title: 'New tactic' }, // Added
      ],
    });

    const diff1 = diffStrategySnapshots(before, after);
    const diff2 = diffStrategySnapshots(before, after);

    // Both diffs should have identical ordering
    expect(diff1.changes.length).toBe(diff2.changes.length);
    for (let i = 0; i < diff1.changes.length; i++) {
      expect(diff1.changes[i].target).toBe(diff2.changes[i].target);
      expect(diff1.changes[i].path).toBe(diff2.changes[i].path);
      expect(diff1.changes[i].type).toBe(diff2.changes[i].type);
    }
  });

  it('should sort changes by target alphabetically first', () => {
    const before = createTestSnapshot({
      goalStatement: 'Old',
      tactics: [{ id: 't_1', title: 'Old tactic' }],
      objectives: [{ id: 'o_1', text: 'Old obj' }],
    });
    const after = createTestSnapshot({
      goalStatement: 'New',
      tactics: [{ id: 't_1', title: 'New tactic' }],
      objectives: [{ id: 'o_1', text: 'New obj' }],
    });

    const diff = diffStrategySnapshots(before, after);
    const targets = diff.changes.map(c => c.target);

    // Should be sorted alphabetically: goalStatement, objectives, tactics
    expect(targets.indexOf('goalStatement')).toBeLessThan(targets.indexOf('objectives'));
    expect(targets.indexOf('objectives')).toBeLessThan(targets.indexOf('tactics'));
  });

  it('should sort changes by path within same target', () => {
    const before = createTestSnapshot({
      objectives: [
        { id: 'obj_z', text: 'Z' },
        { id: 'obj_a', text: 'A' },
        { id: 'obj_m', text: 'M' },
      ],
    });
    const after = createTestSnapshot({
      objectives: [
        { id: 'obj_z', text: 'Modified Z' },
        { id: 'obj_a', text: 'Modified A' },
        { id: 'obj_m', text: 'Modified M' },
      ],
    });

    const diff = diffStrategySnapshots(before, after);
    const objChanges = diff.changes.filter(c => c.target === 'objectives');
    const paths = objChanges.map(c => c.path);

    // Should be sorted by path alphabetically
    expect(paths[0]).toBe('objectives[obj_a]');
    expect(paths[1]).toBe('objectives[obj_m]');
    expect(paths[2]).toBe('objectives[obj_z]');
  });
});

describe('risk flags stability', () => {
  it('should deduplicate risk flags', () => {
    // Create a scenario that might trigger duplicate flags
    const before = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'A' },
        { id: 'obj_2', text: 'B' },
        { id: 'obj_3', text: 'C' },
      ],
    });
    const after = createTestSnapshot({
      objectives: [
        { id: 'obj_1', text: 'Modified A' },
        { id: 'obj_2', text: 'Modified B' },
        // obj_3 removed - this should trigger both objective_removed AND multiple_objectives_changed
      ],
    });

    const diff = diffStrategySnapshots(before, after);

    // Check no duplicates
    const uniqueFlags = [...new Set(diff.riskFlags)];
    expect(diff.riskFlags.length).toBe(uniqueFlags.length);
  });

  it('should sort risk flags alphabetically', () => {
    const before = createTestSnapshot({
      goalStatement: 'Old goal',
      objectives: [
        { id: 'obj_1', text: 'A' },
        { id: 'obj_2', text: 'B' },
      ],
    });
    const after = createTestSnapshot({
      goalStatement: 'New goal', // Triggers goal_changed
      objectives: [
        { id: 'obj_1', text: 'Modified A' },
        // obj_2 removed - triggers objective_removed and multiple_objectives_changed
      ],
    });

    const diff = diffStrategySnapshots(before, after);

    // Should be sorted alphabetically
    const sortedFlags = [...diff.riskFlags].sort();
    expect(diff.riskFlags).toEqual(sortedFlags);
  });

  it('should produce stable risk flags across multiple runs', () => {
    const before = createTestSnapshot({
      goalStatement: 'Old',
      objectives: [{ id: 'o', text: 'A' }, { id: 'o2', text: 'B' }],
      pillars: [{ id: 'p', title: 'P', description: '', priority: 'high' }],
    });
    const after = createTestSnapshot({
      goalStatement: 'New',
      objectives: [{ id: 'o', text: 'Changed A' }], // Removed one, modified one
      pillars: [{ id: 'p', title: 'Changed P', description: '', priority: 'high' }],
    });

    const diff1 = diffStrategySnapshots(before, after);
    const diff2 = diffStrategySnapshots(before, after);

    expect(diff1.riskFlags).toEqual(diff2.riskFlags);
  });
});
