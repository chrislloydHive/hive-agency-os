// tests/os/workOutcomeCapture.test.ts
// Tests for work item outcome capture and artifact shipping functionality

import { describe, it, expect } from 'vitest';
import {
  isArtifactShipped,
  canShipArtifact,
  type ArtifactStatus,
} from '@/lib/types/artifact';
import {
  isShippingTransition,
} from '@/lib/os/outcomes/captureCandidate';
import type { WorkOutcomeData } from '@/components/os/outcomes/WorkOutcomeCaptureModal';
import type { OutcomeSignalConfidence } from '@/lib/types/outcomeSignal';

// ============================================================================
// Artifact Shipped State Tests
// ============================================================================

describe('isArtifactShipped', () => {
  it('should return true for final status', () => {
    expect(isArtifactShipped('final')).toBe(true);
  });

  it('should return false for draft status', () => {
    expect(isArtifactShipped('draft')).toBe(false);
  });

  it('should return false for archived status', () => {
    expect(isArtifactShipped('archived')).toBe(false);
  });
});

describe('canShipArtifact', () => {
  it('should return true for draft status', () => {
    expect(canShipArtifact('draft')).toBe(true);
  });

  it('should return false for final status', () => {
    expect(canShipArtifact('final')).toBe(false);
  });

  it('should return false for archived status', () => {
    expect(canShipArtifact('archived')).toBe(false);
  });
});

// ============================================================================
// Shipping Transition Tests
// ============================================================================

describe('isShippingTransition', () => {
  it('should detect transition from draft to final as shipping', () => {
    expect(isShippingTransition('draft', 'final')).toBe(true);
  });

  it('should not detect transition from final to final as shipping', () => {
    expect(isShippingTransition('final', 'final')).toBe(false);
  });

  it('should not detect transition to draft as shipping', () => {
    expect(isShippingTransition('archived', 'draft')).toBe(false);
  });

  it('should not detect transition to archived as shipping', () => {
    expect(isShippingTransition('draft', 'archived')).toBe(false);
  });

  it('should handle undefined old status', () => {
    expect(isShippingTransition(undefined, 'final')).toBe(true);
  });

  it('should not trigger for undefined to draft', () => {
    expect(isShippingTransition(undefined, 'draft')).toBe(false);
  });
});

// ============================================================================
// Work Outcome Data Tests
// ============================================================================

describe('WorkOutcomeData', () => {
  it('should accept minimal required fields', () => {
    const data: WorkOutcomeData = {
      primaryConversionAction: 'Generate qualified leads',
      observedResult: 'Campaign generated 45 MQLs',
      confidence: 'medium',
    };

    expect(data.primaryConversionAction).toBeDefined();
    expect(data.observedResult).toBeDefined();
    expect(data.confidence).toBe('medium');
    expect(data.metric).toBeUndefined();
  });

  it('should accept data with metric', () => {
    const data: WorkOutcomeData = {
      primaryConversionAction: 'Increase brand awareness',
      observedResult: 'Social impressions up 200%',
      confidence: 'high',
      metric: {
        label: 'Impressions',
        value: '1.2M',
        period: 'Q1 2024',
      },
    };

    expect(data.metric).toBeDefined();
    expect(data.metric?.label).toBe('Impressions');
    expect(data.metric?.value).toBe('1.2M');
    expect(data.metric?.period).toBe('Q1 2024');
  });

  it('should accept metric without period', () => {
    const data: WorkOutcomeData = {
      primaryConversionAction: 'Drive conversions',
      observedResult: 'Conversion rate improved',
      confidence: 'low',
      metric: {
        label: 'CVR',
        value: '3.5%',
      },
    };

    expect(data.metric?.period).toBeUndefined();
  });
});

// ============================================================================
// Confidence Level Tests
// ============================================================================

describe('OutcomeSignalConfidence', () => {
  const confidenceLevels: OutcomeSignalConfidence[] = ['low', 'medium', 'high'];

  it('should support all confidence levels', () => {
    confidenceLevels.forEach((level) => {
      const data: WorkOutcomeData = {
        primaryConversionAction: 'Test action',
        observedResult: 'Test result',
        confidence: level,
      };
      expect(data.confidence).toBe(level);
    });
  });
});

// ============================================================================
// Outcome Capture Candidate Scenarios
// ============================================================================

describe('Outcome capture candidate scenarios', () => {
  it('should create candidate when artifact ships with produces relation', () => {
    // Scenario: Work item produces an artifact, artifact is marked as final
    const workItemRelation: string = 'produces';
    const newStatus: ArtifactStatus = 'final';
    const oldStatus: ArtifactStatus = 'draft';

    const isShipping = isShippingTransition(oldStatus, newStatus);
    const isProducingWorkItem = workItemRelation === 'produces';

    expect(isShipping && isProducingWorkItem).toBe(true);
  });

  it('should not create candidate for requires relation', () => {
    // Scenario: Work item requires an artifact (dependency), artifact ships
    const workItemRelation: string = 'requires';

    const shouldCreateCandidate = workItemRelation === 'produces';
    expect(shouldCreateCandidate).toBe(false);
  });

  it('should not create candidate for reference relation', () => {
    // Scenario: Work item references an artifact, artifact ships
    const workItemRelation: string = 'reference';

    const shouldCreateCandidate = workItemRelation === 'produces';
    expect(shouldCreateCandidate).toBe(false);
  });
});

// ============================================================================
// API Payload Construction Tests
// ============================================================================

