// tests/programs/createWebsiteProgramSkeleton.test.ts
// Tests for Website Program skeleton generator
//
// Validates that createWebsiteProgramSkeleton() produces valid plans
// with correct structure even with empty/minimal inputs.

import { describe, it, expect } from 'vitest';
import {
  createWebsiteProgramSkeleton,
  type WebsiteProgramSkeletonInput,
  type WebsiteLabSummary,
} from '@/lib/os/programs/website/createWebsiteProgramSkeleton';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeEmptyInput(): WebsiteProgramSkeletonInput {
  return {
    companyId: 'test-company-123',
    contextGraph: null,
    strategyExcerpt: null,
    websiteLabSummary: null,
  };
}

function makeMinimalContextGraph(): Partial<CompanyContextGraph> {
  return {
    companyId: 'test-company-123',
    companyName: 'Test Company',
    meta: {
      version: '2.0.0',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastFusionAt: null,
      lastFusionRunId: null,
      completenessScore: 50,
      domainCoverage: {},
      lastSnapshotId: 'snap-123',
    },
    identity: {
      businessName: { value: 'Test Company', provenance: [] },
      businessModel: { value: 'B2B SaaS', provenance: [] },
      industry: { value: 'Technology', provenance: [] },
    },
    audience: {
      primaryAudience: { value: 'Small business owners', provenance: [] },
    },
    objectives: {
      primaryObjective: { value: 'Generate qualified leads', provenance: [] },
    },
    operationalConstraints: {
      minBudget: { value: 5000, provenance: [] },
      maxBudget: { value: 15000, provenance: [] },
    },
  } as unknown as CompanyContextGraph;
}

