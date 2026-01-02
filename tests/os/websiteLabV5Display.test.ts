// tests/os/websiteLabV5Display.test.ts
// Unit tests for Website Lab V5 UI display logic
//
// Tests:
// - Verdict derivation from score
// - Type exports and structures
// - Summary stat calculations

import { describe, it, expect } from 'vitest';
import {
  deriveVerdict,
  VERDICT_CONFIG,
  PERSONA_LABELS,
  type V5DiagnosticOutput,
  type V5PersonaType,
  type V5Verdict,
} from '@/lib/types/websiteLabV5';

describe('deriveVerdict', () => {
  it('returns STRONG for scores >= 80', () => {
    expect(deriveVerdict(80)).toBe('STRONG');
    expect(deriveVerdict(85)).toBe('STRONG');
    expect(deriveVerdict(100)).toBe('STRONG');
  });

  it('returns MIXED for scores 60-79', () => {
    expect(deriveVerdict(60)).toBe('MIXED');
    expect(deriveVerdict(65)).toBe('MIXED');
    expect(deriveVerdict(79)).toBe('MIXED');
  });

  it('returns WEAK for scores < 60', () => {
    expect(deriveVerdict(59)).toBe('WEAK');
    expect(deriveVerdict(30)).toBe('WEAK');
    expect(deriveVerdict(0)).toBe('WEAK');
  });
});

describe('VERDICT_CONFIG', () => {
  it('provides config for all verdict types', () => {
    const verdicts: V5Verdict[] = ['STRONG', 'MIXED', 'WEAK'];

    verdicts.forEach(verdict => {
      expect(VERDICT_CONFIG[verdict]).toBeDefined();
      expect(VERDICT_CONFIG[verdict].label).toBeDefined();
      expect(VERDICT_CONFIG[verdict].color).toBeDefined();
      expect(VERDICT_CONFIG[verdict].bgColor).toBeDefined();
    });
  });

  it('has appropriate labels', () => {
    expect(VERDICT_CONFIG.STRONG.label).toBe('Strong');
    expect(VERDICT_CONFIG.MIXED.label).toBe('Mixed');
    expect(VERDICT_CONFIG.WEAK.label).toBe('Needs Work');
  });
});

describe('PERSONA_LABELS', () => {
  it('provides labels for all persona types', () => {
    const personas: V5PersonaType[] = ['first_time', 'ready_to_buy', 'comparison_shopper'];

    personas.forEach(persona => {
      expect(PERSONA_LABELS[persona]).toBeDefined();
      expect(typeof PERSONA_LABELS[persona]).toBe('string');
    });
  });

  it('has human-readable labels', () => {
    expect(PERSONA_LABELS.first_time).toBe('First-Time Visitor');
    expect(PERSONA_LABELS.ready_to_buy).toBe('Ready to Buy');
    expect(PERSONA_LABELS.comparison_shopper).toBe('Comparison Shopper');
  });
});

