// tests/plans/planDiff.test.ts
// Tests for Plan Diff utility

import { describe, it, expect } from 'vitest';
import {
  computePlanDiff,
  getDiffSummary,
  type PlanDiff,
} from '@/lib/os/plans/diff/planDiff';
import type { MediaPlan, ContentPlan } from '@/lib/types/plan';
import { createDefaultMediaPlanSections, createDefaultContentPlanSections } from '@/lib/types/plan';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockMediaPlan(overrides: Partial<MediaPlan> = {}): MediaPlan {
  return {
    id: 'plan-1',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    status: 'approved',
    version: 1,
    sourceSnapshot: {
      contextHash: 'abc123',
      strategyHash: 'def456',
      contextConfirmedAt: null,
      strategyLockedAt: null,
    },
    sections: createDefaultMediaPlanSections(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockContentPlan(overrides: Partial<ContentPlan> = {}): ContentPlan {
  return {
    id: 'plan-2',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    status: 'approved',
    version: 1,
    sourceSnapshot: {
      contextHash: 'abc123',
      strategyHash: 'def456',
      contextConfirmedAt: null,
      strategyLockedAt: null,
    },
    sections: createDefaultContentPlanSections(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// New Plan Tests (no approved plan)
// ============================================================================

describe('computePlanDiff - New Plan', () => {
  it('detects new media plan when no approved plan exists', () => {
    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'Increase brand awareness',
          executiveSummary: 'Test summary',
          assumptions: ['Assumption 1'],
        },
      },
    });

    const diff = computePlanDiff(null, proposed);

    expect(diff.isNewPlan).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.planType).toBe('media');
  });

  it('detects new content plan when no approved plan exists', () => {
    const proposed = createMockContentPlan({
      sections: {
        ...createDefaultContentPlanSections(),
        summary: {
          goalStatement: 'Build thought leadership',
          editorialThesis: 'Test thesis',
          voiceGuidance: 'Professional',
        },
        pillars: [
          { id: '1', pillar: 'Education', why: 'Test', targetIntents: [], proofPoints: [] },
        ],
      },
    });

    const diff = computePlanDiff(null, proposed);

    expect(diff.isNewPlan).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.planType).toBe('content');
  });

  it('shows all sections as added for new plan', () => {
    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'Test goal',
          executiveSummary: 'Test summary',
          assumptions: [],
        },
        channelMix: [
          { id: '1', channel: 'Google Ads', objective: 'Conversions', audience: 'B2B', monthlyBudget: 5000, kpiTargets: {}, rationale: 'Test' },
        ],
      },
    });

    const diff = computePlanDiff(null, proposed);

    expect(diff.isNewPlan).toBe(true);
    // Should have some changed sections
    expect(diff.sections.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Text Change Detection
// ============================================================================

describe('computePlanDiff - Text Changes', () => {
  it('detects text field changes in summary', () => {
    const approved = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'Old goal',
          executiveSummary: 'Old summary',
          assumptions: [],
        },
      },
    });

    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'New goal',
          executiveSummary: 'New summary with more detail',
          assumptions: [],
        },
      },
    });

    const diff = computePlanDiff(approved, proposed);

    expect(diff.hasChanges).toBe(true);
    expect(diff.isNewPlan).toBe(false);

    const summarySection = diff.sections.find((s) => s.sectionKey === 'summary');
    expect(summarySection).toBeDefined();
    expect(summarySection?.sectionType).toBe('changed');

    const goalChange = summarySection?.fieldChanges.find((f) => f.field === 'goalStatement');
    expect(goalChange?.type).toBe('changed');
    expect(goalChange?.oldPreview).toBe('Old goal');
    expect(goalChange?.newPreview).toBe('New goal');
  });

  it('detects added text fields', () => {
    const approved = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: '',
          executiveSummary: '',
          assumptions: [],
        },
      },
    });

    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'New goal statement',
          executiveSummary: 'New executive summary',
          assumptions: [],
        },
      },
    });

    const diff = computePlanDiff(approved, proposed);

    expect(diff.hasChanges).toBe(true);
    const summarySection = diff.sections.find((s) => s.sectionKey === 'summary');
    expect(summarySection?.fieldChanges.some((f) => f.type === 'changed')).toBe(true);
  });

  it('truncates long text in previews', () => {
    const longText = 'A'.repeat(300);
    const approved = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: '',
          executiveSummary: longText,
          assumptions: [],
        },
      },
    });

    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: '',
          executiveSummary: longText + ' modified',
          assumptions: [],
        },
      },
    });

    const diff = computePlanDiff(approved, proposed);
    const summarySection = diff.sections.find((s) => s.sectionKey === 'summary');
    const execSummaryChange = summarySection?.fieldChanges.find((f) => f.field === 'executiveSummary');

    expect(execSummaryChange?.oldPreview?.length).toBeLessThanOrEqual(243); // 240 + '...'
    expect(execSummaryChange?.oldPreview?.endsWith('...')).toBe(true);
  });
});

