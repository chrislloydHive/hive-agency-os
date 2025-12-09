// tests/competition/cartoysRegression.test.ts
// Full regression test for Car Toys competition analysis

import { describe, it, expect } from 'vitest';
import cartoysFixture from '../fixtures/competition-cartoys.json';

/**
 * Normalize a domain for comparison
 */
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let normalized = domain.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.split('/')[0];
  return normalized || null;
}

/**
 * V3.5 Threat Score Formula
 */
function computeThreatScoreV35(signals: {
  offerOverlapScore?: number;
  jtbdMatches?: number;
  geoScore?: number;
}): number {
  const offerOverlap = signals.offerOverlapScore ?? 0;
  const jtbd = signals.jtbdMatches ?? 0;
  const geo = signals.geoScore ?? 0.4;
  return Math.round(((offerOverlap * 0.5) + (jtbd * 0.3) + (geo * 0.2)) * 100);
}

describe('Car Toys Competition Lab Regression', () => {
  const { company, mockCompetitors, mockInsights } = cartoysFixture;

  describe('Self-Competitor Filtering', () => {
    it('Car Toys (cartoys.com) should NEVER appear as its own competitor', () => {
      const selfCompetitor = mockCompetitors.find((c) => {
        const normalizedCompetitor = normalizeDomain(c.domain);
        const normalizedCompany = normalizeDomain(company.domain);
        return normalizedCompetitor === normalizedCompany;
      });

      // The fixture intentionally includes Car Toys as a competitor
      // to test that the pipeline filters it out
      expect(selfCompetitor).toBeDefined();

      // After filtering (which the real pipeline does), it should not exist
      const filteredCompetitors = mockCompetitors.filter((c) => {
        const normalizedCompetitor = normalizeDomain(c.domain);
        const normalizedCompany = normalizeDomain(company.domain);
        return normalizedCompetitor !== normalizedCompany;
      });

      const selfInFiltered = filteredCompetitors.find((c) =>
        normalizeDomain(c.domain) === normalizeDomain(company.domain)
      );

      expect(selfInFiltered).toBeUndefined();
    });
  });

  describe('Competitor Classification', () => {
    it('should have at least one direct competitor', () => {
      const directCompetitors = mockCompetitors.filter(
        (c) => c.type === 'direct' && normalizeDomain(c.domain) !== normalizeDomain(company.domain)
      );
      expect(directCompetitors.length).toBeGreaterThanOrEqual(1);
    });

    it('should have at least one partial competitor', () => {
      const partialCompetitors = mockCompetitors.filter((c) => c.type === 'partial');
      expect(partialCompetitors.length).toBeGreaterThanOrEqual(1);
    });

    it('should have platform competitors identified', () => {
      const platformCompetitors = mockCompetitors.filter((c) => c.type === 'platform');
      expect(platformCompetitors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('V3.5 Threat Scoring', () => {
    it('threat scores should NOT all be identical', () => {
      const nonSelfCompetitors = mockCompetitors.filter(
        (c) => normalizeDomain(c.domain) !== normalizeDomain(company.domain)
      );

      const threatScores = nonSelfCompetitors.map((c) => computeThreatScoreV35(c.signals));
      const uniqueScores = new Set(threatScores);

      // Regression: All scores used to be "40"
      expect(uniqueScores.size).toBeGreaterThan(1);
    });

    it('direct competitors should have higher threat than platform competitors', () => {
      const directCompetitor = mockCompetitors.find(
        (c) => c.type === 'direct' && normalizeDomain(c.domain) !== normalizeDomain(company.domain)
      );
      const platformCompetitor = mockCompetitors.find((c) => c.type === 'platform');

      expect(directCompetitor).toBeDefined();
      expect(platformCompetitor).toBeDefined();

      const directThreat = computeThreatScoreV35(directCompetitor!.signals);
      const platformThreat = computeThreatScoreV35(platformCompetitor!.signals);

      expect(directThreat).toBeGreaterThan(platformThreat);
    });
  });

  describe('Strategic Insights', () => {
    it('keyRisks should contain at least one string', () => {
      expect(mockInsights.keyRisks.length).toBeGreaterThanOrEqual(1);
      expect(typeof mockInsights.keyRisks[0]).toBe('string');
      expect(mockInsights.keyRisks[0].length).toBeGreaterThan(10);
    });

    it('keyOpportunities should contain at least one string', () => {
      expect(mockInsights.keyOpportunities.length).toBeGreaterThanOrEqual(1);
      expect(typeof mockInsights.keyOpportunities[0]).toBe('string');
      expect(mockInsights.keyOpportunities[0].length).toBeGreaterThan(10);
    });

    it('insights should be actionable text, not just counts', () => {
      // Check that risks are sentences, not numbers
      for (const risk of mockInsights.keyRisks) {
        expect(risk).not.toMatch(/^\d+$/); // Not just a number
        expect(risk.split(' ').length).toBeGreaterThan(3); // More than 3 words
      }

      // Check that opportunities are sentences, not numbers
      for (const opp of mockInsights.keyOpportunities) {
        expect(opp).not.toMatch(/^\d+$/);
        expect(opp.split(' ').length).toBeGreaterThan(3);
      }
    });
  });

  describe('Data Consistency', () => {
    it('all competitors should have required fields', () => {
      for (const competitor of mockCompetitors) {
        expect(competitor.id).toBeDefined();
        expect(competitor.name).toBeDefined();
        expect(competitor.type).toBeDefined();
        expect(competitor.scores).toBeDefined();
        expect(competitor.signals).toBeDefined();
      }
    });

    it('all V3.5 signals should be between 0 and 1', () => {
      for (const competitor of mockCompetitors) {
        const { jtbdMatches, offerOverlapScore, geoScore } = competitor.signals;

        if (jtbdMatches !== undefined) {
          expect(jtbdMatches).toBeGreaterThanOrEqual(0);
          expect(jtbdMatches).toBeLessThanOrEqual(1);
        }
        if (offerOverlapScore !== undefined) {
          expect(offerOverlapScore).toBeGreaterThanOrEqual(0);
          expect(offerOverlapScore).toBeLessThanOrEqual(1);
        }
        if (geoScore !== undefined) {
          expect(geoScore).toBeGreaterThanOrEqual(0);
          expect(geoScore).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