describe('V5DiagnosticOutput structure', () => {
  const sampleOutput: V5DiagnosticOutput = {
    observations: [
      {
        pagePath: '/',
        pageType: 'home',
        aboveFoldElements: ['Hero with headline', 'CTA button'],
        primaryCTAs: [
          { text: 'Get Started', position: 'above_fold', destination: '/signup' },
        ],
        trustProofElements: ['Client logos'],
        missingUnclearElements: ['No pricing visible'],
      },
    ],
    personaJourneys: [
      {
        persona: 'first_time',
        startingPage: '/',
        intendedGoal: 'Learn about services',
        actualPath: ['/', '/about', '/services'],
        failurePoint: null,
        confidenceScore: 85,
        succeeded: true,
      },
      {
        persona: 'ready_to_buy',
        startingPage: '/',
        intendedGoal: 'Find pricing and sign up',
        actualPath: ['/', '/pricing'],
        failurePoint: { page: '/pricing', reason: 'No clear pricing displayed' },
        confidenceScore: 40,
        succeeded: false,
      },
    ],
    blockingIssues: [
      {
        id: 1,
        severity: 'high',
        affectedPersonas: ['ready_to_buy', 'comparison_shopper'],
        page: '/pricing',
        whyItBlocks: 'No visible pricing tiers',
        concreteFix: {
          what: 'Add pricing table with 3 tiers',
          where: '/pricing above the fold',
        },
      },
    ],
    quickWins: [
      {
        addressesIssueId: 1,
        title: 'Add pricing table',
        action: 'Create a comparison table with 3 pricing tiers',
        page: '/pricing',
        expectedImpact: 'Reduces bounce rate for ready-to-buy visitors',
      },
    ],
    structuralChanges: [
      {
        addressesIssueIds: [1],
        title: 'Pricing page overhaul',
        description: 'Complete redesign of pricing page',
        pagesAffected: ['/pricing', '/'],
        rationale: 'Current page lacks clarity for decision-makers',
      },
    ],
    score: 62,
    scoreJustification: 'Website has good structure but lacks clear pricing and CTAs.',
  };

  it('calculates correct counts from sample data', () => {
    expect(sampleOutput.observations.length).toBe(1);
    expect(sampleOutput.personaJourneys.length).toBe(2);
    expect(sampleOutput.blockingIssues.length).toBe(1);
    expect(sampleOutput.quickWins.length).toBe(1);
    expect(sampleOutput.structuralChanges.length).toBe(1);
  });

  it('counts high severity issues correctly', () => {
    const highCount = sampleOutput.blockingIssues.filter(i => i.severity === 'high').length;
    expect(highCount).toBe(1);
  });

  it('counts failed journeys correctly', () => {
    const failedCount = sampleOutput.personaJourneys.filter(j => !j.succeeded).length;
    expect(failedCount).toBe(1);
  });

  it('derives correct verdict from score', () => {
    expect(deriveVerdict(sampleOutput.score)).toBe('MIXED');
  });

  it('validates blocking issue structure', () => {
    const issue = sampleOutput.blockingIssues[0];
    expect(issue.id).toBeDefined();
    expect(issue.severity).toMatch(/^(high|medium|low)$/);
    expect(issue.affectedPersonas.length).toBeGreaterThan(0);
    expect(issue.page).toBeDefined();
    expect(issue.whyItBlocks).toBeDefined();
    expect(issue.concreteFix.what).toBeDefined();
    expect(issue.concreteFix.where).toBeDefined();
  });

  it('validates persona journey structure', () => {
    const journey = sampleOutput.personaJourneys[0];
    expect(journey.persona).toMatch(/^(first_time|ready_to_buy|comparison_shopper)$/);
    expect(journey.startingPage).toBeDefined();
    expect(journey.actualPath.length).toBeGreaterThan(0);
    expect(typeof journey.confidenceScore).toBe('number');
    expect(typeof journey.succeeded).toBe('boolean');
  });

  it('validates page observation structure', () => {
    const obs = sampleOutput.observations[0];
    expect(obs.pagePath).toBeDefined();
    expect(obs.pageType).toBeDefined();
    expect(Array.isArray(obs.aboveFoldElements)).toBe(true);
    expect(Array.isArray(obs.primaryCTAs)).toBe(true);
    expect(Array.isArray(obs.trustProofElements)).toBe(true);
    expect(Array.isArray(obs.missingUnclearElements)).toBe(true);
  });
});

describe('Edge cases', () => {
  it('handles empty V5 output gracefully', () => {
    const emptyOutput: V5DiagnosticOutput = {
      observations: [],
      personaJourneys: [],
      blockingIssues: [],
      quickWins: [],
      structuralChanges: [],
      score: 0,
      scoreJustification: '',
    };

    expect(emptyOutput.observations.length).toBe(0);
    expect(emptyOutput.blockingIssues.length).toBe(0);
    expect(deriveVerdict(emptyOutput.score)).toBe('WEAK');
  });

  it('handles boundary score values', () => {
    expect(deriveVerdict(0)).toBe('WEAK');
    expect(deriveVerdict(59)).toBe('WEAK');
    expect(deriveVerdict(60)).toBe('MIXED');
    expect(deriveVerdict(79)).toBe('MIXED');
    expect(deriveVerdict(80)).toBe('STRONG');
    expect(deriveVerdict(100)).toBe('STRONG');
  });
});
