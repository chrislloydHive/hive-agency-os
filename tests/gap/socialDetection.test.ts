// tests/gap/socialDetection.test.ts
// Unit tests for social detection utilities

import { describe, it, expect } from 'vitest';
import {
  detectSocialAndGbp,
  computeSocialLocalPresenceScore,
  buildSocialFootprintSummary,
  _testing,
} from '@/lib/gap/socialDetection';

describe('socialDetection', () => {
  // ============================================================================
  // Case A: IG + GBP present (Atlas-like)
  // ============================================================================
  describe('Case A: IG + GBP present (Atlas-like)', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Atlas Skateboarding</title></head>
      <body>
        <header>
          <nav>
            <a href="/">Home</a>
          </nav>
        </header>
        <main>
          <h1>Welcome to Atlas Skateboarding</h1>
        </main>
        <footer>
          <a href="https://www.instagram.com/atlasskateboarding/">Instagram</a>
          <a href="https://www.youtube.com/@AtlasSkateboarding">YouTube</a>
          <a href="https://maps.google.com/?q=Atlas+Skateboard+Store">Find Us</a>
        </footer>
      </body>
      </html>
    `;

    const schemas = [
      {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Atlas Skateboarding',
        sameAs: [
          'https://www.instagram.com/atlasskateboarding/',
          'https://g.page/atlas-skate-shop',
        ],
      },
    ];

    it('should detect Instagram as present with high confidence', () => {
      const result = detectSocialAndGbp({ html, schemas });

      const instagram = result.socials.find(s => s.network === 'instagram');
      expect(instagram).toBeDefined();
      expect(instagram!.status).toBe('present');
      expect(instagram!.confidence).toBeGreaterThanOrEqual(0.8);
      expect(instagram!.handle).toBe('atlasskateboarding');
      expect(instagram!.detectionSources.length).toBeGreaterThan(0);
    });

    it('should detect GBP as present with high confidence', () => {
      const result = detectSocialAndGbp({ html, schemas });

      expect(result.gbp).toBeDefined();
      expect(result.gbp!.status).toBe('present');
      expect(result.gbp!.confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.gbp!.detectionSources.length).toBeGreaterThan(0);
    });

    it('should have high data confidence', () => {
      const result = detectSocialAndGbp({ html, schemas });
      expect(result.dataConfidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should produce a high socialLocalPresence score', () => {
      const result = detectSocialAndGbp({ html, schemas });
      const score = computeSocialLocalPresenceScore(result);
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should also detect YouTube', () => {
      const result = detectSocialAndGbp({ html, schemas });

      const youtube = result.socials.find(s => s.network === 'youtube');
      expect(youtube).toBeDefined();
      expect(youtube!.status).not.toBe('missing');
    });
  });

  // ============================================================================
  // Case B: IG only via schema
  // ============================================================================
  describe('Case B: IG only via schema', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <main><h1>Company</h1></main>
      </body>
      </html>
    `;

    const schemas = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Test Company',
        sameAs: ['https://www.instagram.com/testcompany/'],
      },
    ];

    it('should detect Instagram as inconclusive with schema-only confidence', () => {
      const result = detectSocialAndGbp({ html, schemas });

      const instagram = result.socials.find(s => s.network === 'instagram');
      expect(instagram).toBeDefined();
      // Schema-only gets +0.50 (updated weight), which is inconclusive (0.30-0.60 range)
      expect(instagram!.status).toBe('inconclusive');
      expect(instagram!.confidence).toBeGreaterThanOrEqual(0.3);
      expect(instagram!.confidence).toBeLessThan(0.8);
      expect(instagram!.detectionSources).toContain('schema_sameAs');
    });

    it('should have GBP as missing', () => {
      const result = detectSocialAndGbp({ html, schemas });

      expect(result.gbp).toBeDefined();
      expect(result.gbp!.status).toBe('missing');
    });

    it('should have moderate data confidence', () => {
      const result = detectSocialAndGbp({ html, schemas });
      expect(result.dataConfidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ============================================================================
  // Case C: GBP link only in contact area (body)
  // ============================================================================
  describe('Case C: GBP link only in body', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <div class="contact">
          <h2>Contact Us</h2>
          <a href="https://g.page/business-name">View on Google Maps</a>
        </div>
      </body>
      </html>
    `;

    const schemas: any[] = [];

    it('should detect GBP as probable from body link', () => {
      const result = detectSocialAndGbp({ html, schemas });

      expect(result.gbp).toBeDefined();
      // Body link gets +0.50 (updated weight), which is "probable" (0.50-0.75 range for GBP)
      expect(result.gbp!.status).toBe('probable');
      expect(result.gbp!.confidence).toBeGreaterThanOrEqual(0.50);
      expect(result.gbp!.confidence).toBeLessThan(0.75);
      expect(result.gbp!.detectionSources).toContain('html_link_body');
    });

    it('should have moderate data confidence', () => {
      const result = detectSocialAndGbp({ html, schemas });
      expect(result.dataConfidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ============================================================================
  // Case D: No socials / No GBP
  // ============================================================================
  describe('Case D: No socials / No GBP', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <header><nav><a href="/">Home</a></nav></header>
        <main><h1>Simple Company</h1><p>We sell products.</p></main>
        <footer><p>Copyright 2024</p></footer>
      </body>
      </html>
    `;

    const schemas: any[] = [];

    it('should mark all networks as missing', () => {
      const result = detectSocialAndGbp({ html, schemas });

      for (const social of result.socials) {
        expect(social.status).toBe('missing');
        expect(social.confidence).toBe(0);
        expect(social.detectionSources).toHaveLength(0);
      }
    });

    it('should mark GBP as missing', () => {
      const result = detectSocialAndGbp({ html, schemas });

      expect(result.gbp).toBeDefined();
      expect(result.gbp!.status).toBe('missing');
      expect(result.gbp!.confidence).toBe(0);
    });

    it('should have high data confidence (scan was complete)', () => {
      const result = detectSocialAndGbp({ html, schemas });
      // Even with nothing found, we had HTML to scan, so dataConfidence should be >= 0.7
      expect(result.dataConfidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should produce a low socialLocalPresence score', () => {
      const result = detectSocialAndGbp({ html, schemas });
      const score = computeSocialLocalPresenceScore(result);
      expect(score).toBeLessThan(20);
    });
  });

  // ============================================================================
  // Header/Footer detection context
  // ============================================================================
  describe('Header/Footer detection context', () => {
    it('should classify links in header correctly', () => {
      const html = `
        <html>
        <body>
          <header>
            <nav>
              <a href="https://instagram.com/test">IG</a>
            </nav>
          </header>
        </body>
        </html>
      `;

      const result = detectSocialAndGbp({ html, schemas: [] });
      const instagram = result.socials.find(s => s.network === 'instagram');

      expect(instagram).toBeDefined();
      expect(instagram!.detectionSources).toContain('html_link_header');
    });

    it('should classify links in footer correctly', () => {
      const html = `
        <html>
        <body>
          <footer>
            <a href="https://facebook.com/test">FB</a>
          </footer>
        </body>
        </html>
      `;

      const result = detectSocialAndGbp({ html, schemas: [] });
      const facebook = result.socials.find(s => s.network === 'facebook');

      expect(facebook).toBeDefined();
      expect(facebook!.detectionSources).toContain('html_link_footer');
    });

    it('should boost confidence for header/footer links', () => {
      const headerHtml = `
        <html>
        <body>
          <header>
            <a href="https://instagram.com/test">IG</a>
          </header>
        </body>
        </html>
      `;

      const bodyHtml = `
        <html>
        <body>
          <main>
            <a href="https://instagram.com/test">IG</a>
          </main>
        </body>
        </html>
      `;

      const headerResult = detectSocialAndGbp({ html: headerHtml, schemas: [] });
      const bodyResult = detectSocialAndGbp({ html: bodyHtml, schemas: [] });

      const headerIg = headerResult.socials.find(s => s.network === 'instagram');
      const bodyIg = bodyResult.socials.find(s => s.network === 'instagram');

      // Header link gets +0.85, body link gets +0.45
      expect(headerIg!.confidence).toBeGreaterThan(bodyIg!.confidence);
      expect(headerIg!.status).toBe('present'); // Header links should be present
      expect(bodyIg!.status).toBe('inconclusive'); // Body links are inconclusive
    });
  });

  // ============================================================================
  // URL pattern tests
  // ============================================================================
  describe('URL pattern matching', () => {
    it('should detect various Instagram URL formats', () => {
      const urls = [
        'https://www.instagram.com/testuser/',
        'https://instagram.com/testuser',
        'http://www.instagram.com/testuser/',
      ];

      for (const url of urls) {
        const html = `<a href="${url}">IG</a>`;
        const result = detectSocialAndGbp({ html, schemas: [] });
        const ig = result.socials.find(s => s.network === 'instagram');
        expect(ig?.status).not.toBe('missing');
      }
    });

    it('should detect various GBP URL formats', () => {
      const urls = [
        'https://g.page/business',
        'https://goo.gl/maps/abc123',
        'https://maps.app.goo.gl/abc123',
        'https://www.google.com/maps?cid=123456',
        'https://www.google.com/maps/place/Business+Name',
        'https://maps.google.com/?q=Business',
      ];

      for (const url of urls) {
        const html = `<a href="${url}">Map</a>`;
        const result = detectSocialAndGbp({ html, schemas: [] });
        expect(result.gbp?.status).not.toBe('missing');
      }
    });

    it('should detect X (Twitter) URL formats', () => {
      const urls = [
        'https://twitter.com/testuser',
        'https://x.com/testuser',
        'https://www.x.com/testuser/',
      ];

      for (const url of urls) {
        const html = `<a href="${url}">X</a>`;
        const result = detectSocialAndGbp({ html, schemas: [] });
        const x = result.socials.find(s => s.network === 'x');
        expect(x?.status).not.toBe('missing');
      }
    });
  });

  // ============================================================================
  // Schema.org detection tests
  // ============================================================================
  describe('Schema.org detection', () => {
    it('should detect socials from sameAs array', () => {
      const schemas = [
        {
          '@type': 'Organization',
          sameAs: [
            'https://www.linkedin.com/company/testco',
            'https://www.facebook.com/testco',
          ],
        },
      ];

      const result = detectSocialAndGbp({ html: '', schemas });

      const linkedin = result.socials.find(s => s.network === 'linkedin');
      const facebook = result.socials.find(s => s.network === 'facebook');

      expect(linkedin?.status).not.toBe('missing');
      expect(linkedin?.detectionSources).toContain('schema_sameAs');

      expect(facebook?.status).not.toBe('missing');
      expect(facebook?.detectionSources).toContain('schema_sameAs');
    });

    it('should detect GBP from LocalBusiness hasMap', () => {
      const schemas = [
        {
          '@type': 'LocalBusiness',
          name: 'Test Business',
          hasMap: 'https://g.page/test-business',
        },
      ];

      const result = detectSocialAndGbp({ html: '', schemas });

      expect(result.gbp?.status).not.toBe('missing');
      expect(result.gbp?.detectionSources).toContain('schema_gbp');
    });

    it('should handle @graph arrays', () => {
      const schemas = [
        {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: 'Test Site',
            },
            {
              '@type': 'Organization',
              sameAs: ['https://instagram.com/testorg'],
            },
          ],
        },
      ];

      const result = detectSocialAndGbp({ html: '', schemas });

      const instagram = result.socials.find(s => s.network === 'instagram');
      expect(instagram?.status).not.toBe('missing');
    });
  });

  // ============================================================================
  // Scoring tests
  // ============================================================================
  describe('socialLocalPresence scoring', () => {
    it('should score GBP at 40% weight', () => {
      const result = {
        socials: [],
        gbp: {
          status: 'present' as const,
          confidence: 1.0,
          detectionSources: ['html_link_footer' as const],
        },
        dataConfidence: 0.9,
      };

      const score = computeSocialLocalPresenceScore(result);
      expect(score).toBe(40); // 40 * 1.0 = 40
    });

    it('should cap social points at 4 networks', () => {
      const result = {
        socials: [
          { network: 'instagram' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
          { network: 'facebook' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
          { network: 'linkedin' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
          { network: 'youtube' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
          { network: 'tiktok' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
          { network: 'x' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
        ],
        gbp: null,
        dataConfidence: 0.9,
      };

      const score = computeSocialLocalPresenceScore(result);
      // Max 4 networks at 15 points each = 60
      expect(score).toBe(60);
    });

    it('should combine GBP and social scores', () => {
      const result = {
        socials: [
          { network: 'instagram' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
          { network: 'facebook' as const, status: 'present' as const, confidence: 1.0, detectionSources: [] },
        ],
        gbp: {
          status: 'present' as const,
          confidence: 1.0,
          detectionSources: [],
        },
        dataConfidence: 0.9,
      };

      const score = computeSocialLocalPresenceScore(result);
      // GBP: 40 * 1.0 = 40
      // Socials: 2 * 15 = 30
      // Total: 70
      expect(score).toBe(70);
    });
  });

  // ============================================================================
  // Summary building tests
  // ============================================================================
  describe('summary building', () => {
    it('should build a summary for detected profiles', () => {
      const result = {
        socials: [
          { network: 'instagram' as const, handle: 'testuser', status: 'present' as const, confidence: 0.9, detectionSources: [] },
        ],
        gbp: {
          status: 'present' as const,
          confidence: 0.85,
          detectionSources: [],
        },
        dataConfidence: 0.9,
      };

      const summary = buildSocialFootprintSummary(result);
      expect(summary).toContain('GBP');
      expect(summary).toContain('instagram');
      expect(summary).toContain('present');
    });

    it('should return appropriate message when nothing detected', () => {
      const result = {
        socials: [
          { network: 'instagram' as const, status: 'missing' as const, confidence: 0, detectionSources: [] },
        ],
        gbp: {
          status: 'missing' as const,
          confidence: 0,
          detectionSources: [],
        },
        dataConfidence: 0.8,
      };

      const summary = buildSocialFootprintSummary(result);
      expect(summary).toContain('No social');
    });
  });

  // ============================================================================
  // Utility function tests
  // ============================================================================
  describe('utility functions', () => {
    it('should correctly identify GBP URLs', () => {
      expect(_testing.isGbpUrl('https://g.page/test')).toBe(true);
      expect(_testing.isGbpUrl('https://maps.google.com/?q=test')).toBe(true);
      expect(_testing.isGbpUrl('https://instagram.com/test')).toBe(false);
      expect(_testing.isGbpUrl('')).toBe(false);
    });

    it('should normalize URLs correctly', () => {
      expect(_testing.normalizeUrl('https://INSTAGRAM.COM/test/')).toContain('instagram.com');
      // Should remove trailing slash from paths
      const normalized = _testing.normalizeUrl('https://instagram.com/test/');
      expect(normalized.endsWith('/')).toBe(false);
    });
  });
});
