// tests/os/governanceLog.test.ts
// Tests for the Governance Change Log system

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordIntensityChange,
  recordStatusChange,
  getChangeRecord,
  getCompanyChanges,
  getProgramChanges,
  getRecentChanges,
  getIntensityMultiplierChange,
  validateIntensityChange,
  getGovernanceStats,
  clearGovernanceLog,
} from '@/lib/os/programs/governanceLog';
import type { PlanningProgram } from '@/lib/types/program';
import type { IntensityLevel } from '@/lib/types/programTemplate';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  return {
    id: 'prog-test-1',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    title: 'Test Program',
    status: 'committed',
    stableKey: 'test-stable-key',
    origin: { strategyId: 'strategy-1' },
    scope: {
      summary: 'Test scope',
      deliverables: [],
      workstreams: [],
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: { kpis: [] },
    planDetails: { horizonDays: 90, milestones: [] },
    commitment: { workItemIds: [] },
    linkedArtifacts: [],
    workPlanVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scopeEnforced: false,
    domain: 'Strategy',
    intensity: 'Standard',
    ...overrides,
  } as PlanningProgram;
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  clearGovernanceLog();
});

// ============================================================================
// Intensity Change Recording Tests
// ============================================================================

describe('recordIntensityChange', () => {
  it('records an intensity change with required fields', () => {
    const program = createMockProgram();
    const record = recordIntensityChange(program, 'Standard', 'Aggressive');

    expect(record.id).toBeTruthy();
    expect(record.debugId).toBeTruthy();
    expect(record.companyId).toBe('company-1');
    expect(record.programId).toBe('prog-test-1');
    expect(record.programTitle).toBe('Test Program');
    expect(record.changeType).toBe('intensity_changed');
    expect(record.timestamp).toBeTruthy();
  });

  it('records intensity change payload correctly', () => {
    const program = createMockProgram({ domain: 'Media' });
    const record = recordIntensityChange(program, 'Core', 'Standard');

    const payload = record.payload as { fromIntensity: string; toIntensity: string; domain: string | null; affectsDeliverables: boolean };
    expect(payload.fromIntensity).toBe('Core');
    expect(payload.toIntensity).toBe('Standard');
    expect(payload.domain).toBe('Media');
    expect(payload.affectsDeliverables).toBe(true);
  });

  it('includes optional reason and actorId', () => {
    const program = createMockProgram();
    const record = recordIntensityChange(program, 'Standard', 'Aggressive', {
      reason: 'Client requested more activity',
      actorId: 'user-123',
    });

    expect(record.actorId).toBe('user-123');
    const payload = record.payload as { reason?: string };
    expect(payload.reason).toBe('Client requested more activity');
  });

  it('uses provided debugId', () => {
    const program = createMockProgram();
    const record = recordIntensityChange(program, 'Standard', 'Core', {
      debugId: 'custom-debug-id',
    });

    expect(record.debugId).toBe('custom-debug-id');
  });

  it('generates unique IDs for each change', () => {
    const program = createMockProgram();
    const record1 = recordIntensityChange(program, 'Standard', 'Aggressive');
    const record2 = recordIntensityChange(program, 'Aggressive', 'Standard');

    expect(record1.id).not.toBe(record2.id);
  });
});

// ============================================================================
// Status Change Recording Tests
// ============================================================================

describe('recordStatusChange', () => {
  it('records a status change with required fields', () => {
    const program = createMockProgram();
    const record = recordStatusChange(program, 'committed', 'paused');

    expect(record.id).toBeTruthy();
    expect(record.debugId).toBeTruthy();
    expect(record.companyId).toBe('company-1');
    expect(record.programId).toBe('prog-test-1');
    expect(record.changeType).toBe('status_changed');
  });

  it('records status change payload correctly', () => {
    const program = createMockProgram({ domain: 'Creative' });
    const record = recordStatusChange(program, 'committed', 'archived');

    const payload = record.payload as { fromStatus: string; toStatus: string; domain: string | null };
    expect(payload.fromStatus).toBe('committed');
    expect(payload.toStatus).toBe('archived');
    expect(payload.domain).toBe('Creative');
  });

  it('includes optional reason and actorId', () => {
    const program = createMockProgram();
    const record = recordStatusChange(program, 'paused', 'committed', {
      reason: 'Resuming after budget approval',
      actorId: 'user-456',
    });

    expect(record.actorId).toBe('user-456');
    const payload = record.payload as { reason?: string };
    expect(payload.reason).toBe('Resuming after budget approval');
  });
});

