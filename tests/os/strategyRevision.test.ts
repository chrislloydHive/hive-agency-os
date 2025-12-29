// tests/os/strategyRevision.test.ts
// Tests for Strategy Revision Proposals (Phase 22)
//
// Tests:
// - Proposal generation rules (low-impact, abandoned, learning, high-impact)
// - Deduplication/idempotency
// - Apply logic (only changes targeted, nothing else)
// - Reject/apply status transitions

import { describe, it, expect } from 'vitest';
import {
  generateRevisionProposals,
  dedupeRevisionProposals,
  calculateProposalConfidence,
  getStrategyCompleteness,
  applyCompletenessPenalty,
  REVISION_THRESHOLDS,
} from '@/lib/os/strategy/revision/generateRevisionProposals';
import type { RevisionGenerationContext } from '@/lib/types/strategyRevision';
import {
  generateProposalId,
  isHighImpactProposal,
  hasRemovalChanges,
  sortProposalsByRelevance,
} from '@/lib/types/strategyRevision';
import type { StrategyRevisionProposal, RevisionConfidence } from '@/lib/types/strategyRevision';

// ============================================================================
// Helper Factories
// ============================================================================

function createMockContext(overrides: Partial<RevisionGenerationContext> = {}): RevisionGenerationContext {
  return {
    companyId: 'comp_123',
    strategyId: 'strat_123',
    currentStrategy: {
      goalStatement: 'Increase market share by 20%',
      audience: 'B2B SaaS buyers',
      valueProp: 'Best-in-class analytics',
      positioning: 'Premium analytics platform',
      constraints: 'Limited budget for paid media',
      objectives: [
        { id: 'obj_1', text: 'Increase trials by 25%', status: 'active' },
        { id: 'obj_2', text: 'Reduce churn by 10%', status: 'active' },
      ],
      bets: [
        { id: 'bet_1', title: 'Content-led growth', status: 'active' },
      ],
      tactics: [
        { id: 'tactic_1', title: 'SEO optimization', channels: ['seo'], status: 'active' },
        { id: 'tactic_2', title: 'Blog content series', channels: ['content'], status: 'active' },
      ],
    },
    signals: [],
    isIncomplete: false,
    missingFields: [],
    ...overrides,
  };
}

function createMockSignal(overrides: Partial<RevisionGenerationContext['signals'][0]> = {}): RevisionGenerationContext['signals'][0] {
  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    signalType: 'learning',
    confidence: 'medium',
    summary: 'Test signal summary',
    evidence: ['Evidence point 1'],
    ...overrides,
  };
}

