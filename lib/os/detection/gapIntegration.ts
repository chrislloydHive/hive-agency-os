// lib/os/detection/gapIntegration.ts
// Bridge between new detection module and existing GAP system

import {
  detectAllSignals,
  summarizeDetection,
  assessDigitalPresence,
  type DetectionResult,
} from './index';
import type { GBPSignal, SocialSignal, SchemaSignal, DiscoveryResult } from './types';

/**
 * Detection result formatted for GAP compatibility
 */
export interface GapDetectionResult {
  /** Whether detection was successful */
  success: boolean;

  /** GBP detection result */
  gbp: {
    found: boolean;
    url: string | null;
    placeId: string | null;
    businessName: string | null;
    confidence: number;
  };

  /** Social profiles detection */
  socials: {
    facebook: { found: boolean; url: string | null; username: string | null; confidence: number };
    instagram: { found: boolean; url: string | null; username: string | null; confidence: number };
    linkedin: { found: boolean; url: string | null; username: string | null; confidence: number };
    youtube: { found: boolean; url: string | null; username: string | null; confidence: number };
    tiktok: { found: boolean; url: string | null; username: string | null; confidence: number };
    x: { found: boolean; url: string | null; username: string | null; confidence: number };
  };

  /** Schema.org data */
  schema: {
    hasLocalBusiness: boolean;
    hasOrganization: boolean;
    hasSameAs: boolean;
    sameAsUrls: string[];
  };

  /** Page discovery */
  discovery: {
    pagesDiscovered: number;
    missingPages: string[];
    hasAbout: boolean;
    hasContact: boolean;
    hasServices: boolean;
    hasBlog: boolean;
    confidence: number;
  };

  /** Overall confidence score (0-100) */
  globalConfidence: number;

  /** Presence assessment */
  presenceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  presenceScore: number;

  /** Summary for display */
  summary: {
    gbpFound: boolean;
    socialCount: number;
    schemaCount: number;
    pagesDiscovered: number;
    missingPages: number;
    confidence: 'high' | 'medium' | 'low' | 'very-low';
    issues: string[];
  };

  /** Raw detection result for advanced usage */
  raw: DetectionResult;
}

/**
 * Map SocialSignal array to structured socials object
 */
function mapSocialsToStructured(socials: SocialSignal[]): GapDetectionResult['socials'] {
  const findPlatform = (platform: string) =>
    socials.find(s => s.platform === platform);

  const mapPlatform = (platform: string) => {
    const signal = findPlatform(platform);
    return {
      found: !!signal?.url,
      url: signal?.url || null,
      username: signal?.username || null,
      confidence: signal?.confidence || 0,
    };
  };

  return {
    facebook: mapPlatform('facebook'),
    instagram: mapPlatform('instagram'),
    linkedin: mapPlatform('linkedin'),
    youtube: mapPlatform('youtube'),
    tiktok: mapPlatform('tiktok'),
    x: mapPlatform('x'),
  };
}

/**
 * Map SchemaSignal array to structured schema object
 */
function mapSchemaToStructured(schema: SchemaSignal[]): GapDetectionResult['schema'] {
  const hasLocalBusiness = schema.some(s =>
    s.type.toLowerCase().includes('localbusiness')
  );
  const hasOrganization = schema.some(s =>
    s.type.toLowerCase().includes('organization')
  );
  const sameAsUrls = schema.flatMap(s => s.sameAs);
  const hasSameAs = sameAsUrls.length > 0;

  return {
    hasLocalBusiness,
    hasOrganization,
    hasSameAs,
    sameAsUrls: [...new Set(sameAsUrls)],
  };
}

/**
 * Map DiscoveryResult to structured discovery object
 */
function mapDiscoveryToStructured(discovery: DiscoveryResult): GapDetectionResult['discovery'] {
  const missingPaths = discovery.missingPages.map(p => p.path);

  // Check for common pages
  const discoveredPaths = discovery.discoveredPages.map(p => {
    try {
      return new URL(p.url).pathname.toLowerCase();
    } catch {
      return '';
    }
  });

  const hasPage = (keywords: string[]) =>
    discoveredPaths.some(path =>
      keywords.some(k => path.includes(k))
    );

  return {
    pagesDiscovered: discovery.discoveredPages.length,
    missingPages: missingPaths,
    hasAbout: hasPage(['about', 'about-us', 'who-we-are']),
    hasContact: hasPage(['contact', 'contact-us', 'get-in-touch']),
    hasServices: hasPage(['services', 'what-we-do', 'solutions']),
    hasBlog: hasPage(['blog', 'news', 'articles', 'resources']),
    confidence: discovery.confidence,
  };
}

/**
 * Run detection and format for GAP system
 *
 * This function uses the new unified detection module and formats
 * the results to be compatible with existing GAP code.
 */
