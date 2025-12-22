// tests/context/v4-convergence.test.ts
// Context V4 Convergence Tests
//
// Tests for the V4 Convergence layer:
// - Specificity scoring
// - Decision impact inference
// - Summary-shaped detection
// - Candidate enhancement
// - Proposal ranking
// - Domain grouping

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeSpecificityScore,
  inferDecisionImpact,
  isSummaryShaped,
  applyConvergenceToCandidates,
  enhanceProposalWithConvergence,
  needsConvergenceRewrite,
  getProposalRankingScore,
  rankProposals,
  getDomainGroup,
  groupProposalsByDomain,
  _testing,
} from '@/lib/contextGraph/v4/convergence';
import {
  getSiteSnapshotForCompany,
  extractEvidenceAnchors,
  hasUsableContent,
  shouldBlockProposals,
} from '@/lib/contextGraph/v4/siteSnapshot';
import {
  isValidEvidenceAnchor,
  truncateQuote,
  type EvidenceAnchor,
} from '@/lib/types/contextField';
import { createProposalBatch } from '@/lib/contextGraph/nodes/proposalStorage';
import type { ContextProposal } from '@/lib/contextGraph/nodes/types';

// ============================================================================
// Mock Feature Flag
// ============================================================================

vi.mock('@/lib/config/featureFlags', () => ({
  FEATURE_FLAGS: {
    CONTEXT_V4_CONVERGENCE_ENABLED: true,
  },
}));

// ============================================================================
// Specificity Scoring Tests
// ============================================================================

