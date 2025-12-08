// tests/gap/atlasIntegration.test.ts
// Integration test using real Atlas Skateboarding HTML fixture

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectSocialAndGbp,
  computeSocialLocalPresenceScore,
} from '@/lib/gap/socialDetection';

describe('Atlas Skateboarding Integration Test', () => {
  // Load the real HTML fixture
  const fixtureDir = path.join(__dirname, '../fixtures');
  let atlasHtml: string;

  try {
    atlasHtml = fs.readFileSync(path.join(fixtureDir, 'atlas-skateboarding.html'), 'utf-8');
  } catch (e) {
    console.warn('Atlas fixture not found, skipping integration tests');
    atlasHtml = '';
  }

  // Skip tests if fixture doesn't exist
  const describeIfFixture = atlasHtml.length > 0 ? describe : describe.skip;

  describeIfFixture('Real Atlas Skateboarding detection', () => {
    it('should detect Instagram from Atlas footer', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [], // Parse schemas from HTML in production
      });

      const instagram = result.socials.find(s => s.network === 'instagram');

      expect(instagram).toBeDefined();
      // Footer link gives 0.85 confidence, which should be "present"
      expect(['present', 'probable']).toContain(instagram!.status);
      expect(instagram!.confidence).toBeGreaterThanOrEqual(0.5);
      expect(instagram!.url).toContain('instagram.com');
    });

    it('should detect GBP/Maps from Atlas footer', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      expect(result.gbp).toBeDefined();
      // Footer link gives 0.80 confidence, which should be "present"
      expect(['present', 'probable']).toContain(result.gbp!.status);
      expect(result.gbp!.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.gbp!.url).toContain('maps.google.com');
    });

    it('should detect YouTube from Atlas footer', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      const youtube = result.socials.find(s => s.network === 'youtube');

      expect(youtube).toBeDefined();
      expect(youtube!.status).not.toBe('missing');
      expect(youtube!.url).toContain('youtube.com');
    });

    it('should produce a high socialLocalPresence score for Atlas', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      const score = computeSocialLocalPresenceScore(result);

      // Atlas has Instagram, YouTube, and GBP, should score well
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it('should have high data confidence', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      expect(result.dataConfidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should correctly populate the socialFootprint structure', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      // Verify structure matches expected interface
      expect(result).toHaveProperty('socials');
      expect(result).toHaveProperty('gbp');
      expect(result).toHaveProperty('dataConfidence');

      // Verify socials array has all 6 networks
      expect(result.socials).toHaveLength(6);

      // Verify each social has required properties
      for (const social of result.socials) {
        expect(social).toHaveProperty('network');
        expect(social).toHaveProperty('confidence');
        expect(social).toHaveProperty('status');
        expect(social).toHaveProperty('detectionSources');
      }

      // Verify GBP has required properties
      if (result.gbp) {
        expect(result.gbp).toHaveProperty('confidence');
        expect(result.gbp).toHaveProperty('status');
        expect(result.gbp).toHaveProperty('detectionSources');
      }
    });
  });

  describeIfFixture('Atlas detection should prevent hallucination', () => {
    it('GAP IA should NOT recommend setting up GBP for Atlas', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      // If GBP is present or probable, GAP IA should not recommend setting one up
      expect(result.gbp).toBeDefined();
      expect(['present', 'probable']).toContain(result.gbp!.status);

      // This is the critical assertion: GBP was detected
      // The prompt rules say "NEVER recommend setting up GBP if status is present/probable"
    });

    it('GAP IA should NOT recommend starting Instagram for Atlas', () => {
      const result = detectSocialAndGbp({
        html: atlasHtml,
        schemas: [],
      });

      const instagram = result.socials.find(s => s.network === 'instagram');

      // If Instagram is present or probable, GAP IA should not recommend starting one
      expect(instagram).toBeDefined();
      expect(['present', 'probable']).toContain(instagram!.status);

      // This is the critical assertion: Instagram was detected
      // The prompt rules say "NEVER recommend starting Instagram if status is present/probable"
    });
  });
});
