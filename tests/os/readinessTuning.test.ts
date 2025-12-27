// tests/os/readinessTuning.test.ts
// Tests for bid readiness config and calibration suggestions

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  DEFAULT_PENALTIES,
  validateWeights,
  validateThresholds,
  validateConfig,
  diffConfigs,
  applyChanges,
  generateConfigPatch,
  type BidReadinessConfig,
  type ConfigChange,
} from '@/lib/os/rfp/bidReadinessConfig';
import {
  suggestReadinessTuning,
  applySuggestion,
  generatePatchForClipboard,
  getSuggestionsSummary,
  type TuningSuggestionResult,
} from '@/lib/os/rfp/suggestReadinessTuning';
import type { OutcomeAnalysisResult, OutcomeInsight } from '@/lib/os/rfp/analyzeOutcomes';

// ============================================================================
// Config Validation Tests
// ============================================================================

describe('BidReadinessConfig validation', () => {
  describe('validateWeights', () => {
    it('should return true for valid weights that sum to 1.0', () => {
      expect(validateWeights(DEFAULT_WEIGHTS)).toBe(true);
    });

    it('should return false for weights that do not sum to 1.0', () => {
      const invalidWeights = {
        ...DEFAULT_WEIGHTS,
        firmBrain: 0.5, // This makes sum > 1.0
      };
      expect(validateWeights(invalidWeights)).toBe(false);
    });

    it('should allow small floating point variance', () => {
      const nearlyValid = {
        firmBrain: 0.25,
        strategy: 0.20,
        coverage: 0.25,
        proof: 0.15,
        persona: 0.1500001, // Very close to sum of 1.0
      };
      expect(validateWeights(nearlyValid)).toBe(true);
    });
  });

  describe('validateThresholds', () => {
    it('should return true for valid thresholds', () => {
      expect(validateThresholds(DEFAULT_THRESHOLDS)).toBe(true);
    });

    it('should return false if go <= conditionalMin', () => {
      expect(validateThresholds({ go: 45, conditionalMin: 45 })).toBe(false);
      expect(validateThresholds({ go: 40, conditionalMin: 50 })).toBe(false);
    });

    it('should return false for out-of-range values', () => {
      expect(validateThresholds({ go: 110, conditionalMin: 45 })).toBe(false);
      expect(validateThresholds({ go: 70, conditionalMin: -5 })).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should return valid for default config', () => {
      const result = validateConfig(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid config', () => {
      const invalidConfig: BidReadinessConfig = {
        ...DEFAULT_CONFIG,
        weights: { ...DEFAULT_WEIGHTS, firmBrain: 0.5 }, // Invalid weights
        thresholds: { go: 40, conditionalMin: 50 }, // Invalid thresholds
      };
      const result = validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate penalty ranges', () => {
      const invalidPenalties: BidReadinessConfig = {
        ...DEFAULT_CONFIG,
        penalties: {
          personaMismatchMultiplier: 1.5, // > 1
          criticalRiskPenalty: 60, // > 50
          proofGapPenalty: 15, // > 10
        },
      };
      const result = validateConfig(invalidPenalties);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });
});

// ============================================================================
// Config Diff Tests
// ============================================================================

describe('Config diffing', () => {
  describe('diffConfigs', () => {
    it('should return empty array for identical configs', () => {
      const changes = diffConfigs(DEFAULT_CONFIG, DEFAULT_CONFIG);
      expect(changes).toHaveLength(0);
    });

    it('should detect weight changes', () => {
      const newConfig = {
        ...DEFAULT_CONFIG,
        weights: { ...DEFAULT_WEIGHTS, firmBrain: 0.30 },
      };
      const changes = diffConfigs(DEFAULT_CONFIG, newConfig);
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('weights.firmBrain');
      expect(changes[0].from).toBe(0.25);
      expect(changes[0].to).toBe(0.30);
    });

    it('should detect threshold changes', () => {
      const newConfig = {
        ...DEFAULT_CONFIG,
        thresholds: { go: 75, conditionalMin: 50 },
      };
      const changes = diffConfigs(DEFAULT_CONFIG, newConfig);
      expect(changes).toHaveLength(2);
    });

    it('should detect penalty changes', () => {
      const newConfig = {
        ...DEFAULT_CONFIG,
        penalties: { ...DEFAULT_PENALTIES, criticalRiskPenalty: 15 },
      };
      const changes = diffConfigs(DEFAULT_CONFIG, newConfig);
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('penalties.criticalRiskPenalty');
    });
  });

  describe('applyChanges', () => {
    it('should apply changes to create new config', () => {
      const changes: ConfigChange[] = [
        { path: 'thresholds.go', from: 70, to: 75, description: 'Test' },
        { path: 'penalties.criticalRiskPenalty', from: 10, to: 15, description: 'Test' },
      ];
      const newConfig = applyChanges(DEFAULT_CONFIG, changes);
      expect(newConfig.thresholds.go).toBe(75);
      expect(newConfig.penalties.criticalRiskPenalty).toBe(15);
      // Original should be unchanged
      expect(DEFAULT_CONFIG.thresholds.go).toBe(70);
    });
  });

  describe('generateConfigPatch', () => {
    it('should generate JSON patch from changes', () => {
      const changes: ConfigChange[] = [
        { path: 'thresholds.go', from: 70, to: 75, description: 'Test' },
      ];
      const patch = generateConfigPatch(changes);
      expect(patch['thresholds.go']).toBe(75);
    });
  });
});

// ============================================================================
// Suggestion Engine Tests
// ============================================================================

describe('suggestReadinessTuning', () => {
  // Helper to create minimal analysis result
  function createAnalysisResult(overrides: Partial<OutcomeAnalysisResult> = {}): OutcomeAnalysisResult {
    return {
      totalAnalyzed: 10,
      completeRecords: 10,
      overallWinRate: 50,
      insights: [],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
      ...overrides,
    };
  }

  describe('sample size requirements', () => {
    it('should produce no suggestions when sample size too low', () => {
      const analysis = createAnalysisResult({
        completeRecords: 2,
        isStatisticallyMeaningful: false,
      });
      const result = suggestReadinessTuning(analysis);
      expect(result.hasEnoughData).toBe(false);
      expect(result.suggestions).toHaveLength(0);
      expect(result.insufficientDataMessage).toBeDefined();
    });

    it('should produce no suggestions when not statistically meaningful', () => {
      const analysis = createAnalysisResult({
        completeRecords: 10,
        isStatisticallyMeaningful: false,
      });
      const result = suggestReadinessTuning(analysis);
      expect(result.hasEnoughData).toBe(false);
    });

    it('should proceed with suggestions when sample size is sufficient', () => {
      const analysis = createAnalysisResult({
        completeRecords: 10,
        isStatisticallyMeaningful: true,
      });
      const result = suggestReadinessTuning(analysis);
      expect(result.hasEnoughData).toBe(true);
    });
  });

  describe('critical risk penalty suggestions', () => {
    it('should suggest increasing critical risk penalty when correlation is strongly negative', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'submitted with critical risks',
            winRateDelta: -25,
            sampleSize: 15,
            confidence: 'medium',
            category: 'risk',
          },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Critical Risk'));
      expect(suggestion).toBeDefined();
      expect(suggestion?.category).toBe('penalty');
    });

    it('should not suggest critical risk changes when correlation is weak', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'submitted with critical risks',
            winRateDelta: -5, // Too weak
            sampleSize: 15,
            confidence: 'medium',
            category: 'risk',
          },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Critical Risk'));
      expect(suggestion).toBeUndefined();
    });

    it('should not suggest changes when confidence is low', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'submitted with critical risks',
            winRateDelta: -25,
            sampleSize: 3,
            confidence: 'low', // Low confidence
            category: 'risk',
          },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Critical Risk'));
      expect(suggestion).toBeUndefined();
    });
  });

  describe('conditional threshold suggestions', () => {
    it('should suggest narrowing conditional band when it behaves like no-go', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'recommendation = Conditional Go',
            winRateDelta: -20,
            sampleSize: 12,
            confidence: 'medium',
            category: 'recommendation',
          },
          {
            signal: 'recommendation = No-Go',
            winRateDelta: -22,
            sampleSize: 8,
            confidence: 'medium',
            category: 'recommendation',
          },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Conditional'));
      expect(suggestion).toBeDefined();
    });
  });

  describe('acknowledged risk suggestions', () => {
    it('should suggest increasing penalty when acknowledged risks correlate with losses', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'submitted with acknowledged risks',
            winRateDelta: -18,
            sampleSize: 20,
            confidence: 'high',
            category: 'acknowledgement',
          },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Acknowledged'));
      expect(suggestion).toBeDefined();
      expect(suggestion?.category).toBe('penalty');
    });
  });

  describe('proof gap suggestions', () => {
    it('should suggest increasing proof penalty when experience is common loss reason', () => {
      const analysis = createAnalysisResult({
        lossReasons: [
          { reason: 'experience', count: 5, percentage: 30, avgReadinessScore: 55 },
          { reason: 'fit', count: 3, percentage: 18, avgReadinessScore: 50 },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Proof'));
      expect(suggestion).toBeDefined();
    });

    it('should not suggest proof changes when experience is not a common loss reason', () => {
      const analysis = createAnalysisResult({
        lossReasons: [
          { reason: 'price', count: 8, percentage: 50, avgReadinessScore: 65 },
          { reason: 'timing', count: 4, percentage: 25, avgReadinessScore: 60 },
        ],
      });
      const result = suggestReadinessTuning(analysis);
      const suggestion = result.suggestions.find(s => s.title.includes('Proof'));
      expect(suggestion).toBeUndefined();
    });
  });

  describe('suggestion determinism', () => {
    it('should produce identical suggestions for identical inputs', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'submitted with critical risks',
            winRateDelta: -20,
            sampleSize: 15,
            confidence: 'medium',
            category: 'risk',
          },
        ],
      });

      const result1 = suggestReadinessTuning(analysis);
      const result2 = suggestReadinessTuning(analysis);

      expect(result1.suggestions.length).toBe(result2.suggestions.length);
      expect(result1.suggestions.map(s => s.title)).toEqual(
        result2.suggestions.map(s => s.title)
      );
    });

    it('should sort suggestions by confidence then impact', () => {
      const analysis = createAnalysisResult({
        insights: [
          {
            signal: 'submitted with acknowledged risks',
            winRateDelta: -15,
            sampleSize: 8,
            confidence: 'medium',
            category: 'acknowledgement',
          },
          {
            signal: 'submitted with critical risks',
            winRateDelta: -25,
            sampleSize: 25,
            confidence: 'high',
            category: 'risk',
          },
        ],
      });
      const result = suggestReadinessTuning(analysis);

      if (result.suggestions.length >= 2) {
        // High confidence should come first
        const confidenceOrder = result.suggestions.map(s => s.confidence);
        expect(confidenceOrder[0]).toBe('high');
      }
    });
  });
});

