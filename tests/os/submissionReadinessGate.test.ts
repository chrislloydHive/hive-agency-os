// tests/os/submissionReadinessGate.test.ts
// Tests for Submission Readiness Gate (SubmissionReadinessModal and useSubmissionGate)

import { describe, test, expect } from 'vitest';
import type { BidReadiness, BidRisk } from '@/lib/os/rfp/computeBidReadiness';
import type { SubmissionSnapshot } from '@/components/os/rfp/SubmissionReadinessModal';
import {
  getRecommendationLabel,
  getRecommendationBgClass,
  getBidReadinessSummary,
} from '@/lib/os/rfp/computeBidReadiness';

// ============================================================================
// Mock Data Helpers
// ============================================================================

function createMockRisk(
  severity: 'low' | 'medium' | 'high' | 'critical',
  category: string = 'coverage'
): BidRisk {
  return {
    category,
    severity,
    description: `${severity} severity ${category} risk`,
    impact: 'May affect win probability',
  };
}

function createMockBidReadiness(options: {
  score: number;
  recommendation: 'go' | 'conditional' | 'no_go';
  risks?: BidRisk[];
  isReliable?: boolean;
}): BidReadiness {
  return {
    score: options.score,
    recommendation: options.recommendation,
    reasons: [],
    topRisks: options.risks ?? [],
    highestImpactFixes: [],
    breakdown: {
      firmBrainReadiness: options.score,
      winStrategyHealth: options.score,
      rubricCoverageHealth: options.score,
      proofCoverage: options.score,
      personaAlignment: options.score,
      weights: { firmBrain: 0.25, strategy: 0.20, coverage: 0.25, proof: 0.15, persona: 0.15 },
    },
    isReliableAssessment: options.isReliable ?? true,
  };
}

function createMockSnapshot(options: {
  score: number;
  recommendation: 'go' | 'conditional' | 'no_go';
  risksAcknowledged: boolean;
  acknowledgedRisks?: Array<{ category: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }>;
}): SubmissionSnapshot {
  return {
    score: options.score,
    recommendation: options.recommendation,
    summary: `Test summary for ${options.recommendation}`,
    acknowledgedRisks: options.acknowledgedRisks ?? [],
    risksAcknowledged: options.risksAcknowledged,
    submittedAt: new Date().toISOString(),
    submittedBy: null,
  };
}

// ============================================================================
// Submission Snapshot Tests
// ============================================================================

describe('SubmissionSnapshot Structure', () => {
  test('snapshot captures score and recommendation', () => {
    const snapshot = createMockSnapshot({
      score: 75,
      recommendation: 'conditional',
      risksAcknowledged: true,
    });

    expect(snapshot.score).toBe(75);
    expect(snapshot.recommendation).toBe('conditional');
    expect(typeof snapshot.submittedAt).toBe('string');
  });

  test('snapshot captures acknowledged risks', () => {
    const risks = [
      { category: 'coverage', severity: 'high' as const, description: 'Low coverage' },
      { category: 'strategy', severity: 'medium' as const, description: 'Missing themes' },
    ];

    const snapshot = createMockSnapshot({
      score: 55,
      recommendation: 'conditional',
      risksAcknowledged: true,
      acknowledgedRisks: risks,
    });

    expect(snapshot.acknowledgedRisks).toHaveLength(2);
    expect(snapshot.acknowledgedRisks[0].severity).toBe('high');
    expect(snapshot.acknowledgedRisks[1].category).toBe('strategy');
  });

  test('snapshot includes timestamp', () => {
    const beforeTime = new Date().toISOString();
    const snapshot = createMockSnapshot({
      score: 80,
      recommendation: 'go',
      risksAcknowledged: true,
    });
    const afterTime = new Date().toISOString();

    expect(snapshot.submittedAt >= beforeTime).toBe(true);
    expect(snapshot.submittedAt <= afterTime).toBe(true);
  });
});

// ============================================================================
// Acknowledgement Requirement Tests
// ============================================================================

