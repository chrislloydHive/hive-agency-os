// tests/gap/socialWorkItems.test.ts
// Tests for Social & Local Work Item generation

import { describe, it, expect } from 'vitest';
import {
  createSocialLocalWorkItemsFromSnapshot,
  suggestionToCreateInput,
  type SocialWorkItemSuggestion,
} from '@/lib/gap/socialWorkItems';
import type { SocialFootprintSnapshot } from '@/lib/gap/socialDetection';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock snapshot with specified overrides
 */
function createMockSnapshot(
  overrides: Partial<SocialFootprintSnapshot> = {}
): SocialFootprintSnapshot {
  return {
    socials: [
      { network: 'instagram', status: 'missing', confidence: 0, detectionSources: [] },
      { network: 'facebook', status: 'missing', confidence: 0, detectionSources: [] },
      { network: 'tiktok', status: 'missing', confidence: 0, detectionSources: [] },
      { network: 'x', status: 'missing', confidence: 0, detectionSources: [] },
      { network: 'linkedin', status: 'missing', confidence: 0, detectionSources: [] },
      { network: 'youtube', status: 'missing', confidence: 0, detectionSources: [] },
    ],
    gbp: { status: 'missing', confidence: 0, detectionSources: [] },
    dataConfidence: 0.8,
    ...overrides,
  };
}

// ============================================================================
// GBP Work Item Tests
// ============================================================================

