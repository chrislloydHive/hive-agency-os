// lib/os/detection/detectGBP.ts
// Google Business Profile detector with multi-method detection

import type { GBPSignal, SignalSource } from './types';
import { GBP_PATTERNS } from './types';
import {
  parseSchemaSignals,
  getGBPFromSameAs,
  extractLocalBusinessData,
} from './detectSchemaSameAs';

/**
 * Options for GBP detection
 */
interface DetectGBPOptions {
  html: string;
  domain: string;
  businessName?: string;
  city?: string;
  useSearchFallback?: boolean;
}

/**
 * Extract GBP links from HTML
 */
function extractGBPLinks(html: string): { url: string; confidence: number }[] {
  const links: { url: string; confidence: number }[] = [];
  const seen = new Set<string>();

  // Find all anchor tags
  const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];

    // Check against GBP patterns
    for (const pattern of GBP_PATTERNS) {
      if (pattern.test(href) && !seen.has(href)) {
        seen.add(href);
        links.push({
          url: href,
          confidence: 80, // Direct link has high confidence
        });
        break;
      }
    }
  }

  // Also check for Google Maps embeds
  const embedRegex = /src=["']([^"']*google\.com\/maps\/embed[^"']*)["']/gi;
  while ((match = embedRegex.exec(html)) !== null) {
    const src = match[1];
    if (!seen.has(src)) {
      seen.add(src);
      links.push({
        url: src,
        confidence: 60, // Embed is less direct than link
      });
    }
  }

  return links;
}

/**
 * Extract g.page redirects
 */
function extractGPageLinks(html: string): { url: string; confidence: number }[] {
  const links: { url: string; confidence: number }[] = [];
  const gPageRegex = /(?:https?:\/\/)?g\.page\/([a-zA-Z0-9_-]+)/gi;
  let match;

  while ((match = gPageRegex.exec(html)) !== null) {
    links.push({
      url: match[0].startsWith('http') ? match[0] : `https://${match[0]}`,
      confidence: 90, // g.page links are official GBP shortlinks
    });
  }

  return links;
}

/**
 * Normalize GBP URL to a standard format
 */
function normalizeGBPUrl(url: string): string {
  // Remove tracking parameters
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract place ID from GBP URL if present
 */
function extractPlaceId(url: string): string | null {
  // Check for CID parameter
  const cidMatch = url.match(/[?&]cid=(\d+)/);
  if (cidMatch) return cidMatch[1];

  // Check for place_id parameter
  const placeIdMatch = url.match(/[?&]place_id=([^&]+)/);
  if (placeIdMatch) return placeIdMatch[1];

  return null;
}

/**
 * Score GBP confidence based on sources
 */
function scoreGBPConfidence(sources: SignalSource[]): number {
  let score = 0;

  for (const source of sources) {
    switch (source.type) {
      case 'direct-link':
        score += 60;
        break;
      case 'schema-sameAs':
        score += 25;
        break;
      case 'pattern-match':
        score += 15;
        break;
      case 'search-result':
        score += 20;
        break;
      case 'inferred':
        score += 10;
        break;
    }
  }

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Detect GBP from HTML and optional search
 */
export async function detectGBP(options: DetectGBPOptions): Promise<GBPSignal> {
  const { html, domain: _domain, businessName, city: _city } = options;
  const sources: SignalSource[] = [];
  const failureReasons: string[] = [];
  let bestUrl: string | null = null;
  let placeId: string | null = null;
  let foundBusinessName: string | null = businessName || null;

  try {
    // Method 1: Direct GBP links in HTML
    const directLinks = extractGBPLinks(html);
    for (const link of directLinks) {
      sources.push({
        type: 'direct-link',
        value: link.url,
        confidence: link.confidence,
        url: link.url,
      });
      if (!bestUrl) {
        bestUrl = normalizeGBPUrl(link.url);
        placeId = extractPlaceId(link.url);
      }
    }

    // Method 2: g.page links
    const gPageLinks = extractGPageLinks(html);
    for (const link of gPageLinks) {
      sources.push({
        type: 'direct-link',
        value: link.url,
        confidence: link.confidence,
        url: link.url,
      });
      if (!bestUrl) {
        bestUrl = link.url;
      }
    }

    // Method 3: Schema.org sameAs
    const schemaResult = parseSchemaSignals(html);
    const gbpFromSchema = getGBPFromSameAs(schemaResult.sameAsUrls);

    if (gbpFromSchema) {
      sources.push(gbpFromSchema.source);
      if (!bestUrl) {
        bestUrl = gbpFromSchema.url;
        placeId = extractPlaceId(gbpFromSchema.url);
      }
    }

    // Method 4: LocalBusiness schema (inferring GBP exists)
    const localBusinessData = extractLocalBusinessData(schemaResult.signals);
    if (localBusinessData.hasLocalBusiness) {
      if (!foundBusinessName && localBusinessData.businessName) {
        foundBusinessName = localBusinessData.businessName;
      }

      // If we have local business data but no GBP link, add as inference
      if (sources.length === 0 && localBusinessData.geo) {
        sources.push({
          type: 'inferred',
          value: 'LocalBusiness schema with geo coordinates suggests GBP may exist',
          confidence: 30,
        });
        failureReasons.push('gbp-inferred: LocalBusiness schema found but no direct GBP link');
      }
    }

    // Check for failures
    if (sources.length === 0) {
      failureReasons.push('no-gbp-signals: No GBP links, schema sameAs, or Google Maps references found');
    }

    // Add schema parsing failures
    failureReasons.push(...schemaResult.failures);

  } catch (error) {
    failureReasons.push(`detection-error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const confidence = scoreGBPConfidence(sources);

  return {
    found: bestUrl !== null || sources.length > 0,
    url: bestUrl,
    placeId,
    businessName: foundBusinessName,
    confidence,
    sources,
    failureReasons,
  };
}

/**
 * Validate a potential GBP URL
 */
export function isValidGBPUrl(url: string): boolean {
  for (const pattern of GBP_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

/**
 * Get GBP search query for manual verification
 */
export function getGBPSearchQuery(businessName: string, city?: string): string {
  const parts = [businessName];
  if (city) parts.push(city);
  parts.push('Google Business Profile');
  return parts.join(' ');
}