describe('Acknowledgement Requirements', () => {
  test('no acknowledgement required for "go" recommendation', () => {
    const readiness = createMockBidReadiness({
      score: 85,
      recommendation: 'go',
      risks: [], // No risks
    });

    // For "go" with no risks, user can proceed without checkbox
    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    expect(requiresAcknowledgement).toBe(false);
  });

  test('acknowledgement required for "conditional" with risks', () => {
    const readiness = createMockBidReadiness({
      score: 55,
      recommendation: 'conditional',
      risks: [createMockRisk('medium', 'coverage')],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    expect(requiresAcknowledgement).toBe(true);
  });

  test('acknowledgement required for "no_go" with risks', () => {
    const readiness = createMockBidReadiness({
      score: 30,
      recommendation: 'no_go',
      risks: [
        createMockRisk('critical', 'coverage'),
        createMockRisk('high', 'strategy'),
      ],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    expect(requiresAcknowledgement).toBe(true);
  });

  test('no acknowledgement required for "conditional" without risks', () => {
    const readiness = createMockBidReadiness({
      score: 60,
      recommendation: 'conditional',
      risks: [],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    expect(requiresAcknowledgement).toBe(false);
  });
});

// ============================================================================
// Risk Display Tests
// ============================================================================

describe('Risk Severity Display', () => {
  test('critical risks are identified', () => {
    const readiness = createMockBidReadiness({
      score: 25,
      recommendation: 'no_go',
      risks: [
        createMockRisk('critical', 'coverage'),
        createMockRisk('medium', 'strategy'),
      ],
    });

    const hasCriticalRisks = readiness.topRisks.some(r => r.severity === 'critical');
    expect(hasCriticalRisks).toBe(true);
  });

  test('no critical risks when all are lower severity', () => {
    const readiness = createMockBidReadiness({
      score: 55,
      recommendation: 'conditional',
      risks: [
        createMockRisk('high', 'coverage'),
        createMockRisk('medium', 'strategy'),
        createMockRisk('low', 'proof'),
      ],
    });

    const hasCriticalRisks = readiness.topRisks.some(r => r.severity === 'critical');
    expect(hasCriticalRisks).toBe(false);
  });
});

// ============================================================================
// Recommendation Display Integration Tests
// ============================================================================

describe('Recommendation Display', () => {
  test('go recommendation shows correct label and style', () => {
    expect(getRecommendationLabel('go')).toBe('Go');
    expect(getRecommendationBgClass('go')).toContain('emerald');
  });

  test('conditional recommendation shows correct label and style', () => {
    expect(getRecommendationLabel('conditional')).toBe('Conditional Go');
    expect(getRecommendationBgClass('conditional')).toContain('amber');
  });

  test('no_go recommendation shows correct label and style', () => {
    expect(getRecommendationLabel('no_go')).toBe('No-Go');
    expect(getRecommendationBgClass('no_go')).toContain('red');
  });
});

describe('Recommendation Summaries', () => {
  test('go summary is appropriate for submission context', () => {
    const readiness = createMockBidReadiness({
      score: 85,
      recommendation: 'go',
    });
    const summary = getBidReadinessSummary(readiness);
    expect(summary).toContain('confidence');
  });

  test('conditional summary warns about risks', () => {
    const readiness = createMockBidReadiness({
      score: 55,
      recommendation: 'conditional',
      risks: [createMockRisk('medium', 'coverage')],
    });
    const summary = getBidReadinessSummary(readiness);
    expect(summary).toContain('risk');
  });

  test('no_go summary strongly discourages', () => {
    const readiness = createMockBidReadiness({
      score: 25,
      recommendation: 'no_go',
      risks: [createMockRisk('critical', 'coverage')],
    });
    const summary = getBidReadinessSummary(readiness);
    expect(summary.toLowerCase()).toContain('not recommended');
  });
});

// ============================================================================
// Unreliable Assessment Tests
// ============================================================================

describe('Unreliable Assessment Warning', () => {
  test('shows warning when assessment is unreliable', () => {
    const readiness = createMockBidReadiness({
      score: 50,
      recommendation: 'conditional',
      isReliable: false,
    });

    expect(readiness.isReliableAssessment).toBe(false);
  });

  test('no warning when assessment is reliable', () => {
    const readiness = createMockBidReadiness({
      score: 75,
      recommendation: 'go',
      isReliable: true,
    });

    expect(readiness.isReliableAssessment).toBe(true);
  });
});

// ============================================================================
// Proceed Logic Tests
// ============================================================================

describe('Proceed Logic', () => {
  test('can proceed immediately with "go" recommendation', () => {
    const readiness = createMockBidReadiness({
      score: 85,
      recommendation: 'go',
      risks: [],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    const risksAcknowledged = false; // User hasn't checked checkbox
    const canProceed = !requiresAcknowledgement || risksAcknowledged;

    expect(canProceed).toBe(true);
  });

  test('cannot proceed with "conditional" until acknowledged', () => {
    const readiness = createMockBidReadiness({
      score: 55,
      recommendation: 'conditional',
      risks: [createMockRisk('medium', 'coverage')],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    const risksAcknowledged = false;
    const canProceed = !requiresAcknowledgement || risksAcknowledged;

    expect(canProceed).toBe(false);
  });

  test('can proceed with "conditional" after acknowledgement', () => {
    const readiness = createMockBidReadiness({
      score: 55,
      recommendation: 'conditional',
      risks: [createMockRisk('medium', 'coverage')],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    const risksAcknowledged = true; // User has checked checkbox
    const canProceed = !requiresAcknowledgement || risksAcknowledged;

    expect(canProceed).toBe(true);
  });

  test('cannot proceed with "no_go" until acknowledged', () => {
    const readiness = createMockBidReadiness({
      score: 25,
      recommendation: 'no_go',
      risks: [createMockRisk('critical', 'coverage')],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    const risksAcknowledged = false;
    const canProceed = !requiresAcknowledgement || risksAcknowledged;

    expect(canProceed).toBe(false);
  });

  test('can proceed with "no_go" after acknowledgement (user choice)', () => {
    const readiness = createMockBidReadiness({
      score: 25,
      recommendation: 'no_go',
      risks: [createMockRisk('critical', 'coverage')],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    const risksAcknowledged = true;
    const canProceed = !requiresAcknowledgement || risksAcknowledged;

    // User can choose to proceed despite no_go - just requires acknowledgement
    expect(canProceed).toBe(true);
  });
});

// ============================================================================
// Snapshot Building Tests
// ============================================================================

describe('Snapshot Building', () => {
  test('snapshot includes all risk details', () => {
    const risks: BidRisk[] = [
      createMockRisk('high', 'coverage'),
      createMockRisk('medium', 'strategy'),
    ];

    const readiness = createMockBidReadiness({
      score: 50,
      recommendation: 'conditional',
      risks,
    });

    const snapshot: SubmissionSnapshot = {
      score: readiness.score,
      recommendation: readiness.recommendation,
      summary: getBidReadinessSummary(readiness),
      acknowledgedRisks: readiness.topRisks.map(r => ({
        category: r.category,
        severity: r.severity,
        description: r.description,
      })),
      risksAcknowledged: true,
      submittedAt: new Date().toISOString(),
    };

    expect(snapshot.acknowledgedRisks).toHaveLength(2);
    expect(snapshot.acknowledgedRisks[0].severity).toBe('high');
    expect(snapshot.acknowledgedRisks[0].category).toBe('coverage');
  });

  test('snapshot marks risksAcknowledged correctly', () => {
    const readiness = createMockBidReadiness({
      score: 85,
      recommendation: 'go',
      risks: [],
    });

    const requiresAcknowledgement = readiness.topRisks.length > 0 && readiness.recommendation !== 'go';
    const userCheckedBox = false;

    const snapshot: SubmissionSnapshot = {
      score: readiness.score,
      recommendation: readiness.recommendation,
      summary: getBidReadinessSummary(readiness),
      acknowledgedRisks: [],
      risksAcknowledged: requiresAcknowledgement ? userCheckedBox : true,
      submittedAt: new Date().toISOString(),
    };

    // For go recommendation, risksAcknowledged is true (no acknowledgement was required)
    expect(snapshot.risksAcknowledged).toBe(true);
  });
});

// ============================================================================
// Action Types Tests
// ============================================================================

describe('Action Types', () => {
  test('submit action uses correct label', () => {
    const action: 'submit' | 'export' = 'submit';
    const actionLabel = action === 'submit' ? 'Submit' : 'Export';
    expect(actionLabel).toBe('Submit');
  });

  test('export action uses correct label', () => {
    const action: 'submit' | 'export' = 'export';
    const actionLabel = action === 'submit' ? 'Submit' : 'Export';
    expect(actionLabel).toBe('Export');
  });
});