// ============================================================================
// Suggestion Application Tests
// ============================================================================

describe('applySuggestion', () => {
  it('should apply suggestion changes to config', () => {
    const suggestion = {
      id: 'test-1',
      title: 'Test Suggestion',
      description: 'Test',
      changes: [
        { path: 'thresholds.go', from: 70, to: 75, description: 'Test' },
      ],
      expectedImpact: 'significant' as const,
      risk: 'medium' as const,
      confidence: 'high' as const,
      rationale: [],
      category: 'threshold' as const,
    };

    const newConfig = applySuggestion(DEFAULT_CONFIG, suggestion);
    expect(newConfig.thresholds.go).toBe(75);
    expect(newConfig.version).not.toBe(DEFAULT_CONFIG.version);
  });
});

describe('generatePatchForClipboard', () => {
  it('should generate valid JSON for clipboard', () => {
    const suggestions = [
      {
        id: 'test-1',
        title: 'Test',
        description: 'Test',
        changes: [
          { path: 'thresholds.go', from: 70, to: 75, description: 'Test' },
        ],
        expectedImpact: 'significant' as const,
        risk: 'medium' as const,
        confidence: 'high' as const,
        rationale: [],
        category: 'threshold' as const,
      },
    ];

    const patch = generatePatchForClipboard(suggestions);
    const parsed = JSON.parse(patch);
    expect(parsed['thresholds.go']).toBe(75);
  });
});