// ============================================================================
// List Item Changes
// ============================================================================

describe('computePlanDiff - List Changes', () => {
  it('detects added list items', () => {
    const approved = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        channelMix: [],
      },
    });

    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        channelMix: [
          { id: '1', channel: 'Google Ads', objective: 'Conversions', audience: 'B2B', monthlyBudget: 5000, kpiTargets: {}, rationale: 'Test' },
        ],
      },
    });

    const diff = computePlanDiff(approved, proposed);

    const channelSection = diff.sections.find((s) => s.sectionKey === 'channelMix');
    expect(channelSection).toBeDefined();
    expect(channelSection?.sectionType).toBe('added');
    expect(channelSection?.listChanges.length).toBe(1);
    expect(channelSection?.listChanges[0].type).toBe('added');
    expect(channelSection?.listChanges[0].itemLabel).toBe('Google Ads');
  });

  it('detects removed list items', () => {
    const approved = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        campaigns: [
          { id: '1', name: 'Campaign A', channel: 'Google', offer: 'Test', targeting: 'Test', creativeNeeds: 'Test', flighting: { startDate: '2025-01-01', endDate: '2025-03-31' }, budget: 1000, kpis: {} },
          { id: '2', name: 'Campaign B', channel: 'Meta', offer: 'Test', targeting: 'Test', creativeNeeds: 'Test', flighting: { startDate: '2025-01-01', endDate: '2025-03-31' }, budget: 2000, kpis: {} },
        ],
      },
    });

    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        campaigns: [
          { id: '1', name: 'Campaign A', channel: 'Google', offer: 'Test', targeting: 'Test', creativeNeeds: 'Test', flighting: { startDate: '2025-01-01', endDate: '2025-03-31' }, budget: 1000, kpis: {} },
        ],
      },
    });

    const diff = computePlanDiff(approved, proposed);

    const campaignSection = diff.sections.find((s) => s.sectionKey === 'campaigns');
    expect(campaignSection).toBeDefined();
    expect(campaignSection?.sectionType).toBe('changed');
    expect(campaignSection?.listChanges.length).toBe(1);
    expect(campaignSection?.listChanges[0].type).toBe('removed');
    expect(campaignSection?.listChanges[0].itemLabel).toBe('Campaign B');
  });

  it('detects changed list items', () => {
    const approved = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        channelMix: [
          { id: '1', channel: 'Google Ads', objective: 'Awareness', audience: 'B2B', monthlyBudget: 5000, kpiTargets: {}, rationale: 'Original' },
        ],
      },
    });

    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        channelMix: [
          { id: '1', channel: 'Google Ads', objective: 'Conversions', audience: 'B2B', monthlyBudget: 7500, kpiTargets: {}, rationale: 'Updated' },
        ],
      },
    });

    const diff = computePlanDiff(approved, proposed);

    const channelSection = diff.sections.find((s) => s.sectionKey === 'channelMix');
    expect(channelSection).toBeDefined();
    expect(channelSection?.listChanges.length).toBe(1);
    expect(channelSection?.listChanges[0].type).toBe('changed');
  });

  it('handles content plan pillars', () => {
    const approved = createMockContentPlan({
      sections: {
        ...createDefaultContentPlanSections(),
        pillars: [],
      },
    });

    const proposed = createMockContentPlan({
      sections: {
        ...createDefaultContentPlanSections(),
        pillars: [
          { id: '1', pillar: 'Thought Leadership', why: 'Build authority', targetIntents: ['learn'], proofPoints: [] },
          { id: '2', pillar: 'Product Education', why: 'Drive adoption', targetIntents: ['evaluate'], proofPoints: [] },
        ],
      },
    });

    const diff = computePlanDiff(approved, proposed);

    const pillarsSection = diff.sections.find((s) => s.sectionKey === 'pillars');
    expect(pillarsSection).toBeDefined();
    expect(pillarsSection?.listChanges.length).toBe(2);
    expect(pillarsSection?.listChanges.every((c) => c.type === 'added')).toBe(true);
  });
});

