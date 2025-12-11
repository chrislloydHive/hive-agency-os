// lib/os/detection/detectSocial.ts
// Social profile detector with multi-method detection

import type { SocialSignal, SocialPlatform, SignalSource } from './types';
import { PLATFORM_PATTERNS, PLATFORM_DOMAINS } from './types';
import { parseSchemaSignals, getSocialFromSameAs } from './detectSchemaSameAs';

/**
 * Options for social detection
 */
interface DetectSocialOptions {
  html: string;
  domain: string;
  brandName?: string;
}

/**
 * Extract social links from HTML anchor tags
 */
function extractSocialLinks(html: string): Map<SocialPlatform, { url: string; confidence: number }[]> {
  const results = new Map<SocialPlatform, { url: string; confidence: number }[]>();

  // Initialize all platforms
  const platforms: SocialPlatform[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x'];
  for (const p of platforms) {
    results.set(p, []);
  }

  // Find all anchor tags
  const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];

    // Check each platform
    for (const platform of platforms) {
      const domains = PLATFORM_DOMAINS[platform];
      const hrefLower = href.toLowerCase();

      for (const domain of domains) {
        if (hrefLower.includes(domain)) {
          const existing = results.get(platform)!;

          // Check for duplicate URLs
          if (!existing.some(e => e.url === href)) {
            // Determine confidence based on link context
            let confidence = 75;

            // Check if it's in a footer/header (typically social links)
            const context = match[0].toLowerCase();
            if (context.includes('footer') || context.includes('social') ||
                context.includes('follow') || context.includes('connect')) {
              confidence = 90;
            }

            // Check for icon classes
            if (context.includes('icon') || context.includes('fa-') ||
                context.includes('svg') || context.includes(platform)) {
              confidence = 85;
            }

            existing.push({ url: href, confidence });
          }
          break;
        }
      }
    }
  }

  return results;
}

/**
 * Extract username from social URL
 */
export function extractUsername(url: string, platform: SocialPlatform): string | null {
  const patterns = PLATFORM_PATTERNS[platform];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      // Clean up username
      let username = match[1];

      // Remove trailing slashes or query params
      username = username.split('?')[0].split('/')[0];

      // Skip generic pages
      const genericPages = ['pages', 'home', 'about', 'help', 'privacy', 'terms', 'share'];
      if (genericPages.includes(username.toLowerCase())) {
        return null;
      }

      return username;
    }
  }

  return null;
}

/**
 * Check for social meta tags (og:, twitter:)
 */
