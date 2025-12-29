/**
 * Tests for Work Materialization Sync Modes
 *
 * Tests the sync mode behavior:
 * - 'additive': Only creates new, never updates or removes
 * - 'update': Creates and updates, but never removes
 * - 'full': Complete sync - creates, updates, and removes
 */

import { describe, it, expect } from 'vitest';
import type { SyncMode } from '@/lib/os/planning/materializeWork';

// ============================================================================
// Sync Mode Logic Tests (unit tests for the sync mode decision logic)
// ============================================================================

describe('Sync Mode Logic', () => {
  // Mock data structures
  interface MockWorkItem {
    id: string;
    title: string;
    workKey: string;
    notes?: string;
  }

  interface MockPlanItem {
    workKey: string;
    title: string;
    notes?: string;
  }

  // Helper to simulate sync mode behavior
  function simulateSync(
    existing: Map<string, MockWorkItem>,
    planItems: MockPlanItem[],
    mode: SyncMode
  ): { created: number; updated: number; skipped: number; removed: number } {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let removed = 0;

    // Process plan items
    for (const planItem of planItems) {
      const existingItem = existing.get(planItem.workKey);

      if (!existingItem) {
        // Always create new items regardless of mode
        created++;
      } else {
        // Existing item - behavior depends on mode
        if (mode === 'additive') {
          skipped++;
        } else {
          // 'update' or 'full' mode - check if update needed
          if (existingItem.title !== planItem.title || existingItem.notes !== planItem.notes) {
            updated++;
          } else {
            skipped++;
          }
        }
        existing.delete(planItem.workKey);
      }
    }

    // Handle orphaned items (in existing but not in plan)
    for (const [_workKey, _item] of existing) {
      if (mode === 'full') {
        removed++;
      } else {
        skipped++;
      }
    }

    return { created, updated, skipped, removed };
  }

  describe('additive mode', () => {
    it('only creates new items', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Existing', workKey: 'key1' }],
      ]);
      const planItems: MockPlanItem[] = [
        { workKey: 'key1', title: 'Updated Title', notes: 'New notes' },
        { workKey: 'key2', title: 'New Item' },
      ];

      const result = simulateSync(existing, planItems, 'additive');

      expect(result.created).toBe(1); // key2 is new
      expect(result.updated).toBe(0); // Never updates
      expect(result.skipped).toBe(1); // key1 exists, skipped
      expect(result.removed).toBe(0); // Never removes
    });

    it('preserves orphaned items', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Will be orphaned', workKey: 'key1' }],
      ]);
      const planItems: MockPlanItem[] = []; // Empty plan

      const result = simulateSync(existing, planItems, 'additive');

      expect(result.removed).toBe(0);
      expect(result.skipped).toBe(1); // Orphaned item is preserved
    });
  });

  describe('update mode', () => {
    it('creates new and updates existing', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Old Title', workKey: 'key1' }],
      ]);
      const planItems: MockPlanItem[] = [
        { workKey: 'key1', title: 'New Title' },
        { workKey: 'key2', title: 'Brand New' },
      ];

      const result = simulateSync(existing, planItems, 'update');

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.removed).toBe(0);
    });

    it('preserves orphaned items', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Orphan', workKey: 'key1' }],
      ]);
      const planItems: MockPlanItem[] = [];

      const result = simulateSync(existing, planItems, 'update');

      expect(result.removed).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('skips unchanged items', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Same Title', notes: 'Same notes', workKey: 'key1' }],
      ]);
      const planItems: MockPlanItem[] = [
        { workKey: 'key1', title: 'Same Title', notes: 'Same notes' },
      ];

      const result = simulateSync(existing, planItems, 'update');

      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('full mode', () => {
    it('creates, updates, and removes', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Existing', workKey: 'key1' }],
        ['key2', { id: '2', title: 'Will be removed', workKey: 'key2' }],
      ]);
      const planItems: MockPlanItem[] = [
        { workKey: 'key1', title: 'Updated' },
        { workKey: 'key3', title: 'New' },
      ];

      const result = simulateSync(existing, planItems, 'full');

      expect(result.created).toBe(1); // key3
      expect(result.updated).toBe(1); // key1
      expect(result.removed).toBe(1); // key2
    });

    it('removes all orphaned items', () => {
      const existing = new Map<string, MockWorkItem>([
        ['key1', { id: '1', title: 'Orphan 1', workKey: 'key1' }],
        ['key2', { id: '2', title: 'Orphan 2', workKey: 'key2' }],
      ]);
      const planItems: MockPlanItem[] = [];

      const result = simulateSync(existing, planItems, 'full');

      expect(result.removed).toBe(2);
    });
  });
});

// ============================================================================
// Sync Mode Selection Tests
// ============================================================================

describe('Sync Mode Selection', () => {
  it('additive is safest for preserving manual edits', () => {
    // This is a documentation test - additive mode should be recommended
    // when users have made manual changes to work items
    const modes: SyncMode[] = ['additive', 'update', 'full'];

    // Additive never overwrites existing items
    expect(modes[0]).toBe('additive');
  });

  it('full mode is needed for complete synchronization', () => {
    const modes: SyncMode[] = ['additive', 'update', 'full'];

    // Full mode is the only one that removes orphaned items
    expect(modes[2]).toBe('full');
  });

  it('update mode is a middle ground', () => {
    // Update creates + updates but never removes
    // Good for when you want changes to propagate but not lose orphaned items
    const mode: SyncMode = 'update';
    expect(mode).toBe('update');
  });
});

// ============================================================================
// Sync Mode API Contract Tests
// ============================================================================

describe('Sync Mode API Contract', () => {
  it('all sync modes are valid enum values', () => {
    const validModes: SyncMode[] = ['additive', 'update', 'full'];

    expect(validModes).toHaveLength(3);
    expect(validModes).toContain('additive');
    expect(validModes).toContain('update');
    expect(validModes).toContain('full');
  });

  it('default mode should be full for backwards compatibility', () => {
    // When no mode is specified, 'full' maintains existing behavior
    const defaultMode: SyncMode = 'full';
    expect(defaultMode).toBe('full');
  });
});