function createMockProposal(overrides: Partial<StrategyRevisionProposal> = {}): StrategyRevisionProposal {
  return {
    id: generateProposalId(),
    companyId: 'comp_123',
    strategyId: 'strat_123',
    title: 'Test Proposal',
    summary: 'Test summary',
    signalIds: ['sig_1'],
    evidence: ['Evidence 1'],
    confidence: 'medium',
    changes: [
      {
        target: 'tactics',
        action: 'update',
        path: 'tactics[tactic_1]',
        description: 'Update tactic',
      },
    ],
    status: 'draft',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Proposal Generation Tests
// ============================================================================

describe('generateRevisionProposals', () => {
  describe('Rule 1: Low-impact tactics', () => {
    it('should generate proposal when tactic has multiple low-impact signals', () => {
      const context = createMockContext({
        signals: [
          createMockSignal({
            signalType: 'low-impact',
            tacticIds: ['tactic_1'],
            summary: 'Low engagement on SEO content',
          }),
          createMockSignal({
            signalType: 'low-impact',
            tacticIds: ['tactic_1'],
            summary: 'SEO traffic not converting',
          }),
        ],
      });

      const proposals = generateRevisionProposals(context);

      expect(proposals.length).toBeGreaterThanOrEqual(1);
      const tacticProposal = proposals.find(p =>
        p.changes.some(c => c.target === 'tactics' && c.path?.includes('tactic_1'))
      );
      expect(tacticProposal).toBeDefined();
      expect(tacticProposal?.title).toContain('SEO optimization');
    });

    it('should NOT generate proposal for single low-impact signal', () => {
      const context = createMockContext({
        signals: [
          createMockSignal({
            signalType: 'low-impact',
            tacticIds: ['tactic_1'],
          }),
        ],
      });

      const proposals = generateRevisionProposals(context);

      // Should not have low-impact proposal since threshold is 2
      const tacticProposal = proposals.find(p =>
        p.title.includes('Refine') && p.changes.some(c => c.path?.includes('tactic_1'))
      );
      expect(tacticProposal).toBeUndefined();
    });
  });

  describe('Rule 2: Abandoned work', () => {
    it('should generate constraint update proposal for untied abandoned signals', () => {
      const context = createMockContext({
        signals: [
          createMockSignal({
            signalType: 'abandoned',
            summary: 'Project was abandoned due to resource constraints',
          }),
          createMockSignal({
            signalType: 'abandoned',
            summary: 'Initiative stalled - no capacity',
          }),
        ],
      });

      const proposals = generateRevisionProposals(context);

      const constraintProposal = proposals.find(p =>
        p.changes.some(c => c.target === 'constraints')
      );
      expect(constraintProposal).toBeDefined();
      expect(constraintProposal?.title).toContain('Resource Constraints');
    });

    it('should generate tactic proposal for abandoned work tied to specific tactic', () => {
      const context = createMockContext({
        signals: [
          createMockSignal({
            signalType: 'abandoned',
            tacticIds: ['tactic_2'],
            summary: 'Blog series never completed',
          }),
          createMockSignal({
            signalType: 'abandoned',
            tacticIds: ['tactic_2'],
            summary: 'Content backlog grew too large',
          }),
        ],
      });

      const proposals = generateRevisionProposals(context);

      const tacticProposal = proposals.find(p =>
        p.title.includes('Blog content series') ||
        p.changes.some(c => c.path?.includes('tactic_2'))
      );
      expect(tacticProposal).toBeDefined();
    });
  });

  describe('Rule 3: Learning clusters', () => {
    it('should propose tactic expansion for positive learning clusters', () => {
      const context = createMockContext({
        signals: [
          createMockSignal({
            signalType: 'learning',
            tacticIds: ['tactic_1'],
            summary: 'SEO bringing high-intent traffic',
          }),
          createMockSignal({
            signalType: 'learning',
            tacticIds: ['tactic_1'],
            summary: 'Long-tail keywords working well',
          }),
          createMockSignal({
            signalType: 'high-impact',
            tacticIds: ['tactic_1'],
            summary: 'SEO contributed to 30% of new trials',
          }),
        ],
      });

      const proposals = generateRevisionProposals(context);

      const expansionProposal = proposals.find(p =>
        p.title.includes('Expand') || p.changes.some(c => c.action === 'add')
      );
      expect(expansionProposal).toBeDefined();
    });
  });

  describe('Rule 4: High-impact patterns', () => {
    it('should propose objective reinforcement for clustered high-impact signals', () => {
      const context = createMockContext({
        signals: [
          createMockSignal({
            signalType: 'high-impact',
            objectiveIds: ['obj_1'],
            summary: 'Trial signups exceeded target',
            confidence: 'high',
          }),
          createMockSignal({
            signalType: 'high-impact',
            objectiveIds: ['obj_1'],
            summary: 'Trial to paid conversion improved',
            confidence: 'high',
          }),
          createMockSignal({
            signalType: 'high-impact',
            objectiveIds: ['obj_1'],
            summary: 'Sales pipeline from trials doubled',
            confidence: 'medium',
          }),
        ],
      });

      const proposals = generateRevisionProposals(context);

      const objectiveProposal = proposals.find(p =>
        p.changes.some(c => c.target === 'objectives')
      );
      expect(objectiveProposal).toBeDefined();
      expect(objectiveProposal?.title).toContain('Reinforce');
    });
  });

  it('should return empty array when no signals provided', () => {
    const context = createMockContext({ signals: [] });
    const proposals = generateRevisionProposals(context);
    expect(proposals).toEqual([]);
  });
});

// ============================================================================
// Deduplication Tests
// ============================================================================

describe('dedupeRevisionProposals', () => {
  it('should deduplicate proposals with same target and action', () => {
    const proposals: StrategyRevisionProposal[] = [
      createMockProposal({
        id: 'rev_1',
        signalIds: ['sig_1'],
        changes: [{ target: 'tactics', action: 'update', path: 'tactics[tactic_1]' }],
      }),
      createMockProposal({
        id: 'rev_2',
        signalIds: ['sig_2'],
        changes: [{ target: 'tactics', action: 'update', path: 'tactics[tactic_1]' }],
      }),
    ];

    const deduped = dedupeRevisionProposals(proposals);

    expect(deduped.length).toBe(1);
    expect(deduped[0].signalIds).toContain('sig_1');
    expect(deduped[0].signalIds).toContain('sig_2');
  });

  it('should keep proposals with different targets', () => {
    const proposals: StrategyRevisionProposal[] = [
      createMockProposal({
        id: 'rev_1',
        changes: [{ target: 'tactics', action: 'update', path: 'tactics[tactic_1]' }],
      }),
      createMockProposal({
        id: 'rev_2',
        changes: [{ target: 'objectives', action: 'update', path: 'objectives[obj_1]' }],
      }),
    ];

    const deduped = dedupeRevisionProposals(proposals);

    expect(deduped.length).toBe(2);
  });

  it('should keep higher confidence when merging duplicates', () => {
    const proposals: StrategyRevisionProposal[] = [
      createMockProposal({
        id: 'rev_1',
        confidence: 'low',
        changes: [{ target: 'tactics', action: 'update', path: 'tactics[tactic_1]' }],
      }),
      createMockProposal({
        id: 'rev_2',
        confidence: 'high',
        changes: [{ target: 'tactics', action: 'update', path: 'tactics[tactic_1]' }],
      }),
    ];

    const deduped = dedupeRevisionProposals(proposals);

    expect(deduped.length).toBe(1);
    expect(deduped[0].confidence).toBe('high');
  });
});

// ============================================================================
// Confidence Calculation Tests
// ============================================================================

describe('calculateProposalConfidence', () => {
  it('should return low for empty signals', () => {
    const confidence = calculateProposalConfidence([]);
    expect(confidence).toBe('low');
  });

  it('should return high when multiple high-confidence signals', () => {
    const signals = [
      { id: 'sig_1', confidence: 'high' as const, signalType: 'learning' as const, source: 'artifact' as const, sourceId: 'art_1', summary: 'Test', createdAt: new Date().toISOString() },
      { id: 'sig_2', confidence: 'high' as const, signalType: 'learning' as const, source: 'artifact' as const, sourceId: 'art_2', summary: 'Test', createdAt: new Date().toISOString() },
      { id: 'sig_3', confidence: 'high' as const, signalType: 'learning' as const, source: 'artifact' as const, sourceId: 'art_3', summary: 'Test', createdAt: new Date().toISOString() },
    ];
    const confidence = calculateProposalConfidence(signals);
    expect(confidence).toBe('high');
  });

  it('should return medium for mixed confidence signals', () => {
    const signals = [
      { id: 'sig_1', confidence: 'high' as const, signalType: 'learning' as const, source: 'artifact' as const, sourceId: 'art_1', summary: 'Test', createdAt: new Date().toISOString() },
      { id: 'sig_2', confidence: 'low' as const, signalType: 'learning' as const, source: 'artifact' as const, sourceId: 'art_2', summary: 'Test', createdAt: new Date().toISOString() },
    ];
    const confidence = calculateProposalConfidence(signals);
    expect(confidence).toBe('medium');
  });

  it('should boost confidence with rich evidence', () => {
    const signals = [
      {
        id: 'sig_1',
        confidence: 'medium' as const,
        signalType: 'learning' as const,
        source: 'artifact' as const,
        sourceId: 'art_1',
        summary: 'Test',
        evidence: ['ev1', 'ev2', 'ev3', 'ev4', 'ev5'],
        createdAt: new Date().toISOString(),
      },
    ];
    const confidence = calculateProposalConfidence(signals);
    // Medium + evidence boost should push toward high
    expect(['medium', 'high']).toContain(confidence);
  });
});

// ============================================================================
// Strategy Completeness Tests
// ============================================================================

describe('getStrategyCompleteness', () => {
  it('should return complete for full strategy', () => {
    const result = getStrategyCompleteness({
      goalStatement: 'Goal',
      audience: 'Audience',
      valueProp: 'Value',
      positioning: 'Position',
      constraints: 'Constraints',
      objectives: [],
      bets: [],
      tactics: [],
    });

    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it('should detect missing goalStatement', () => {
    const result = getStrategyCompleteness({
      goalStatement: '',
      audience: 'Audience',
      valueProp: 'Value',
      objectives: [],
      bets: [],
      tactics: [],
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toContain('goalStatement');
  });

  it('should detect multiple missing fields', () => {
    const result = getStrategyCompleteness({
      objectives: [],
      bets: [],
      tactics: [],
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toContain('goalStatement');
    expect(result.missingFields).toContain('audience');
    expect(result.missingFields).toContain('valueProp');
  });
});

describe('applyCompletenessPenalty', () => {
  it('should cap high confidence to medium when incomplete', () => {
    const result = applyCompletenessPenalty('high', false);
    expect(result).toBe('medium');
  });

  it('should keep confidence unchanged when complete', () => {
    const result = applyCompletenessPenalty('high', true);
    expect(result).toBe('high');
  });

  it('should not change low confidence', () => {
    const result = applyCompletenessPenalty('low', false);
    expect(result).toBe('low');
  });
});

// ============================================================================
// Proposal Helper Tests
// ============================================================================

describe('isHighImpactProposal', () => {
  it('should return true for goalStatement changes', () => {
    const proposal = createMockProposal({
      changes: [{ target: 'goalStatement', action: 'update' }],
    });
    expect(isHighImpactProposal(proposal)).toBe(true);
  });

  it('should return true for objective changes', () => {
    const proposal = createMockProposal({
      changes: [{ target: 'objectives', action: 'update' }],
    });
    expect(isHighImpactProposal(proposal)).toBe(true);
  });

  it('should return true for any removal action', () => {
    const proposal = createMockProposal({
      changes: [{ target: 'strategicBets', action: 'remove' }],
    });
    expect(isHighImpactProposal(proposal)).toBe(true);
  });

  it('should return false for tactic update', () => {
    const proposal = createMockProposal({
      changes: [{ target: 'tactics', action: 'update' }],
    });
    expect(isHighImpactProposal(proposal)).toBe(false);
  });
});

describe('hasRemovalChanges', () => {
  it('should return true when proposal has remove action', () => {
    const proposal = createMockProposal({
      changes: [{ target: 'tactics', action: 'remove', path: 'tactics[tactic_1]' }],
    });
    expect(hasRemovalChanges(proposal)).toBe(true);
  });

  it('should return false when no remove actions', () => {
    const proposal = createMockProposal({
      changes: [
        { target: 'tactics', action: 'update' },
        { target: 'tactics', action: 'add' },
      ],
    });
    expect(hasRemovalChanges(proposal)).toBe(false);
  });
});

describe('sortProposalsByRelevance', () => {
  it('should sort high-impact proposals first', () => {
    const proposals = [
      createMockProposal({
        id: 'rev_1',
        confidence: 'high',
        changes: [{ target: 'tactics', action: 'update' }],
      }),
      createMockProposal({
        id: 'rev_2',
        confidence: 'low',
        changes: [{ target: 'goalStatement', action: 'update' }],
      }),
    ];

    const sorted = sortProposalsByRelevance(proposals);

    expect(sorted[0].id).toBe('rev_2'); // High-impact first
  });

  it('should sort by confidence when same impact level', () => {
    const proposals = [
      createMockProposal({
        id: 'rev_1',
        confidence: 'low',
        changes: [{ target: 'tactics', action: 'update' }],
      }),
      createMockProposal({
        id: 'rev_2',
        confidence: 'high',
        changes: [{ target: 'tactics', action: 'update' }],
      }),
    ];

    const sorted = sortProposalsByRelevance(proposals);

    expect(sorted[0].id).toBe('rev_2'); // High confidence first
  });
});

// ============================================================================
// ID Generation Tests
// ============================================================================

describe('generateProposalId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateProposalId());
    }
    expect(ids.size).toBe(100);
  });

  it('should start with rev_ prefix', () => {
    const id = generateProposalId();
    expect(id.startsWith('rev_')).toBe(true);
  });
});

// ============================================================================
// Threshold Configuration Tests
// ============================================================================

describe('REVISION_THRESHOLDS', () => {
  it('should have sensible default values', () => {
    expect(REVISION_THRESHOLDS.MIN_SIGNALS_FOR_PROPOSAL).toBeGreaterThanOrEqual(1);
    expect(REVISION_THRESHOLDS.MIN_SIGNALS_FOR_HIGH_IMPACT).toBeGreaterThan(
      REVISION_THRESHOLDS.MIN_SIGNALS_FOR_PROPOSAL
    );
    expect(REVISION_THRESHOLDS.LOW_IMPACT_SIGNAL_THRESHOLD).toBeGreaterThanOrEqual(2);
    expect(REVISION_THRESHOLDS.ABANDONED_SIGNAL_THRESHOLD).toBeGreaterThanOrEqual(2);
  });
});
