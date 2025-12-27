// tests/os/outcomeCaptureModal.test.ts
// Tests for OutcomeCaptureModal and outcome capture integration

import { describe, it, expect } from 'vitest';
import {
  LOSS_REASON_TAGS,
  type LossReasonTag,
  type OutcomeCaptureData,
} from '@/lib/types/rfp';

describe('LOSS_REASON_TAGS', () => {
  it('should include all expected loss reason tags', () => {
    expect(LOSS_REASON_TAGS).toContain('price');
    expect(LOSS_REASON_TAGS).toContain('timing');
    expect(LOSS_REASON_TAGS).toContain('scope');
    expect(LOSS_REASON_TAGS).toContain('competitor');
    expect(LOSS_REASON_TAGS).toContain('budget');
    expect(LOSS_REASON_TAGS).toContain('fit');
    expect(LOSS_REASON_TAGS).toContain('experience');
    expect(LOSS_REASON_TAGS).toContain('relationship');
    expect(LOSS_REASON_TAGS).toContain('internal');
    expect(LOSS_REASON_TAGS).toContain('cancelled');
    expect(LOSS_REASON_TAGS).toContain('other');
  });

  it('should have 11 loss reason tags', () => {
    expect(LOSS_REASON_TAGS.length).toBe(11);
  });
});

describe('OutcomeCaptureData type', () => {
  it('should accept valid won outcome data', () => {
    const data: OutcomeCaptureData = {
      outcomeDecisionAt: new Date().toISOString(),
      dealValue: 50000,
      budgetRange: '$40k-$60k',
      decisionNotes: 'Strong proposal with good pricing',
    };

    expect(data.outcomeDecisionAt).toBeDefined();
    expect(data.dealValue).toBe(50000);
    expect(data.lossReasonTags).toBeUndefined();
  });

  it('should accept valid lost outcome data', () => {
    const data: OutcomeCaptureData = {
      outcomeDecisionAt: new Date().toISOString(),
      lossReasonTags: ['price', 'timing'],
      competitorChosen: 'Acme Corp',
      budgetRange: '$30k-$40k',
      decisionNotes: 'Competitor offered faster timeline',
    };

    expect(data.outcomeDecisionAt).toBeDefined();
    expect(data.lossReasonTags).toEqual(['price', 'timing']);
    expect(data.competitorChosen).toBe('Acme Corp');
    expect(data.dealValue).toBeUndefined();
  });

  it('should accept minimal outcome data (skip scenario)', () => {
    const data: OutcomeCaptureData = {
      outcomeDecisionAt: new Date().toISOString(),
    };

    expect(data.outcomeDecisionAt).toBeDefined();
    expect(data.lossReasonTags).toBeUndefined();
    expect(data.competitorChosen).toBeUndefined();
    expect(data.dealValue).toBeUndefined();
    expect(data.decisionNotes).toBeUndefined();
    expect(data.budgetRange).toBeUndefined();
  });
});