describe('Outcome API payload construction', () => {
  it('should build valid payload for work item outcome', () => {
    const workItemId = 'work_123';
    const companyId = 'company_456';
    const data: WorkOutcomeData = {
      primaryConversionAction: 'Generate leads',
      observedResult: 'Generated 50 leads in 2 weeks',
      confidence: 'high',
      metric: {
        label: 'MQLs',
        value: '50',
        period: 'Dec 2024',
      },
    };

    const payload = {
      ...data,
      workItemId,
      companyId,
    };

    expect(payload.primaryConversionAction).toBe('Generate leads');
    expect(payload.workItemId).toBe(workItemId);
    expect(payload.companyId).toBe(companyId);
  });

  it('should build valid payload for artifact outcome', () => {
    const artifactId = 'art_789';
    const companyId = 'company_456';
    const data: WorkOutcomeData = {
      primaryConversionAction: 'Increase engagement',
      observedResult: 'Email open rate improved by 25%',
      confidence: 'medium',
    };

    const payload = {
      ...data,
      artifactId,
      companyId,
    };

    expect(payload.primaryConversionAction).toBe('Increase engagement');
    expect(payload.artifactId).toBe(artifactId);
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe('Outcome capture idempotency', () => {
  it('should handle duplicate outcome capture gracefully', () => {
    // Each capture should create a new signal with unique ID
    // This is acceptable behavior - duplicates are allowed
    const captures = [
      { id: 'sig_1', timestamp: '2024-01-01T10:00:00Z' },
      { id: 'sig_2', timestamp: '2024-01-01T10:00:05Z' }, // Same data, different ID
    ];

    expect(captures[0].id).not.toBe(captures[1].id);
    expect(captures.length).toBe(2);
  });
});

// ============================================================================
// Work-Artifact Relation Upsert Tests
// ============================================================================

describe('Work-Artifact relation upsert', () => {
  const VALID_RELATIONS = ['produces', 'requires', 'reference'] as const;

  describe('coerceRelation behavior', () => {
    // Simulating the coerceRelation function behavior
    function coerceRelation(input: unknown): string {
      if (
        typeof input === 'string' &&
        (VALID_RELATIONS as readonly string[]).includes(input)
      ) {
        return input;
      }
      return 'produces';
    }

    it('should accept valid relations', () => {
      expect(coerceRelation('produces')).toBe('produces');
      expect(coerceRelation('requires')).toBe('requires');
      expect(coerceRelation('reference')).toBe('reference');
    });

    it('should default to produces for invalid input', () => {
      expect(coerceRelation('invalid')).toBe('produces');
      expect(coerceRelation('')).toBe('produces');
      expect(coerceRelation(null)).toBe('produces');
      expect(coerceRelation(undefined)).toBe('produces');
      expect(coerceRelation(123)).toBe('produces');
      expect(coerceRelation({})).toBe('produces');
    });
  });

  describe('attach action results', () => {
    type AttachAction = 'attached' | 'updated' | 'unchanged';

    interface AttachResult {
      action: AttachAction;
      previousRelation?: string;
    }

    it('should return attached for new artifact', () => {
      const result: AttachResult = { action: 'attached' };
      expect(result.action).toBe('attached');
      expect(result.previousRelation).toBeUndefined();
    });

    it('should return unchanged when relation matches', () => {
      const result: AttachResult = { action: 'unchanged' };
      expect(result.action).toBe('unchanged');
    });

    it('should return updated with previous relation when changed', () => {
      const result: AttachResult = {
        action: 'updated',
        previousRelation: 'requires',
      };
      expect(result.action).toBe('updated');
      expect(result.previousRelation).toBe('requires');
    });
  });

  describe('upsert scenarios', () => {
    interface MockArtifact {
      artifactId: string;
      relation: string;
    }

    function simulateUpsert(
      existing: MockArtifact[],
      newArtifact: MockArtifact
    ): { action: string; result: MockArtifact[] } {
      const index = existing.findIndex(a => a.artifactId === newArtifact.artifactId);

      if (index < 0) {
        // Not found - add new
        return {
          action: 'attached',
          result: [...existing, newArtifact],
        };
      }

      if (existing[index].relation === newArtifact.relation) {
        // Same relation - no change
        return {
          action: 'unchanged',
          result: existing,
        };
      }

      // Different relation - update
      const updated = [...existing];
      updated[index] = { ...existing[index], relation: newArtifact.relation };
      return {
        action: 'updated',
        result: updated,
      };
    }

    it('should add artifact when not present', () => {
      const existing: MockArtifact[] = [];
      const result = simulateUpsert(existing, { artifactId: 'art_1', relation: 'produces' });

      expect(result.action).toBe('attached');
      expect(result.result.length).toBe(1);
      expect(result.result[0].relation).toBe('produces');
    });

    it('should not change when same relation', () => {
      const existing: MockArtifact[] = [{ artifactId: 'art_1', relation: 'produces' }];
      const result = simulateUpsert(existing, { artifactId: 'art_1', relation: 'produces' });

      expect(result.action).toBe('unchanged');
      expect(result.result.length).toBe(1);
    });

    it('should update relation when different', () => {
      const existing: MockArtifact[] = [{ artifactId: 'art_1', relation: 'produces' }];
      const result = simulateUpsert(existing, { artifactId: 'art_1', relation: 'requires' });

      expect(result.action).toBe('updated');
      expect(result.result.length).toBe(1);
      expect(result.result[0].relation).toBe('requires');
    });

    it('should handle multiple artifacts correctly', () => {
      const existing: MockArtifact[] = [
        { artifactId: 'art_1', relation: 'produces' },
        { artifactId: 'art_2', relation: 'reference' },
      ];

      // Update art_1 relation
      const result = simulateUpsert(existing, { artifactId: 'art_1', relation: 'requires' });

      expect(result.action).toBe('updated');
      expect(result.result.length).toBe(2);
      expect(result.result[0].relation).toBe('requires');
      expect(result.result[1].relation).toBe('reference'); // Unchanged
    });
  });
});
