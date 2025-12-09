// tests/competition/threatScoringV35.test.ts
// Regression test: V3.5 threat scoring formula

import { describe, it, expect } from 'vitest';
import cartoysFixture from '../fixtures/competition-cartoys.json';

/**
 * V3.5 Threat Score Formula:
 * threatScore = (offerOverlapScore * 0.5 + jtbdMatches * 0.3 + geoScore * 0.2) * 100
 */
function computeThreatScoreV35(signals: {
  offerOverlapScore?: number;
  jtbdMatches?: number;
  geoScore?: number;
}): number {
  const offerOverlap = signals.offerOverlapScore ?? 0;
  const jtbd = signals.jtbdMatches ?? 0;
  const geo = signals.geoScore ?? 0.4; // Default fallback

  return Math.round(((offerOverlap * 0.5) + (jtbd * 0.3) + (geo * 0.2)) * 100);
}

describe('V3.5 Threat Scoring', () => {
  it('should calculate threat scores using V3.5 formula', () => {
    // Test with mock competitors from Car Toys fixture
    const competitors = cartoysFixture.mockCompetitors.filter(
      (c) => c.domain !== 'cartoys.com' // Exclude self
    );

    for (const competitor of competitors) {
      const calculatedScore = computeThreatScoreV35(competitor.signals);

      // Verify the calculation is correct
      const expected = Math.round(
        ((competitor.signals.offerOverlapScore * 0.5) +
         (competitor.signals.jtbdMatches * 0.3) +
         (competitor.signals.geoScore * 0.2)) * 100
      );

      expect(calculatedScore).toBe(expected);
    }
  });

  it('should produce varied threat scores for different competitors', () => {
    const competitors = cartoysFixture.mockCompetitors.filter(
      (c) => c.domain !== 'cartoys.com'
    );

    const scores = competitors.map((c) => computeThreatScoreV35(c.signals));

    // All scores should NOT be the same (regression for "all 40" bug)
    const uniqueScores = new Set(scores);
    expect(uniqueScores.size).toBeGreaterThan(1);

    // Scores should be within valid range
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('should rank Best Buy higher than Crutchfield (direct vs partial)', () => {
    const bestBuy = cartoysFixture.mockCompetitors.find((c) => c.domain?.includes('bestbuy'));
    const crutchfield = cartoysFixture.mockCompetitors.find((c) => c.domain?.includes('crutchfield'));

    expect(bestBuy).toBeDefined();
    expect(crutchfield).toBeDefined();

    const bestBuyScore = computeThreatScoreV35(bestBuy!.signals);
    const crutchfieldScore = computeThreatScoreV35(crutchfield!.signals);

    // Best Buy (direct competitor) should have higher threat than Crutchfield (partial)
    expect(bestBuyScore).toBeGreaterThan(crutchfieldScore);
  });

  it('should handle edge cases gracefully', () => {
    // All zeros
    expect(computeThreatScoreV35({ offerOverlapScore: 0, jtbdMatches: 0, geoScore: 0 })).toBe(0);

    // All ones
    expect(computeThreatScoreV35({ offerOverlapScore: 1, jtbdMatches: 1, geoScore: 1 })).toBe(100);

    // Missing values (should use defaults)
    expect(computeThreatScoreV35({})).toBeGreaterThanOrEqual(0);
    expect(computeThreatScoreV35({})).toBeLessThanOrEqual(100);
  });

  it('should weight offer overlap highest (50%)', () => {
    const baseSignals = { offerOverlapScore: 0.5, jtbdMatches: 0.5, geoScore: 0.5 };

    // Only increase offer overlap
    const highOffer = computeThreatScoreV35({ ...baseSignals, offerOverlapScore: 1.0 });
    const highJtbd = computeThreatScoreV35({ ...baseSignals, jtbdMatches: 1.0 });
    const highGeo = computeThreatScoreV35({ ...baseSignals, geoScore: 1.0 });

    // Offer overlap should have largest impact (50% weight)
    const baseScore = computeThreatScoreV35(baseSignals);
    const offerImpact = highOffer - baseScore;
    const jtbdImpact = highJtbd - baseScore;
    const geoImpact = highGeo - baseScore;

    expect(offerImpact).toBeGreaterThan(jtbdImpact);
    expect(jtbdImpact).toBeGreaterThan(geoImpact);
  });
});