describe('getSuggestionsSummary', () => {
  it('should describe insufficient data', () => {
    const result: TuningSuggestionResult = {
      suggestions: [],
      currentConfig: DEFAULT_CONFIG,
      hasEnoughData: false,
      insufficientDataMessage: 'Need more data',
    };
    const summary = getSuggestionsSummary(result);
    expect(summary).toBe('Need more data');
  });

  it('should describe well-tuned config when no suggestions', () => {
    const result: TuningSuggestionResult = {
      suggestions: [],
      currentConfig: DEFAULT_CONFIG,
      hasEnoughData: true,
    };
    const summary = getSuggestionsSummary(result);
    expect(summary).toContain('well-tuned');
  });

  it('should count suggestions with confidence', () => {
    const result: TuningSuggestionResult = {
      suggestions: [
        {
          id: '1',
          title: 'Test',
          description: 'Test',
          changes: [],
          expectedImpact: 'moderate',
          risk: 'low',
          confidence: 'high',
          rationale: [],
          category: 'penalty',
        },
        {
          id: '2',
          title: 'Test2',
          description: 'Test2',
          changes: [],
          expectedImpact: 'minor',
          risk: 'low',
          confidence: 'medium',
          rationale: [],
          category: 'penalty',
        },
      ],
      currentConfig: DEFAULT_CONFIG,
      hasEnoughData: true,
    };
    const summary = getSuggestionsSummary(result);
    expect(summary).toContain('2');
    expect(summary).toContain('high confidence');
  });
});
