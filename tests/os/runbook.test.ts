// tests/os/runbook.test.ts
// Tests for the Runbook (Weekly Operator Checklist) system

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWeekKey,
  isCurrentWeek,
  generateRunbookCompletionKey,
  getRunbookForIntensity,
  groupRunbookByDomain,
  markRunbookItemComplete,
  markRunbookItemSkipped,
  resetRunbookItem,
  getRunbookItemCompletion,
  getWeekCompletions,
  buildRunbookChecklist,
  calculateRunbookSummary,
  clearRunbookCompletions,
  CAR_TOYS_STANDARD_RUNBOOK,
  DOMAIN_DISPLAY_ORDER,
} from '@/lib/os/programs/runbook';

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  clearRunbookCompletions();
});

// ============================================================================
// Week Key Tests
// ============================================================================

describe('getWeekKey', () => {
  it('generates ISO week format', () => {
    const key = getWeekKey();
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('generates correct week for specific date', () => {
    // January 15, 2025 is week 3
    const date = new Date(2025, 0, 15);
    const key = getWeekKey(date);
    expect(key).toBe('2025-W03');
  });

  it('handles year boundary correctly', () => {
    // December 31, 2024 might be week 1 of 2025 depending on day
    const date = new Date(2024, 11, 30);
    const key = getWeekKey(date);
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('isCurrentWeek', () => {
  it('returns true for current week key', () => {
    const currentWeek = getWeekKey();
    expect(isCurrentWeek(currentWeek)).toBe(true);
  });

  it('returns false for different week', () => {
    expect(isCurrentWeek('2020-W01')).toBe(false);
  });
});

describe('generateRunbookCompletionKey', () => {
  it('generates expected format', () => {
    const key = generateRunbookCompletionKey('company-1', 'item-1', '2025-W03');
    expect(key).toBe('runbook:company-1:item-1:2025-W03');
  });

  it('produces unique keys for different companies', () => {
    const key1 = generateRunbookCompletionKey('company-1', 'item-1', '2025-W03');
    const key2 = generateRunbookCompletionKey('company-2', 'item-1', '2025-W03');
    expect(key1).not.toBe(key2);
  });
});

// ============================================================================
// Runbook Template Tests
// ============================================================================

describe('CAR_TOYS_STANDARD_RUNBOOK', () => {
  it('has items for all expected domains', () => {
    const domains = new Set(CAR_TOYS_STANDARD_RUNBOOK.map(item => item.domain));
    expect(domains.has('Media')).toBe(true);
    expect(domains.has('Creative')).toBe(true);
    expect(domains.has('LocalVisibility')).toBe(true);
    expect(domains.has('Analytics')).toBe(true);
    expect(domains.has('Operations')).toBe(true);
  });

  it('has media weekly items', () => {
    const mediaItems = CAR_TOYS_STANDARD_RUNBOOK.filter(i => i.domain === 'Media');
    expect(mediaItems.length).toBeGreaterThanOrEqual(5);
    expect(mediaItems.some(i => i.id === 'media-pmax-cycle')).toBe(true);
    expect(mediaItems.some(i => i.id === 'media-lsa-optimization')).toBe(true);
  });

  it('all items have unique IDs', () => {
    const ids = CAR_TOYS_STANDARD_RUNBOOK.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('getRunbookForIntensity', () => {
  it('returns all items for Standard intensity', () => {
    const items = getRunbookForIntensity('Standard');
    expect(items.length).toBe(CAR_TOYS_STANDARD_RUNBOOK.length);
  });

  it('returns fewer items for Core intensity', () => {
    const coreItems = getRunbookForIntensity('Core');
    const standardItems = getRunbookForIntensity('Standard');
    expect(coreItems.length).toBeLessThan(standardItems.length);
  });

  it('returns all items for Aggressive intensity', () => {
    const items = getRunbookForIntensity('Aggressive');
    expect(items.length).toBe(CAR_TOYS_STANDARD_RUNBOOK.length);
  });
});

describe('groupRunbookByDomain', () => {
  it('groups items correctly', () => {
    const grouped = groupRunbookByDomain(CAR_TOYS_STANDARD_RUNBOOK);

    expect(grouped.Media.length).toBeGreaterThan(0);
    expect(grouped.Creative.length).toBeGreaterThan(0);
    expect(grouped.Analytics.length).toBeGreaterThan(0);
  });

  it('includes all domains even if empty', () => {
    const grouped = groupRunbookByDomain([]);
    expect(Object.keys(grouped)).toHaveLength(6);
    expect(grouped.Strategy).toEqual([]);
  });
});

// ============================================================================
// Completion Tracking Tests
// ============================================================================

describe('markRunbookItemComplete', () => {
  it('creates a completion record', () => {
    const completion = markRunbookItemComplete('company-1', 'media-pmax-cycle');

    expect(completion.itemId).toBe('media-pmax-cycle');
    expect(completion.status).toBe('completed');
    expect(completion.completedAt).toBeTruthy();
  });

  it('includes optional fields when provided', () => {
    const completion = markRunbookItemComplete('company-1', 'media-pmax-cycle', {
      completedBy: 'user-1',
      notes: 'Reviewed all campaigns',
    });

    expect(completion.completedBy).toBe('user-1');
    expect(completion.notes).toBe('Reviewed all campaigns');
  });

  it('uses specified week key', () => {
    const completion = markRunbookItemComplete('company-1', 'media-pmax-cycle', {
      weekKey: '2025-W01',
    });

    expect(completion.weekKey).toBe('2025-W01');
  });

  it('is idempotent - overwrites previous completion', () => {
    markRunbookItemComplete('company-1', 'media-pmax-cycle', {
      notes: 'First',
    });
    const second = markRunbookItemComplete('company-1', 'media-pmax-cycle', {
      notes: 'Second',
    });

    expect(second.notes).toBe('Second');

    const retrieved = getRunbookItemCompletion('company-1', 'media-pmax-cycle');
    expect(retrieved?.notes).toBe('Second');
  });
});

describe('markRunbookItemSkipped', () => {
  it('creates a skipped record', () => {
    const completion = markRunbookItemSkipped('company-1', 'media-pmax-cycle', {
      notes: 'Client requested pause',
    });

    expect(completion.status).toBe('skipped');
    expect(completion.notes).toBe('Client requested pause');
  });
});

describe('resetRunbookItem', () => {
  it('removes the completion record', () => {
    markRunbookItemComplete('company-1', 'media-pmax-cycle');
    expect(getRunbookItemCompletion('company-1', 'media-pmax-cycle')).not.toBeNull();

    resetRunbookItem('company-1', 'media-pmax-cycle');
    expect(getRunbookItemCompletion('company-1', 'media-pmax-cycle')).toBeNull();
  });
});

describe('getWeekCompletions', () => {
  it('returns all completions for a week', () => {
    markRunbookItemComplete('company-1', 'item-1');
    markRunbookItemComplete('company-1', 'item-2');
    markRunbookItemSkipped('company-1', 'item-3');

    const completions = getWeekCompletions('company-1');
    expect(completions).toHaveLength(3);
  });

  it('filters by week', () => {
    markRunbookItemComplete('company-1', 'item-1', { weekKey: '2025-W01' });
    markRunbookItemComplete('company-1', 'item-2', { weekKey: '2025-W02' });

    const week1 = getWeekCompletions('company-1', '2025-W01');
    expect(week1).toHaveLength(1);
    expect(week1[0].itemId).toBe('item-1');
  });

  it('filters by company', () => {
    markRunbookItemComplete('company-1', 'item-1');
    markRunbookItemComplete('company-2', 'item-1');

    const completions = getWeekCompletions('company-1');
    expect(completions).toHaveLength(1);
  });
});

// ============================================================================
// Checklist Building Tests
// ============================================================================

describe('buildRunbookChecklist', () => {
  it('returns items with completion status', () => {
    const items = CAR_TOYS_STANDARD_RUNBOOK.slice(0, 3);
    markRunbookItemComplete('company-1', items[0].id);

    const checklist = buildRunbookChecklist('company-1', items);

    expect(checklist[0].status).toBe('completed');
    expect(checklist[1].status).toBe('pending');
    expect(checklist[2].status).toBe('pending');
  });

  it('includes completion metadata', () => {
    const items = [CAR_TOYS_STANDARD_RUNBOOK[0]];
    markRunbookItemComplete('company-1', items[0].id, {
      completedBy: 'user-1',
      notes: 'Done',
    });

    const checklist = buildRunbookChecklist('company-1', items);

    expect(checklist[0].completedBy).toBe('user-1');
    expect(checklist[0].notes).toBe('Done');
  });
});

// ============================================================================
// Summary Calculation Tests
// ============================================================================

describe('calculateRunbookSummary', () => {
  it('calculates correct totals', () => {
    const items = CAR_TOYS_STANDARD_RUNBOOK.slice(0, 5);
    markRunbookItemComplete('company-1', items[0].id);
    markRunbookItemComplete('company-1', items[1].id);
    markRunbookItemSkipped('company-1', items[2].id);

    const summary = calculateRunbookSummary('company-1', items);

    expect(summary.totalItems).toBe(5);
    expect(summary.completedItems).toBe(2);
    expect(summary.skippedItems).toBe(1);
    expect(summary.pendingItems).toBe(2);
  });

  it('calculates correct percentage', () => {
    const items = CAR_TOYS_STANDARD_RUNBOOK.slice(0, 4);
    markRunbookItemComplete('company-1', items[0].id);
    markRunbookItemComplete('company-1', items[1].id);

    const summary = calculateRunbookSummary('company-1', items);

    expect(summary.completionPercentage).toBe(50);
  });

  it('groups by domain correctly', () => {
    const summary = calculateRunbookSummary('company-1', CAR_TOYS_STANDARD_RUNBOOK);

    expect(summary.byDomain.Media.total).toBeGreaterThan(0);
    expect(summary.byDomain.Creative.total).toBeGreaterThan(0);
  });

  it('handles empty items', () => {
    const summary = calculateRunbookSummary('company-1', []);

    expect(summary.totalItems).toBe(0);
    expect(summary.completionPercentage).toBe(0);
  });
});

// ============================================================================
// Weekly Reset Tests
// ============================================================================

describe('Weekly Reset Behavior', () => {
  it('completions are scoped to specific week', () => {
    markRunbookItemComplete('company-1', 'item-1', { weekKey: '2025-W01' });

    // Current week should show as pending
    const currentWeek = getWeekKey();
    if (currentWeek !== '2025-W01') {
      const completion = getRunbookItemCompletion('company-1', 'item-1');
      expect(completion).toBeNull();
    }
  });

  it('previous week completions do not affect current week', () => {
    markRunbookItemComplete('company-1', 'item-1', { weekKey: '2020-W01' });

    const items = [{ id: 'item-1', title: 'Test', domain: 'Media' as const, cadence: 'weekly' as const }];
    const checklist = buildRunbookChecklist('company-1', items);

    // Should be pending for current week
    expect(checklist[0].status).toBe('pending');
  });
});
