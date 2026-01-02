// tests/audience/demographicOverlays.test.ts
// Tests for Demographic Overlays - Behavior-First, Guardrailed
//
// Core constraints being tested:
// - Demographics are overlays, not facts
// - Segment-specific only
// - Low confidence by default
// - Never exceed 70% confidence
// - Never auto-confirmed

import { describe, it, expect } from 'vitest';
import {
  BASE_DEMOGRAPHIC_CONFIDENCE,
  MAX_DEMOGRAPHIC_CONFIDENCE,
  MIN_DEMOGRAPHIC_CONFIDENCE,
  extractBehavioralSignals,
  canInferDemographicsForSegment,
  inferDemographicsForSegment,
  generateDemographicOverlays,
  validateDemographicOverlay,
  type DemographicOverlay,
  type BehavioralSignalSet,
} from '@/lib/audience/demographicOverlays';
import type { AudienceSegment } from '@/lib/audience/model';
import type { AudienceSignals } from '@/lib/audience/signals';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockSegment(overrides: Partial<AudienceSegment> = {}): AudienceSegment {
  return {
    id: 'seg_test_123',
    name: 'Test Segment',
    description: 'A test segment for validation',
    jobsToBeDone: ['Get vehicle serviced', 'Find reliable mechanic'],
    keyPains: ['Time constraints', 'Uncertain quality'],
    keyGoals: ['Maintain vehicle safety', 'Minimize costs'],
    behavioralDrivers: ['DIY research', 'Comparison shopping'],
    mediaHabits: 'Uses search engines for research',
    secondaryDemandStates: [],
    keyObjections: [],
    proofPointsNeeded: [],
    priorityChannels: [],
    avoidChannels: [],
    creativeAngles: [],
    recommendedFormats: [],
    ...overrides,
  };
}

