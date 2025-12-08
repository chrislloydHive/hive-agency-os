// tests/gap/socialFootprintGating.test.ts
// Tests for output layer gating - ensuring subscores and narratives don't contradict detection

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  computeGoogleBusinessProfileSubscore,
  computeSocialPresenceSubscore,
  computeLinkedInSubscore,
  computeDigitalFootprintSubscores,
  computeDigitalFootprintScore,
  hasGbpPresent,
  hasInstagramPresent,
  hasSocialPresent,
  getActiveSocialNetworks,
  sanitizeDigitalFootprintNarrative,
  sanitizeSocialQuickWinsAndOpportunities,
  sanitizeQuickSummary,
  _testing,
} from '@/lib/gap/socialFootprintGating';
import { detectSocialAndGbp, type SocialFootprintSnapshot } from '@/lib/gap/socialDetection';

// ============================================================================
// Fixtures
// ============================================================================

// Atlas Skateboarding-like snapshot: GBP present, Instagram present, YouTube present
const atlasLikeSnapshot: SocialFootprintSnapshot = {
  socials: [
    { network: 'instagram', url: 'https://instagram.com/atlasskateboarding', confidence: 0.85, status: 'present', detectionSources: ['html_link_footer'] },
    { network: 'facebook', url: undefined, confidence: 0.15, status: 'missing', detectionSources: [] },
    { network: 'youtube', url: 'https://youtube.com/@atlasskateboarding', confidence: 0.80, status: 'present', detectionSources: ['html_link_footer'] },
    { network: 'tiktok', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'x', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'linkedin', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
  ],
  gbp: { url: 'https://maps.google.com/maps?cid=123', confidence: 0.90, status: 'present', detectionSources: ['html_link_footer', 'schema_gbp'] },
  dataConfidence: 0.85,
};

// Site with nothing detected (all missing)
const emptySnapshot: SocialFootprintSnapshot = {
  socials: [
    { network: 'instagram', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'facebook', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'youtube', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'tiktok', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'x', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'linkedin', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
  ],
  gbp: { url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
  dataConfidence: 0.75,
};

// Low confidence site (inconclusive detection)
const inconclusiveSnapshot: SocialFootprintSnapshot = {
  socials: [
    { network: 'instagram', url: undefined, confidence: 0.45, status: 'inconclusive', detectionSources: ['search_fallback'] },
    { network: 'facebook', url: undefined, confidence: 0.40, status: 'inconclusive', detectionSources: ['search_fallback'] },
    { network: 'youtube', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'tiktok', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'x', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'linkedin', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
  ],
  gbp: { url: undefined, confidence: 0.45, status: 'inconclusive', detectionSources: ['schema_gbp'] },
  dataConfidence: 0.45,
};

// ============================================================================
// Subscore Computation Tests
// ============================================================================

describe('Subscore Computation', () => {
  describe('computeGoogleBusinessProfileSubscore', () => {
    it('should return 0 for undefined socialFootprint', () => {
      expect(computeGoogleBusinessProfileSubscore(undefined)).toBe(0);
    });

    it('should return 0 for missing GBP', () => {
      expect(computeGoogleBusinessProfileSubscore(emptySnapshot)).toBe(0);
    });

    it('should return 80+ for present GBP', () => {
      const score = computeGoogleBusinessProfileSubscore(atlasLikeSnapshot);
      expect(score).toBeGreaterThanOrEqual(80);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 30-50 for inconclusive GBP', () => {
      const score = computeGoogleBusinessProfileSubscore(inconclusiveSnapshot);
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(50);
    });

    it('should scale with confidence within present tier', () => {
      const highConfidence: SocialFootprintSnapshot = {
        ...atlasLikeSnapshot,
        gbp: { ...atlasLikeSnapshot.gbp!, confidence: 1.0 },
      };
      const lowConfidence: SocialFootprintSnapshot = {
        ...atlasLikeSnapshot,
        gbp: { ...atlasLikeSnapshot.gbp!, confidence: 0.75 },
      };

      expect(computeGoogleBusinessProfileSubscore(highConfidence))
        .toBeGreaterThan(computeGoogleBusinessProfileSubscore(lowConfidence));
    });
  });

  describe('computeSocialPresenceSubscore', () => {
    it('should return 0 for undefined socialFootprint', () => {
      expect(computeSocialPresenceSubscore(undefined)).toBe(0);
    });

    it('should return 0 for no active socials', () => {
      expect(computeSocialPresenceSubscore(emptySnapshot)).toBe(0);
    });

    it('should return 55+ for 2 active socials', () => {
      // Atlas has Instagram + YouTube
      const score = computeSocialPresenceSubscore(atlasLikeSnapshot);
      expect(score).toBeGreaterThanOrEqual(55);
    });

    it('should increase with more active networks', () => {
      const oneNetwork: SocialFootprintSnapshot = {
        ...emptySnapshot,
        socials: [
          { network: 'instagram', url: 'https://ig.com', confidence: 0.85, status: 'present', detectionSources: [] },
          ...emptySnapshot.socials.slice(1),
        ],
      };

      const twoNetworks: SocialFootprintSnapshot = {
        ...emptySnapshot,
        socials: [
          { network: 'instagram', url: 'https://ig.com', confidence: 0.85, status: 'present', detectionSources: [] },
          { network: 'facebook', url: 'https://fb.com', confidence: 0.85, status: 'present', detectionSources: [] },
          ...emptySnapshot.socials.slice(2),
        ],
      };

      expect(computeSocialPresenceSubscore(twoNetworks))
        .toBeGreaterThan(computeSocialPresenceSubscore(oneNetwork));
    });
  });

  describe('computeLinkedInSubscore', () => {
    it('should return 0 for undefined socialFootprint', () => {
      expect(computeLinkedInSubscore(undefined)).toBe(0);
    });

    it('should return 0 for missing LinkedIn', () => {
      expect(computeLinkedInSubscore(atlasLikeSnapshot)).toBe(0);
    });

    it('should return 75+ for present LinkedIn', () => {
      const withLinkedIn: SocialFootprintSnapshot = {
        ...atlasLikeSnapshot,
        socials: [
          ...atlasLikeSnapshot.socials.slice(0, 5),
          { network: 'linkedin', url: 'https://linkedin.com/company/atlas', confidence: 0.85, status: 'present', detectionSources: [] },
        ],
      };
      expect(computeLinkedInSubscore(withLinkedIn)).toBeGreaterThanOrEqual(75);
    });
  });

  describe('computeDigitalFootprintScore', () => {
    it('should produce a weighted score from subscores', () => {
      const subscores = computeDigitalFootprintSubscores(atlasLikeSnapshot);
      const overallScore = computeDigitalFootprintScore(subscores);

      // Atlas has GBP and socials, no LinkedIn, default reviews
      // Expected: 0.35 * ~98 + 0.35 * ~70 + 0.15 * 0 + 0.15 * 50 ≈ 66
      expect(overallScore).toBeGreaterThanOrEqual(50);
      expect(overallScore).toBeLessThanOrEqual(100);
    });

    it('should return low score for empty snapshot', () => {
      const subscores = computeDigitalFootprintSubscores(emptySnapshot);
      const overallScore = computeDigitalFootprintScore(subscores);

      // Only reviews (50) contributes at 15% = 7.5
      expect(overallScore).toBeLessThan(20);
    });
  });
});

// ============================================================================
// Detection Helpers Tests
// ============================================================================

describe('Detection Helpers', () => {
  describe('hasGbpPresent', () => {
    it('should return false for undefined', () => {
      expect(hasGbpPresent(undefined)).toBe(false);
    });

    it('should return true for present GBP', () => {
      expect(hasGbpPresent(atlasLikeSnapshot)).toBe(true);
    });

    it('should return false for missing GBP', () => {
      expect(hasGbpPresent(emptySnapshot)).toBe(false);
    });

    it('should return false for inconclusive GBP', () => {
      expect(hasGbpPresent(inconclusiveSnapshot)).toBe(false);
    });
  });

  describe('hasInstagramPresent', () => {
    it('should return true for present Instagram', () => {
      expect(hasInstagramPresent(atlasLikeSnapshot)).toBe(true);
    });

    it('should return false for missing Instagram', () => {
      expect(hasInstagramPresent(emptySnapshot)).toBe(false);
    });
  });

  describe('getActiveSocialNetworks', () => {
    it('should return list of present/probable networks', () => {
      const active = getActiveSocialNetworks(atlasLikeSnapshot);
      expect(active).toContain('instagram');
      expect(active).toContain('youtube');
      expect(active).not.toContain('facebook');
      expect(active).not.toContain('linkedin');
    });

    it('should return empty array for no active networks', () => {
      expect(getActiveSocialNetworks(emptySnapshot)).toHaveLength(0);
    });
  });
});

// ============================================================================
// Narrative Sanitization Tests
// ============================================================================

describe('Narrative Sanitization', () => {
  describe('sanitizeDigitalFootprintNarrative', () => {
    it('should rewrite "no GBP" to "under-optimized" when GBP is present', () => {
      const { oneLiner, issues } = sanitizeDigitalFootprintNarrative(
        atlasLikeSnapshot,
        'The company has no Google Business Profile and weak social media presence.',
        ['No Google Business Profile found', 'Limited online reviews']
      );

      expect(oneLiner).not.toContain('no Google Business Profile');
      expect(oneLiner).toContain('under-optimized Google Business Profile');
      expect(issues[0]).not.toContain('No Google Business Profile');
      expect(issues[0]).toContain('under-optimized Google Business Profile');
    });

    it('should rewrite "weak social" to "under-leveraged" when social is present', () => {
      const { oneLiner } = sanitizeDigitalFootprintNarrative(
        atlasLikeSnapshot,
        'The site exhibits weak social media presence.',
        []
      );

      expect(oneLiner).not.toContain('weak social media presence');
      expect(oneLiner).toContain('under-leveraged social media presence');
    });

    it('should preserve text when GBP/social is actually missing', () => {
      const { oneLiner, issues } = sanitizeDigitalFootprintNarrative(
        emptySnapshot,
        'No Google Business Profile detected.',
        ['Weak social media presence']
      );

      // Should NOT rewrite since actually missing
      expect(oneLiner).toContain('No Google Business Profile');
      expect(issues[0]).toContain('Weak social media presence');
    });
  });

  describe('_testing.rewriteNoGbpText', () => {
    const rewriteNoGbpText = _testing.rewriteNoGbpText;

    it('should handle various "no GBP" phrasings', () => {
      expect(rewriteNoGbpText('no Google Business Profile')).toContain('under-optimized');
      expect(rewriteNoGbpText('absence of Google Business Profile')).toContain('under-optimized');
      expect(rewriteNoGbpText('lacks a Google Business Profile')).toContain('under-optimized');
      expect(rewriteNoGbpText('without Google Business Profile')).toContain('under-optimized');
      expect(rewriteNoGbpText('missing Google Business Profile')).toContain('under-optimized');
    });
  });

  describe('_testing.rewriteWeakSocialText', () => {
    const rewriteWeakSocialText = _testing.rewriteWeakSocialText;

    it('should handle various "weak social" phrasings', () => {
      expect(rewriteWeakSocialText('weak social media presence')).toContain('under-leveraged');
      expect(rewriteWeakSocialText('no social media presence')).toContain('under-leveraged');
      expect(rewriteWeakSocialText('limited social presence')).toContain('under-leveraged');
    });
  });
});

// ============================================================================
// QuickWins and TopOpportunities Sanitization Tests
// ============================================================================

describe('QuickWins and TopOpportunities Sanitization', () => {
  describe('sanitizeSocialQuickWinsAndOpportunities', () => {
    it('should rewrite "Establish GBP" to "Optimize GBP" when GBP is present', () => {
      const { quickWins, topOpportunities } = sanitizeSocialQuickWinsAndOpportunities(
        atlasLikeSnapshot,
        ['Establish a Google Business Profile to improve local visibility'],
        ['Set up Google Business Profile for local search']
      );

      expect(quickWins[0]).not.toMatch(/establish/i);
      expect(quickWins[0]).toContain('Optimize');
      expect(topOpportunities[0]).not.toMatch(/set up/i);
      expect(topOpportunities[0]).toContain('Optimize');
    });

    it('should rewrite "Start Instagram" to "Strengthen Instagram" when IG is present', () => {
      const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(
        atlasLikeSnapshot,
        ['Begin posting regularly on Instagram to engage customers'],
        []
      );

      expect(quickWins[0]).not.toMatch(/begin posting/i);
      expect(quickWins[0]).toMatch(/strengthen/i);
    });

    it('should rewrite generic "develop social media strategy" when social is present', () => {
      const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(
        atlasLikeSnapshot,
        ['Develop a robust social media strategy'],
        []
      );

      expect(quickWins[0]).not.toMatch(/develop.*social media strategy/i);
      expect(quickWins[0]).toContain('Strengthen');
    });

    it('should preserve "Establish GBP" when GBP is actually missing with high confidence', () => {
      const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(
        emptySnapshot,
        ['Establish a Google Business Profile to improve local visibility'],
        []
      );

      // High confidence (0.75) + missing = allow as-is
      expect(quickWins[0]).toMatch(/establish/i);
    });

    it('should soften "Establish GBP" with low confidence', () => {
      const lowConfidenceSnapshot = { ...inconclusiveSnapshot, dataConfidence: 0.4 };
      const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(
        lowConfidenceSnapshot,
        ['Establish a Google Business Profile to improve local visibility'],
        []
      );

      // Low confidence = soften language
      expect(quickWins[0]).toMatch(/verify/i);
    });
  });

  describe('_testing pattern matchers', () => {
    it('should match GBP establish patterns', () => {
      const { isGbpEstablishRecommendation } = _testing;
      expect(isGbpEstablishRecommendation('Establish a Google Business Profile')).toBe(true);
      expect(isGbpEstablishRecommendation('Set up Google Business Profile')).toBe(true);
      expect(isGbpEstablishRecommendation('Create a GBP')).toBe(true);
      expect(isGbpEstablishRecommendation('Optimize your GBP')).toBe(false);
    });

    it('should match Instagram start patterns', () => {
      const { isIgStartRecommendation } = _testing;
      expect(isIgStartRecommendation('Begin posting regularly on Instagram')).toBe(true);
      expect(isIgStartRecommendation('Start an Instagram presence')).toBe(true);
      expect(isIgStartRecommendation('Strengthen your Instagram')).toBe(false);
    });
  });
});

// ============================================================================
// QuickSummary Sanitization Tests
// ============================================================================

describe('QuickSummary Sanitization', () => {
  describe('sanitizeQuickSummary', () => {
    it('should rewrite multiple issues in quickSummary when GBP/social present', () => {
      const rawSummary = 'Atlas Skateboarding has no Google Business Profile and weak social media presence. Establish a GBP and begin posting on Instagram.';

      const sanitized = sanitizeQuickSummary(atlasLikeSnapshot, rawSummary);

      expect(sanitized).not.toMatch(/no google business profile/i);
      expect(sanitized).not.toMatch(/weak social media/i);
      expect(sanitized).not.toMatch(/establish.*gbp/i);
      expect(sanitized).not.toMatch(/begin posting on instagram/i);

      expect(sanitized).toMatch(/under-optimized/i);
      expect(sanitized).toMatch(/under-leveraged|strengthen/i);
    });

    it('should preserve quickSummary when everything is actually missing', () => {
      const rawSummary = 'The company lacks a Google Business Profile and has no social media presence.';

      const sanitized = sanitizeQuickSummary(emptySnapshot, rawSummary);

      // Should mostly preserve since actually missing
      expect(sanitized).toMatch(/google business profile/i);
      expect(sanitized).toMatch(/social media/i);
    });
  });
});

// ============================================================================
// Atlas Integration Test for Output Layer
// ============================================================================

describe('Atlas Output Layer Regression Test', () => {
  const fixtureDir = path.join(__dirname, '../fixtures');
  let atlasSnapshot: SocialFootprintSnapshot | null = null;

  try {
    const atlasHtml = fs.readFileSync(path.join(fixtureDir, 'atlas-skateboarding.html'), 'utf-8');
    atlasSnapshot = detectSocialAndGbp({ html: atlasHtml, schemas: [] });
  } catch (e) {
    console.warn('Atlas fixture not found, using synthetic snapshot');
    atlasSnapshot = atlasLikeSnapshot;
  }

  it('should NOT produce narrative claiming "no GBP" for Atlas', () => {
    const badNarrative = 'Atlas Skateboarding has no Google Business Profile and relies solely on organic foot traffic.';
    const { oneLiner } = sanitizeDigitalFootprintNarrative(atlasSnapshot!, badNarrative, []);

    expect(oneLiner).not.toMatch(/no google business profile/i);
  });

  it('should NOT produce narrative claiming "weak social" for Atlas', () => {
    const badNarrative = 'The business has weak social media presence and no local search optimization.';
    const { oneLiner } = sanitizeDigitalFootprintNarrative(atlasSnapshot!, badNarrative, []);

    expect(oneLiner).not.toMatch(/weak social/i);
  });

  it('should NOT produce quickWin "Establish GBP" for Atlas', () => {
    const badQuickWins = [
      'Establish a Google Business Profile to improve local visibility',
      'Claim and optimize Google Business Profile',
    ];
    const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(atlasSnapshot!, badQuickWins, []);

    for (const qw of quickWins) {
      expect(qw).not.toMatch(/establish.*google business profile/i);
    }
  });

  it('should NOT produce opportunity "Start Instagram" for Atlas', () => {
    const badOpportunities = [
      'Begin posting regularly on Instagram to engage younger audience',
      'Start an Instagram presence to showcase products',
    ];
    const { topOpportunities } = sanitizeSocialQuickWinsAndOpportunities(atlasSnapshot!, [], badOpportunities);

    for (const opp of topOpportunities) {
      expect(opp).not.toMatch(/begin posting.*instagram/i);
      expect(opp).not.toMatch(/start.*instagram/i);
    }
  });

  it('should produce high digitalFootprint subscore for Atlas GBP', () => {
    const gbpScore = computeGoogleBusinessProfileSubscore(atlasSnapshot!);

    // Atlas has GBP present with high confidence - should score 80+
    expect(gbpScore).toBeGreaterThanOrEqual(80);
  });

  it('should produce meaningful socialPresence subscore for Atlas', () => {
    const socialScore = computeSocialPresenceSubscore(atlasSnapshot!);

    // Atlas has Instagram + YouTube = 2 networks, should score 55+
    expect(socialScore).toBeGreaterThanOrEqual(55);
  });
});

// ============================================================================
// Negative Test: Missing GBP/IG Site
// ============================================================================

describe('Missing GBP/IG Site - Negative Test', () => {
  const trulyMissingSnapshot: SocialFootprintSnapshot = {
    socials: [
      { network: 'instagram', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'facebook', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'youtube', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'tiktok', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'x', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'linkedin', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    ],
    gbp: { url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    dataConfidence: 0.85, // High confidence that things are missing
  };

  it('should allow "Establish GBP" when GBP is truly missing with high confidence', () => {
    const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(
      trulyMissingSnapshot,
      ['Establish a Google Business Profile for local visibility'],
      []
    );

    // Should preserve the recommendation since GBP is truly missing
    expect(quickWins[0]).toMatch(/establish.*google business profile/i);
  });

  it('should allow "Start Instagram" when Instagram is truly missing', () => {
    const { quickWins } = sanitizeSocialQuickWinsAndOpportunities(
      trulyMissingSnapshot,
      ['Begin posting regularly on Instagram'],
      []
    );

    // Should preserve since Instagram is truly missing
    expect(quickWins[0]).toMatch(/begin posting.*instagram/i);
  });

  it('should allow "weak social" narrative when social is truly missing', () => {
    const { oneLiner } = sanitizeDigitalFootprintNarrative(
      trulyMissingSnapshot,
      'The business has weak social media presence.',
      []
    );

    // Should preserve since social is truly weak
    expect(oneLiner).toMatch(/weak social media/i);
  });

  it('should produce low GBP subscore when GBP is missing', () => {
    const gbpScore = computeGoogleBusinessProfileSubscore(trulyMissingSnapshot);
    expect(gbpScore).toBe(0);
  });

  it('should produce low socialPresence subscore when social is missing', () => {
    const socialScore = computeSocialPresenceSubscore(trulyMissingSnapshot);
    expect(socialScore).toBe(0);
  });

  it('should produce low overall digitalFootprint score when everything missing', () => {
    const subscores = computeDigitalFootprintSubscores(trulyMissingSnapshot);
    const overallScore = computeDigitalFootprintScore(subscores);

    // Only reviews default (50) at 15% = 7.5
    expect(overallScore).toBeLessThanOrEqual(10);
  });
});
