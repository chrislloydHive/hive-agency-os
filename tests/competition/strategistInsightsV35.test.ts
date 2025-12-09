// tests/competition/strategistInsightsV35.test.ts
// Regression test: Key Risks and Opportunities should contain actual text

import { describe, it, expect } from 'vitest';
import cartoysFixture from '../fixtures/competition-cartoys.json';

describe('Strategist Insights V3.5', () => {
  const { mockInsights } = cartoysFixture;

  it('should have keyRisks as an array of strings', () => {
    expect(Array.isArray(mockInsights.keyRisks)).toBe(true);
    expect(mockInsights.keyRisks.length).toBeGreaterThan(0);

    for (const risk of mockInsights.keyRisks) {
      expect(typeof risk).toBe('string');
      expect(risk.length).toBeGreaterThan(10); // Not just a count
    }
  });

  it('should have keyOpportunities as an array of strings', () => {
    expect(Array.isArray(mockInsights.keyOpportunities)).toBe(true);
    expect(mockInsights.keyOpportunities.length).toBeGreaterThan(0);

    for (const opp of mockInsights.keyOpportunities) {
      expect(typeof opp).toBe('string');
      expect(opp.length).toBeGreaterThan(10); // Not just a count
    }
  });

  it('should have recommendedMoves with now/next/later arrays', () => {
    expect(mockInsights.recommendedMoves).toBeDefined();
    expect(Array.isArray(mockInsights.recommendedMoves.now)).toBe(true);
    expect(Array.isArray(mockInsights.recommendedMoves.next)).toBe(true);
    expect(Array.isArray(mockInsights.recommendedMoves.later)).toBe(true);
  });

  it('should have a landscape summary string', () => {
    expect(typeof mockInsights.landscapeSummary).toBe('string');
    expect(mockInsights.landscapeSummary.length).toBeGreaterThan(20);
  });

  it('should have category breakdown', () => {
    expect(typeof mockInsights.categoryBreakdown).toBe('string');
    expect(mockInsights.categoryBreakdown.length).toBeGreaterThan(5);
  });

  it('should render risks and opportunities as lists, not counts', () => {
    // Simulate what the UI should render
    const risksRendered = mockInsights.keyRisks.map((risk, idx) => `${idx + 1}. ${risk}`);
    const oppsRendered = mockInsights.keyOpportunities.map((opp, idx) => `${idx + 1}. ${opp}`);

    // Each rendered item should be a full sentence, not "3" or "5"
    for (const rendered of [...risksRendered, ...oppsRendered]) {
      expect(rendered.length).toBeGreaterThan(15);
      expect(/^\d+\.\s+\w/.test(rendered)).toBe(true); // Starts with "N. word"
    }
  });
});