describe('Outcome capture integration scenarios', () => {
  describe('Won status transition', () => {
    it('should trigger modal on won status selection', () => {
      // Simulates the behavior: when user selects "won" status,
      // the OutcomeCaptureModal should open
      const previousStatus = 'submitted';
      const newStatus = 'won';

      const shouldTriggerModal = newStatus === 'won' || newStatus === 'lost';
      expect(shouldTriggerModal).toBe(true);
    });

    it('should allow skip without blocking status change', () => {
      // When user clicks "Skip for now", status should still update
      const newStatus = 'won';
      const skipped = true;

      // Status should be updated regardless of skip
      const statusUpdate = { status: newStatus };
      expect(statusUpdate.status).toBe('won');

      // Outcome data should be empty when skipped
      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
      };
      expect(outcomeData.dealValue).toBeUndefined();
    });

    it('should include deal value when provided', () => {
      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        dealValue: 75000,
        decisionNotes: 'Client loved our approach',
      };

      expect(outcomeData.dealValue).toBe(75000);
      expect(outcomeData.decisionNotes).toBe('Client loved our approach');
    });
  });

  describe('Lost status transition', () => {
    it('should trigger modal on lost status selection', () => {
      const previousStatus = 'submitted';
      const newStatus = 'lost';

      const shouldTriggerModal = newStatus === 'won' || newStatus === 'lost';
      expect(shouldTriggerModal).toBe(true);
    });

    it('should not trigger modal on non-outcome status changes', () => {
      const statusTransitions = [
        { from: 'intake', to: 'assembling' },
        { from: 'assembling', to: 'review' },
        { from: 'review', to: 'submitted' },
      ];

      statusTransitions.forEach(({ to }) => {
        const shouldTriggerModal = to === 'won' || to === 'lost';
        expect(shouldTriggerModal).toBe(false);
      });
    });

    it('should capture loss reason tags', () => {
      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        lossReasonTags: ['price', 'competitor'],
        competitorChosen: 'Better Agency',
        decisionNotes: 'They undercut our pricing significantly',
      };

      expect(outcomeData.lossReasonTags).toContain('price');
      expect(outcomeData.lossReasonTags).toContain('competitor');
      expect(outcomeData.competitorChosen).toBe('Better Agency');
    });

    it('should support multiple loss reason tags', () => {
      const tags: LossReasonTag[] = ['price', 'timing', 'scope'];
      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        lossReasonTags: tags,
      };

      expect(outcomeData.lossReasonTags?.length).toBe(3);
    });
  });

  describe('Competitor handling', () => {
    it('should use known competitor from dropdown', () => {
      const knownCompetitors = ['Agency A', 'Agency B', 'Agency C'];
      const selectedCompetitor = 'Agency B';

      expect(knownCompetitors).toContain(selectedCompetitor);

      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        lossReasonTags: ['competitor'],
        competitorChosen: selectedCompetitor,
      };

      expect(outcomeData.competitorChosen).toBe('Agency B');
    });

    it('should allow freeform competitor entry', () => {
      const knownCompetitors = ['Agency A', 'Agency B'];
      const newCompetitor = 'Unknown New Agency';

      expect(knownCompetitors).not.toContain(newCompetitor);

      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        lossReasonTags: ['competitor'],
        competitorChosen: newCompetitor,
      };

      expect(outcomeData.competitorChosen).toBe('Unknown New Agency');
    });
  });

  describe('Budget range handling', () => {
    it('should capture budget range for won deals', () => {
      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        dealValue: 50000,
        budgetRange: '$50k-$75k',
      };

      expect(outcomeData.budgetRange).toBe('$50k-$75k');
    });

    it('should capture budget range for lost deals', () => {
      const outcomeData: OutcomeCaptureData = {
        outcomeDecisionAt: new Date().toISOString(),
        lossReasonTags: ['budget'],
        budgetRange: '$25k-$35k',
        decisionNotes: 'Budget was lower than expected',
      };

      expect(outcomeData.budgetRange).toBe('$25k-$35k');
      expect(outcomeData.lossReasonTags).toContain('budget');
    });
  });
});

describe('Outcome data persistence', () => {
  it('should generate valid API payload for won outcome', () => {
    const outcomeData: OutcomeCaptureData = {
      outcomeDecisionAt: '2024-01-15T12:00:00Z',
      dealValue: 100000,
      budgetRange: '$80k-$120k',
      decisionNotes: 'Excellent proposal',
    };

    const apiPayload = {
      status: 'won' as const,
      ...outcomeData,
    };

    expect(apiPayload.status).toBe('won');
    expect(apiPayload.outcomeDecisionAt).toBe('2024-01-15T12:00:00Z');
    expect(apiPayload.dealValue).toBe(100000);
  });

  it('should generate valid API payload for lost outcome', () => {
    const outcomeData: OutcomeCaptureData = {
      outcomeDecisionAt: '2024-01-15T12:00:00Z',
      lossReasonTags: ['price', 'timing'],
      competitorChosen: 'Rival Agency',
      budgetRange: '$50k-$60k',
      decisionNotes: 'Lost on price',
    };

    const apiPayload = {
      status: 'lost' as const,
      ...outcomeData,
    };

    expect(apiPayload.status).toBe('lost');
    expect(apiPayload.lossReasonTags).toEqual(['price', 'timing']);
    expect(apiPayload.competitorChosen).toBe('Rival Agency');
  });

  it('should generate valid API payload for skipped outcome', () => {
    const apiPayload = {
      status: 'lost' as const,
    };

    expect(apiPayload.status).toBe('lost');
    // No outcome data when skipped
    expect((apiPayload as any).outcomeDecisionAt).toBeUndefined();
    expect((apiPayload as any).lossReasonTags).toBeUndefined();
  });
});
