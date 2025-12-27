// tests/os/planToWorkConversion.test.ts
// Unit tests for Plan → Work Item conversion utilities
//
// Tests:
// - Work key generation (determinism, normalization)
// - Media plan mapping (channels, campaigns, measurement)
// - Content plan mapping (calendar, SEO, distribution)
// - Idempotency (duplicate detection via work keys)
// - Validation (approved-only conversion)

import { describe, it, expect } from 'vitest';
import {
  normalizeForKey,
  generateWorkKey,
  hashWorkKey,
  generateCampaignWorkKey,
  generateChannelWorkKey,
} from '@/lib/os/plans/convert/workKeyGenerator';
import {
  convertMediaPlanToWorkItems,
  mapChannelMixToWorkItems,
  mapCampaignsToWorkItems,
  mapMeasurementToWorkItems,
} from '@/lib/os/plans/convert/mediaPlanMapper';
import {
  convertContentPlanToWorkItems,
  mapCalendarToWorkItems,
  mapSEOToWorkItems,
  mapDistributionToWorkItems,
} from '@/lib/os/plans/convert/contentPlanMapper';
import {
  convertPlanToWorkItems,
  validatePlanForConversion,
  getConversionBreakdown,
} from '@/lib/os/plans/convert/planToWorkItems';
import type { MediaPlan, ContentPlan } from '@/lib/types/plan';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeMediaPlan(status: MediaPlan['status'] = 'approved'): MediaPlan {
  return {
    id: 'mp-test-123',
    companyId: 'company-123',
    strategyId: 'strat-123',
    status,
    version: 2,
    sourceSnapshot: {
      contextHash: 'ctx-hash',
      strategyHash: 'strat-hash',
      contextConfirmedAt: '2025-01-01T00:00:00Z',
      strategyLockedAt: '2025-01-01T00:00:00Z',
    },
    sections: {
      summary: {
        goalStatement: 'Increase brand awareness',
        executiveSummary: 'Q1 media plan',
        assumptions: ['Budget is fixed'],
      },
      budget: {
        totalMonthly: 50000,
        currency: 'USD',
      },
      markets: {
        geo: ['US', 'CA'],
      },
      kpis: {
        primary: [],
        secondary: [],
      },
      measurement: {
        trackingStack: 'GA4 + GTM',
        attributionModel: 'Data-Driven',
        conversionEvents: ['sign_up', 'purchase'],
        reportingCadence: 'Weekly',
      },
      channelMix: [
        {
          id: 'ch-1',
          channel: 'Google Search',
          objective: 'Capture demand',
          audience: 'High-intent buyers',
          monthlyBudget: 20000,
          kpiTargets: { CPA: '$50', ROAS: '3x' },
          rationale: 'Strong historical performance',
        },
        {
          id: 'ch-2',
          channel: 'Meta Social',
          objective: 'Brand awareness',
          audience: 'Cold audience',
          monthlyBudget: 15000,
          kpiTargets: { CPM: '$10', Reach: '500K' },
          rationale: 'Expand top of funnel',
        },
      ],
      campaigns: [
        {
          id: 'camp-1',
          name: 'Spring Launch',
          channel: 'Google Search',
          offer: '20% off first order',
          landingPage: '/promo/spring',
          targeting: 'Brand + non-brand keywords',
          creativeNeeds: '3 responsive search ads',
          flighting: {
            startDate: '2025-03-01',
            endDate: '2025-03-31',
          },
          budget: 20000,
          kpis: { Conversions: '400', CPA: '$50' },
          experiments: ['Dynamic headlines'],
        },
      ],
      cadence: {
        weekly: ['Review performance', 'Adjust bids'],
        monthly: ['Budget reallocation', 'Creative refresh'],
      },
      risks: [],
      approvals: {
        checklist: [],
      },
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  };
}

function makeContentPlan(status: ContentPlan['status'] = 'approved'): ContentPlan {
  return {
    id: 'cp-test-456',
    companyId: 'company-123',
    strategyId: 'strat-123',
    status,
    version: 1,
    sourceSnapshot: {
      contextHash: 'ctx-hash',
      strategyHash: 'strat-hash',
      contextConfirmedAt: '2025-01-01T00:00:00Z',
      strategyLockedAt: '2025-01-01T00:00:00Z',
    },
    sections: {
      summary: {
        goalStatement: 'Establish thought leadership',
        editorialThesis: 'AI-first marketing insights',
        voiceGuidance: 'Professional but approachable',
      },
      audiences: {
        segments: [
          {
            id: 'seg-1',
            segment: 'Marketing Leaders',
            pains: ['ROI attribution'],
            intents: ['Team efficiency'],
            objections: ['Change management'],
          },
        ],
      },
      pillars: [
        {
          id: 'pil-1',
          pillar: 'AI in Marketing',
          why: 'Core differentiator',
          targetIntents: ['AI adoption', 'Automation'],
          proofPoints: ['Case studies', 'Benchmarks'],
        },
      ],
      calendar: [
        {
          id: 'cal-1',
          title: 'AI Marketing Guide',
          channel: 'Blog',
          format: 'Long-form article',
          pillar: 'AI in Marketing',
          objective: 'SEO traffic',
          status: 'planned',
          weekOf: '2025-02-01',
        },
        {
          id: 'cal-2',
          title: 'Video Tutorial',
          channel: 'YouTube',
          format: 'Video',
          pillar: 'AI in Marketing',
          objective: 'Engagement',
          status: 'in_progress',
          owner: 'Jane',
        },
      ],
      seo: {
        keywordClusters: ['ai marketing', 'marketing automation'],
        onPageStandards: ['Title tags under 60 chars', 'H1 with primary keyword'],
        internalLinkingRules: ['Link to pillar pages', 'Use descriptive anchors'],
      },
      distribution: {
        channels: [
          {
            id: 'dist-1',
            channel: 'Email Newsletter',
            frequency: 'Weekly',
            audience: 'Subscribers',
            goals: ['Drive blog traffic', 'Nurture leads'],
          },
          {
            id: 'dist-2',
            channel: 'LinkedIn',
            frequency: 'Daily',
            audience: 'Professional network',
            goals: ['Brand awareness', 'Engagement'],
          },
        ],
      },
      production: {
        workflowSteps: ['Brief', 'Draft', 'Review', 'Publish'],
        roles: ['Writer', 'Editor', 'Designer'],
        sla: '5 business days',
      },
      measurement: {
        kpis: [],
        reportingCadence: 'Monthly',
      },
      risks: [],
      approvals: {
        checklist: [],
      },
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
  };
}

// ============================================================================
// Work Key Generation Tests
// ============================================================================

describe('Work Key Generation', () => {
  describe('normalizeForKey', () => {
    it('converts to lowercase', () => {
      expect(normalizeForKey('HELLO World')).toBe('hello_world');
    });

    it('replaces spaces with underscores', () => {
      expect(normalizeForKey('hello world test')).toBe('hello_world_test');
    });

    it('removes special characters', () => {
      // @ and # are removed, so no spaces remain to become underscores
      expect(normalizeForKey('hello@world#test!')).toBe('helloworldtest');
    });

    it('preserves hyphens', () => {
      expect(normalizeForKey('hello-world')).toBe('hello-world');
    });

    it('trims whitespace', () => {
      expect(normalizeForKey('  hello  ')).toBe('hello');
    });

    it('limits length to 50 characters', () => {
      const longString = 'a'.repeat(100);
      expect(normalizeForKey(longString)).toHaveLength(50);
    });
  });

  describe('generateWorkKey', () => {
    it('generates deterministic keys', () => {
      const key1 = generateWorkKey('company-1', 'plan-1', 'campaigns', 'Spring Launch');
      const key2 = generateWorkKey('company-1', 'plan-1', 'campaigns', 'Spring Launch');
      expect(key1).toBe(key2);
    });

    it('includes all components in key', () => {
      const key = generateWorkKey('company-1', 'plan-1', 'campaigns', 'Spring Launch');
      expect(key).toContain('company-1');
      expect(key).toContain('plan-1');
      expect(key).toContain('campaigns');
      expect(key).toContain('spring_launch');
    });

    it('generates different keys for different inputs', () => {
      const key1 = generateWorkKey('company-1', 'plan-1', 'campaigns', 'Campaign A');
      const key2 = generateWorkKey('company-1', 'plan-1', 'campaigns', 'Campaign B');
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashWorkKey', () => {
    it('generates consistent hashes', () => {
      const hash1 = hashWorkKey('a', 'b', 'c');
      const hash2 = hashWorkKey('a', 'b', 'c');
      expect(hash1).toBe(hash2);
    });

    it('returns 16-character hex string', () => {
      const hash = hashWorkKey('test');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('specialized generators', () => {
    it('generateCampaignWorkKey creates unique keys', () => {
      const key = generateCampaignWorkKey('co-1', 'plan-1', 'camp-1', 'Spring Sale');
      expect(key).toContain('campaign');
      expect(key).toContain('spring_sale');
    });

    it('generateChannelWorkKey creates unique keys', () => {
      const key = generateChannelWorkKey('co-1', 'plan-1', 'ch-1', 'Google Search');
      expect(key).toContain('channel');
      expect(key).toContain('google_search');
    });
  });
});

// ============================================================================
// Media Plan Mapping Tests
// ============================================================================

describe('Media Plan Mapping', () => {
  const plan = makeMediaPlan();
  const companyId = 'company-123';

  describe('mapChannelMixToWorkItems', () => {
    it('creates work items for each channel', () => {
      const items = mapChannelMixToWorkItems(plan, companyId);
      expect(items).toHaveLength(2);
    });

    it('sets correct titles', () => {
      const items = mapChannelMixToWorkItems(plan, companyId);
      expect(items[0].title).toContain('Google Search');
      expect(items[1].title).toContain('Meta Social');
    });

    it('includes budget in notes', () => {
      const items = mapChannelMixToWorkItems(plan, companyId);
      expect(items[0].notes).toContain('$20,000');
    });

    it('sets heavy_plan source type', () => {
      const items = mapChannelMixToWorkItems(plan, companyId);
      expect(items[0].source.sourceType).toBe('heavy_plan');
      expect(items[0].source.planId).toBe(plan.id);
      expect(items[0].source.planType).toBe('media');
    });

    it('generates unique work keys', () => {
      const items = mapChannelMixToWorkItems(plan, companyId);
      const keys = items.map(i => i.source.workKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('mapCampaignsToWorkItems', () => {
    it('creates work items for each campaign', () => {
      const items = mapCampaignsToWorkItems(plan, companyId);
      expect(items).toHaveLength(1);
    });

    it('includes flight dates in notes', () => {
      const items = mapCampaignsToWorkItems(plan, companyId);
      expect(items[0].notes).toContain('2025-03-01');
    });
  });

  describe('mapMeasurementToWorkItems', () => {
    it('creates tasks for tracking setup', () => {
      const items = mapMeasurementToWorkItems(plan, companyId);
      expect(items.length).toBeGreaterThan(0);
    });

    it('includes conversion events', () => {
      const items = mapMeasurementToWorkItems(plan, companyId);
      const eventsTask = items.find(i => i.title.includes('conversion'));
      expect(eventsTask?.notes).toContain('sign_up');
    });
  });

  describe('convertMediaPlanToWorkItems', () => {
    it('combines all section mappings', () => {
      const result = convertMediaPlanToWorkItems(plan, companyId);
      expect(result.all.length).toBeGreaterThan(0);
      expect(result.channelTasks.length).toBeGreaterThan(0);
      expect(result.campaignTasks.length).toBeGreaterThan(0);
    });

    it('throws for non-approved plans', () => {
      const draftPlan = makeMediaPlan('draft');
      expect(() => convertMediaPlanToWorkItems(draftPlan, companyId)).toThrow('approved');
    });
  });
});

// ============================================================================
// Content Plan Mapping Tests
// ============================================================================

describe('Content Plan Mapping', () => {
  const plan = makeContentPlan();
  const companyId = 'company-123';

  describe('mapCalendarToWorkItems', () => {
    it('creates work items for planned/in_progress items only', () => {
      const items = mapCalendarToWorkItems(plan, companyId);
      expect(items).toHaveLength(2); // planned + in_progress
    });

    it('excludes published/archived items', () => {
      const planWithPublished: ContentPlan = {
        ...plan,
        sections: {
          ...plan.sections,
          calendar: [
            ...plan.sections.calendar,
            {
              id: 'cal-3',
              title: 'Published Article',
              channel: 'Blog',
              format: 'Article',
              pillar: 'Test',
              objective: 'SEO',
              status: 'published',
            },
          ],
        },
      };
      const items = mapCalendarToWorkItems(planWithPublished, companyId);
      expect(items).toHaveLength(2); // Still only planned + in_progress
    });

    it('sets higher severity for in_progress items', () => {
      const items = mapCalendarToWorkItems(plan, companyId);
      const inProgressItem = items.find(i => i.title.includes('Video Tutorial'));
      expect(inProgressItem?.severity).toBe('High');
    });
  });

  describe('mapSEOToWorkItems', () => {
    it('creates tasks for keyword clusters', () => {
      const items = mapSEOToWorkItems(plan, companyId);
      const keywordTask = items.find(i => i.title.includes('keyword'));
      expect(keywordTask).toBeDefined();
    });

    it('includes SEO standards in notes', () => {
      const items = mapSEOToWorkItems(plan, companyId);
      const standardsTask = items.find(i => i.title.includes('standards'));
      expect(standardsTask?.notes).toContain('Title tags');
    });
  });

  describe('mapDistributionToWorkItems', () => {
    it('creates work items for each distribution channel', () => {
      const items = mapDistributionToWorkItems(plan, companyId);
      expect(items).toHaveLength(2);
    });

    it('includes frequency and goals', () => {
      const items = mapDistributionToWorkItems(plan, companyId);
      expect(items[0].notes).toContain('Weekly');
      expect(items[0].notes).toContain('Drive blog traffic');
    });
  });

  describe('convertContentPlanToWorkItems', () => {
    it('combines all section mappings', () => {
      const result = convertContentPlanToWorkItems(plan, companyId);
      expect(result.all.length).toBeGreaterThan(0);
    });

    it('includes pillar tasks first (strategic)', () => {
      const result = convertContentPlanToWorkItems(plan, companyId);
      expect(result.all[0].source.sectionId).toBe('pillars');
    });

    it('throws for non-approved plans', () => {
      const draftPlan = makeContentPlan('draft');
      expect(() => convertContentPlanToWorkItems(draftPlan, companyId)).toThrow('approved');
    });
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe('Idempotency', () => {
  const companyId = 'company-123';

  describe('convertPlanToWorkItems with existing keys', () => {
    it('skips items with existing work keys', () => {
      const plan = makeMediaPlan();
      const existingKeys = new Set([
        generateChannelWorkKey(companyId, plan.id, 'ch-1', 'Google Search'),
      ]);

      const result = convertPlanToWorkItems(plan, companyId, {
        existingWorkKeys: existingKeys,
      });

      expect(result.skippedWorkKeys).toHaveLength(1);
      expect(result.stats.skipped).toBe(1);
      expect(result.workItemsToCreate.length).toBeLessThan(result.stats.total);
    });

    it('creates nothing if all keys exist', () => {
      const plan = makeMediaPlan();

      // Generate all work keys from the plan
      const fullResult = convertPlanToWorkItems(plan, companyId);
      const allKeys = new Set(fullResult.workItemsToCreate.map(i => i.source.workKey));

      // Now convert with all keys as existing
      const result = convertPlanToWorkItems(plan, companyId, {
        existingWorkKeys: allKeys,
      });

      expect(result.workItemsToCreate).toHaveLength(0);
      expect(result.skippedWorkKeys.length).toBe(allKeys.size);
    });

    it('creates all items if no existing keys', () => {
      const plan = makeMediaPlan();
      const result = convertPlanToWorkItems(plan, companyId, {
        existingWorkKeys: new Set(),
      });

      expect(result.skippedWorkKeys).toHaveLength(0);
      expect(result.stats.skipped).toBe(0);
      expect(result.workItemsToCreate.length).toBe(result.stats.total);
    });
  });

  describe('deterministic work keys across runs', () => {
    it('generates same keys for same plan content', () => {
      const plan = makeMediaPlan();

      const result1 = convertPlanToWorkItems(plan, companyId);
      const result2 = convertPlanToWorkItems(plan, companyId);

      const keys1 = result1.workItemsToCreate.map(i => i.source.workKey).sort();
      const keys2 = result2.workItemsToCreate.map(i => i.source.workKey).sort();

      expect(keys1).toEqual(keys2);
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Validation', () => {
  describe('validatePlanForConversion', () => {
    it('allows approved plans', () => {
      const plan = makeMediaPlan('approved');
      const result = validatePlanForConversion(plan);
      expect(result.valid).toBe(true);
    });

    it('rejects draft plans', () => {
      const plan = makeMediaPlan('draft');
      const result = validatePlanForConversion(plan);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('draft');
    });

    it('rejects in_review plans', () => {
      const plan = makeMediaPlan('in_review');
      const result = validatePlanForConversion(plan);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('in_review');
    });

    it('rejects archived plans', () => {
      const plan = makeMediaPlan('archived');
      const result = validatePlanForConversion(plan);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('archived');
    });
  });

  describe('getConversionBreakdown', () => {
    it('returns breakdown by section', () => {
      const plan = makeMediaPlan();
      const breakdown = getConversionBreakdown(plan, 'company-123');

      expect(breakdown.length).toBeGreaterThan(0);
      expect(breakdown.some(b => b.sectionId === 'channelMix')).toBe(true);
    });

    it('includes counts per section', () => {
      const plan = makeMediaPlan();
      const breakdown = getConversionBreakdown(plan, 'company-123');

      const channelSection = breakdown.find(b => b.sectionId === 'channelMix');
      expect(channelSection?.count).toBe(2); // Two channels in fixture
    });
  });
});

// ============================================================================
// Source Metadata Tests
// ============================================================================

describe('Source Metadata', () => {
  it('includes plan version in source', () => {
    const plan = makeMediaPlan();
    const result = convertPlanToWorkItems(plan, 'company-123');
    const item = result.workItemsToCreate[0];

    expect(item.source.planVersion).toBe(plan.version);
  });

  it('includes section identifiers', () => {
    const plan = makeMediaPlan();
    const result = convertPlanToWorkItems(plan, 'company-123');

    const sectionIds = result.workItemsToCreate.map(i => i.source.sectionId);
    expect(sectionIds).toContain('channelMix');
    expect(sectionIds).toContain('campaigns');
  });

  it('includes human-readable section names', () => {
    const plan = makeMediaPlan();
    const result = convertPlanToWorkItems(plan, 'company-123');

    const sectionNames = result.workItemsToCreate.map(i => i.source.sectionName);
    expect(sectionNames).toContain('Channel Mix');
    expect(sectionNames).toContain('Campaigns');
  });

  it('includes convertedAt timestamp', () => {
    const plan = makeMediaPlan();
    const before = new Date().toISOString();
    const result = convertPlanToWorkItems(plan, 'company-123');
    const after = new Date().toISOString();

    const item = result.workItemsToCreate[0];
    expect(item.source.convertedAt >= before).toBe(true);
    expect(item.source.convertedAt <= after).toBe(true);
  });
});
