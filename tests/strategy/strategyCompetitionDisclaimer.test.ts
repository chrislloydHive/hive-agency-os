// tests/strategy/strategyCompetitionDisclaimer.test.ts
// Tests for Strategy Competition Disclaimers
//
// Verifies:
// - Disclaimer text is injected when competition confidence is not high
// - Strategy can run with no competition (no blocking)
// - Correct disclaimer text for each state

import { describe, it, expect } from 'vitest';
import {
  computeStrategyCompetitionContext,
  buildStrategyPromptWithDisclaimer,
  LOW_COMPETITION_DISCLAIMER,
  MISSING_COMPETITION_DISCLAIMER,
} from '@/lib/os/strategy/strategyInputsHelpers';

// ============================================================================
// computeStrategyCompetitionContext
// ============================================================================

describe('computeStrategyCompetitionContext', () => {
  describe('high confidence scenarios', () => {
    it('returns fully informed for high confidence with competitors', () => {
      const context = computeStrategyCompetitionContext('high', 5);

      expect(context.competitionInformed).toBe(true);
      expect(context.competitionConfidence).toBe('high');
      expect(context.disclaimer).toBeNull();
      expect(context.uiMessage).toBeNull();
    });

    it('returns not informed for high confidence with zero competitors', () => {
      const context = computeStrategyCompetitionContext('high', 0);

      expect(context.competitionInformed).toBe(false);
      expect(context.competitionConfidence).toBe('missing');
      expect(context.disclaimer).toBe(MISSING_COMPETITION_DISCLAIMER);
    });
  });

  describe('low confidence scenarios', () => {
    it('returns not informed for low confidence', () => {
      const context = computeStrategyCompetitionContext('low', 3);

      expect(context.competitionInformed).toBe(false);
      expect(context.competitionConfidence).toBe('low');
      expect(context.disclaimer).toBe(LOW_COMPETITION_DISCLAIMER);
      expect(context.uiMessage).toContain('limited competitive context');
    });
  });

  describe('missing competition scenarios', () => {
    it('returns not informed for missing confidence', () => {
      const context = computeStrategyCompetitionContext('missing', 0);

      expect(context.competitionInformed).toBe(false);
      expect(context.competitionConfidence).toBe('missing');
      expect(context.disclaimer).toBe(MISSING_COMPETITION_DISCLAIMER);
      expect(context.uiMessage).toContain('without competitive context');
    });
  });
});

// ============================================================================
// buildStrategyPromptWithDisclaimer
// ============================================================================

describe('buildStrategyPromptWithDisclaimer', () => {
  const basePrompt = 'Generate a marketing strategy for this company.';

  it('returns base prompt unchanged when no disclaimer needed', () => {
    const context = computeStrategyCompetitionContext('high', 5);
    const result = buildStrategyPromptWithDisclaimer(basePrompt, context);

    expect(result).toBe(basePrompt);
  });

  it('prepends disclaimer for low confidence', () => {
    const context = computeStrategyCompetitionContext('low', 2);
    const result = buildStrategyPromptWithDisclaimer(basePrompt, context);

    expect(result).toContain(LOW_COMPETITION_DISCLAIMER);
    expect(result).toContain(basePrompt);
    expect(result.indexOf(LOW_COMPETITION_DISCLAIMER)).toBeLessThan(
      result.indexOf(basePrompt)
    );
  });

  it('prepends disclaimer for missing competition', () => {
    const context = computeStrategyCompetitionContext('missing', 0);
    const result = buildStrategyPromptWithDisclaimer(basePrompt, context);

    expect(result).toContain(MISSING_COMPETITION_DISCLAIMER);
    expect(result).toContain(basePrompt);
  });

  it('includes newlines between disclaimer and prompt', () => {
    const context = computeStrategyCompetitionContext('low', 2);
    const result = buildStrategyPromptWithDisclaimer(basePrompt, context);

    expect(result).toContain('\n\n');
  });
});

// ============================================================================
// Disclaimer Content Validation
// ============================================================================

describe('Disclaimer text content', () => {
  it('LOW_COMPETITION_DISCLAIMER mentions low-confidence', () => {
    expect(LOW_COMPETITION_DISCLAIMER).toContain('low-confidence');
    expect(LOW_COMPETITION_DISCLAIMER).toContain('validated');
  });

  it('MISSING_COMPETITION_DISCLAIMER mentions no competitive analysis', () => {
    expect(MISSING_COMPETITION_DISCLAIMER).toContain('No competitive analysis');
    expect(MISSING_COMPETITION_DISCLAIMER).toContain('improve recommendation quality');
  });

  it('both disclaimers mention internal positioning as fallback', () => {
    expect(LOW_COMPETITION_DISCLAIMER).toContain('internal positioning');
    expect(MISSING_COMPETITION_DISCLAIMER).toContain('internal positioning');
  });
});

// ============================================================================
// Strategy NOT blocked by competition
// ============================================================================

describe('Strategy runs without competition blocking', () => {
  it('strategy can compute context with missing competition', () => {
    // This should not throw
    const context = computeStrategyCompetitionContext('missing', 0);

    // Context should be valid (not blocked)
    expect(context).toBeDefined();
    expect(context.competitionInformed).toBe(false);
    // But strategy can still proceed - it just has a disclaimer
    expect(context.disclaimer).not.toBeNull();
  });

  it('strategy can compute context with low confidence', () => {
    // LOW_CONFIDENCE_CONTEXT error state
    const context = computeStrategyCompetitionContext('low', 0);

    // Context should be valid (not blocked)
    expect(context).toBeDefined();
    // Strategy proceeds with disclaimer
    expect(context.disclaimer).not.toBeNull();
  });

  it('UI message is suitable for warning banner', () => {
    const lowContext = computeStrategyCompetitionContext('low', 2);
    const missingContext = computeStrategyCompetitionContext('missing', 0);

    // UI messages should be informational, not blocking
    expect(lowContext.uiMessage).toContain('should be validated');
    expect(missingContext.uiMessage).toContain('should be validated');

    // No message should say "blocked" or "cannot"
    expect(lowContext.uiMessage).not.toContain('blocked');
    expect(missingContext.uiMessage).not.toContain('cannot');
  });
});
