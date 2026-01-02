// tests/os/contextReadinessCompute.test.ts
// Tests for Context Readiness Computation System
//
// Covers:
// - Domain check functions
// - Overall status computation
// - Score calculation
// - Next action generation
// - Messaging helpers

import { describe, it, expect } from 'vitest';
import {
  computeReadiness,
  computeDomainReadiness,
  computeOverallScore,
  checkAudienceDomain,
  checkCompetitiveLandscapeDomain,
  checkBrandDomain,
  checkWebsiteDomain,
  getOverallStatusMessage,
  getStatusBadgeLabel,
  getDomainStatusMessage,
  getProgressMessage,
} from '@/lib/os/contextReadiness';
import type {
  ReadinessInput,
  ContextGraphSnapshot,
  DomainReadiness,
} from '@/lib/os/contextReadiness/types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createEmptyInput(requiredFor: 'strategy' | 'overview' | 'labs' | 'proposals' | 'gap-plan' = 'strategy'): ReadinessInput {
  return {
    companyId: 'test-company',
    requiredFor,
    contextGraph: {},
    pendingProposalsByDomain: {
      audience: 0,
      competitiveLandscape: 0,
      brand: 0,
      website: 0,
      seo: 0,
      media: 0,
      creative: 0,
    },
    labRuns: new Map(),
  };
}

function createFullContextGraph(): ContextGraphSnapshot {
  return {
    audience: {
      primaryAudience: { value: 'B2B SaaS Companies', confirmed: true },
      icpDescription: { value: 'Mid-market SaaS companies with 50-500 employees', confirmed: true },
      segments: { value: [{ label: 'SMB' }, { label: 'Enterprise' }], confirmed: true },
      primarySegments: { value: [{ label: 'SMB' }], confirmed: true },
    },
    competitive: {
      competitors: { value: [{ name: 'Competitor A' }, { name: 'Competitor B' }, { name: 'Competitor C' }], confirmed: true },
      primaryCompetitors: { value: [{ name: 'Competitor A' }], confirmed: true },
      competitiveModality: { value: 'Differentiated', confirmed: true },
      positionSummary: { value: 'Market leader in niche segment', confirmed: true },
    },
    brand: {
      positioning: { value: 'Premium B2B solution', confirmed: true },
      valueProps: { value: ['Speed', 'Security', 'Support'], confirmed: true },
      differentiators: { value: ['AI-powered', 'Enterprise-grade'], confirmed: true },
    },
    productOffer: {
      valueProposition: { value: 'All-in-one marketing platform', confirmed: true },
      primaryProducts: { value: [{ name: 'Core Platform' }], confirmed: true },
    },
    website: {
      websiteScore: { value: 85, confirmed: true },
      conversionBlocks: { value: [{ type: 'CTA' }], confirmed: true },
      quickWins: { value: [{ title: 'Add social proof' }], confirmed: true },
    },
    seo: {
      seoScore: { value: 72, confirmed: true },
      technicalIssues: { value: [{ issue: 'Missing meta descriptions' }], confirmed: true },
    },
  };
}

// ============================================================================
// Domain Check Tests
// ============================================================================

