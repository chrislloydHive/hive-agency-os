// lib/os/detection/unifySignals.ts
// Unified signal detection entry point

import type {
  DetectionResult,
  DetectionFailure,
  GBPSignal,
  SocialSignal,
  SchemaSignal,
  DiscoveryResult,
} from './types';
import { detectGBP } from './detectGBP';
import { detectSocial } from './detectSocial';
import { parseSchemaSignals } from './detectSchemaSameAs';
import { discoverPages, analyzeHomepageLinks } from './discoverPages';
import { computeGlobalConfidence } from './computeConfidence';

/**
 * Options for detection
 */
interface DetectAllSignalsOptions {
  domain: string;
  html?: string;
  businessName?: string;
  city?: string;
  enableDeepCrawl?: boolean;
  fetchFn?: (url: string) => Promise<{ html: string; status: number }>;
}

/**
 * Fetch HTML content from a URL
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveOS/1.0; +https://hiveos.io)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Normalize domain to URL
 */
function normalizeToUrl(domain: string): string {
  // Remove protocol if present
  let clean = domain.replace(/^https?:\/\//, '');

  // Remove trailing slash
  clean = clean.replace(/\/$/, '');

  // Remove paths
  clean = clean.split('/')[0];

  // Add https
  return `https://${clean}`;
}

/**
 * Detect all signals for a domain
 *
 * This is the main entry point for the detection system.
 * It orchestrates GBP, social, schema, and page discovery detection.
 */
export async function detectAllSignals(
  options: DetectAllSignalsOptions
): Promise<DetectionResult> {
  const {
    domain,
    html: providedHtml,
    businessName,
    city,
    enableDeepCrawl = false,
    fetchFn,
  } = options;

  const failures: DetectionFailure[] = [];
  const startUrl = normalizeToUrl(domain);

  // Default results for error cases
  let gbp: GBPSignal = {
    found: false,
    url: null,
    placeId: null,
    businessName: null,
    confidence: 0,
    sources: [],
    failureReasons: [],
  };

  let socials: SocialSignal[] = [];
  let schema: SchemaSignal[] = [];
  let discovery: DiscoveryResult = {
    discoveredPages: [],
    missingPages: [],
    totalLinksFound: 0,
    maxDepthReached: 0,
    confidence: 0,
    errors: [],
  };

  try {
    // Step 1: Get HTML content
    let html: string;
    if (providedHtml) {
      html = providedHtml;
    } else {
      try {
        html = await fetchHtml(startUrl);
      } catch (error) {
        failures.push({
          code: 'html-fetch-failed',
          message: `Failed to fetch HTML: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recoverable: false,
        });

        return {
          success: false,
          domain,
          gbp,
          socials,
          schema,
          discovery,
          globalConfidence: 0,
          failures,
          detectedAt: new Date().toISOString(),
        };
      }
    }

    // Step 2: Parse schema.org data
    try {
      const schemaResult = parseSchemaSignals(html);
      schema = schemaResult.signals;

      for (const failure of schemaResult.failures) {
        failures.push({
          code: 'schema-parse-issue',
          message: failure,
          recoverable: true,
        });
      }
    } catch (error) {
      failures.push({
        code: 'schema-detection-failed',
        message: `Schema detection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      });
    }

    // Step 3: Detect GBP
    try {
      gbp = await detectGBP({
        html,
        domain,
        businessName,
        city,
      });
    } catch (error) {
      failures.push({
        code: 'gbp-detection-failed',
        message: `GBP detection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      });
    }

    // Step 4: Detect social profiles
    try {
      socials = await detectSocial({
        html,
        domain,
        brandName: businessName,
      });
    } catch (error) {
      failures.push({
        code: 'social-detection-failed',
        message: `Social detection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      });
    }

    // Step 5: Page discovery
    try {
      if (enableDeepCrawl) {
        // Full crawl
        discovery = await discoverPages({
          startUrl,
          maxDepth: 2,
          maxPages: 50,
          fetchFn: fetchFn || (async (url) => {
            const h = await fetchHtml(url);
            return { html: h, status: 200 };
          }),
        });
      } else {
        // Quick analysis of homepage only
        const linkAnalysis = analyzeHomepageLinks(html, startUrl);

        discovery = {
          discoveredPages: [{
            url: startUrl,
            depth: 0,
            status: 200,
            title: null,
            type: 'internal',
            linkCount: linkAnalysis.internalLinks.length + linkAnalysis.externalLinks.length,
          }],
          missingPages: linkAnalysis.missingExpectedPages.map(path => ({
            path,
            importance: 'medium' as const,
            reason: 'Not linked from homepage',
          })),
          totalLinksFound: linkAnalysis.internalLinks.length + linkAnalysis.externalLinks.length,
          maxDepthReached: 0,
          confidence: Math.round(
            (linkAnalysis.foundExpectedPages.length /
             (linkAnalysis.foundExpectedPages.length + linkAnalysis.missingExpectedPages.length)) * 100
          ) || 50,
          errors: [],
        };
      }
    } catch (error) {
      failures.push({
        code: 'discovery-failed',
        message: `Page discovery error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      });
    }

    // Step 6: Compute global confidence
    const globalConfidence = computeGlobalConfidence({
      gbp,
      socials,
      schema,
      discovery,
    });

    return {
      success: true,
      domain,
      gbp,
      socials,
      schema,
      discovery,
      globalConfidence,
      failures,
      detectedAt: new Date().toISOString(),
    };

  } catch (error) {
    failures.push({
      code: 'detection-error',
      message: `Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recoverable: false,
    });

    return {
      success: false,
      domain,
      gbp,
      socials,
      schema,
      discovery,
      globalConfidence: 0,
      failures,
      detectedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get a summary of detection results
 */
export function summarizeDetection(result: DetectionResult): {
  gbpFound: boolean;
  socialCount: number;
  schemaCount: number;
  pagesDiscovered: number;
  missingPages: number;
  confidence: 'high' | 'medium' | 'low' | 'very-low';
  issues: string[];
} {
  const socialCount = result.socials.filter(s => s.url).length;
  const confidence = result.globalConfidence >= 80 ? 'high'
    : result.globalConfidence >= 60 ? 'medium'
    : result.globalConfidence >= 40 ? 'low'
    : 'very-low';

  const issues: string[] = [];

  // Collect issues
  if (!result.gbp.found) {
    issues.push('No Google Business Profile detected');
  }

  if (socialCount < 2) {
    issues.push(`Only ${socialCount} social profiles found`);
  }

  if (result.schema.length === 0) {
    issues.push('No schema.org markup found');
  }

  if (result.discovery.missingPages.length > 3) {
    issues.push(`${result.discovery.missingPages.length} expected pages missing`);
  }

  for (const failure of result.failures) {
    if (!failure.recoverable) {
      issues.push(failure.message);
    }
  }

  return {
    gbpFound: result.gbp.found,
    socialCount,
    schemaCount: result.schema.length,
    pagesDiscovered: result.discovery.discoveredPages.length,
    missingPages: result.discovery.missingPages.length,
    confidence,
    issues,
  };
}

/**
 * Check if detection results indicate a healthy digital presence
 */
export function assessDigitalPresence(result: DetectionResult): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0;

  // GBP (25 points)
  if (result.gbp.found) {
    if (result.gbp.confidence >= 80) {
      score += 25;
      strengths.push('Strong Google Business Profile presence');
    } else if (result.gbp.confidence >= 60) {
      score += 20;
      strengths.push('Google Business Profile detected');
    } else {
      score += 10;
      weaknesses.push('GBP detected but low confidence');
    }
  } else {
    weaknesses.push('No Google Business Profile found');
  }

  // Social (25 points)
  const socialCount = result.socials.filter(s => s.url && s.confidence >= 60).length;
  if (socialCount >= 4) {
    score += 25;
    strengths.push('Strong social media presence');
  } else if (socialCount >= 2) {
    score += 15;
    strengths.push('Basic social media presence');
  } else if (socialCount >= 1) {
    score += 5;
    weaknesses.push('Limited social media presence');
  } else {
    weaknesses.push('No social media profiles found');
  }

  // Schema (25 points)
  const hasOrg = result.schema.some(s =>
    s.type.toLowerCase().includes('organization') ||
    s.type.toLowerCase().includes('localbusiness')
  );
  const hasSameAs = result.schema.some(s => s.sameAs.length > 0);

  if (hasOrg && hasSameAs) {
    score += 25;
    strengths.push('Comprehensive schema markup');
  } else if (hasOrg) {
    score += 15;
    strengths.push('Basic schema markup present');
  } else if (result.schema.length > 0) {
    score += 5;
    weaknesses.push('Limited schema markup');
  } else {
    weaknesses.push('No schema markup found');
  }

  // Site structure (25 points)
  const criticalMissing = result.discovery.missingPages.filter(p =>
    p.importance === 'critical'
  ).length;
  const highMissing = result.discovery.missingPages.filter(p =>
    p.importance === 'high'
  ).length;

  if (criticalMissing === 0 && highMissing === 0) {
    score += 25;
    strengths.push('Complete site structure');
  } else if (criticalMissing === 0) {
    score += 15;
    weaknesses.push(`Missing ${highMissing} important pages`);
  } else {
    score += 5;
    weaknesses.push(`Missing ${criticalMissing} critical pages`);
  }

  // Determine grade
  const grade =
    score >= 90 ? 'A' :
    score >= 80 ? 'B' :
    score >= 70 ? 'C' :
    score >= 60 ? 'D' : 'F';

  return { score, grade, strengths, weaknesses };
}