export async function runGapDetection(options: {
  domain: string;
  html?: string;
  businessName?: string;
  city?: string;
}): Promise<GapDetectionResult> {
  try {
    // Run the unified detection
    const result = await detectAllSignals({
      domain: options.domain,
      html: options.html,
      businessName: options.businessName,
      city: options.city,
      enableDeepCrawl: false, // Quick mode for GAP
    });

    // Get summary and assessment
    const summary = summarizeDetection(result);
    const assessment = assessDigitalPresence(result);

    // Format for GAP compatibility
    return {
      success: result.success,
      gbp: {
        found: result.gbp.found,
        url: result.gbp.url,
        placeId: result.gbp.placeId,
        businessName: result.gbp.businessName,
        confidence: result.gbp.confidence,
      },
      socials: mapSocialsToStructured(result.socials),
      schema: mapSchemaToStructured(result.schema),
      discovery: mapDiscoveryToStructured(result.discovery),
      globalConfidence: result.globalConfidence,
      presenceGrade: assessment.grade,
      presenceScore: assessment.score,
      summary,
      raw: result,
    };
  } catch (error) {
    console.error('[gapIntegration] Detection failed:', error);

    // Return empty result on failure
    return {
      success: false,
      gbp: { found: false, url: null, placeId: null, businessName: null, confidence: 0 },
      socials: {
        facebook: { found: false, url: null, username: null, confidence: 0 },
        instagram: { found: false, url: null, username: null, confidence: 0 },
        linkedin: { found: false, url: null, username: null, confidence: 0 },
        youtube: { found: false, url: null, username: null, confidence: 0 },
        tiktok: { found: false, url: null, username: null, confidence: 0 },
        x: { found: false, url: null, username: null, confidence: 0 },
      },
      schema: { hasLocalBusiness: false, hasOrganization: false, hasSameAs: false, sameAsUrls: [] },
      discovery: {
        pagesDiscovered: 0,
        missingPages: [],
        hasAbout: false,
        hasContact: false,
        hasServices: false,
        hasBlog: false,
        confidence: 0,
      },
      globalConfidence: 0,
      presenceGrade: 'F',
      presenceScore: 0,
      summary: {
        gbpFound: false,
        socialCount: 0,
        schemaCount: 0,
        pagesDiscovered: 0,
        missingPages: 0,
        confidence: 'very-low',
        issues: ['Detection failed'],
      },
      raw: {
        success: false,
        domain: options.domain,
        gbp: { found: false, url: null, placeId: null, businessName: null, confidence: 0, sources: [], failureReasons: ['Detection failed'] },
        socials: [],
        schema: [],
        discovery: { discoveredPages: [], missingPages: [], totalLinksFound: 0, maxDepthReached: 0, confidence: 0, errors: [] },
        globalConfidence: 0,
        failures: [{ code: 'detection-error', message: error instanceof Error ? error.message : 'Unknown error', recoverable: false }],
        detectedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Convert GAP detection result to DataConfidenceBadge sources format
 */
export function detectionToDataSources(detection: GapDetectionResult): Array<{
  id: string;
  name: string;
  type: 'diagnostic';
  lastUpdated: string | null;
  status: 'fresh' | 'stale' | 'missing' | 'error';
  description?: string;
}> {
  const sources: Array<{
    id: string;
    name: string;
    type: 'diagnostic';
    lastUpdated: string | null;
    status: 'fresh' | 'stale' | 'missing' | 'error';
    description?: string;
  }> = [];

  // GBP source
  sources.push({
    id: 'detection-gbp',
    name: 'Google Business Profile',
    type: 'diagnostic',
    lastUpdated: detection.raw.detectedAt,
    status: detection.gbp.found
      ? detection.gbp.confidence >= 70 ? 'fresh' : 'stale'
      : 'missing',
    description: detection.gbp.found
      ? `Confidence: ${detection.gbp.confidence}%`
      : 'Not detected',
  });

  // Social sources
  const socialCount = Object.values(detection.socials).filter(s => s.found).length;
  const avgSocialConfidence = Object.values(detection.socials)
    .filter(s => s.found)
    .reduce((sum, s) => sum + s.confidence, 0) / Math.max(socialCount, 1);

  sources.push({
    id: 'detection-social',
    name: 'Social Profiles',
    type: 'diagnostic',
    lastUpdated: detection.raw.detectedAt,
    status: socialCount >= 2
      ? avgSocialConfidence >= 70 ? 'fresh' : 'stale'
      : socialCount === 0 ? 'missing' : 'stale',
    description: `${socialCount} platforms · avg ${Math.round(avgSocialConfidence)}% confidence`,
  });

  // Schema source
  sources.push({
    id: 'detection-schema',
    name: 'Schema.org Markup',
    type: 'diagnostic',
    lastUpdated: detection.raw.detectedAt,
    status: detection.schema.hasLocalBusiness || detection.schema.hasOrganization
      ? 'fresh'
      : detection.schema.sameAsUrls.length > 0 ? 'stale' : 'missing',
    description: detection.schema.hasLocalBusiness
      ? 'LocalBusiness schema found'
      : detection.schema.hasOrganization
        ? 'Organization schema found'
        : 'No schema detected',
  });

  // Discovery source
  sources.push({
    id: 'detection-discovery',
    name: 'Page Discovery',
    type: 'diagnostic',
    lastUpdated: detection.raw.detectedAt,
    status: detection.discovery.confidence >= 70
      ? 'fresh'
      : detection.discovery.pagesDiscovered > 0 ? 'stale' : 'missing',
    description: `${detection.discovery.pagesDiscovered} pages · ${detection.discovery.missingPages.length} missing`,
  });

  return sources;
}

/**
 * Get detection summary text for display
 */
export function getDetectionSummaryText(detection: GapDetectionResult): string {
  const parts: string[] = [];

  if (detection.gbp.found) {
    parts.push(`GBP: ${detection.gbp.confidence}% confidence`);
  } else {
    parts.push('GBP: Not found');
  }

  const socialCount = Object.values(detection.socials).filter(s => s.found).length;
  parts.push(`Social: ${socialCount} platforms`);

  parts.push(`Discovery: ${detection.discovery.pagesDiscovered} pages`);

  parts.push(`Overall: ${detection.presenceGrade} (${detection.presenceScore}/100)`);

  return parts.join(' · ');
}