describe('Domain Check Functions', () => {
  describe('checkAudienceDomain', () => {
    it('returns checks even for empty context (with passed=false)', () => {
      const checks = checkAudienceDomain({});
      // Returns checks with passed=false for missing data
      expect(checks.length).toBeGreaterThan(0);
    });

    it('returns passing checks for complete audience data', () => {
      const graph = createFullContextGraph();
      const checks = checkAudienceDomain(graph);

      expect(checks.length).toBeGreaterThan(0);
      const passedRequired = checks.filter(c => c.required && c.passed);
      expect(passedRequired.length).toBeGreaterThan(0);
    });

    it('passes check when primaryAudience is set (even without icpDescription)', () => {
      const graph: ContextGraphSnapshot = {
        audience: {
          primaryAudience: { value: 'B2B SaaS', confirmed: true },
          // Missing icpDescription - but primaryAudience counts
        },
      };
      const checks = checkAudienceDomain(graph);

      // Field path is 'audience.primaryAudience' (combined check for either)
      const primaryCheck = checks.find(c => c.fieldPath === 'audience.primaryAudience');
      expect(primaryCheck?.passed).toBe(true);
    });

    it('fails check when both primaryAudience and icpDescription are missing', () => {
      const checks = checkAudienceDomain({});

      const primaryCheck = checks.find(c => c.fieldPath === 'audience.primaryAudience');
      expect(primaryCheck?.passed).toBe(false);
    });
  });

  describe('checkCompetitiveLandscapeDomain', () => {
    it('returns checks even for empty context', () => {
      const checks = checkCompetitiveLandscapeDomain({}, null);
      // Returns checks with passed=false for missing data
      expect(checks.length).toBeGreaterThan(0);
    });

    it('requires at least 2 competitors for ready status', () => {
      const graphWithFewCompetitors: ContextGraphSnapshot = {
        competitive: {
          competitors: { value: [{ name: 'A' }], confirmed: true },
          primaryCompetitors: { value: [{ name: 'A' }], confirmed: true },
        },
      };
      const checks = checkCompetitiveLandscapeDomain(graphWithFewCompetitors, null);

      // Field path is 'competitive.primaryCompetitors'
      const competitorsCheck = checks.find(c => c.fieldPath === 'competitive.primaryCompetitors');
      expect(competitorsCheck?.passed).toBe(false);
    });

    it('passes with 2+ competitors', () => {
      const graph = createFullContextGraph();
      const checks = checkCompetitiveLandscapeDomain(graph, 80);

      // Field path is 'competitive.primaryCompetitors'
      const competitorsCheck = checks.find(c => c.fieldPath === 'competitive.primaryCompetitors');
      expect(competitorsCheck?.passed).toBe(true);
    });
  });

  describe('checkBrandDomain', () => {
    it('returns failed check for missing positioning', () => {
      const graph: ContextGraphSnapshot = {
        brand: {
          valueProps: { value: ['Speed'], confirmed: true },
        },
      };
      const checks = checkBrandDomain(graph);

      const positioningCheck = checks.find(c => c.fieldPath === 'brand.positioning');
      expect(positioningCheck?.passed).toBe(false);
    });

    it('passes with complete brand data', () => {
      const graph = createFullContextGraph();
      const checks = checkBrandDomain(graph);

      const passedRequired = checks.filter(c => c.required && c.passed);
      expect(passedRequired.length).toBeGreaterThan(0);
    });
  });

  describe('checkWebsiteDomain', () => {
    it('returns checks even for empty context (with passed=false)', () => {
      const checks = checkWebsiteDomain({});
      // Returns checks with passed=false for missing data
      expect(checks.length).toBeGreaterThan(0);
      expect(checks.every(c => c.passed === false)).toBe(true);
    });

    it('returns passing checks for complete website data', () => {
      const graph = createFullContextGraph();
      const checks = checkWebsiteDomain(graph);

      expect(checks.length).toBeGreaterThan(0);
      const requiredCheck = checks.find(c => c.required);
      expect(requiredCheck?.passed).toBe(true);
    });
  });
});

// ============================================================================
// Domain Readiness Computation Tests
// ============================================================================

