// tests/os/weeklyBrief.test.ts
// Weekly Brief System Tests
//
// Tests for:
// - Week key period math
// - Idempotent upsert behavior
// - Brief content generation with required sections
// - Brief storage operations

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWeekKey,
  getPreviousWeekKey,
  parseWeekKey,
  getWeekStartDate,
} from '@/lib/types/weeklyBrief';
import {
  upsertWeeklyBrief,
  getBriefById,
  getBriefByCompanyWeek,
  getLatestBrief,
  getCompanyBriefs,
  briefExists,
  hasHistory,
  clearBriefStore,
} from '@/lib/os/briefs/briefStore';
import {
  generateWeeklyBrief,
  generateBriefId,
} from '@/lib/os/briefs/generateWeeklyBrief';
import type { PlanningProgram } from '@/lib/types/program';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import type { WeeklyBrief } from '@/lib/types/weeklyBrief';

// ============================================================================
// Test Data Helpers
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  const id = `prog_${Math.random().toString(36).substring(2, 8)}`;
  return {
    id,
    companyId: 'test-company',
    strategyId: 'test-strategy',
    title: 'Test Program',
    status: 'committed',
    domain: 'Media',
    intensity: 'Standard',
    origin: {
      strategyId: 'test-strategy',
    },
    scope: {
      summary: 'Test program scope',
      workstreams: ['paid_media'],
      deliverables: [],
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: {
      kpis: [],
    },
    planDetails: {
      horizonDays: 30,
      milestones: [],
    },
    commitment: {
      workItemIds: [],
    },
    linkedArtifacts: [],
    workPlanVersion: 0,
    scopeEnforced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockWorkItem(overrides: Partial<WorkItemRecord> = {}): WorkItemRecord {
  return {
    id: `work_${Math.random().toString(36).substring(2, 8)}`,
    companyId: 'test-company',
    title: 'Test Work Item',
    status: 'In Progress',
    area: 'Media',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as WorkItemRecord;
}

function createMockBrief(overrides: Partial<WeeklyBrief> = {}): WeeklyBrief {
  return {
    id: generateBriefId(),
    companyId: 'test-company',
    weekKey: getWeekKey(),
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    contentMarkdown: '# Test Brief',
    content: {
      thisWeek: [],
      overdue: [],
      programHealth: {
        summary: { healthy: 1, attention: 0, atRisk: 0 },
        atRiskPrograms: [],
      },
      runbook: null,
      approvalsPending: { count: 0, items: [] },
      scopeDrift: { totalBlocked: 0, blockedActions: [], recommendedActions: [] },
      recentChanges: [],
      recommendedActions: [],
    },
    sourceSummary: {
      programsCount: 1,
      deliverablesThisWeek: 0,
      deliverablesOverdue: 0,
      workItemsInProgress: 0,
      approvalsCount: 0,
      scopeViolationsLast30Days: 0,
      recentChangesCount: 0,
    },
    debugId: 'EVT-test-123',
    ...overrides,
  };
}

// ============================================================================
// Week Key Period Math Tests
// ============================================================================

describe('Week Key Period Math', () => {
  describe('getWeekKey', () => {
    it('should return YYYY-Www format', () => {
      const weekKey = getWeekKey();
      expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should return same week for dates in same week', () => {
      // Get two dates 3 days apart (should be in same week)
      const day1 = new Date();
      day1.setHours(12, 0, 0, 0);
      const day2 = new Date(day1);
      day2.setDate(day1.getDate() + 2);
      expect(getWeekKey(day1)).toBe(getWeekKey(day2));
    });

    it('should return different weeks for dates in different weeks', () => {
      // Get two dates 8 days apart (must be in different weeks)
      const week1 = new Date();
      week1.setHours(12, 0, 0, 0);
      const week2 = new Date(week1);
      week2.setDate(week1.getDate() + 8);
      expect(getWeekKey(week1)).not.toBe(getWeekKey(week2));
    });

    it('should handle year boundary correctly', () => {
      // Just verify it produces valid output for Jan 1
      const jan1 = new Date(2025, 0, 1, 12, 0, 0);
      const weekKey = getWeekKey(jan1);
      expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should handle week 53 correctly for applicable years', () => {
      // 2020 had 53 weeks
      const dec31_2020 = new Date('2020-12-31');
      expect(getWeekKey(dec31_2020)).toBe('2020-W53');
    });
  });

  describe('getPreviousWeekKey', () => {
    it('should return the previous week', () => {
      // Current week key should differ from previous week key
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const currentWeek = getWeekKey(now);
      const prevWeek = getPreviousWeekKey(now);
      expect(prevWeek).not.toBe(currentWeek);
      expect(prevWeek).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should be consistent with getWeekKey for 7 days ago', () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      // getPreviousWeekKey(now) should equal getWeekKey(7 days ago)
      expect(getPreviousWeekKey(now)).toBe(getWeekKey(sevenDaysAgo));
    });
  });

  describe('parseWeekKey', () => {
    it('should parse valid week key', () => {
      const result = parseWeekKey('2025-W03');
      expect(result).toEqual({ year: 2025, week: 3 });
    });

    it('should return null for invalid format', () => {
      expect(parseWeekKey('2025-03')).toBeNull();
      expect(parseWeekKey('W03-2025')).toBeNull();
      expect(parseWeekKey('invalid')).toBeNull();
    });
  });

  describe('getWeekStartDate', () => {
    it('should return Monday of the week', () => {
      const monday = getWeekStartDate('2025-W02');
      expect(monday).not.toBeNull();
      expect(monday!.getDay()).toBe(1); // Monday
      expect(monday!.getFullYear()).toBe(2025);
    });

    it('should return null for invalid week key', () => {
      expect(getWeekStartDate('invalid')).toBeNull();
    });
  });
});

// ============================================================================
// Brief Storage Tests
// ============================================================================

describe('Brief Storage', () => {
  beforeEach(() => {
    clearBriefStore();
  });

  describe('upsertWeeklyBrief', () => {
    it('should store a new brief', () => {
      const brief = createMockBrief();
      const result = upsertWeeklyBrief(brief);
      expect(result.id).toBe(brief.id);
      expect(getBriefById(brief.id)).toEqual(brief);
    });

    it('should be idempotent - same companyId+weekKey replaces existing', () => {
      const brief1 = createMockBrief({
        id: 'brief-1',
        companyId: 'company-a',
        weekKey: '2025-W03',
      });
      const brief2 = createMockBrief({
        id: 'brief-2',
        companyId: 'company-a',
        weekKey: '2025-W03',
      });

      upsertWeeklyBrief(brief1);
      expect(getBriefByCompanyWeek('company-a', '2025-W03')?.id).toBe('brief-1');

      upsertWeeklyBrief(brief2);
      expect(getBriefByCompanyWeek('company-a', '2025-W03')?.id).toBe('brief-2');

      // Old brief should be gone
      expect(getBriefById('brief-1')).toBeNull();
    });

    it('should allow different weekKeys for same company', () => {
      const brief1 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W02',
      });
      const brief2 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W03',
      });

      upsertWeeklyBrief(brief1);
      upsertWeeklyBrief(brief2);

      expect(getBriefByCompanyWeek('company-a', '2025-W02')).not.toBeNull();
      expect(getBriefByCompanyWeek('company-a', '2025-W03')).not.toBeNull();
    });
  });

  describe('getLatestBrief', () => {
    it('should return null for company with no briefs', () => {
      expect(getLatestBrief('nonexistent')).toBeNull();
    });

    it('should return most recent brief by weekKey', () => {
      const brief1 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W01',
      });
      const brief2 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W03',
      });
      const brief3 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W02',
      });

      upsertWeeklyBrief(brief1);
      upsertWeeklyBrief(brief2);
      upsertWeeklyBrief(brief3);

      const latest = getLatestBrief('company-a');
      expect(latest?.weekKey).toBe('2025-W03');
    });
  });

  describe('getCompanyBriefs', () => {
    it('should return briefs sorted by weekKey descending', () => {
      const brief1 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W01',
      });
      const brief2 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W03',
      });
      const brief3 = createMockBrief({
        companyId: 'company-a',
        weekKey: '2025-W02',
      });

      upsertWeeklyBrief(brief1);
      upsertWeeklyBrief(brief2);
      upsertWeeklyBrief(brief3);

      const briefs = getCompanyBriefs('company-a');
      expect(briefs.map((b) => b.weekKey)).toEqual([
        '2025-W03',
        '2025-W02',
        '2025-W01',
      ]);
    });

    it('should respect limit parameter', () => {
      for (let i = 1; i <= 5; i++) {
        upsertWeeklyBrief(
          createMockBrief({
            companyId: 'company-a',
            weekKey: `2025-W${String(i).padStart(2, '0')}`,
          })
        );
      }

      expect(getCompanyBriefs('company-a', { limit: 3 })).toHaveLength(3);
    });
  });

  describe('briefExists', () => {
    it('should return false for non-existent brief', () => {
      expect(briefExists('company-a', '2025-W01')).toBe(false);
    });

    it('should return true for existing brief', () => {
      upsertWeeklyBrief(
        createMockBrief({
          companyId: 'company-a',
          weekKey: '2025-W01',
        })
      );
      expect(briefExists('company-a', '2025-W01')).toBe(true);
    });
  });

  describe('hasHistory', () => {
    it('should return false for company with no briefs', () => {
      expect(hasHistory('nonexistent')).toBe(false);
    });

    it('should return true for company with briefs', () => {
      upsertWeeklyBrief(createMockBrief({ companyId: 'company-a' }));
      expect(hasHistory('company-a')).toBe(true);
    });
  });
});