// ============================================================================
// Stable Ordering
// ============================================================================

describe('computePlanDiff - Stable Ordering', () => {
  it('maintains consistent section order', () => {
    const approved = createMockMediaPlan();
    const proposed = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'Changed',
          executiveSummary: 'Changed',
          assumptions: [],
        },
        budget: {
          ...createDefaultMediaPlanSections().budget,
          totalMonthly: 10000,
        },
        campaigns: [
          { id: '1', name: 'New Campaign', channel: 'Google', offer: 'Test', targeting: 'Test', creativeNeeds: 'Test', flighting: { startDate: '2025-01-01', endDate: '2025-03-31' }, budget: 1000, kpis: {} },
        ],
      },
    });

    const diff1 = computePlanDiff(approved, proposed);
    const diff2 = computePlanDiff(approved, proposed);

    // Section order should be consistent between calls
    expect(diff1.sections.map((s) => s.sectionKey)).toEqual(
      diff2.sections.map((s) => s.sectionKey)
    );
  });
});

// ============================================================================
// No Changes
// ============================================================================

describe('computePlanDiff - No Changes', () => {
  it('returns empty diff when plans are identical', () => {
    const plan = createMockMediaPlan({
      sections: {
        ...createDefaultMediaPlanSections(),
        summary: {
          goalStatement: 'Same goal',
          executiveSummary: 'Same summary',
          assumptions: ['Same assumption'],
        },
      },
    });

    const diff = computePlanDiff(plan, plan);

    expect(diff.hasChanges).toBe(false);
    expect(diff.isNewPlan).toBe(false);
    expect(diff.sections.length).toBe(0);
    expect(diff.stats.sectionsChanged).toBe(0);
  });
});

// ============================================================================
// Summary Text
// ============================================================================

describe('getDiffSummary', () => {
  it('returns new plan message when no approved plan', () => {
    const diff: PlanDiff = {
      planType: 'media',
      hasChanges: true,
      isNewPlan: true,
      sections: [],
      stats: { sectionsChanged: 0, fieldsChanged: 0, itemsAdded: 0, itemsRemoved: 0 },
    };

    expect(getDiffSummary(diff)).toBe('This is a new plan. Accepting will create v1.');
  });

  it('returns no changes message when identical', () => {
    const diff: PlanDiff = {
      planType: 'media',
      hasChanges: false,
      isNewPlan: false,
      sections: [],
      stats: { sectionsChanged: 0, fieldsChanged: 0, itemsAdded: 0, itemsRemoved: 0 },
    };

    expect(getDiffSummary(diff)).toBe('No changes detected between approved and proposed plans.');
  });

  it('summarizes changes correctly', () => {
    const diff: PlanDiff = {
      planType: 'media',
      hasChanges: true,
      isNewPlan: false,
      sections: [],
      stats: { sectionsChanged: 2, fieldsChanged: 3, itemsAdded: 1, itemsRemoved: 2 },
    };

    const summary = getDiffSummary(diff);
    expect(summary).toContain('2 sections changed');
    expect(summary).toContain('1 item added');
    expect(summary).toContain('2 items removed');
  });
});

// ============================================================================
// Error Cases
// ============================================================================

describe('computePlanDiff - Error Cases', () => {
  it('throws when comparing different plan types', () => {
    const mediaPlan = createMockMediaPlan();
    const contentPlan = createMockContentPlan();

    expect(() => computePlanDiff(mediaPlan, contentPlan)).toThrow(
      'Cannot diff plans of different types'
    );
  });
});
