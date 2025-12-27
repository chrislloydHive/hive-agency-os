// tests/strategy/goalStatement.test.ts
// Tests for goalStatement feature implementation
//
// Covers:
// - AI contracts using goalStatement as primary/secondary input
// - Prompt builder handling strategyInputs
// - Goal alignment rule activation

import { describe, it, expect } from 'vitest';
import {
  getContract,
  GOAL_ALIGNMENT_RULE,
  isStrategyInputKey,
  getAIInputKeyLabel,
} from '@/lib/os/ai/strategyFieldContracts';
import {
  buildStrategyFieldPrompt,
  createSnapshotFromFields,
  type StrategyInputs,
  type ConfirmedContextSnapshot,
} from '@/lib/os/ai/buildStrategyFieldPrompt';
import type { ContextFieldV4 } from '@/lib/types/contextField';

// ============================================================================
// Test Helpers
// ============================================================================

function createMinimalSnapshot(): ConfirmedContextSnapshot {
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'B2B SaaS founders',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'identity.businessModel',
      domain: 'identity',
      value: 'SaaS subscription',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'productOffer.valueProposition',
      domain: 'productOffer',
      value: 'Automated marketing for startups',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

// ============================================================================
// Contract Definition Tests
// ============================================================================

describe('goalStatement in AI Contracts', () => {
  describe('objectives contract', () => {
    it('should have goalStatement as primary input', () => {
      const contract = getContract('objectives');
      expect(contract.primaryInputs).toContain('strategy.goalStatement');
    });

    it('should require goal alignment', () => {
      const contract = getContract('objectives');
      expect(contract.requireGoalAlignment).toBe(true);
    });
  });

  describe('bets contract', () => {
    it('should have goalStatement as primary input', () => {
      const contract = getContract('bets');
      expect(contract.primaryInputs).toContain('strategy.goalStatement');
    });

    it('should require goal alignment', () => {
      const contract = getContract('bets');
      expect(contract.requireGoalAlignment).toBe(true);
    });
  });

  describe('valueProp contract', () => {
    it('should have goalStatement as secondary input (stabilizer)', () => {
      const contract = getContract('valueProp');
      expect(contract.secondaryInputs).toContain('strategy.goalStatement');
    });

    it('should NOT require goal alignment', () => {
      const contract = getContract('valueProp');
      expect(contract.requireGoalAlignment).toBeFalsy();
    });
  });

  describe('positioning contract', () => {
    it('should have goalStatement as secondary input (stabilizer)', () => {
      const contract = getContract('positioning');
      expect(contract.secondaryInputs).toContain('strategy.goalStatement');
    });
  });

  describe('constraints contract', () => {
    it('should have goalStatement as secondary input (stabilizer)', () => {
      const contract = getContract('constraints');
      expect(contract.secondaryInputs).toContain('strategy.goalStatement');
    });
  });
});

// ============================================================================
// Goal Alignment Rule Tests
// ============================================================================

describe('GOAL_ALIGNMENT_RULE', () => {
  it('should be defined', () => {
    expect(GOAL_ALIGNMENT_RULE).toBeDefined();
    expect(typeof GOAL_ALIGNMENT_RULE).toBe('string');
  });

  it('should contain critical instructions', () => {
    expect(GOAL_ALIGNMENT_RULE).toContain('GOAL ALIGNMENT');
    expect(GOAL_ALIGNMENT_RULE).toContain('MUST align');
    expect(GOAL_ALIGNMENT_RULE).toContain('Do NOT introduce');
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('isStrategyInputKey', () => {
  it('should return true for strategy keys', () => {
    expect(isStrategyInputKey('strategy.goalStatement')).toBe(true);
  });

  it('should return false for context keys', () => {
    expect(isStrategyInputKey('audience.icpDescription')).toBe(false);
    expect(isStrategyInputKey('identity.businessModel')).toBe(false);
  });
});

describe('getAIInputKeyLabel', () => {
  it('should return label for strategy.goalStatement', () => {
    expect(getAIInputKeyLabel('strategy.goalStatement')).toBe('Goal Statement');
  });

  it('should return label for context keys', () => {
    expect(getAIInputKeyLabel('audience.icpDescription')).toBe('ICP Description');
    expect(getAIInputKeyLabel('identity.businessModel')).toBe('Business Model');
  });
});

// ============================================================================
// Prompt Builder Tests
// ============================================================================

describe('buildStrategyFieldPrompt with goalStatement', () => {
  describe('objectives field (goalStatement as primary)', () => {
    it('should include goalStatement in usedPrimaryKeys when provided', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Increase qualified leads by 50% in Q1',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'objectives',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.generatedUsing.usedPrimaryKeys).toContain('strategy.goalStatement');
      expect(result.generatedUsing.primaryLabels).toContain('Goal Statement');
    });

    it('should activate goal alignment when goalStatement provided', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Increase qualified leads by 50% in Q1',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'objectives',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.generatedUsing.goalAlignmentActive).toBe(true);
    });

    it('should NOT activate goal alignment when goalStatement empty', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: '',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'objectives',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.generatedUsing.goalAlignmentActive).toBe(false);
    });

    it('should NOT activate goal alignment when strategyInputs undefined', () => {
      const snapshot = createMinimalSnapshot();

      const result = buildStrategyFieldPrompt({
        fieldKey: 'objectives',
        contextSnapshot: snapshot,
      });

      expect(result.generatedUsing.goalAlignmentActive).toBe(false);
    });

    it('should include goal alignment rule in prompt when active', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Increase qualified leads by 50% in Q1',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'objectives',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.userPrompt).toContain('GOAL ALIGNMENT');
      expect(result.userPrompt).toContain('Goal Statement: Increase qualified leads');
    });
  });

  describe('valueProp field (goalStatement as secondary)', () => {
    it('should include goalStatement in usedSecondaryKeys when provided', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Increase qualified leads by 50% in Q1',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'valueProp',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.generatedUsing.usedSecondaryKeys).toContain('strategy.goalStatement');
    });

    it('should NOT activate goal alignment (secondary only)', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Increase qualified leads by 50% in Q1',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'valueProp',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      // valueProp doesn't have requireGoalAlignment, so it should be false
      expect(result.generatedUsing.goalAlignmentActive).toBe(false);
    });

    it('should include goalStatement in secondary inputs section of prompt', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Increase qualified leads by 50% in Q1',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'valueProp',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.userPrompt).toContain('MAY Influence');
      expect(result.userPrompt).toContain('Goal Statement');
    });
  });

  describe('bets field (goalStatement as primary)', () => {
    it('should activate goal alignment when goalStatement provided', () => {
      const snapshot = createMinimalSnapshot();
      const strategyInputs: StrategyInputs = {
        goalStatement: 'Double ARR through enterprise expansion',
      };

      const result = buildStrategyFieldPrompt({
        fieldKey: 'bets',
        contextSnapshot: snapshot,
        strategyInputs,
      });

      expect(result.generatedUsing.goalAlignmentActive).toBe(true);
      expect(result.generatedUsing.usedPrimaryKeys).toContain('strategy.goalStatement');
    });
  });
});

// ============================================================================
// Missing Goal Statement Tests
// ============================================================================

describe('missing goalStatement handling', () => {
  it('should include goalStatement in missingPrimaryKeys when not provided', () => {
    const snapshot = createMinimalSnapshot();

    const result = buildStrategyFieldPrompt({
      fieldKey: 'objectives',
      contextSnapshot: snapshot,
      // No strategyInputs provided
    });

    expect(result.generatedUsing.missingPrimaryKeys).toContain('strategy.goalStatement');
  });

  it('should show goalStatement as [unknown] in prompt when missing', () => {
    const snapshot = createMinimalSnapshot();

    const result = buildStrategyFieldPrompt({
      fieldKey: 'objectives',
      contextSnapshot: snapshot,
    });

    expect(result.userPrompt).toContain('Goal Statement: [unknown]');
  });
});