function makeWebsiteLabSummary(): WebsiteLabSummary {
  return {
    runId: 'lab-run-123',
    runDate: '2024-01-15T00:00:00Z',
    websiteScore: 65,
    executiveSummary: 'The website has good structure but needs mobile optimization.',
    criticalIssues: [
      'Mobile layout issues on product pages',
      'Slow page load times on homepage',
      'Form validation errors',
    ],
    quickWins: [
      'Add meta descriptions to key pages',
      'Compress hero images',
    ],
    conversionBlocks: [
      'Contact form has 8 required fields',
      'No clear CTA on landing page',
    ],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('createWebsiteProgramSkeleton', () => {
  describe('basic structure', () => {
    it('returns 3 priorities with empty inputs', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      expect(result.priorities).toBeDefined();
      expect(result.priorities.length).toBeGreaterThanOrEqual(3);
      expect(result.priorities.every(p => p.label && p.label.length > 0)).toBe(true);
    });

    it('returns 3 phases with empty inputs', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      expect(result.sequencing).toBeDefined();
      expect(result.sequencing.length).toBe(3);
      expect(result.sequencing.every(p => p.phase && p.items.length > 0)).toBe(true);
    });

    it('returns readiness gates with empty inputs', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      expect(result.readinessGates).toBeDefined();
      expect(result.readinessGates.length).toBeGreaterThanOrEqual(2);
      expect(result.readinessGates.every(g => g.gate && g.criteria.length > 0)).toBe(true);
    });

    it('includes title and summary', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      expect(result.title).toBeDefined();
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('includes inputs snapshot with companyId', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      expect(result.inputsSnapshot).toBeDefined();
      expect(result.inputsSnapshot.companyId).toBe('test-company-123');
      expect(result.inputsSnapshot.capturedAt).toBeDefined();
    });
  });

  describe('with context graph', () => {
    it('uses company name in title', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: makeMinimalContextGraph() as CompanyContextGraph,
        strategyExcerpt: null,
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.title).toContain('Test Company');
    });

    it('includes audience in summary', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: makeMinimalContextGraph() as CompanyContextGraph,
        strategyExcerpt: null,
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.summary).toContain('Small business owners');
    });

    it('captures context revision id in snapshot', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: makeMinimalContextGraph() as CompanyContextGraph,
        strategyExcerpt: null,
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.inputsSnapshot.contextRevisionId).toBe('snap-123');
    });

    it('captures budget constraints in snapshot', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: makeMinimalContextGraph() as CompanyContextGraph,
        strategyExcerpt: null,
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.inputsSnapshot.constraints?.minBudget).toBe(5000);
      expect(result.inputsSnapshot.constraints?.maxBudget).toBe(15000);
    });
  });

  describe('with website lab summary', () => {
    it('adapts priorities based on critical issues', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: null,
        strategyExcerpt: null,
        websiteLabSummary: makeWebsiteLabSummary(),
      };

      const result = createWebsiteProgramSkeleton(input);

      // Should have mobile-related priority since lab mentioned mobile issues
      const hasMobilePriority = result.priorities.some(
        p => p.label.toLowerCase().includes('mobile') ||
             p.rationale?.toLowerCase().includes('mobile')
      );

      // Either has mobile priority or speed priority (both mentioned in lab)
      const hasRelevantPriority = hasMobilePriority ||
        result.priorities.some(p =>
          p.label.toLowerCase().includes('speed') ||
          p.label.toLowerCase().includes('performance')
        );

      expect(hasRelevantPriority).toBe(true);
    });

    it('incorporates critical issues into Phase 1', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: null,
        strategyExcerpt: null,
        websiteLabSummary: makeWebsiteLabSummary(),
      };

      const result = createWebsiteProgramSkeleton(input);

      const phase1 = result.sequencing[0];
      expect(phase1.phase).toContain('Phase 1');

      // Should include at least one critical issue in Phase 1
      const criticalIssues = makeWebsiteLabSummary().criticalIssues!;
      const hasLabIssue = phase1.items.some(item =>
        criticalIssues.some(issue =>
          item.toLowerCase().includes(issue.toLowerCase().split(' ')[0])
        ) || criticalIssues.includes(item)
      );

      expect(hasLabIssue).toBe(true);
    });

    it('captures website lab run id in snapshot', () => {
      const labSummary = makeWebsiteLabSummary();
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: null,
        strategyExcerpt: null,
        websiteLabSummary: labSummary,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.inputsSnapshot.websiteLabRunId).toBe('lab-run-123');
    });
  });

  describe('with strategy excerpt', () => {
    it('includes objective in summary', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: null,
        strategyExcerpt: {
          id: 'strategy-123',
          title: 'Growth Strategy 2024',
          primaryObjective: 'Increase lead generation by 50%',
          positioning: 'The affordable solution for small teams',
        },
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.summary).toContain('lead generation');
    });

    it('adapts title based on lead-focused objective', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: makeMinimalContextGraph() as CompanyContextGraph,
        strategyExcerpt: {
          primaryObjective: 'Generate more qualified leads',
        },
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      // Title should mention conversion since it's lead-focused
      expect(result.title.toLowerCase()).toContain('conversion');
    });

    it('captures strategy id in snapshot', () => {
      const input: WebsiteProgramSkeletonInput = {
        companyId: 'test-company-123',
        contextGraph: null,
        strategyExcerpt: {
          id: 'strategy-456',
        },
        websiteLabSummary: null,
      };

      const result = createWebsiteProgramSkeleton(input);

      expect(result.inputsSnapshot.strategyId).toBe('strategy-456');
    });
  });

  describe('phase structure validation', () => {
    it('Phase 1 focuses on fundamentals', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      const phase1 = result.sequencing[0];
      expect(phase1.phase.toLowerCase()).toContain('fundamental');
    });

    it('Phase 2 focuses on conversion paths', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      const phase2 = result.sequencing[1];
      expect(phase2.phase.toLowerCase()).toContain('conversion');
    });

    it('Phase 3 focuses on optimization', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      const phase3 = result.sequencing[2];
      expect(phase3.phase.toLowerCase()).toContain('optim');
    });
  });

  describe('readiness gates validation', () => {
    it('includes traffic-ready gate', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      const hasTrafficGate = result.readinessGates.some(
        g => g.gate.toLowerCase().includes('traffic')
      );
      expect(hasTrafficGate).toBe(true);
    });

    it('includes conversion tracking gate', () => {
      const input = makeEmptyInput();
      const result = createWebsiteProgramSkeleton(input);

      const hasTrackingGate = result.readinessGates.some(
        g => g.gate.toLowerCase().includes('tracking') ||
             g.gate.toLowerCase().includes('conversion')
      );
      expect(hasTrackingGate).toBe(true);
    });
  });
});