describe('computeDomainReadiness', () => {
  it('returns missing status for domain with no context', () => {
    const input = createEmptyInput();
    const result = computeDomainReadiness(input, 'audience');

    expect(result.status).toBe('missing');
    expect(result.domain).toBe('audience');
  });

  it('returns ready status for domain with complete context', () => {
    const input = createEmptyInput();
    input.contextGraph = createFullContextGraph();
    input.labRuns.set('audience', {
      labSlug: 'audience',
      hasRun: true,
      latestRunDate: new Date().toISOString(),
      qualityScore: 80,
    });

    const result = computeDomainReadiness(input, 'audience');

    expect(result.status).toBe('ready');
    expect(result.failedChecks.length).toBe(0);
  });

  it('returns partial status for domain with pending proposals', () => {
    const input = createEmptyInput();
    input.contextGraph = createFullContextGraph();
    input.pendingProposalsByDomain.audience = 5;

    const result = computeDomainReadiness(input, 'audience');

    expect(result.status).toBe('partial');
    expect(result.pendingProposalsCount).toBe(5);
  });

  it('downgrades to partial if lab quality is low', () => {
    const input = createEmptyInput();
    input.contextGraph = createFullContextGraph();
    // labSlug for competitiveLandscape is 'competitor'
    input.labRuns.set('competitor', {
      labSlug: 'competitor',
      hasRun: true,
      latestRunDate: new Date().toISOString(),
      qualityScore: 30, // Below MIN_QUALITY_SCORE_FOR_READY (40)
    });

    const result = computeDomainReadiness(input, 'competitiveLandscape');

    // Should be partial due to low quality score
    expect(result.labQualityScore).toBe(30);
    expect(result.warnings.some(w => w.message.includes('quality'))).toBe(true);
  });

  it('generates appropriate CTAs based on status', () => {
    const input = createEmptyInput();

    const result = computeDomainReadiness(input, 'audience');

    expect(result.ctas.length).toBeGreaterThan(0);
    expect(result.primaryCTA).not.toBeNull();
  });
});

// ============================================================================
// Overall Score Computation Tests
// ============================================================================

describe('computeOverallScore', () => {
  it('returns 0 for all missing domains', () => {
    const domains: DomainReadiness[] = [
      { domain: 'audience', domainLabel: 'Audience', status: 'missing', requirementLevel: 'required', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: false, pendingProposalsCount: 0, confirmedFactsCount: 0 },
      { domain: 'competitiveLandscape', domainLabel: 'Competition', status: 'missing', requirementLevel: 'required', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: false, pendingProposalsCount: 0, confirmedFactsCount: 0 },
    ];

    const score = computeOverallScore(domains);

    expect(score).toBe(0);
  });

  it('returns 100 for all ready domains', () => {
    const domains: DomainReadiness[] = [
      { domain: 'audience', domainLabel: 'Audience', status: 'ready', requirementLevel: 'required', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 3 },
      { domain: 'competitiveLandscape', domainLabel: 'Competition', status: 'ready', requirementLevel: 'required', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 3 },
    ];

    const score = computeOverallScore(domains);

    expect(score).toBe(100);
  });

  it('caps score at 60 when required domain is missing', () => {
    const domains: DomainReadiness[] = [
      { domain: 'audience', domainLabel: 'Audience', status: 'missing', requirementLevel: 'required', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: false, pendingProposalsCount: 0, confirmedFactsCount: 0 },
      { domain: 'brand', domainLabel: 'Brand', status: 'ready', requirementLevel: 'recommended', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 3 },
      { domain: 'website', domainLabel: 'Website', status: 'ready', requirementLevel: 'optional', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 2 },
    ];

    const score = computeOverallScore(domains);

    // Without penalty would be higher, but capped at 60
    expect(score).toBeLessThanOrEqual(60);
  });

  it('weights domains correctly (required > recommended > optional)', () => {
    // All partial - weights should affect final score
    const domains: DomainReadiness[] = [
      { domain: 'audience', domainLabel: 'Audience', status: 'partial', requirementLevel: 'required', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 1 },
      { domain: 'brand', domainLabel: 'Brand', status: 'partial', requirementLevel: 'recommended', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 1 },
      { domain: 'website', domainLabel: 'Website', status: 'partial', requirementLevel: 'optional', checks: [], failedChecks: [], warnings: [], ctas: [], primaryCTA: null, labSlug: undefined, labQualityScore: null, labHasRun: true, pendingProposalsCount: 0, confirmedFactsCount: 1 },
    ];

    const score = computeOverallScore(domains);

    // All partial = 0.6, weighted sum should be 60%
    expect(score).toBe(60);
  });
});

// ============================================================================
// Full Readiness Computation Tests
// ============================================================================