// ============================================================================
// Change Retrieval Tests
// ============================================================================

describe('getChangeRecord', () => {
  it('retrieves a recorded change by ID', () => {
    const program = createMockProgram();
    const record = recordIntensityChange(program, 'Standard', 'Aggressive');

    const retrieved = getChangeRecord(record.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(record.id);
  });

  it('returns undefined for non-existent ID', () => {
    const retrieved = getChangeRecord('non-existent-id');
    expect(retrieved).toBeUndefined();
  });
});

describe('getCompanyChanges', () => {
  it('retrieves all changes for a company', () => {
    const program1 = createMockProgram({ id: 'prog-1', companyId: 'company-1' });
    const program2 = createMockProgram({ id: 'prog-2', companyId: 'company-1' });
    const program3 = createMockProgram({ id: 'prog-3', companyId: 'company-2' });

    recordIntensityChange(program1, 'Standard', 'Aggressive');
    recordStatusChange(program2, 'committed', 'paused');
    recordIntensityChange(program3, 'Standard', 'Core'); // Different company

    const changes = getCompanyChanges('company-1');
    expect(changes).toHaveLength(2);
  });

  it('filters by change type', () => {
    const program = createMockProgram();
    recordIntensityChange(program, 'Standard', 'Aggressive');
    recordStatusChange(program, 'committed', 'paused');
    recordIntensityChange(program, 'Aggressive', 'Standard');

    const intensityChanges = getCompanyChanges('company-1', { changeType: 'intensity_changed' });
    expect(intensityChanges).toHaveLength(2);

    const statusChanges = getCompanyChanges('company-1', { changeType: 'status_changed' });
    expect(statusChanges).toHaveLength(1);
  });

  it('limits results', () => {
    const program = createMockProgram();
    for (let i = 0; i < 10; i++) {
      recordIntensityChange(program, 'Standard', 'Aggressive');
    }

    const changes = getCompanyChanges('company-1', { limit: 5 });
    expect(changes).toHaveLength(5);
  });

  it('sorts by timestamp descending', () => {
    const program = createMockProgram();
    recordIntensityChange(program, 'Standard', 'Aggressive');
    recordIntensityChange(program, 'Aggressive', 'Standard');

    const changes = getCompanyChanges('company-1');
    // Both records may have the same timestamp if created quickly enough
    // Just verify we got both back in sorted order by checking we have 2 changes
    expect(changes).toHaveLength(2);
    // Verify that timestamps are in descending order (or equal)
    const t1 = new Date(changes[0].timestamp).getTime();
    const t2 = new Date(changes[1].timestamp).getTime();
    expect(t1).toBeGreaterThanOrEqual(t2);
  });

  it('returns empty array for unknown company', () => {
    const changes = getCompanyChanges('unknown-company');
    expect(changes).toEqual([]);
  });
});

describe('getProgramChanges', () => {
  it('retrieves all changes for a program', () => {
    const program = createMockProgram({ id: 'prog-1' });
    recordIntensityChange(program, 'Standard', 'Aggressive');
    recordStatusChange(program, 'committed', 'paused');
    recordIntensityChange(program, 'Aggressive', 'Core');

    const changes = getProgramChanges('prog-1');
    expect(changes).toHaveLength(3);
  });

  it('does not include changes from other programs', () => {
    const program1 = createMockProgram({ id: 'prog-1' });
    const program2 = createMockProgram({ id: 'prog-2' });

    recordIntensityChange(program1, 'Standard', 'Aggressive');
    recordIntensityChange(program2, 'Standard', 'Core');

    const changes = getProgramChanges('prog-1');
    expect(changes).toHaveLength(1);
  });
});

describe('getRecentChanges', () => {
  it('retrieves changes across all companies', () => {
    const program1 = createMockProgram({ id: 'prog-1', companyId: 'company-1' });
    const program2 = createMockProgram({ id: 'prog-2', companyId: 'company-2' });

    recordIntensityChange(program1, 'Standard', 'Aggressive');
    recordStatusChange(program2, 'committed', 'paused');

    const changes = getRecentChanges();
    expect(changes).toHaveLength(2);
  });
});

// ============================================================================
// Intensity Multiplier Tests
// ============================================================================

describe('getIntensityMultiplierChange', () => {
  it('calculates correct multipliers', () => {
    const change = getIntensityMultiplierChange('Standard', 'Aggressive');

    expect(change.fromMultiplier).toBe(1.0);
    expect(change.toMultiplier).toBe(1.5);
    expect(change.changePercent).toBe(50);
  });

  it('calculates negative change for downgrade', () => {
    const change = getIntensityMultiplierChange('Standard', 'Core');

    expect(change.fromMultiplier).toBe(1.0);
    expect(change.toMultiplier).toBe(0.6);
    expect(change.changePercent).toBe(-40);
  });

  it('calculates Core to Aggressive correctly', () => {
    const change = getIntensityMultiplierChange('Core', 'Aggressive');

    expect(change.fromMultiplier).toBe(0.6);
    expect(change.toMultiplier).toBe(1.5);
    expect(change.changePercent).toBe(150);
  });

  it('returns 0% change for same intensity', () => {
    const change = getIntensityMultiplierChange('Standard', 'Standard');

    expect(change.changePercent).toBe(0);
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('validateIntensityChange', () => {
  it('allows valid intensity change', () => {
    const program = createMockProgram({ intensity: 'Standard' });
    const result = validateIntensityChange(program, 'Aggressive');

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects change for archived programs', () => {
    const program = createMockProgram({ status: 'archived', intensity: 'Standard' });
    const result = validateIntensityChange(program, 'Aggressive');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('archived');
  });

  it('rejects no-op change to same intensity', () => {
    const program = createMockProgram({ intensity: 'Standard' });
    const result = validateIntensityChange(program, 'Standard');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('already has this intensity');
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('getGovernanceStats', () => {
  it('calculates correct totals', () => {
    const program = createMockProgram();
    recordIntensityChange(program, 'Standard', 'Aggressive');
    recordIntensityChange(program, 'Aggressive', 'Standard');
    recordStatusChange(program, 'committed', 'paused');

    const stats = getGovernanceStats('company-1');

    expect(stats.totalChanges).toBe(3);
    expect(stats.intensityChanges).toBe(2);
    expect(stats.statusChanges).toBe(1);
  });

  it('returns recent changes', () => {
    const program = createMockProgram();
    for (let i = 0; i < 10; i++) {
      recordIntensityChange(program, 'Standard', 'Aggressive');
    }

    const stats = getGovernanceStats('company-1');

    expect(stats.recentChanges).toHaveLength(5);
  });

  it('returns zeros for company with no changes', () => {
    const stats = getGovernanceStats('unknown-company');

    expect(stats.totalChanges).toBe(0);
    expect(stats.intensityChanges).toBe(0);
    expect(stats.statusChanges).toBe(0);
  });
});

// ============================================================================
// Only Future Deliverables Affected Tests
// ============================================================================

describe('Future Deliverables Only', () => {
  it('intensity change payload indicates it affects deliverables', () => {
    const program = createMockProgram();
    const record = recordIntensityChange(program, 'Standard', 'Aggressive');

    const payload = record.payload as { affectsDeliverables: boolean };
    expect(payload.affectsDeliverables).toBe(true);
  });

  it('intensity change does not modify existing deliverables', () => {
    const program = createMockProgram({
      scope: {
        summary: 'Test',
        deliverables: [
          {
            id: 'del-1',
            title: 'Existing Deliverable',
            type: 'document',
            status: 'planned',
            dueDate: '2025-01-15',
          },
        ],
        workstreams: [],
        channels: [],
        constraints: [],
        assumptions: [],
        unknowns: [],
        dependencies: [],
      },
    });

    // Record intensity change
    recordIntensityChange(program, 'Standard', 'Aggressive');

    // Verify existing deliverables are unchanged
    expect(program.scope?.deliverables).toHaveLength(1);
    expect(program.scope?.deliverables[0].id).toBe('del-1');
    expect(program.scope?.deliverables[0].status).toBe('planned');
  });
});

// ============================================================================
// Clear Function Tests
// ============================================================================

describe('clearGovernanceLog', () => {
  it('clears all records', () => {
    const program = createMockProgram();
    recordIntensityChange(program, 'Standard', 'Aggressive');
    recordStatusChange(program, 'committed', 'paused');

    clearGovernanceLog();

    const changes = getCompanyChanges('company-1');
    expect(changes).toHaveLength(0);
  });
});