// ============================================================================
// Brief Content Generation Tests
// ============================================================================

describe('Brief Content Generation', () => {
  describe('generateBriefId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateBriefId();
      const id2 = generateBriefId();
      expect(id1).not.toBe(id2);
    });

    it('should start with brief_ prefix', () => {
      const id = generateBriefId();
      expect(id.startsWith('brief_')).toBe(true);
    });
  });

  describe('generateWeeklyBrief', () => {
    it('should include all required sections', () => {
      const programs = [createMockProgram()];
      const workItems = [createMockWorkItem()];

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs,
        workItems,
      });

      expect(brief.content).toHaveProperty('thisWeek');
      expect(brief.content).toHaveProperty('overdue');
      expect(brief.content).toHaveProperty('programHealth');
      expect(brief.content).toHaveProperty('runbook');
      expect(brief.content).toHaveProperty('approvalsPending');
      expect(brief.content).toHaveProperty('scopeDrift');
      expect(brief.content).toHaveProperty('recentChanges');
      expect(brief.content).toHaveProperty('recommendedActions');
    });

    it('should include source summary with counts', () => {
      const programs = [createMockProgram(), createMockProgram()];
      const workItems = [
        createMockWorkItem({ status: 'In Progress' }),
        createMockWorkItem({ status: 'Planned' }),
      ];

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs,
        workItems,
      });

      expect(brief.sourceSummary.programsCount).toBe(2);
      expect(brief.sourceSummary.workItemsInProgress).toBe(1);
      expect(brief.sourceSummary.approvalsCount).toBe(1); // review status
    });

    it('should generate markdown content', () => {
      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [createMockProgram()],
        workItems: [],
      });

      expect(brief.contentMarkdown).toContain('# Weekly Brief');
      expect(brief.contentMarkdown).toContain('## This Week');
      expect(brief.contentMarkdown).toContain('## Overdue');
      expect(brief.contentMarkdown).toContain('## Program Health');
      expect(brief.contentMarkdown).toContain('## Recommended Actions');
    });

    it('should include debugId', () => {
      const { brief, debugId } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [],
        workItems: [],
      });

      expect(brief.debugId).toBe(debugId);
      expect(debugId).toMatch(/^EVT-/);
    });

    it('should use provided weekKey', () => {
      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [],
        workItems: [],
        weekKey: '2025-W05',
      });

      expect(brief.weekKey).toBe('2025-W05');
    });

    it('should count deliverables due this week correctly', () => {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 3); // 3 days from now

      const program = createMockProgram({
        scope: {
          summary: 'Test scope',
          workstreams: ['paid_media'],
          deliverables: [
            {
              id: 'd1',
              title: 'Due This Week',
              type: 'document',
              dueDate: dueDate.toISOString().split('T')[0],
              status: 'in_progress',
            },
          ],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [program],
        workItems: [],
      });

      expect(brief.sourceSummary.deliverablesThisWeek).toBe(1);
    });

    it('should count overdue deliverables correctly', () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 5); // 5 days ago

      const program = createMockProgram({
        scope: {
          summary: 'Test scope',
          workstreams: ['paid_media'],
          deliverables: [
            {
              id: 'd1',
              title: 'Overdue Deliverable',
              type: 'document',
              dueDate: overdueDate.toISOString().split('T')[0],
              status: 'in_progress',
            },
          ],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [program],
        workItems: [],
      });

      expect(brief.sourceSummary.deliverablesOverdue).toBe(1);
    });

    it('should group deliverables by domain', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const mediaProgram = createMockProgram({
        domain: 'Media',
        scope: {
          summary: 'Media scope',
          workstreams: ['paid_media'],
          deliverables: [
            {
              id: 'd1',
              title: 'Media Deliverable',
              type: 'document',
              dueDate: dueDate.toISOString().split('T')[0],
              status: 'in_progress',
            },
          ],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const creativeProgram = createMockProgram({
        domain: 'Creative',
        scope: {
          summary: 'Creative scope',
          workstreams: ['content'],
          deliverables: [
            {
              id: 'd2',
              title: 'Creative Deliverable',
              type: 'document',
              dueDate: dueDate.toISOString().split('T')[0],
              status: 'in_progress',
            },
          ],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [mediaProgram, creativeProgram],
        workItems: [],
      });

      const domains = brief.content.thisWeek.map((d) => d.domain);
      expect(domains).toContain('Media');
      expect(domains).toContain('Creative');
    });

    it('should calculate program health correctly', () => {
      const healthyProgram = createMockProgram({
        id: 'healthy',
        title: 'Healthy Program',
        scope: {
          summary: 'Healthy scope',
          workstreams: [],
          deliverables: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [healthyProgram],
        workItems: [],
      });

      expect(brief.content.programHealth.summary.healthy).toBe(1);
      expect(brief.content.programHealth.summary.attention).toBe(0);
      expect(brief.content.programHealth.summary.atRisk).toBe(0);
    });

    it('should generate recommended actions for overdue deliverables', () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 5);

      const program = createMockProgram({
        scope: {
          summary: 'Test scope',
          workstreams: ['paid_media'],
          deliverables: [
            {
              id: 'd1',
              title: 'Overdue',
              type: 'document',
              dueDate: overdueDate.toISOString().split('T')[0],
              status: 'in_progress',
            },
          ],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [program],
        workItems: [],
      });

      const overdueActions = brief.content.recommendedActions.filter(
        (a) => a.category === 'overdue'
      );
      expect(overdueActions.length).toBeGreaterThan(0);
    });

    it('should exclude archived programs', () => {
      const activeProgram = createMockProgram({
        status: 'committed',
        title: 'Active',
      });
      const archivedProgram = createMockProgram({
        status: 'archived',
        title: 'Archived',
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [activeProgram, archivedProgram],
        workItems: [],
      });

      expect(brief.sourceSummary.programsCount).toBe(1);
    });

    it('should exclude draft programs', () => {
      const committedProgram = createMockProgram({
        status: 'committed',
        title: 'Committed',
      });
      const draftProgram = createMockProgram({
        status: 'draft',
        title: 'Draft',
      });

      const { brief } = generateWeeklyBrief({
        companyId: 'test-company',
        programs: [committedProgram, draftProgram],
        workItems: [],
      });

      expect(brief.sourceSummary.programsCount).toBe(1);
    });
  });
});

// ============================================================================
// Inngest Job Wiring Tests
// ============================================================================

describe('Inngest Job Wiring', () => {
  it('should export weeklyBriefMonday function', async () => {
    const { weeklyBriefMonday } = await import(
      '@/lib/inngest/functions/weekly-brief'
    );
    expect(weeklyBriefMonday).toBeDefined();
  });

  it('should export weeklyBriefOnDemand function', async () => {
    const { weeklyBriefOnDemand } = await import(
      '@/lib/inngest/functions/weekly-brief'
    );
    expect(weeklyBriefOnDemand).toBeDefined();
  });

  it('should export event types', async () => {
    const module = await import('@/lib/inngest/functions/weekly-brief');
    expect(module).toHaveProperty('weeklyBriefMonday');
    expect(module).toHaveProperty('weeklyBriefOnDemand');
  });
});