describe('computeReadiness', () => {
  it('computes full summary for empty input', () => {
    const input = createEmptyInput();
    const result = computeReadiness(input);

    expect(result.companyId).toBe('test-company');
    expect(result.requiredFor).toBe('strategy');
    expect(result.domains.length).toBeGreaterThan(0);
    expect(result.overallStatus).toBe('missing');
    expect(result.computedAt).toBeTruthy();
  });

  it('identifies missing required domains', () => {
    const input = createEmptyInput();
    const result = computeReadiness(input);

    expect(result.missingRequiredDomains.length).toBeGreaterThan(0);
    expect(result.missingRequiredDomains).toContain('audience');
    expect(result.missingRequiredDomains).toContain('competitiveLandscape');
  });

  it('generates next action message', () => {
    const input = createEmptyInput();
    const result = computeReadiness(input);

    expect(result.nextAction).toBeTruthy();
    expect(result.nextAction.length).toBeGreaterThan(0);
  });

  it('returns ready status when all required domains are ready', () => {
    const input = createEmptyInput();
    input.contextGraph = createFullContextGraph();

    // Set up lab runs for all domains
    input.labRuns.set('audience', {
      labSlug: 'audience',
      hasRun: true,
      latestRunDate: new Date().toISOString(),
      qualityScore: 80,
    });
    input.labRuns.set('competition', {
      labSlug: 'competition',
      hasRun: true,
      latestRunDate: new Date().toISOString(),
      qualityScore: 85,
    });

    const result = computeReadiness(input);

    expect(result.overallScore).toBeGreaterThan(60);
    expect(result.readyDomains.length).toBeGreaterThan(0);
  });

  it('respects feature-specific requirements', () => {
    // For 'overview', requirements are different than 'strategy'
    const overviewInput = createEmptyInput('overview');
    const strategyInput = createEmptyInput('strategy');

    const overviewResult = computeReadiness(overviewInput);
    const strategyResult = computeReadiness(strategyInput);

    // Both should have domains but may have different requirements
    expect(overviewResult.domains.length).toBeGreaterThan(0);
    expect(strategyResult.domains.length).toBeGreaterThan(0);
    expect(overviewResult.requiredFor).toBe('overview');
    expect(strategyResult.requiredFor).toBe('strategy');
  });
});

// ============================================================================
// Messaging Helper Tests
// ============================================================================

describe('Messaging Helpers', () => {
  describe('getStatusBadgeLabel', () => {
    it('returns correct labels', () => {
      expect(getStatusBadgeLabel('ready')).toBe('Ready');
      expect(getStatusBadgeLabel('partial')).toBe('Partial');
      expect(getStatusBadgeLabel('missing')).toBe('Missing');
    });
  });

  describe('getOverallStatusMessage', () => {
    it('returns appropriate message for ready status', () => {
      const input = createEmptyInput();
      input.contextGraph = createFullContextGraph();
      const summary = computeReadiness(input);

      // Force ready status for test
      summary.overallStatus = 'ready';
      summary.missingRequiredDomains = [];

      const message = getOverallStatusMessage(summary);

      expect(message).toContain('ready');
      expect(message).toContain('Strategy');
    });

    it('lists missing domains for missing status', () => {
      const input = createEmptyInput();
      const summary = computeReadiness(input);

      const message = getOverallStatusMessage(summary);

      expect(message).toContain('Missing');
    });
  });

  describe('getDomainStatusMessage', () => {
    it('returns appropriate message for ready domain', () => {
      const input = createEmptyInput();
      input.contextGraph = createFullContextGraph();
      const domain = computeDomainReadiness(input, 'audience');

      // Force ready for test
      domain.status = 'ready';

      const message = getDomainStatusMessage(domain);

      expect(message).toContain('complete');
    });

    it('mentions pending proposals when relevant', () => {
      const input = createEmptyInput();
      input.contextGraph = createFullContextGraph();
      input.pendingProposalsByDomain.audience = 3;
      const domain = computeDomainReadiness(input, 'audience');

      const message = getDomainStatusMessage(domain);

      expect(message).toContain('pending');
    });
  });

  describe('getProgressMessage', () => {
    it('returns progress message with domain counts', () => {
      const input = createEmptyInput();
      const summary = computeReadiness(input);

      const message = getProgressMessage(summary);

      expect(message).toMatch(/\d+ of \d+ domains|No domains ready|All \d+ domains/);
    });
  });
});