describe('GBP Work Items', () => {
  describe('GBP Setup Recommendations', () => {
    it('should recommend GBP setup when missing with high confidence', () => {
      const snapshot = createMockSnapshot({
        gbp: { status: 'missing', confidence: 0, detectionSources: [] },
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const gbpItem = result.suggestions.find(s => s.triggerType === 'gbp_setup');
      expect(gbpItem).toBeDefined();
      expect(gbpItem!.title).toContain('Set up Google Business Profile');
      expect(gbpItem!.recommendationConfidence).toBe('high');
    });

    it('should give GBP P1 priority for local businesses', () => {
      const snapshot = createMockSnapshot({
        gbp: { status: 'missing', confidence: 0, detectionSources: [] },
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot, {
        businessType: 'local_business',
      });

      const gbpItem = result.suggestions.find(s => s.triggerType === 'gbp_setup');
      expect(gbpItem).toBeDefined();
      expect(gbpItem!.priority).toBe('P1');
    });

    it('should use conditional language when data confidence is medium', () => {
      const snapshot = createMockSnapshot({
        gbp: { status: 'missing', confidence: 0, detectionSources: [] },
        dataConfidence: 0.55,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const gbpItem = result.suggestions.find(s => s.triggerType === 'gbp_setup');
      expect(gbpItem).toBeDefined();
      expect(gbpItem!.recommendationConfidence).toBe('conditional');
      expect(gbpItem!.title).toContain('Verify');
    });

    it('should skip GBP setup when data confidence is too low', () => {
      const snapshot = createMockSnapshot({
        gbp: { status: 'missing', confidence: 0, detectionSources: [] },
        dataConfidence: 0.3,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const gbpItem = result.suggestions.find(s => s.triggerType === 'gbp_setup');
      expect(gbpItem).toBeUndefined();

      const skipReason = result.skipped.find(s => s.network === 'gbp');
      expect(skipReason).toBeDefined();
      expect(skipReason!.reason).toContain('confidence');
    });
  });

  describe('GBP Optimization Recommendations', () => {
    it('should recommend GBP optimization when present', () => {
      const snapshot = createMockSnapshot({
        gbp: {
          status: 'present',
          confidence: 0.85,
          detectionSources: ['html_link_footer'],
          url: 'https://maps.google.com/example',
        },
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const gbpItem = result.suggestions.find(s => s.triggerType === 'gbp_optimize');
      expect(gbpItem).toBeDefined();
      expect(gbpItem!.title).toContain('Optimize');
      expect(gbpItem!.recommendationConfidence).toBe('high');
    });

    it('should recommend GBP optimization when probable', () => {
      const snapshot = createMockSnapshot({
        gbp: {
          status: 'probable',
          confidence: 0.65,
          detectionSources: ['html_link_body'],
        },
        dataConfidence: 0.7,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const gbpItem = result.suggestions.find(s => s.triggerType === 'gbp_optimize');
      expect(gbpItem).toBeDefined();
    });
  });

  describe('GBP Inconclusive Handling', () => {
    it('should skip GBP when status is inconclusive', () => {
      const snapshot = createMockSnapshot({
        gbp: {
          status: 'inconclusive',
          confidence: 0.35,
          detectionSources: ['html_link_body'],
        },
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const gbpItems = result.suggestions.filter(
        s => s.triggerType === 'gbp_setup' || s.triggerType === 'gbp_optimize'
      );
      expect(gbpItems).toHaveLength(0);

      const skipReason = result.skipped.find(s => s.network === 'gbp');
      expect(skipReason).toBeDefined();
      expect(skipReason!.reason).toContain('inconclusive');
    });
  });
});

// ============================================================================
// Social Network Work Item Tests
// ============================================================================

describe('Social Network Work Items', () => {
  describe('Social Start Recommendations', () => {
    it('should recommend starting Instagram when missing with high confidence', () => {
      const snapshot = createMockSnapshot({
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const igItem = result.suggestions.find(
        s => s.triggerType === 'social_start' && s.network === 'instagram'
      );
      expect(igItem).toBeDefined();
      expect(igItem!.title).toContain('Instagram');
      expect(igItem!.priority).toBe('P2');
    });

    it('should recommend starting priority networks (IG, FB, LI)', () => {
      const snapshot = createMockSnapshot({
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const startItems = result.suggestions.filter(s => s.triggerType === 'social_start');
      const networks = startItems.map(s => s.network);

      expect(networks).toContain('instagram');
      expect(networks).toContain('facebook');
      expect(networks).toContain('linkedin');
    });

    it('should NOT recommend starting non-priority networks by default', () => {
      const snapshot = createMockSnapshot({
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const startItems = result.suggestions.filter(s => s.triggerType === 'social_start');
      const networks = startItems.map(s => s.network);

      expect(networks).not.toContain('tiktok');
      expect(networks).not.toContain('x');
      expect(networks).not.toContain('youtube');
    });

    it('should recommend all networks when includeAllNetworks is true', () => {
      const snapshot = createMockSnapshot({
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot, {
        includeAllNetworks: true,
      });

      // Should have more suggestions than default
      expect(result.suggestions.length).toBeGreaterThan(3);
    });
  });

  describe('Social Improvement Recommendations', () => {
    it('should recommend improving Instagram when present', () => {
      const snapshot = createMockSnapshot({
        socials: [
          {
            network: 'instagram',
            status: 'present',
            confidence: 0.85,
            detectionSources: ['html_link_footer'],
            handle: 'testbrand',
            url: 'https://instagram.com/testbrand',
          },
          { network: 'facebook', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'tiktok', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'x', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'linkedin', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'youtube', status: 'missing', confidence: 0, detectionSources: [] },
        ],
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const igItem = result.suggestions.find(
        s => s.triggerType === 'social_improve' && s.network === 'instagram'
      );
      expect(igItem).toBeDefined();
      expect(igItem!.title).toContain('Strengthen');
      expect(igItem!.title).toContain('Instagram');
    });

    it('should include handle in improvement description when available', () => {
      const snapshot = createMockSnapshot({
        socials: [
          {
            network: 'instagram',
            status: 'present',
            confidence: 0.85,
            detectionSources: ['html_link_footer'],
            handle: 'atlasskateboarding',
            url: 'https://instagram.com/atlasskateboarding',
          },
          { network: 'facebook', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'tiktok', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'x', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'linkedin', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'youtube', status: 'missing', confidence: 0, detectionSources: [] },
        ],
        dataConfidence: 0.8,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const igItem = result.suggestions.find(
        s => s.triggerType === 'social_improve' && s.network === 'instagram'
      );
      expect(igItem).toBeDefined();
      expect(igItem!.description).toContain('@atlasskateboarding');
    });
  });

  describe('Social Expansion Recommendations', () => {
    it('should recommend expansion when few socials are active', () => {
      const snapshot = createMockSnapshot({
        socials: [
          {
            network: 'instagram',
            status: 'present',
            confidence: 0.85,
            detectionSources: ['html_link_footer'],
          },
          { network: 'facebook', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'tiktok', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'x', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'linkedin', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'youtube', status: 'missing', confidence: 0, detectionSources: [] },
        ],
        dataConfidence: 0.7,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const expandItem = result.suggestions.find(s => s.triggerType === 'social_expand');
      expect(expandItem).toBeDefined();
      expect(expandItem!.title).toContain('Expand');
    });

    it('should NOT recommend expansion when 3+ socials are active', () => {
      const snapshot = createMockSnapshot({
        socials: [
          {
            network: 'instagram',
            status: 'present',
            confidence: 0.85,
            detectionSources: ['html_link_footer'],
          },
          {
            network: 'facebook',
            status: 'present',
            confidence: 0.8,
            detectionSources: ['html_link_footer'],
          },
          {
            network: 'linkedin',
            status: 'present',
            confidence: 0.75,
            detectionSources: ['html_link_footer'],
          },
          { network: 'tiktok', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'x', status: 'missing', confidence: 0, detectionSources: [] },
          { network: 'youtube', status: 'missing', confidence: 0, detectionSources: [] },
        ],
        dataConfidence: 0.7,
      });

      const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

      const expandItem = result.suggestions.find(s => s.triggerType === 'social_expand');
      expect(expandItem).toBeUndefined();
    });
  });
});

// ============================================================================
// Priority and Sorting Tests
// ============================================================================

describe('Priority and Sorting', () => {
  it('should sort suggestions by priority (P1 first)', () => {
    const snapshot = createMockSnapshot({
      gbp: { status: 'missing', confidence: 0, detectionSources: [] },
      dataConfidence: 0.8,
    });

    const result = createSocialLocalWorkItemsFromSnapshot(snapshot, {
      businessType: 'local_business',
    });

    // GBP should be first (P1 for local business)
    expect(result.suggestions[0].priority).toBe('P1');
  });

  it('should have P2 priority for social start items', () => {
    const snapshot = createMockSnapshot({
      gbp: { status: 'present', confidence: 0.8, detectionSources: ['html_link_footer'] },
      dataConfidence: 0.8,
    });

    const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

    const startItems = result.suggestions.filter(s => s.triggerType === 'social_start');
    for (const item of startItems) {
      expect(item.priority).toBe('P2');
    }
  });
});

// ============================================================================
// Anti-Hallucination Tests
// ============================================================================

describe('Anti-Hallucination Safety', () => {
  it('should NEVER recommend setup when profile is present', () => {
    const snapshot = createMockSnapshot({
      gbp: {
        status: 'present',
        confidence: 0.9,
        detectionSources: ['html_link_footer', 'schema_gbp'],
      },
      socials: [
        {
          network: 'instagram',
          status: 'present',
          confidence: 0.85,
          detectionSources: ['html_link_footer'],
        },
        { network: 'facebook', status: 'missing', confidence: 0, detectionSources: [] },
        { network: 'tiktok', status: 'missing', confidence: 0, detectionSources: [] },
        { network: 'x', status: 'missing', confidence: 0, detectionSources: [] },
        { network: 'linkedin', status: 'missing', confidence: 0, detectionSources: [] },
        { network: 'youtube', status: 'missing', confidence: 0, detectionSources: [] },
      ],
      dataConfidence: 0.9,
    });

    const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

    // Should NOT have any setup items for GBP or Instagram
    const gbpSetup = result.suggestions.find(s => s.triggerType === 'gbp_setup');
    expect(gbpSetup).toBeUndefined();

    const igStart = result.suggestions.find(
      s => s.triggerType === 'social_start' && s.network === 'instagram'
    );
    expect(igStart).toBeUndefined();

    // Should have optimize items instead
    const gbpOptimize = result.suggestions.find(s => s.triggerType === 'gbp_optimize');
    expect(gbpOptimize).toBeDefined();

    const igImprove = result.suggestions.find(
      s => s.triggerType === 'social_improve' && s.network === 'instagram'
    );
    expect(igImprove).toBeDefined();
  });

  it('should use conditional language for low confidence detections', () => {
    const snapshot = createMockSnapshot({
      gbp: { status: 'missing', confidence: 0, detectionSources: [] },
      dataConfidence: 0.55,
    });

    const result = createSocialLocalWorkItemsFromSnapshot(snapshot);

    const gbpItem = result.suggestions.find(
      s => s.triggerType === 'gbp_setup' || s.triggerType === 'gbp_optimize'
    );

    // Should exist but with conditional confidence
    if (gbpItem) {
      expect(gbpItem.recommendationConfidence).toBe('conditional');
    }
  });
});

// ============================================================================
// Conversion to CreateWorkItemInput Tests
// ============================================================================

describe('suggestionToCreateInput', () => {
  it('should convert suggestion to CreateWorkItemInput format', () => {
    const suggestion: SocialWorkItemSuggestion = {
      title: 'Set up Google Business Profile',
      description: 'Detailed setup instructions...',
      area: 'Strategy',
      priority: 'P1',
      triggerType: 'gbp_setup',
      recommendationConfidence: 'high',
    };

    const input = suggestionToCreateInput(suggestion, 'recCOMPANY123');

    expect(input.companyId).toBe('recCOMPANY123');
    expect(input.title).toBe('Set up Google Business Profile');
    expect(input.description).toBe('Detailed setup instructions...');
    expect(input.area).toBe('Strategy');
    expect(input.priority).toBe('P1');
    expect(input.status).toBe('Backlog');
    expect(input.sourceType).toBe('gap_insight');
  });
});