function extractSocialMetaTags(html: string): Map<SocialPlatform, { url: string; confidence: number }[]> {
  const results = new Map<SocialPlatform, { url: string; confidence: number }[]>();
  const platforms: SocialPlatform[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x'];

  for (const p of platforms) {
    results.set(p, []);
  }

  // Check for Twitter/X card meta
  const twitterSiteMatch = html.match(/<meta[^>]*name=["']twitter:site["'][^>]*content=["']@?([^"']+)["']/i);
  if (twitterSiteMatch) {
    const username = twitterSiteMatch[1].replace('@', '');
    results.get('x')!.push({
      url: `https://x.com/${username}`,
      confidence: 85,
    });
  }

  // Check for og:see_also (some sites use this for social links)
  const ogSeeAlsoRegex = /<meta[^>]*property=["']og:see_also["'][^>]*content=["']([^"']+)["']/gi;
  let match;

  while ((match = ogSeeAlsoRegex.exec(html)) !== null) {
    const url = match[1];
    for (const platform of platforms) {
      const domains = PLATFORM_DOMAINS[platform];
      for (const domain of domains) {
        if (url.toLowerCase().includes(domain)) {
          results.get(platform)!.push({ url, confidence: 80 });
          break;
        }
      }
    }
  }

  return results;
}

/**
 * Score social profile confidence
 */
function scoreSocialConfidence(sources: SignalSource[]): number {
  if (sources.length === 0) return 0;

  let maxScore = 0;

  for (const source of sources) {
    let score = source.confidence;

    // Boost for multiple sources
    if (sources.length > 1) {
      score += 10;
    }

    // Type weighting
    switch (source.type) {
      case 'schema-sameAs':
        score += 5; // Schema is authoritative
        break;
      case 'direct-link':
        // Already scored
        break;
      case 'meta-tag':
        score += 3;
        break;
    }

    maxScore = Math.max(maxScore, score);
  }

  return Math.min(100, maxScore);
}

/**
 * Merge sources and pick best URL
 */
function mergeSourcesForPlatform(
  directLinks: { url: string; confidence: number }[],
  schemaLinks: { url: string; confidence: number; source: SignalSource }[],
  metaLinks: { url: string; confidence: number }[]
): { url: string | null; sources: SignalSource[] } {
  const sources: SignalSource[] = [];
  const urlScores = new Map<string, number>();

  // Add direct links
  for (const link of directLinks) {
    sources.push({
      type: 'direct-link',
      value: link.url,
      confidence: link.confidence,
      url: link.url,
    });
    urlScores.set(link.url, (urlScores.get(link.url) || 0) + link.confidence);
  }

  // Add schema links
  for (const link of schemaLinks) {
    sources.push(link.source);
    urlScores.set(link.url, (urlScores.get(link.url) || 0) + link.confidence);
  }

  // Add meta links
  for (const link of metaLinks) {
    sources.push({
      type: 'meta-tag',
      value: link.url,
      confidence: link.confidence,
      url: link.url,
    });
    urlScores.set(link.url, (urlScores.get(link.url) || 0) + link.confidence);
  }

  // Pick URL with highest combined score
  let bestUrl: string | null = null;
  let bestScore = 0;

  for (const [url, score] of urlScores) {
    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return { url: bestUrl, sources };
}

/**
 * Detect all social profiles from HTML
 */
export async function detectSocial(options: DetectSocialOptions): Promise<SocialSignal[]> {
  const { html, domain, brandName } = options;
  const results: SocialSignal[] = [];
  const platforms: SocialPlatform[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x'];

  try {
    // Method 1: Direct HTML links
    const directLinks = extractSocialLinks(html);

    // Method 2: Schema.org sameAs
    const schemaResult = parseSchemaSignals(html);
    const schemaLinks = getSocialFromSameAs(schemaResult.sameAsUrls);

    // Group schema links by platform
    const schemaByPlatform = new Map<SocialPlatform, { url: string; confidence: number; source: SignalSource }[]>();
    for (const p of platforms) {
      schemaByPlatform.set(p, []);
    }
    for (const link of schemaLinks) {
      schemaByPlatform.get(link.platform)!.push(link);
    }

    // Method 3: Meta tags
    const metaLinks = extractSocialMetaTags(html);

    // Process each platform
    for (const platform of platforms) {
      const direct = directLinks.get(platform) || [];
      const schema = schemaByPlatform.get(platform) || [];
      const meta = metaLinks.get(platform) || [];

      const { url, sources } = mergeSourcesForPlatform(direct, schema, meta);
      const confidence = scoreSocialConfidence(sources);

      const failureReasons: string[] = [];

      // Check for inconsistencies
      if (sources.length > 1) {
        const usernames = sources
          .filter(s => s.url)
          .map(s => extractUsername(s.url!, platform))
          .filter((u): u is string => u !== null);

        const uniqueUsernames = new Set(usernames);
        if (uniqueUsernames.size > 1) {
          failureReasons.push(`inconsistent-usernames: Found multiple usernames: ${[...uniqueUsernames].join(', ')}`);
        }
      }

      if (sources.length === 0) {
        failureReasons.push(`no-${platform}-signals: No links or schema references found`);
      }

      results.push({
        platform,
        url,
        username: url ? extractUsername(url, platform) : null,
        confidence,
        sources,
        failureReasons,
      });
    }

  } catch (error) {
    // Return empty results with error for each platform
    for (const platform of platforms) {
      results.push({
        platform,
        url: null,
        username: null,
        confidence: 0,
        sources: [],
        failureReasons: [`detection-error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      });
    }
  }

  return results;
}

/**
 * Get social profile search query for manual verification
 */
export function getSocialSearchQuery(brandName: string, platform: SocialPlatform): string {
  const sitePrefix: Record<SocialPlatform, string> = {
    facebook: 'site:facebook.com',
    instagram: 'site:instagram.com',
    tiktok: 'site:tiktok.com',
    youtube: 'site:youtube.com',
    linkedin: 'site:linkedin.com/company',
    x: 'site:x.com OR site:twitter.com',
  };

  return `${sitePrefix[platform]} "${brandName}"`;
}

/**
 * Validate a social URL matches expected platform
 */
export function validateSocialUrl(url: string, expectedPlatform: SocialPlatform): boolean {
  const domains = PLATFORM_DOMAINS[expectedPlatform];
  const urlLower = url.toLowerCase();

  return domains.some(domain => urlLower.includes(domain));
}