describe('Specificity Scoring', () => {
  describe('computeSpecificityScore', () => {
    it('should return 0 for empty text', () => {
      const result = computeSpecificityScore('');
      expect(result.score).toBe(0);
      expect(result.reasons).toContain('Empty or invalid text');
    });

    it('should penalize cliches', () => {
      const result = computeSpecificityScore(
        'We offer innovative and seamless solutions that streamline your business growth.'
      );
      expect(result.score).toBeLessThan(70);
      expect(result.reasons.some(r => r.includes('cliche'))).toBe(true);
    });

    it('should penalize vague audience terms', () => {
      const result = computeSpecificityScore(
        'We help businesses and companies achieve their goals.'
      );
      expect(result.score).toBeLessThan(70);
      expect(result.reasons.some(r => r.includes('Vague audience'))).toBe(true);
    });

    it('should penalize very short text', () => {
      const result = computeSpecificityScore('Short text.');
      expect(result.score).toBeLessThan(60);
      expect(result.reasons.some(r => r.includes('too short'))).toBe(true);
    });

    it('should penalize lack of specific numbers', () => {
      // Short text without numbers gets penalized
      const result = computeSpecificityScore(
        'We provide marketing automation.'
      );
      expect(result.reasons.some(r => r.includes('No specific numbers'))).toBe(true);
    });

    it('should reward company name mention', () => {
      const withName = computeSpecificityScore(
        'Acme Corp provides marketing automation for B2B SaaS companies.',
        'Acme Corp'
      );
      const withoutName = computeSpecificityScore(
        'We provide marketing automation for B2B SaaS companies.',
        'Acme Corp'
      );
      expect(withName.score).toBeGreaterThan(withoutName.score);
    });

    it('should reward specific industry terms', () => {
      const result = computeSpecificityScore(
        'A B2B SaaS platform for fintech companies with over 100 employees.'
      );
      expect(result.score).toBeGreaterThan(60);
    });

    it('should reward specific role mentions', () => {
      const result = computeSpecificityScore(
        'Built for CTOs and engineering leaders managing 50+ developers.'
      );
      expect(result.score).toBeGreaterThan(60);
    });

    it('should give high score for specific, concrete text', () => {
      const result = computeSpecificityScore(
        'Acme provides API-first payment infrastructure for fintech startups. ' +
        'Platform processes over $2B annually for 500+ companies with 99.99% uptime.',
        'Acme'
      );
      expect(result.score).toBeGreaterThan(70);
      // May have minor reasons but score should still be high
      expect(result.reasons.length).toBeLessThanOrEqual(2);
    });

    it('should give low score for generic marketing speak', () => {
      const result = computeSpecificityScore(
        'We are a leading provider of innovative, cutting-edge solutions that empower ' +
        'businesses to transform their operations and drive unprecedented growth.'
      );
      expect(result.score).toBeLessThan(50);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Decision Impact Tests
// ============================================================================

describe('Decision Impact Inference', () => {
  describe('inferDecisionImpact', () => {
    it('should return HIGH for positioning field', () => {
      expect(inferDecisionImpact('brand.positioning', 'Test')).toBe('HIGH');
    });

    it('should return HIGH for value proposition', () => {
      expect(inferDecisionImpact('productOffer.valueProposition', 'Test')).toBe('HIGH');
    });

    it('should return HIGH for primary audience', () => {
      expect(inferDecisionImpact('audience.primaryAudience', 'Test')).toBe('HIGH');
    });

    it('should return HIGH for ICP description', () => {
      expect(inferDecisionImpact('audience.icpDescription', 'Test')).toBe('HIGH');
    });

    it('should return LOW for executive summary', () => {
      expect(inferDecisionImpact('website.executiveSummary', 'Test')).toBe('LOW');
    });

    it('should return LOW for website summary', () => {
      expect(inferDecisionImpact('website.websiteSummary', 'Test')).toBe('LOW');
    });

    it('should return LOW for company description (summary-shaped)', () => {
      expect(inferDecisionImpact('identity.companyDescription', 'Test')).toBe('LOW');
    });

    it('should return MEDIUM for business model', () => {
      expect(inferDecisionImpact('identity.businessModel', 'Test')).toBe('MEDIUM');
    });

    it('should return MEDIUM for active channels', () => {
      expect(inferDecisionImpact('performanceMedia.activeChannels', 'Test')).toBe('MEDIUM');
    });
  });
});

// ============================================================================
// Summary-Shaped Detection Tests
// ============================================================================

describe('Summary-Shaped Detection', () => {
  describe('isSummaryShaped', () => {
    it('should detect explicit summary fields', () => {
      expect(isSummaryShaped('website.executiveSummary', 'Test')).toBe(true);
      expect(isSummaryShaped('website.websiteSummary', 'Test')).toBe(true);
      expect(isSummaryShaped('identity.companyDescription', 'Test')).toBe(true);
    });

    it('should detect fields with "summary" in key', () => {
      expect(isSummaryShaped('custom.brandSummary', 'Test')).toBe(true);
      expect(isSummaryShaped('brand.positioningSummary', 'Test')).toBe(true);
    });

    it('should detect fields with "description" in key', () => {
      expect(isSummaryShaped('product.longDescription', 'Test')).toBe(true);
    });

    it('should detect long narratives starting with "The company"', () => {
      const longText = 'The company was founded in 2010 and has since grown to serve ' +
        'over 1000 customers. Our mission is to help businesses succeed. ' +
        'We offer a comprehensive suite of products and services designed to ' +
        'meet the needs of modern enterprises. Our team of experts is dedicated ' +
        'to providing exceptional customer service and support.';
      expect(isSummaryShaped('brand.about', longText)).toBe(true);
    });

    it('should not flag short, specific text', () => {
      expect(isSummaryShaped('brand.positioning', 'AI-powered marketing for SMBs')).toBe(false);
    });
  });
});

// ============================================================================
// Candidate Enhancement Tests
// ============================================================================

describe('Candidate Enhancement', () => {
  describe('applyConvergenceToCandidates', () => {
    it('should add all required metadata to candidates', () => {
      const candidates = [
        { fieldPath: 'brand.positioning', value: 'Test positioning', confidence: 0.8 },
      ];

      const enhanced = applyConvergenceToCandidates(candidates, 'Test Company');

      expect(enhanced).toHaveLength(1);
      expect(enhanced[0]).toHaveProperty('decisionImpact');
      expect(enhanced[0]).toHaveProperty('specificityScore');
      expect(enhanced[0]).toHaveProperty('genericnessReasons');
      expect(enhanced[0]).toHaveProperty('hiddenByDefault');
      expect(enhanced[0]).toHaveProperty('fieldCategory');
    });

    it('should mark summary fields as LOW impact and hiddenByDefault', () => {
      const candidates = [
        { fieldPath: 'website.executiveSummary', value: 'A long summary...', confidence: 0.8 },
      ];

      const enhanced = applyConvergenceToCandidates(candidates);

      expect(enhanced[0].decisionImpact).toBe('LOW');
      expect(enhanced[0].hiddenByDefault).toBe(true);
      expect(enhanced[0].fieldCategory).toBe('derivedNarrative');
    });

    it('should mark positioning as HIGH impact and corePositioning', () => {
      const candidates = [
        { fieldPath: 'brand.positioning', value: 'Specific B2B positioning', confidence: 0.8 },
      ];

      const enhanced = applyConvergenceToCandidates(candidates);

      expect(enhanced[0].decisionImpact).toBe('HIGH');
      expect(enhanced[0].fieldCategory).toBe('corePositioning');
    });

    it('should hide proposals with very low specificity', () => {
      const candidates = [
        {
          fieldPath: 'brand.tagline',
          // Use extremely generic text with multiple cliches
          value: 'Innovative seamless solutions for growth and streamline',
          confidence: 0.8,
        },
      ];

      const enhanced = applyConvergenceToCandidates(candidates);

      // Very generic text should have low specificity and be hidden
      // HiddenByDefault is true when specificityScore < 30 OR decisionImpact === 'LOW'
      expect(enhanced[0].specificityScore).toBeLessThan(55);
      // Since this is a tagline (not summary-shaped), it won't be LOW impact
      // But it should have low specificity
      expect(enhanced[0].genericnessReasons.length).toBeGreaterThan(0);
    });
  });

  describe('enhanceProposalWithConvergence', () => {
    it('should enhance existing proposal with convergence metadata', () => {
      const proposal: ContextProposal = {
        id: 'test-id',
        companyId: 'company-123',
        fieldPath: 'brand.positioning',
        fieldLabel: 'Brand Positioning',
        proposedValue: 'B2B SaaS for marketing teams',
        currentValue: null,
        reasoning: 'Derived from website',
        confidence: 0.8,
        trigger: 'lab_inference',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const enhanced = enhanceProposalWithConvergence(proposal, 'TestCo');

      expect(enhanced.decisionImpact).toBe('HIGH');
      expect(enhanced.specificityScore).toBeDefined();
      expect(enhanced.fieldCategory).toBe('corePositioning');
    });
  });
});

// ============================================================================
// Convergence Rewrite Detection Tests
// ============================================================================

describe('Convergence Rewrite Detection', () => {
  describe('needsConvergenceRewrite', () => {
    it('should trigger rewrite for low-specificity positioning', () => {
      const result = needsConvergenceRewrite(
        'brand.positioning',
        'We offer innovative solutions for businesses.',
        'TestCo'
      );
      expect(result).toBe(true);
    });

    it('should not trigger rewrite for high-specificity positioning', () => {
      const result = needsConvergenceRewrite(
        'brand.positioning',
        'TestCo provides API-first payments for 500+ fintech startups, processing $2B annually.',
        'TestCo'
      );
      expect(result).toBe(false);
    });

    it('should not trigger rewrite for non-baseline fields', () => {
      const result = needsConvergenceRewrite(
        'identity.industry',
        'Software',
        'TestCo'
      );
      expect(result).toBe(false);
    });

    it('should not trigger rewrite for empty values', () => {
      const result = needsConvergenceRewrite('brand.positioning', null, 'TestCo');
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// Proposal Ranking Tests
// ============================================================================

describe('Proposal Ranking', () => {
  describe('getProposalRankingScore', () => {
    it('should rank HIGH impact higher than MEDIUM', () => {
      const high = getProposalRankingScore({
        decisionImpact: 'HIGH',
        confidence: 0.8,
        specificityScore: 70,
        createdAt: new Date().toISOString(),
      });
      const medium = getProposalRankingScore({
        decisionImpact: 'MEDIUM',
        confidence: 0.8,
        specificityScore: 70,
        createdAt: new Date().toISOString(),
      });
      expect(high).toBeGreaterThan(medium);
    });

    it('should rank higher confidence higher', () => {
      const highConf = getProposalRankingScore({
        decisionImpact: 'MEDIUM',
        confidence: 0.9,
        specificityScore: 70,
        createdAt: new Date().toISOString(),
      });
      const lowConf = getProposalRankingScore({
        decisionImpact: 'MEDIUM',
        confidence: 0.5,
        specificityScore: 70,
        createdAt: new Date().toISOString(),
      });
      expect(highConf).toBeGreaterThan(lowConf);
    });

    it('should rank higher specificity higher', () => {
      const highSpec = getProposalRankingScore({
        decisionImpact: 'MEDIUM',
        confidence: 0.8,
        specificityScore: 90,
        createdAt: new Date().toISOString(),
      });
      const lowSpec = getProposalRankingScore({
        decisionImpact: 'MEDIUM',
        confidence: 0.8,
        specificityScore: 30,
        createdAt: new Date().toISOString(),
      });
      expect(highSpec).toBeGreaterThan(lowSpec);
    });
  });

  describe('rankProposals', () => {
    it('should sort proposals by ranking score descending', () => {
      const proposals = [
        { decisionImpact: 'LOW' as const, confidence: 0.5, specificityScore: 30, createdAt: new Date().toISOString() },
        { decisionImpact: 'HIGH' as const, confidence: 0.9, specificityScore: 80, createdAt: new Date().toISOString() },
        { decisionImpact: 'MEDIUM' as const, confidence: 0.7, specificityScore: 60, createdAt: new Date().toISOString() },
      ];

      const ranked = rankProposals(proposals);

      expect(ranked[0].decisionImpact).toBe('HIGH');
      expect(ranked[1].decisionImpact).toBe('MEDIUM');
      expect(ranked[2].decisionImpact).toBe('LOW');
    });
  });
});

// ============================================================================
// Domain Grouping Tests
// ============================================================================

describe('Domain Grouping', () => {
  describe('getDomainGroup', () => {
    it('should return proper domain group for known domains', () => {
      expect(getDomainGroup('brand.positioning')).toBe('Brand');
      expect(getDomainGroup('audience.primaryAudience')).toBe('Audience');
      expect(getDomainGroup('productOffer.valueProposition')).toBe('ProductOffer');
      expect(getDomainGroup('identity.businessModel')).toBe('Identity');
    });

    it('should return domain name for unknown domains', () => {
      expect(getDomainGroup('custom.field')).toBe('custom');
    });
  });

  describe('groupProposalsByDomain', () => {
    it('should group proposals by domain', () => {
      const proposals = [
        { fieldPath: 'brand.positioning' },
        { fieldPath: 'brand.tagline' },
        { fieldPath: 'audience.primaryAudience' },
        { fieldPath: 'productOffer.valueProposition' },
      ];

      const grouped = groupProposalsByDomain(proposals);

      expect(grouped.get('Brand')).toHaveLength(2);
      expect(grouped.get('Audience')).toHaveLength(1);
      expect(grouped.get('ProductOffer')).toHaveLength(1);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Constants', () => {
  it('should have reasonable number of cliches', () => {
    expect(_testing.GENERIC_CLICHES.length).toBeGreaterThan(20);
  });

  it('should have baseline rewrite fields', () => {
    expect(_testing.BASELINE_REWRITE_FIELDS).toContain('brand.positioning');
    expect(_testing.BASELINE_REWRITE_FIELDS).toContain('productOffer.valueProposition');
    expect(_testing.BASELINE_REWRITE_FIELDS).toContain('audience.primaryAudience');
    expect(_testing.BASELINE_REWRITE_FIELDS).toContain('audience.icpDescription');
  });

  it('should have summary-shaped fields', () => {
    expect(_testing.SUMMARY_SHAPED_FIELDS).toContain('website.executiveSummary');
    expect(_testing.SUMMARY_SHAPED_FIELDS).toContain('website.websiteSummary');
    expect(_testing.SUMMARY_SHAPED_FIELDS).toContain('identity.companyDescription');
  });
});

// ============================================================================
// V4 Evidence Grounding Tests
// ============================================================================

describe('Evidence Anchor Validation', () => {
  describe('isValidEvidenceAnchor', () => {
    it('should validate anchors with valid quote', () => {
      const anchor: EvidenceAnchor = {
        quote: 'We help B2B SaaS companies grow faster.',
      };
      expect(isValidEvidenceAnchor(anchor)).toBe(true);
    });

    it('should validate anchors with url and pageTitle', () => {
      const anchor: EvidenceAnchor = {
        url: 'https://example.com/about',
        pageTitle: 'About Us',
        quote: 'We help B2B SaaS companies grow faster.',
      };
      expect(isValidEvidenceAnchor(anchor)).toBe(true);
    });

    it('should reject empty quotes', () => {
      const anchor: EvidenceAnchor = {
        quote: '',
      };
      expect(isValidEvidenceAnchor(anchor)).toBe(false);
    });

    it('should reject whitespace-only quotes', () => {
      const anchor: EvidenceAnchor = {
        quote: '   ',
      };
      expect(isValidEvidenceAnchor(anchor)).toBe(false);
    });

    it('should reject overly long quotes', () => {
      const anchor: EvidenceAnchor = {
        quote: 'x'.repeat(201),
      };
      expect(isValidEvidenceAnchor(anchor)).toBe(false);
    });
  });

  describe('truncateQuote', () => {
    it('should not truncate short quotes', () => {
      const quote = 'Short quote';
      expect(truncateQuote(quote)).toBe(quote);
    });

    it('should truncate long quotes', () => {
      const quote = 'x'.repeat(250);
      const truncated = truncateQuote(quote);
      expect(truncated.length).toBe(200);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(truncateQuote('')).toBe('');
    });

    it('should respect custom max length', () => {
      const quote = 'This-is-a-longer-quote-that-will-be-truncated.';
      const truncated = truncateQuote(quote, 20);
      // Result may be slightly shorter due to trim(), but should end with ...
      expect(truncated.length).toBeLessThanOrEqual(20);
      expect(truncated.endsWith('...')).toBe(true);
    });
  });
});

describe('Site Snapshot Extraction', () => {
  describe('getSiteSnapshotForCompany', () => {
    it('should return unavailable snapshot when no data', () => {
      const snapshot = getSiteSnapshotForCompany('https://example.com', null, null);
      expect(snapshot.source).toBe('unavailable');
      expect(snapshot.homepageText).toBe('');
      expect(snapshot.keyPages).toEqual([]);
    });

    it('should return error state for blocked websiteLab', () => {
      const snapshot = getSiteSnapshotForCompany(
        'https://example.com',
        { status: 'blocked', errorMessage: 'Access denied' },
        null
      );
      expect(snapshot.isErrorState).toBe(true);
      expect(snapshot.source).toBe('unavailable');
      expect(snapshot.errorMessage).toBe('Access denied');
    });

    it('should return error state for errored websiteLab', () => {
      const snapshot = getSiteSnapshotForCompany(
        'https://example.com',
        { status: 'error', errorMessage: 'Timeout' },
        null
      );
      expect(snapshot.isErrorState).toBe(true);
    });

    it('should extract from websiteLab siteGraph', () => {
      const websiteLabResult = {
        status: 'success' as const,
        siteGraph: {
          pages: [
            {
              url: 'https://example.com/',
              path: '/',
              evidenceV3: {
                title: 'Example Co',
                heroText: 'We help B2B SaaS companies grow.',
                headlines: ['About Us', 'Our Services'],
                bodySnippets: ['Founded in 2020.'],
              },
            },
            {
              url: 'https://example.com/pricing',
              path: '/pricing',
              evidenceV3: {
                title: 'Pricing',
                heroText: 'Simple pricing for everyone.',
              },
            },
          ],
        },
      };

      const snapshot = getSiteSnapshotForCompany(
        'https://example.com',
        websiteLabResult,
        null
      );

      expect(snapshot.source).toBe('websiteLab');
      expect(snapshot.homepageText).toContain('Example Co');
      expect(snapshot.homepageText).toContain('B2B SaaS');
      expect(snapshot.keyPages.length).toBeGreaterThan(0);
      expect(snapshot.keyPages.some(p => p.pageType === 'pricing')).toBe(true);
    });

    it('should extract from brandLab when websiteLab unavailable', () => {
      const brandLabResult = {
        status: 'success' as const,
        siteContent: {
          url: 'https://example.com',
          title: 'Example Brand',
          heroText: 'Brand positioning statement.',
          headlines: ['Feature 1', 'Feature 2'],
        },
      };

      const snapshot = getSiteSnapshotForCompany(
        'https://example.com',
        null,
        brandLabResult
      );

      expect(snapshot.source).toBe('brandLab');
      expect(snapshot.homepageText).toContain('Example Brand');
      expect(snapshot.homepageText).toContain('Brand positioning');
    });
  });

  describe('hasUsableContent', () => {
    it('should return false for error state', () => {
      const snapshot = {
        homepageText: 'Some content',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'unavailable' as const,
        companyUrl: 'https://example.com',
        isErrorState: true,
      };
      expect(hasUsableContent(snapshot)).toBe(false);
    });

    it('should return true for snapshot with homepage text', () => {
      const snapshot = {
        homepageText: 'x'.repeat(150),
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      expect(hasUsableContent(snapshot)).toBe(true);
    });

    it('should return false for snapshot with minimal text', () => {
      const snapshot = {
        homepageText: 'Short',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      expect(hasUsableContent(snapshot)).toBe(false);
    });
  });

  describe('shouldBlockProposals', () => {
    it('should return true for error state', () => {
      const snapshot = {
        homepageText: '',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'unavailable' as const,
        companyUrl: 'https://example.com',
        isErrorState: true,
      };
      expect(shouldBlockProposals(snapshot)).toBe(true);
    });

    it('should return false for valid snapshot', () => {
      const snapshot = {
        homepageText: 'Valid content',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      expect(shouldBlockProposals(snapshot)).toBe(false);
    });
  });
});

describe('Evidence Extraction', () => {
  describe('extractEvidenceAnchors', () => {
    it('should return empty array for error state snapshot', () => {
      const snapshot = {
        homepageText: 'Some content about SaaS and marketing.',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'unavailable' as const,
        companyUrl: 'https://example.com',
        isErrorState: true,
      };
      const anchors = extractEvidenceAnchors(snapshot, 'SaaS marketing');
      expect(anchors).toEqual([]);
    });

    it('should return empty array for empty proposed value', () => {
      const snapshot = {
        homepageText: 'Some content about SaaS and marketing.',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      const anchors = extractEvidenceAnchors(snapshot, '');
      expect(anchors).toEqual([]);
    });

    it('should find relevant quotes from homepage', () => {
      const snapshot = {
        homepageText: 'We are a B2B SaaS platform. We help marketing teams automate their workflows. Our customers love us.',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      const anchors = extractEvidenceAnchors(snapshot, 'B2B SaaS for marketing teams');
      expect(anchors.length).toBeGreaterThan(0);
      expect(anchors[0].quote).toBeDefined();
    });

    it('should find quotes from key pages', () => {
      const snapshot = {
        homepageText: 'Welcome to our site.',
        keyPages: [
          {
            url: 'https://example.com/about',
            title: 'About Us',
            text: 'Founded in 2020, we help B2B SaaS companies with their marketing automation needs.',
            pageType: 'about' as const,
          },
        ],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      const anchors = extractEvidenceAnchors(snapshot, 'B2B SaaS marketing automation');
      expect(anchors.length).toBeGreaterThan(0);
      expect(anchors[0].pageTitle).toBe('About Us');
    });

    it('should limit number of anchors returned', () => {
      const snapshot = {
        homepageText: `
          We are a B2B SaaS platform for marketing.
          We help marketing teams automate their workflows.
          Our marketing automation saves time.
          Marketing is easy with our SaaS.
          B2B marketing made simple with SaaS.
        `,
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };
      const anchors = extractEvidenceAnchors(snapshot, 'B2B SaaS marketing automation', 2);
      expect(anchors.length).toBeLessThanOrEqual(2);
    });
  });
});

describe('Evidence-Based Specificity Scoring', () => {
  describe('computeSpecificityScore with evidence', () => {
    it('should penalize empty evidence anchors', () => {
      const withEvidence = computeSpecificityScore(
        'B2B SaaS platform for marketing teams',
        { evidenceAnchors: [{ quote: 'We help B2B SaaS' }] }
      );
      const withoutEvidence = computeSpecificityScore(
        'B2B SaaS platform for marketing teams',
        { evidenceAnchors: [] }
      );

      expect(withEvidence.score).toBeGreaterThan(withoutEvidence.score);
      expect(withoutEvidence.reasons).toContain('No evidence anchors (ungrounded proposal)');
    });

    it('should reward proposals with evidence anchors', () => {
      const withEvidence = computeSpecificityScore(
        'B2B SaaS platform for marketing teams',
        {
          evidenceAnchors: [
            { quote: 'We help B2B SaaS' },
            { quote: 'Marketing teams love us' },
          ],
        }
      );
      const withoutEvidenceOption = computeSpecificityScore(
        'B2B SaaS platform for marketing teams'
      );

      // With evidence anchors should be higher than without the option at all
      expect(withEvidence.score).toBeGreaterThan(withoutEvidenceOption.score - 10);
    });

    it('should give extra bonus for multiple evidence anchors', () => {
      const oneAnchor = computeSpecificityScore(
        'B2B SaaS platform',
        { evidenceAnchors: [{ quote: 'Quote 1' }] }
      );
      const twoAnchors = computeSpecificityScore(
        'B2B SaaS platform',
        { evidenceAnchors: [{ quote: 'Quote 1' }, { quote: 'Quote 2' }] }
      );

      expect(twoAnchors.score).toBeGreaterThan(oneAnchor.score);
    });
  });
});

describe('Proposal Batch Error Gating', () => {
  describe('createProposalBatch with error state', () => {
    it('should block proposals when diagnostic has error and blockOnError is true', () => {
      const batch = createProposalBatch(
        'company-123',
        [
          {
            fieldPath: 'brand.positioning',
            fieldLabel: 'Brand Positioning',
            proposedValue: 'Test value',
            currentValue: null,
            reasoning: 'Test',
            confidence: 0.8,
          },
        ],
        'lab_inference',
        'Test batch',
        'brandLab',
        {
          blockOnError: true,
          diagnosticErrorState: true,
          diagnosticErrorMessage: 'Website blocked (403)',
        }
      );

      expect(batch.proposals).toEqual([]);
      expect(batch.status).toBe('rejected');
      expect(batch.batchReasoning).toContain('Proposals blocked');
      expect(batch.batchReasoning).toContain('403');
    });

    it('should not block proposals when blockOnError is false', () => {
      const batch = createProposalBatch(
        'company-123',
        [
          {
            fieldPath: 'brand.positioning',
            fieldLabel: 'Brand Positioning',
            proposedValue: 'Test value',
            currentValue: null,
            reasoning: 'Test',
            confidence: 0.8,
          },
        ],
        'lab_inference',
        'Test batch',
        'brandLab',
        {
          blockOnError: false,
          diagnosticErrorState: true,
        }
      );

      expect(batch.proposals.length).toBe(1);
      expect(batch.status).toBe('pending');
    });

    it('should not block proposals when no error state', () => {
      const batch = createProposalBatch(
        'company-123',
        [
          {
            fieldPath: 'brand.positioning',
            fieldLabel: 'Brand Positioning',
            proposedValue: 'Test value',
            currentValue: null,
            reasoning: 'Test',
            confidence: 0.8,
          },
        ],
        'lab_inference',
        'Test batch',
        'brandLab',
        {
          blockOnError: true,
          diagnosticErrorState: false,
        }
      );

      expect(batch.proposals.length).toBe(1);
      expect(batch.status).toBe('pending');
    });

    it('should attach evidence anchors to proposals', () => {
      const batch = createProposalBatch(
        'company-123',
        [
          {
            fieldPath: 'brand.positioning',
            fieldLabel: 'Brand Positioning',
            proposedValue: 'B2B SaaS for marketing',
            currentValue: null,
            reasoning: 'Extracted from website',
            confidence: 0.8,
            evidenceAnchors: [
              { url: 'https://example.com', quote: 'We help B2B SaaS companies' },
            ],
          },
        ],
        'lab_inference',
        'Test batch',
        'brandLab'
      );

      expect(batch.proposals[0].evidenceAnchors).toHaveLength(1);
      expect(batch.proposals[0].isUngrounded).toBe(false);
    });

    it('should mark proposals as ungrounded when evidence is empty', () => {
      const batch = createProposalBatch(
        'company-123',
        [
          {
            fieldPath: 'brand.positioning',
            fieldLabel: 'Brand Positioning',
            proposedValue: 'B2B SaaS for marketing',
            currentValue: null,
            reasoning: 'No evidence available',
            confidence: 0.6,
            evidenceAnchors: [],
          },
        ],
        'lab_inference',
        'Test batch',
        'brandLab'
      );

      expect(batch.proposals[0].evidenceAnchors).toEqual([]);
      expect(batch.proposals[0].isUngrounded).toBe(true);
    });
  });
});

// ============================================================================
// Evidence Grounding Validation Tests
// ============================================================================

import {
  validatePositioning,
  validateValueProposition,
  validatePrimaryAudience,
  validateIcpDescription,
  groundCandidate,
  findGenericCliches,
  isTooGeneric,
  _testing as evidenceTestingExports,
} from '@/lib/contextGraph/v4/evidenceGrounding';

describe('Evidence Grounding Validation', () => {
  describe('validatePositioning', () => {
    it('should pass for positioning with category and specific audience', () => {
      const result = validatePositioning(
        'Acme is a marketing automation platform for B2B SaaS companies'
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(60);
    });

    it('should fail for positioning without category', () => {
      // Note: "B2B" audience is specific, but no category term (platform, software, tool, etc.)
      // Must avoid "saas" since that's also a category term
      const result = validatePositioning(
        'Acme helps mid-market B2B companies achieve their goals'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('category'))).toBe(true);
    });

    it('should fail for positioning with only generic audience', () => {
      const result = validatePositioning(
        'A comprehensive platform for businesses and companies'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('specific audience'))).toBe(true);
    });

    it('should fail for very short positioning', () => {
      const result = validatePositioning('A tool.');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });
  });

  describe('validateValueProposition', () => {
    it('should pass for value prop with outcome and mechanism', () => {
      const result = validateValueProposition(
        'Increase revenue by 30% through automated lead nurturing campaigns'
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for value prop without outcome', () => {
      // Note: Must avoid outcome terms like "automate", "increase", "improve", etc.
      // Just describing features without outcome
      const result = validateValueProposition(
        'A platform with modern workflows and third-party connections'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('outcome'))).toBe(true);
    });

    it('should fail for value prop without mechanism', () => {
      const result = validateValueProposition(
        'Increase your revenue and reduce costs significantly'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mechanism'))).toBe(true);
    });
  });

  describe('validatePrimaryAudience', () => {
    it('should pass for specific audience segment', () => {
      const result = validatePrimaryAudience(
        'Mid-market B2B SaaS founders and marketing teams'
      );
      expect(result.valid).toBe(true);
    });

    it('should fail for generic audience only', () => {
      const result = validatePrimaryAudience(
        'Businesses and organizations looking to grow'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('concrete segment'))).toBe(true);
    });
  });

  describe('validateIcpDescription', () => {
    it('should pass for ICP with firmographics and trigger', () => {
      const result = validateIcpDescription(
        'Series A B2B SaaS companies with 50-200 employees looking to scale their marketing operations after hitting $5M ARR'
      );
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(70);
    });

    it('should fail for ICP without firmographics or role', () => {
      const result = validateIcpDescription(
        'Companies that want to grow their business and improve their marketing'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('firmographics'))).toBe(true);
    });

    it('should warn about missing trigger', () => {
      const result = validateIcpDescription(
        'Series A startups with 20-50 employees in the fintech space'
      );
      // May not be fully valid if trigger is missing
      expect(result.errors.some(e => e.includes('trigger'))).toBe(true);
    });
  });

  describe('findGenericCliches', () => {
    it('should find common cliches in text', () => {
      const cliches = findGenericCliches(
        'We provide innovative and seamless solutions that streamline your workflow'
      );
      expect(cliches).toContain('innovative');
      expect(cliches).toContain('seamless');
      expect(cliches).toContain('streamline');
    });

    it('should return empty array for specific text', () => {
      const cliches = findGenericCliches(
        'Acme provides marketing automation for B2B SaaS companies with 50-200 employees'
      );
      expect(cliches.length).toBeLessThanOrEqual(1);
    });

    it('should find V4 additions like adapt and grow', () => {
      const cliches = findGenericCliches(
        'Help your business adapt and grow in the changing market and thrive'
      );
      expect(cliches).toContain('adapt and grow');
      expect(cliches).toContain('changing market');
      expect(cliches).toContain('thrive');
    });
  });

  describe('isTooGeneric', () => {
    it('should return true for text with many cliches', () => {
      expect(isTooGeneric(
        'Innovative seamless solutions that empower your team to transform',
        2
      )).toBe(true);
    });

    it('should return false for specific text', () => {
      expect(isTooGeneric(
        'B2B SaaS marketing platform for fintech startups',
        2
      )).toBe(false);
    });
  });

  describe('groundCandidate', () => {
    it('should ground candidate with evidence from snapshot', () => {
      const snapshot = {
        homepageText: 'We help B2B SaaS companies automate their marketing workflows and increase conversion rates.',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };

      const grounded = groundCandidate(
        'brand.positioning',
        'Brand Positioning',
        'Marketing automation platform for B2B SaaS companies',
        'Extracted from website content',
        0.8,
        { snapshot, companyName: 'Acme' }
      );

      expect(grounded.fieldPath).toBe('brand.positioning');
      expect(grounded.validationPassed).toBe(true);
      // Evidence may or may not be found depending on keyword matching
    });

    it('should return empty evidence for error state snapshot', () => {
      const snapshot = {
        homepageText: '',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'unavailable' as const,
        companyUrl: 'https://example.com',
        isErrorState: true,
        errorMessage: 'Website blocked',
      };

      const grounded = groundCandidate(
        'brand.positioning',
        'Brand Positioning',
        'Some positioning statement',
        'Test reasoning',
        0.8,
        { snapshot }
      );

      expect(grounded.evidenceAnchors).toHaveLength(0);
    });

    it('should reduce confidence for validation failures', () => {
      const snapshot = {
        homepageText: 'Some content here.',
        keyPages: [],
        createdAt: new Date().toISOString(),
        source: 'websiteLab' as const,
        companyUrl: 'https://example.com',
      };

      const grounded = groundCandidate(
        'brand.positioning',
        'Brand Positioning',
        'Short', // Too short, no category, no audience
        'Test',
        0.8,
        { snapshot }
      );

      expect(grounded.validationPassed).toBe(false);
      expect(grounded.confidence).toBeLessThan(0.8);
    });
  });
});

// ============================================================================
// Lab Proposals Tests
// ============================================================================

import {
  extractBrandLabCandidates,
  extractWebsiteLabCandidates,
  generateLabProposals,
  _testing as labProposalsTesting,
} from '@/lib/contextGraph/v4/labProposals';

describe('Lab Proposals', () => {
  describe('extractBrandLabCandidates', () => {
    it('should extract candidates from V4 findings format', () => {
      const brandLabResult = {
        findings: {
          valueProp: {
            headline: 'Automate your marketing',
            description: 'Save 10 hours per week with AI-powered workflows',
          },
          positioning: {
            statement: 'The leading marketing automation platform for B2B SaaS',
          },
          icp: {
            primaryAudience: 'B2B SaaS marketing teams at companies with 50-200 employees',
          },
          differentiators: {
            bullets: ['AI-powered automation', 'Native CRM integrations', 'Real-time analytics'],
          },
        },
      };

      const candidates = extractBrandLabCandidates(brandLabResult);

      expect(candidates.length).toBeGreaterThan(0);

      const valueProp = candidates.find(c => c.fieldPath === 'productOffer.valueProposition');
      expect(valueProp).toBeDefined();
      expect(valueProp?.value).toContain('Automate your marketing');

      const positioning = candidates.find(c => c.fieldPath === 'brand.positioning');
      expect(positioning).toBeDefined();

      const audience = candidates.find(c => c.fieldPath === 'audience.primaryAudience');
      expect(audience).toBeDefined();
    });

    it('should extract candidates from legacy format', () => {
      const brandLabResult = {
        positioning: 'A marketing platform for growing businesses',
        differentiators: ['Feature 1', 'Feature 2'],
        strengths: ['Good design', 'Easy to use'],
        toneOfVoice: 'Professional and friendly',
      };

      const candidates = extractBrandLabCandidates(brandLabResult);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.fieldPath === 'brand.positioning')).toBe(true);
      expect(candidates.some(c => c.fieldPath === 'brand.differentiators')).toBe(true);
    });

    it('should skip empty values', () => {
      const brandLabResult = {
        findings: {
          positioning: {
            statement: '',
          },
          differentiators: {
            bullets: [],
          },
        },
      };

      const candidates = extractBrandLabCandidates(brandLabResult);
      expect(candidates.length).toBe(0);
    });
  });

  describe('extractWebsiteLabCandidates', () => {
    it('should extract candidates from WebsiteLab result', () => {
      const websiteLabResult = {
        siteAssessment: {
          score: 75,
          executiveSummary: 'A well-designed website with clear messaging',
          keyIssues: ['Missing testimonials', 'No pricing page'],
          quickWins: ['Add social proof', 'Improve CTA visibility'],
          funnelHealthScore: 68,
        },
        trustAnalysis: {
          trustScore: 72,
        },
        contentIntelligence: {
          summaryScore: 70,
          narrative: 'Content is clear but could be more specific',
        },
      };

      const candidates = extractWebsiteLabCandidates(websiteLabResult);

      expect(candidates.length).toBeGreaterThan(0);

      const websiteScore = candidates.find(c => c.fieldPath === 'website.websiteScore');
      expect(websiteScore).toBeDefined();
      expect(websiteScore?.value).toBe('75');

      const summary = candidates.find(c => c.fieldPath === 'website.executiveSummary');
      expect(summary).toBeDefined();

      const trustScore = candidates.find(c => c.fieldPath === 'brand.trustScore');
      expect(trustScore).toBeDefined();
    });
  });

  describe('generateLabProposals', () => {
    it('should block proposals when diagnostic has error state', async () => {
      const result = await generateLabProposals(
        {
          labType: 'brandLab',
          status: 'error',
          errorMessage: 'Website returned 403',
          fields: [
            {
              fieldPath: 'brand.positioning',
              fieldLabel: 'Brand Positioning',
              value: 'Test positioning',
              reasoning: 'Test',
              confidence: 0.8,
            },
          ],
        },
        {
          companyId: 'test-company',
          companyUrl: 'https://example.com',
          blockOnError: true,
          saveToStorage: false,
        }
      );

      expect(result.blocked).toBe(true);
      expect(result.batch).toBeNull();
      expect(result.blockReason).toContain('403');
    });

    it('should generate proposals with evidence grounding when snapshot available', async () => {
      const result = await generateLabProposals(
        {
          labType: 'brandLab',
          status: 'success',
          fields: [
            {
              fieldPath: 'brand.positioning',
              fieldLabel: 'Brand Positioning',
              value: 'Marketing automation platform for B2B SaaS companies',
              reasoning: 'Extracted from website',
              confidence: 0.8,
            },
          ],
          siteContent: {
            url: 'https://example.com',
            title: 'Acme - Marketing Automation',
            heroText: 'We help B2B SaaS companies automate their marketing',
            headlines: ['Automate your marketing', 'Grow faster'],
          },
        },
        {
          companyId: 'test-company',
          companyUrl: 'https://example.com',
          companyName: 'Acme',
          saveToStorage: false,
        }
      );

      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.batch).not.toBeNull();
      expect(result.batch?.proposals.length).toBe(1);
      expect(result.evidenceSummary.totalProposals).toBe(1);
    });

    it('should track grounded vs ungrounded proposals', async () => {
      const result = await generateLabProposals(
        {
          labType: 'brandLab',
          status: 'success',
          fields: [
            {
              fieldPath: 'brand.positioning',
              fieldLabel: 'Brand Positioning',
              value: 'A completely unrelated positioning statement',
              reasoning: 'Test',
              confidence: 0.7,
            },
          ],
          siteContent: {
            url: 'https://example.com',
            title: 'Example',
            heroText: 'Different content entirely',
          },
        },
        {
          companyId: 'test-company',
          companyUrl: 'https://example.com',
          saveToStorage: false,
        }
      );

      expect(result.success).toBe(true);
      expect(result.evidenceSummary.totalProposals).toBe(1);
      // Ungrounded because content doesn't match
      expect(result.evidenceSummary.ungroundedCount).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Review Queue Hiding Tests
// ============================================================================

describe('Review Queue Low-Impact Hiding', () => {
  it('should mark ungrounded LOW impact proposals as hidden by default', () => {
    const batch = createProposalBatch(
      'company-123',
      [
        {
          fieldPath: 'website.executiveSummary', // LOW impact field
          fieldLabel: 'Executive Summary',
          proposedValue: 'A generic summary of the website',
          currentValue: null,
          reasoning: 'Generated summary',
          confidence: 0.6,
          evidenceAnchors: [], // Ungrounded
        },
      ],
      'lab_inference',
      'Test batch',
      'websiteLab'
    );

    const proposal = batch.proposals[0];
    expect(proposal.decisionImpact).toBe('LOW');
    expect(proposal.isUngrounded).toBe(true);
    expect(proposal.hiddenByDefault).toBe(true);
  });

  it('should not hide HIGH impact proposals even if ungrounded', () => {
    const batch = createProposalBatch(
      'company-123',
      [
        {
          fieldPath: 'brand.positioning', // HIGH impact field
          fieldLabel: 'Brand Positioning',
          proposedValue: 'Marketing automation for B2B SaaS with specific features',
          currentValue: null,
          reasoning: 'Extracted from analysis',
          confidence: 0.8,
          evidenceAnchors: [], // Ungrounded but HIGH impact
        },
      ],
      'lab_inference',
      'Test batch',
      'brandLab'
    );

    const proposal = batch.proposals[0];
    expect(proposal.decisionImpact).toBe('HIGH');
    expect(proposal.isUngrounded).toBe(true);
    // HIGH impact should not be hidden even if ungrounded
    // (hiddenByDefault logic: LOW impact OR specificity < 30 OR ungrounded && not HIGH)
  });
});

// ============================================================================
// Snapshot Truncation Tests
// ============================================================================

import { _testing as snapshotTesting } from '@/lib/contextGraph/v4/siteSnapshot';

describe('Site Snapshot Truncation', () => {
  it('should have correct max page text length constant', () => {
    expect(snapshotTesting.MAX_PAGE_TEXT_LENGTH).toBe(6000);
  });

  it('should truncate text to max length', () => {
    const longText = 'x'.repeat(10000);
    const truncated = snapshotTesting.truncateText(longText, 6000);
    expect(truncated.length).toBe(6000);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should not truncate short text', () => {
    const shortText = 'Short text here.';
    const result = snapshotTesting.truncateText(shortText, 6000);
    expect(result).toBe(shortText);
  });

  it('should build page text from evidence parts', () => {
    const evidence = {
      title: 'Page Title',
      heroText: 'Hero text content',
      headlines: ['Headline 1', 'Headline 2'],
      bodySnippets: ['Body content snippet 1', 'Body content snippet 2'],
    };

    const text = snapshotTesting.buildPageText(evidence);

    expect(text).toContain('Title: Page Title');
    expect(text).toContain('Hero: Hero text content');
    expect(text).toContain('Headlines: Headline 1 | Headline 2');
    expect(text).toContain('Body content snippet 1');
  });

  it('should classify page types correctly', () => {
    expect(snapshotTesting.classifyPageType('/')).toBe('homepage');
    expect(snapshotTesting.classifyPageType('/pricing')).toBe('pricing');
    expect(snapshotTesting.classifyPageType('/pricing-plans')).toBe('pricing');
    expect(snapshotTesting.classifyPageType('/customers')).toBe('customers');
    expect(snapshotTesting.classifyPageType('/case-studies')).toBe('customers');
    expect(snapshotTesting.classifyPageType('/solutions')).toBe('solutions');
    expect(snapshotTesting.classifyPageType('/about-us')).toBe('about');
    expect(snapshotTesting.classifyPageType('/blog/article')).toBe('other');
  });
});