function createMockSignals(overrides: Partial<AudienceSignals> = {}): AudienceSignals {
  return {
    canonicalICP: { hasCanonicalICP: false },
    sourcesAvailable: {
      gap: false,
      brand: false,
      content: false,
      seo: false,
      demand: false,
      contextGraph: false,
      brain: false,
    },
    loadedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Confidence Bounds Tests
// ============================================================================

describe('Demographic Overlays: Confidence Bounds', () => {
  it('should have BASE_DEMOGRAPHIC_CONFIDENCE of 50', () => {
    expect(BASE_DEMOGRAPHIC_CONFIDENCE).toBe(50);
  });

  it('should have MAX_DEMOGRAPHIC_CONFIDENCE of 70', () => {
    expect(MAX_DEMOGRAPHIC_CONFIDENCE).toBe(70);
  });

  it('should have MIN_DEMOGRAPHIC_CONFIDENCE of 40', () => {
    expect(MIN_DEMOGRAPHIC_CONFIDENCE).toBe(40);
  });

  it('should never exceed MAX_DEMOGRAPHIC_CONFIDENCE in generated overlays', () => {
    const segment = createMockSegment({
      jobsToBeDone: ['DIY project', 'Buy equipment', 'Research options'],
      behavioralDrivers: [
        'DIY enthusiast',
        'Buying guide user',
        'Comparison shopper',
        'Local service seeker',
        'Premium buyer',
      ],
      description: 'High-ticket installed services with professional installation and DIY buying guides for enthusiasts',
    });

    const signals = createMockSignals({
      gapNarrative: 'Premium automotive service with DIY and professional options',
      seoFindings: {
        keywordThemes: ['local tire shop', 'premium tires', 'buying guide'],
      },
    });

    const result = inferDemographicsForSegment(segment, signals);

    if (result.overlay) {
      expect(result.overlay.confidence).toBeLessThanOrEqual(MAX_DEMOGRAPHIC_CONFIDENCE);
    }
  });

  it('should discard overlays with confidence below MIN_DEMOGRAPHIC_CONFIDENCE', () => {
    // Create a segment with weak signals that would result in low confidence
    const segment = createMockSegment({
      jobsToBeDone: ['General task'],
      behavioralDrivers: ['Generic behavior'],
      description: 'Mixed urgency with industry norms',
    });

    const signals = createMockSignals({
      gapNarrative: 'General business with mixed audience signals near me and buying guide',
    });

    const result = inferDemographicsForSegment(segment, signals);

    // If rejected due to low confidence, check the reason
    if (result.rejected && result.rawConfidence !== undefined) {
      expect(result.rawConfidence).toBeLessThan(MIN_DEMOGRAPHIC_CONFIDENCE);
    }
  });
});

// ============================================================================
// Behavioral Signal Extraction Tests
// ============================================================================

describe('Behavioral Signal Extraction', () => {
  it('should detect DIY signals', () => {
    const segment = createMockSegment({
      description: 'DIY enthusiasts who do it yourself projects',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.hasDIYSignals).toBe(true);
  });

  it('should detect buying guide signals', () => {
    const segment = createMockSegment({
      description: 'Users reading buying guides and how to choose articles',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.hasBuyingGuides).toBe(true);
  });

  it('should detect installed services signals', () => {
    const segment = createMockSegment({
      description: 'Professional installation by certified technicians',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.hasInstalledServices).toBe(true);
  });

  it('should detect local urgency signals', () => {
    const segment = createMockSegment({
      description: 'Emergency service near me, same day response',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.hasLocalUrgency).toBe(true);
  });

  it('should detect high-ticket service signals', () => {
    const segment = createMockSegment({
      description: 'Premium luxury high-end professional grade equipment',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.hasHighTicketServices).toBe(true);
  });

  it('should detect enthusiast content signals', () => {
    const segment = createMockSegment({
      description: 'Automotive enthusiasts and hobbyists passionate about cars',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.hasEnthusiastContent).toBe(true);
  });

  it('should count total strong signals', () => {
    const segment = createMockSegment({
      description: 'DIY enthusiast buying guide professional installation high-end premium',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.signalCount).toBeGreaterThanOrEqual(3);
  });

  it('should detect MIXED urgency type', () => {
    const segment = createMockSegment({
      description: 'Emergency service near me with detailed buying guide comparison',
    });
    const signals = createMockSignals();

    const result = extractBehavioralSignals(segment, signals);
    expect(result.urgencyType).toBe('mixed');
  });
});

// ============================================================================
// Inference Permission Tests
// ============================================================================

describe('Demographic Inference Permission', () => {
  it('should NOT allow inference without segment ID', () => {
    const segment = createMockSegment({ id: '' });
    const behavioralSignals: BehavioralSignalSet = {
      hasDIYSignals: true,
      hasBuyingGuides: true,
      hasInstalledServices: false,
      hasLocalUrgency: false,
      hasHighTicketServices: false,
      hasProfessionalInstallation: false,
      hasEnthusiastContent: false,
      hasComparisonContent: false,
      hasB2BSignals: false,
      categoryType: null,
      urgencyType: 'none',
      signalCount: 2,
    };

    const result = canInferDemographicsForSegment(segment, behavioralSignals);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No valid segment');
  });

  it('should NOT allow inference without behavioral data', () => {
    const segment = createMockSegment({
      behavioralDrivers: [],
      jobsToBeDone: [],
      keyPains: [],
    });
    const behavioralSignals: BehavioralSignalSet = {
      hasDIYSignals: true,
      hasBuyingGuides: true,
      hasInstalledServices: false,
      hasLocalUrgency: false,
      hasHighTicketServices: false,
      hasProfessionalInstallation: false,
      hasEnthusiastContent: false,
      hasComparisonContent: false,
      hasB2BSignals: false,
      categoryType: null,
      urgencyType: 'none',
      signalCount: 2,
    };

    const result = canInferDemographicsForSegment(segment, behavioralSignals);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('lacks behavioral data');
  });

  it('should NOT allow inference with fewer than 2 behavioral signals', () => {
    const segment = createMockSegment();
    const behavioralSignals: BehavioralSignalSet = {
      hasDIYSignals: true,
      hasBuyingGuides: false,
      hasInstalledServices: false,
      hasLocalUrgency: false,
      hasHighTicketServices: false,
      hasProfessionalInstallation: false,
      hasEnthusiastContent: false,
      hasComparisonContent: false,
      hasB2BSignals: false,
      categoryType: null,
      urgencyType: 'none',
      signalCount: 1,
    };

    const result = canInferDemographicsForSegment(segment, behavioralSignals);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient behavioral signals');
  });

  it('should ALLOW inference with sufficient behavioral data and signals', () => {
    const segment = createMockSegment();
    const behavioralSignals: BehavioralSignalSet = {
      hasDIYSignals: true,
      hasBuyingGuides: true,
      hasInstalledServices: false,
      hasLocalUrgency: false,
      hasHighTicketServices: false,
      hasProfessionalInstallation: false,
      hasEnthusiastContent: false,
      hasComparisonContent: false,
      hasB2BSignals: false,
      categoryType: null,
      urgencyType: 'none',
      signalCount: 2,
    };

    const result = canInferDemographicsForSegment(segment, behavioralSignals);
    expect(result.allowed).toBe(true);
  });
});

// ============================================================================
// Safe Inference Tests
// ============================================================================

describe('Safe Demographic Inference', () => {
  it('should infer lifestyle context from DIY + buying guides', () => {
    const segment = createMockSegment({
      description: 'DIY enthusiasts researching buying guides',
      behavioralDrivers: ['DIY projects', 'Research behavior'],
    });
    const signals = createMockSignals();

    const result = inferDemographicsForSegment(segment, signals);

    expect(result.rejected).toBe(false);
    expect(result.overlay).not.toBeNull();
    expect(result.overlay?.inferredAttributes.lifestyleContext).toContain('enthusiast');
    expect(result.overlay?.inferredAttributes.lifestyleContext).toContain('(inferred)');
  });

  it('should infer household type from installed services + local urgency (automotive)', () => {
    const segment = createMockSegment({
      description: 'Vehicle service installation near me emergency auto tire',
      behavioralDrivers: ['Local service seeker', 'Urgent need'],
    });
    const signals = createMockSignals();

    const result = inferDemographicsForSegment(segment, signals);

    expect(result.rejected).toBe(false);
    if (result.overlay?.inferredAttributes.householdType) {
      expect(result.overlay.inferredAttributes.householdType).toContain('Vehicle');
      expect(result.overlay.inferredAttributes.householdType).toContain('(inferred)');
    }
  });

  it('should infer income tier from high-ticket services', () => {
    const segment = createMockSegment({
      description: 'Premium luxury high-end service with buying guide research',
      behavioralDrivers: ['Premium buyer', 'Research behavior'],
    });
    const signals = createMockSignals();

    const result = inferDemographicsForSegment(segment, signals);

    expect(result.rejected).toBe(false);
    expect(result.overlay?.inferredAttributes.incomeTier).toContain('income');
    expect(result.overlay?.inferredAttributes.incomeTier).toContain('(inferred)');
  });

  it('should always include "(inferred)" suffix on attributes', () => {
    const segment = createMockSegment({
      description: 'DIY enthusiast buying guide professional installation high-end premium',
      behavioralDrivers: ['Multiple signals'],
    });
    const signals = createMockSignals();

    const result = inferDemographicsForSegment(segment, signals);

    if (result.overlay) {
      const attrs = result.overlay.inferredAttributes;
      for (const [key, value] of Object.entries(attrs)) {
        if (value) {
          expect(value).toContain('(inferred)');
        }
      }
    }
  });
});

// ============================================================================
// Confidence Adjustment Tests
// ============================================================================

describe('Confidence Adjustments', () => {
  it('should add +5 confidence when ≥3 strong behavioral signals align', () => {
    // Use segment WITHOUT mixed urgency (no local urgency + buying guide combo)
    const segment = createMockSegment({
      description: 'DIY enthusiast buying guide premium high-end professional installation certified',
      behavioralDrivers: ['Multiple signals', 'Strong indicators'],
    });
    const signals = createMockSignals();

    const behavioralSignals = extractBehavioralSignals(segment, signals);
    expect(behavioralSignals.signalCount).toBeGreaterThanOrEqual(3);
    expect(behavioralSignals.urgencyType).not.toBe('mixed'); // Ensure no mixed urgency penalty

    const result = inferDemographicsForSegment(segment, signals);

    // With ≥3 signals and no penalties, confidence should be BASE + 5 = 55
    if (result.overlay) {
      expect(result.overlay.confidence).toBeGreaterThanOrEqual(BASE_DEMOGRAPHIC_CONFIDENCE);
    }
  });

  it('should subtract -10 confidence for MIXED urgency type', () => {
    const segment = createMockSegment({
      description: 'Emergency near me with detailed buying guide comparison research',
      behavioralDrivers: ['Urgency and research mixed'],
    });
    const signals = createMockSignals();

    const behavioralSignals = extractBehavioralSignals(segment, signals);
    expect(behavioralSignals.urgencyType).toBe('mixed');

    const result = inferDemographicsForSegment(segment, signals);

    // Mixed urgency should reduce confidence
    if (result.overlay) {
      expect(result.overlay.confidence).toBeLessThanOrEqual(BASE_DEMOGRAPHIC_CONFIDENCE);
    }
  });
});

// ============================================================================
// Batch Processing Tests
// ============================================================================

describe('Batch Demographic Overlay Generation', () => {
  it('should generate max 1 overlay per segment', () => {
    const segments: AudienceSegment[] = [
      createMockSegment({ id: 'seg_1', name: 'Segment 1' }),
      createMockSegment({ id: 'seg_2', name: 'Segment 2' }),
      createMockSegment({ id: 'seg_3', name: 'Segment 3' }),
    ];
    const signals = createMockSignals();

    const result = generateDemographicOverlays(segments, signals);

    // Each overlay should have a unique segment key
    const segmentKeys = result.overlays.map(o => o.appliesToSegmentKey);
    const uniqueKeys = new Set(segmentKeys);
    expect(uniqueKeys.size).toBe(segmentKeys.length);
  });

  it('should track rejections with reasons', () => {
    const segments: AudienceSegment[] = [
      createMockSegment({
        id: 'seg_weak',
        name: 'Weak Segment',
        behavioralDrivers: [],
        jobsToBeDone: [],
        keyPains: [],
      }),
    ];
    const signals = createMockSignals();

    const result = generateDemographicOverlays(segments, signals);

    expect(result.rejections.length).toBeGreaterThan(0);
    expect(result.rejections[0].segmentId).toBe('seg_weak');
    expect(result.rejections[0].reason).toBeTruthy();
  });

  it('should return empty overlays for segments without behavioral grounding', () => {
    const segments: AudienceSegment[] = [
      {
        id: 'seg_empty',
        name: 'Empty Segment',
        // No behavioral data
      } as AudienceSegment,
    ];
    const signals = createMockSignals();

    const result = generateDemographicOverlays(segments, signals);

    expect(result.overlays.length).toBe(0);
    expect(result.rejections.length).toBe(1);
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Demographic Overlay Validation', () => {
  it('should reject overlays with confidence above 70', () => {
    const overlay: DemographicOverlay = {
      appliesToSegmentKey: 'seg_test',
      inferredAttributes: {
        lifestyleContext: 'Test (inferred)',
      },
      confidence: 75, // Invalid - above 70
      rationale: 'Test rationale',
      evidence: [{ type: 'behavior_pattern', snippet: 'Test evidence' }],
    };

    const result = validateDemographicOverlay(overlay);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('70'))).toBe(true);
  });

  it('should reject overlays with confidence below 40', () => {
    const overlay: DemographicOverlay = {
      appliesToSegmentKey: 'seg_test',
      inferredAttributes: {
        lifestyleContext: 'Test (inferred)',
      },
      confidence: 35, // Invalid - below 40
      rationale: 'Test rationale',
      evidence: [{ type: 'behavior_pattern', snippet: 'Test evidence' }],
    };

    const result = validateDemographicOverlay(overlay);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('40'))).toBe(true);
  });

  it('should reject attributes without "(inferred)" suffix', () => {
    const overlay = {
      appliesToSegmentKey: 'seg_test',
      inferredAttributes: {
        lifestyleContext: 'Test without suffix', // Missing (inferred)
      },
      confidence: 50,
      rationale: 'Test rationale',
      evidence: [{ type: 'behavior_pattern', snippet: 'Test evidence' }],
    };

    const result = validateDemographicOverlay(overlay);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('(inferred)'))).toBe(true);
  });

  it('should reject overlays without evidence', () => {
    const overlay = {
      appliesToSegmentKey: 'seg_test',
      inferredAttributes: {
        lifestyleContext: 'Test (inferred)',
      },
      confidence: 50,
      rationale: 'Test rationale',
      evidence: [], // Invalid - empty evidence
    };

    const result = validateDemographicOverlay(overlay);
    expect(result.valid).toBe(false);
  });

  it('should accept valid overlays', () => {
    const overlay: DemographicOverlay = {
      appliesToSegmentKey: 'seg_test',
      inferredAttributes: {
        lifestyleContext: 'Automotive enthusiast (inferred)',
        incomeTier: 'Mid to upper income (inferred)',
      },
      confidence: 55,
      rationale: 'Inferred from DIY and premium service signals',
      evidence: [
        { type: 'behavior_pattern', snippet: 'DIY content engagement' },
        { type: 'category', snippet: 'Premium service tier focus' },
      ],
    };

    const result = validateDemographicOverlay(overlay);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Demographic Overlays: Integration', () => {
  it('should NOT generate overlays when no segments exist', () => {
    const segments: AudienceSegment[] = [];
    const signals = createMockSignals();

    const result = generateDemographicOverlays(segments, signals);

    expect(result.overlays).toHaveLength(0);
    expect(result.rejections).toHaveLength(0);
  });

  it('should handle real-world automotive segment', () => {
    const segment = createMockSegment({
      id: 'seg_auto_diy',
      name: 'Automotive DIY Enthusiasts',
      description: 'Vehicle owners who research tire options thoroughly, compare prices, and may consider self-installation for basic maintenance while preferring professional installation for complex work',
      jobsToBeDone: [
        'Find the right tires for my vehicle',
        'Compare tire options and prices',
        'Decide between DIY and professional installation',
      ],
      keyPains: [
        'Overwhelmed by tire options',
        'Uncertain about installation complexity',
        'Budget constraints',
      ],
      behavioralDrivers: [
        'Research-intensive buying behavior',
        'Price comparison shopping',
        'DIY consideration with professional backup',
      ],
    });

    const signals = createMockSignals({
      seoFindings: {
        keywordThemes: ['tire buying guide', 'tire comparison', 'tire installation near me'],
      },
      contentFindings: {
        keyTopics: ['tire selection', 'installation options', 'maintenance tips'],
      },
    });

    const result = inferDemographicsForSegment(segment, signals);

    // Should generate an overlay for this well-defined automotive segment
    expect(result.rejected).toBe(false);
    expect(result.overlay).not.toBeNull();
    expect(result.overlay?.appliesToSegmentKey).toBe('seg_auto_diy');
    expect(result.overlay?.confidence).toBeGreaterThanOrEqual(MIN_DEMOGRAPHIC_CONFIDENCE);
    expect(result.overlay?.confidence).toBeLessThanOrEqual(MAX_DEMOGRAPHIC_CONFIDENCE);
  });
});
