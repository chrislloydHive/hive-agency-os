// lib/gap/socialDetection.ts
//
// Social Media & Google Business Profile Detection for GAP Snapshots
//
// This module provides robust detection of social profiles and GBP using:
// - HTML link analysis with location context (header/footer/body)
// - Schema.org JSON-LD parsing (sameAs, hasMap, LocalBusiness)
// - Confidence scoring based on detection sources
// - Status classification (present/probable/inconclusive/missing)
//
// Usage:
//   const result = detectSocialAndGbp({ html, schemas: parsedJsonLd });
//   snapshot.socialFootprint = result;
//   snapshot.scores.socialLocalPresence = computeSocialLocalPresenceScore(result);

import * as cheerio from 'cheerio';

// ============================================================================
// Types
// ============================================================================

/**
 * Detection source - where the social/GBP signal was found
 */
export type DetectionSource =
  | 'html_link_header'
  | 'html_link_footer'
  | 'html_link_body'
  | 'schema_sameAs'
  | 'schema_url'
  | 'schema_gbp'
  | 'schema_social'
  | 'search_fallback'
  | 'manual';

/**
 * Presence status based on confidence thresholds
 */
export type PresenceStatus = 'present' | 'probable' | 'inconclusive' | 'missing';

/**
 * Supported social networks
 */
export type SocialNetwork =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'youtube';

/**
 * Social presence detection result for a single network
 */
export interface SocialPresence {
  network: SocialNetwork;
  url?: string;
  handle?: string;
  detectionSources: DetectionSource[];
  confidence: number; // 0-1
  status: PresenceStatus;
}

/**
 * Google Business Profile presence detection result
 */
export interface GbpPresence {
  url?: string;
  detectionSources: DetectionSource[];
  confidence: number; // 0-1
  status: PresenceStatus;
}

/**
 * Complete social footprint snapshot
 */
export interface SocialFootprintSnapshot {
  socials: SocialPresence[];
  gbp: GbpPresence | null;
  dataConfidence: number; // 0-1 (how thoroughly we checked)
}

/**
 * Input for social detection
 */
export interface SocialDetectionInput {
  html: string;
  schemas: any[]; // parsed JSON-LD objects
  baseUrl?: string; // Optional base URL for resolving relative URLs
}

/**
 * Output from social detection
 */
export interface SocialDetectionResult {
  socials: SocialPresence[];
  gbp: GbpPresence | null;
  dataConfidence: number;
}

/**
 * Extract JSON-LD schemas from raw HTML.
 *
 * We keep this lightweight (regex + JSON.parse) so detection callers can
 * supply schema objects without needing cheerio.
 */
export function extractJsonLdSchemas(html: string): any[] {
  const schemas: any[] = [];
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = html.matchAll(jsonLdRegex);

  for (const match of matches) {
    try {
      const jsonContent = match[1].trim();
      if (!jsonContent) continue;

      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch (e) {
      // Ignore invalid JSON-LD blocks; continue parsing others
      continue;
    }
  }

  return schemas;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_NETWORKS: SocialNetwork[] = [
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'linkedin',
  'youtube',
];

/**
 * URL patterns for social networks
 */
const SOCIAL_PATTERNS: Record<SocialNetwork, RegExp> = {
  instagram: /https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/i,
  facebook: /https?:\/\/(www\.|m\.)?facebook\.com\/([a-zA-Z0-9_.]+)\/?/i,
  tiktok: /https?:\/\/(www\.)?tiktok\.com\/@?([a-zA-Z0-9_.]+)\/?/i,
  x: /https?:\/\/(www\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/?/i,
  linkedin: /https?:\/\/(www\.)?linkedin\.com\/(company|in|showcase)\/([a-zA-Z0-9_-]+)\/?/i,
  youtube: /https?:\/\/(www\.)?youtube\.com\/(channel|c|user|@)?\/?\/?([a-zA-Z0-9_-]+)\/?/i,
};

/**
 * GBP URL patterns
 * 
 * Note: Patterns are flexible to handle:
 * - Full URLs: https://maps.google.com/...
 * - Protocol-relative: //maps.google.com/...
 * - Relative URLs: /maps?cid=... (when domain is google.com)
 * - URLs without protocol: maps.google.com/...
 */
const GBP_PATTERNS: RegExp[] = [
  // g.page short links (full URL or protocol-relative)
  /(https?:)?\/\/g\.page\/[a-zA-Z0-9_/-]+/i,
  // goo.gl/maps short links
  /(https?:)?\/\/goo\.gl\/maps\/[a-zA-Z0-9]+/i,
  // maps.app.goo.gl short links
  /(https?:)?\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9]+/i,
  // google.com/maps with cid parameter
  /(https?:)?\/\/(www\.)?google\.com\/maps\?cid=\d+/i,
  // google.com/maps/place
  /(https?:)?\/\/(www\.)?google\.com\/maps\/place\/[^\s"'<>]+/i,
  // google.com/maps/search
  /(https?:)?\/\/(www\.)?google\.com\/maps\/search\/\?api=1&query=[^\s"'<>]+/i,
  // google.com/maps/@
  /(https?:)?\/\/(www\.)?google\.com\/maps\/@\?api=1&map_action=map[^\s"'<>]*/i,
  // search.google.com/local/writereview
  /(https?:)?\/\/search\.google\.com\/local\/writereview\?placeid=[^\s"'<>]+/i,
  // maps.google.com (any path)
  /(https?:)?\/\/maps\.google\.com\/[^\s"'<>]+/i,
  // google.com/business
  /(https?:)?\/\/(www\.)?google\.com\/business\/[^\s"'<>]+/i,
  // Relative URLs that look like Google Maps (when on google.com domain)
  /^\/maps\?cid=\d+/i,
  /^\/maps\/place\/[^\s"'<>]+/i,
  // Domain patterns without protocol (matches maps.google.com, etc.)
  /^(www\.)?maps\.google\.com\/[^\s"'<>]+/i,
  /^g\.page\/[a-zA-Z0-9_/-]+/i,
];

/**
 * Confidence weights per detection source
 *
 * Key insight: For local businesses, footer links are a STRONG signal.
 * A business that takes the time to link their social profiles in the footer
 * almost certainly has those profiles. We weight footer/header links highly.
 */
const SOCIAL_SOURCE_WEIGHTS: Record<DetectionSource, number> = {
  html_link_header: 0.85,  // Header/nav social links are very intentional
  html_link_footer: 0.85,  // Footer social links are the standard pattern
  html_link_body: 0.45,    // Body links are less reliable (could be mentions)
  schema_sameAs: 0.50,     // Schema alone is moderate confidence
  schema_url: 0.30,
  schema_gbp: 0.50,
  schema_social: 0.50,
  search_fallback: 0.30,
  manual: 1.0,
};

const GBP_SOURCE_WEIGHTS: Record<DetectionSource, number> = {
  html_link_header: 0.80,  // GBP in header is strong
  html_link_footer: 0.80,  // GBP in footer is the standard pattern
  html_link_body: 0.50,    // Body links are moderate (often in contact section)
  schema_sameAs: 0.80,     // Schema sameAs is very reliable for GBP
  schema_url: 0.50,
  schema_gbp: 0.85,        // Explicit hasMap is highly reliable
  schema_social: 0.40,
  search_fallback: 0.30,
  manual: 1.0,
};

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect social profiles and GBP from HTML and schema.org data
 *
 * @param input - HTML content and parsed JSON-LD schemas
 * @returns Detection result with socials, GBP, and data confidence
 */
export function detectSocialAndGbp(input: SocialDetectionInput): SocialDetectionResult {
  const { html, schemas, baseUrl } = input;

  // Track detections per network
  const socialDetections: Map<SocialNetwork, {
    url?: string;
    handle?: string;
    sources: Set<DetectionSource>;
  }> = new Map();

  // Track GBP detections
  const gbpDetections: {
    url?: string;
    sources: Set<DetectionSource>;
  } = { sources: new Set() };

  // Stage 1: Parse HTML for links with location context
  const htmlDetections = detectFromHtml(html, baseUrl);
  mergeDetections(socialDetections, gbpDetections, htmlDetections);

  // Stage 2: Parse schema.org JSON-LD
  const schemaDetections = detectFromSchemas(schemas);
  mergeDetections(socialDetections, gbpDetections, schemaDetections);

  // Stage 3: Build final results with confidence scoring
  const socials = buildSocialResults(socialDetections);
  const gbp = buildGbpResult(gbpDetections);

  // Stage 4: Calculate data confidence
  const dataConfidence = calculateDataConfidence(html, schemas, socials, gbp);

  return { socials, gbp, dataConfidence };
}

// ============================================================================
// HTML Detection
// ============================================================================

interface HtmlDetections {
  socials: Map<SocialNetwork, {
    url: string;
    handle?: string;
    source: DetectionSource;
  }[]>;
  gbp: { url: string; source: DetectionSource }[];
}

/**
 * Detect social profiles and GBP from HTML links with location context
 */
function detectFromHtml(html: string, baseUrl?: string): HtmlDetections {
  const $ = cheerio.load(html);
  const result: HtmlDetections = {
    socials: new Map(),
    gbp: [],
  };

  // Find all anchor tags
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Determine location context
    const source = classifyLinkLocation($, el);

    // Check social networks
    for (const network of ALL_NETWORKS) {
      const pattern = SOCIAL_PATTERNS[network];
      const match = href.match(pattern);
      if (match) {
        const handle = extractHandleFromMatch(network, match);
        const url = normalizeUrl(href, baseUrl);

        if (!result.socials.has(network)) {
          result.socials.set(network, []);
        }
        result.socials.get(network)!.push({ url, handle, source });
      }
    }

    // Check GBP patterns
    // First check raw href
    for (const pattern of GBP_PATTERNS) {
      if (pattern.test(href)) {
        // Normalize URL - handle protocol-relative and relative URLs
        const normalizedHref = normalizeUrl(href, baseUrl);
        result.gbp.push({ url: normalizedHref, source });
        break;
      }
    }
  });

  return result;
}

/**
 * Classify where a link appears in the page (header, footer, or body)
 */
function classifyLinkLocation($: cheerio.CheerioAPI, el: Parameters<typeof $>[0]): DetectionSource {
  const $el = $(el);

  // Check if in header
  if (
    $el.closest('header').length > 0 ||
    $el.closest('[id*="header"]').length > 0 ||
    $el.closest('[class*="header"]').length > 0 ||
    $el.closest('[id*="site-header"]').length > 0 ||
    $el.closest('[class*="site-header"]').length > 0 ||
    $el.closest('nav').length > 0 ||
    $el.closest('[id*="nav"]').length > 0 ||
    $el.closest('[class*="nav"]').length > 0
  ) {
    return 'html_link_header';
  }

  // Check if in footer
  if (
    $el.closest('footer').length > 0 ||
    $el.closest('[id*="footer"]').length > 0 ||
    $el.closest('[class*="footer"]').length > 0 ||
    $el.closest('[id*="site-footer"]').length > 0 ||
    $el.closest('[class*="site-footer"]').length > 0
  ) {
    return 'html_link_footer';
  }

  return 'html_link_body';
}

// ============================================================================
// Schema.org Detection
// ============================================================================

interface SchemaDetections {
  socials: Map<SocialNetwork, {
    url: string;
    handle?: string;
    source: DetectionSource;
  }[]>;
  gbp: { url: string; source: DetectionSource }[];
}

/**
 * Detect social profiles and GBP from schema.org JSON-LD data
 */
function detectFromSchemas(schemas: any[]): SchemaDetections {
  const result: SchemaDetections = {
    socials: new Map(),
    gbp: [],
  };

  for (const schema of schemas) {
    if (!schema || typeof schema !== 'object') continue;

    // Handle @graph arrays
    const items = schema['@graph'] ? schema['@graph'] : [schema];

    for (const item of items) {
      // Check sameAs array
      if (item.sameAs) {
        const sameAsUrls = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];

        for (const url of sameAsUrls) {
          if (typeof url !== 'string') continue;

          // Check social networks
          for (const network of ALL_NETWORKS) {
            const pattern = SOCIAL_PATTERNS[network];
            const match = url.match(pattern);
            if (match) {
              const handle = extractHandleFromMatch(network, match);
              if (!result.socials.has(network)) {
                result.socials.set(network, []);
              }
              result.socials.get(network)!.push({
                url: normalizeUrl(url),
                handle,
                source: 'schema_sameAs',
              });
            }
          }

          // Check GBP patterns
          for (const pattern of GBP_PATTERNS) {
            if (pattern.test(url)) {
              result.gbp.push({ url: normalizeUrl(url), source: 'schema_sameAs' });
              break;
            }
          }
        }
      }

      // Check for LocalBusiness-related schemas with hasMap
      const type = item['@type'];
      const isLocalBusiness =
        type === 'LocalBusiness' ||
        type === 'Restaurant' ||
        type === 'Store' ||
        type === 'Organization' ||
        type === 'Place' ||
        (Array.isArray(type) && type.some(t =>
          ['LocalBusiness', 'Restaurant', 'Store', 'Organization', 'Place'].includes(t)
        ));

      if (isLocalBusiness) {
        // Check hasMap property
        if (item.hasMap) {
          const mapUrl = typeof item.hasMap === 'string' ? item.hasMap : item.hasMap?.['@id'];
          if (mapUrl && isGbpUrl(mapUrl)) {
            result.gbp.push({ url: normalizeUrl(mapUrl), source: 'schema_gbp' });
          }
        }

        // Check url property for GBP
        if (item.url && isGbpUrl(item.url)) {
          result.gbp.push({ url: normalizeUrl(item.url), source: 'schema_url' });
        }

        // Check @id for GBP
        if (item['@id'] && isGbpUrl(item['@id'])) {
          result.gbp.push({ url: normalizeUrl(item['@id']), source: 'schema_gbp' });
        }
      }
    }
  }

  return result;
}

// ============================================================================
// Result Building
// ============================================================================

/**
 * Merge detections from different sources
 */
function mergeDetections(
  socialMap: Map<SocialNetwork, { url?: string; handle?: string; sources: Set<DetectionSource> }>,
  gbpDetections: { url?: string; sources: Set<DetectionSource> },
  newDetections: HtmlDetections | SchemaDetections
): void {
  // Merge social detections
  for (const [network, detections] of newDetections.socials) {
    if (!socialMap.has(network)) {
      socialMap.set(network, { sources: new Set() });
    }
    const existing = socialMap.get(network)!;

    for (const detection of detections) {
      if (!existing.url && detection.url) {
        existing.url = detection.url;
      }
      if (!existing.handle && detection.handle) {
        existing.handle = detection.handle;
      }
      existing.sources.add(detection.source);
    }
  }

  // Merge GBP detections
  for (const detection of newDetections.gbp) {
    if (!gbpDetections.url && detection.url) {
      gbpDetections.url = detection.url;
    }
    gbpDetections.sources.add(detection.source);
  }
}

/**
 * Build final social presence results with confidence scoring
 */
function buildSocialResults(
  detections: Map<SocialNetwork, { url?: string; handle?: string; sources: Set<DetectionSource> }>
): SocialPresence[] {
  const results: SocialPresence[] = [];

  // Always include all networks (with missing status if not detected)
  for (const network of ALL_NETWORKS) {
    const detection = detections.get(network);

    if (detection && detection.sources.size > 0) {
      // Calculate confidence from sources
      let confidence = 0;
      for (const source of detection.sources) {
        confidence += SOCIAL_SOURCE_WEIGHTS[source] ?? 0;
      }
      confidence = Math.min(1, confidence);

      // Map confidence to status
      const status = mapConfidenceToStatus(confidence, 'social');

      results.push({
        network,
        url: detection.url,
        handle: detection.handle,
        detectionSources: Array.from(detection.sources),
        confidence,
        status,
      });
    } else {
      // No detection - mark as missing
      results.push({
        network,
        detectionSources: [],
        confidence: 0,
        status: 'missing',
      });
    }
  }

  return results;
}

/**
 * Build final GBP presence result with confidence scoring
 */
function buildGbpResult(
  detections: { url?: string; sources: Set<DetectionSource> }
): GbpPresence | null {
  if (detections.sources.size === 0) {
    return {
      detectionSources: [],
      confidence: 0,
      status: 'missing',
    };
  }

  // Calculate confidence from sources
  let confidence = 0;
  for (const source of detections.sources) {
    confidence += GBP_SOURCE_WEIGHTS[source] ?? 0;
  }
  confidence = Math.min(1, confidence);

  // Map confidence to status
  const status = mapConfidenceToStatus(confidence, 'gbp');

  return {
    url: detections.url,
    detectionSources: Array.from(detections.sources),
    confidence,
    status,
  };
}

/**
 * Map confidence score to presence status
 */
function mapConfidenceToStatus(
  confidence: number,
  type: 'social' | 'gbp'
): PresenceStatus {
  if (type === 'social') {
    if (confidence >= 0.80) return 'present';
    if (confidence >= 0.60) return 'probable';
    if (confidence >= 0.30) return 'inconclusive';
    return 'missing';
  } else {
    // GBP thresholds (slightly lower for schema-only detection)
    if (confidence >= 0.75) return 'present';
    if (confidence >= 0.50) return 'probable';
    if (confidence >= 0.25) return 'inconclusive';
    return 'missing';
  }
}

/**
 * Calculate overall data confidence
 */
function calculateDataConfidence(
  html: string,
  schemas: any[],
  socials: SocialPresence[],
  gbp: GbpPresence | null
): number {
  // Coverage: how many networks did we actually check?
  const checkedNetworks = socials.filter(s => s.detectionSources.length > 0 || s.status === 'missing').length;
  const coverage = checkedNetworks / ALL_NETWORKS.length;

  // GBP check quality
  let gbpCheck = 0.5; // Default if we parsed HTML
  if (schemas.length > 0) {
    gbpCheck = 0.8; // Better if we also have schema
  }
  if (html.length < 1000) {
    gbpCheck = 0.3; // Low confidence if HTML is very short (likely error)
  }

  // Formula: 30% base + 50% coverage + 20% GBP check quality
  let dataConfidence = 0.3 + 0.5 * coverage + 0.2 * gbpCheck;
  dataConfidence = Math.max(0, Math.min(1, dataConfidence));

  return Math.round(dataConfidence * 100) / 100;
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Compute the socialLocalPresence score (0-100) from detection results
 *
 * Scoring weights:
 * - GBP: 40 points max
 * - Social networks: 60 points max (up to 4 networks, 15 points each)
 */
export function computeSocialLocalPresenceScore(result: SocialDetectionResult): number {
  let score = 0;

  // GBP (weight: 40)
  if (result.gbp) {
    if (result.gbp.status === 'present' || result.gbp.status === 'probable') {
      score += 40 * result.gbp.confidence;
    } else if (result.gbp.status === 'inconclusive') {
      score += 20 * result.gbp.confidence;
    }
  }

  // Socials (weight: 60) - consider up to 4 networks
  const activeSocials = result.socials.filter(
    s => s.status === 'present' || s.status === 'probable'
  );

  const maxNetworks = 4;
  const maxPointsPerNetwork = 60 / maxNetworks; // 15 points each

  for (const social of activeSocials.slice(0, maxNetworks)) {
    score += maxPointsPerNetwork * social.confidence;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract handle from regex match based on network
 */
function extractHandleFromMatch(network: SocialNetwork, match: RegExpMatchArray): string | undefined {
  switch (network) {
    case 'instagram':
    case 'facebook':
      return match[2];
    case 'tiktok':
      return match[2]?.replace(/^@/, '');
    case 'x':
      return match[3];
    case 'linkedin':
      return match[3];
    case 'youtube':
      return match[3];
    default:
      return undefined;
  }
}

/**
 * Normalize URL (lowercase host, remove unnecessary parts)
 * Handles protocol-relative URLs (//example.com) and relative URLs (/path)
 */
function normalizeUrl(url: string, baseUrl?: string): string {
  try {
    let urlToNormalize = url;
    
    // Handle protocol-relative URLs (//maps.google.com)
    if (url.startsWith('//')) {
      urlToNormalize = 'https:' + url;
    }
    // Handle relative URLs (/maps?cid=...)
    else if (url.startsWith('/') && baseUrl) {
      try {
        const base = new URL(baseUrl);
        urlToNormalize = new URL(url, base).toString();
      } catch {
        // If base URL is invalid, try to construct from url
        urlToNormalize = url;
      }
    }
    // Handle URLs without protocol (maps.google.com)
    else if (!url.match(/^https?:\/\//i) && !url.startsWith('/') && baseUrl) {
      try {
        const base = new URL(baseUrl);
        urlToNormalize = new URL(`https://${url}`, base).toString();
      } catch {
        // If construction fails, try adding https://
        if (!url.includes('://')) {
          urlToNormalize = `https://${url}`;
        }
      }
    }
    
    const urlObj = new URL(urlToNormalize);
    urlObj.hostname = urlObj.hostname.toLowerCase();
    // Remove trailing slash except for root
    let normalized = urlObj.toString();
    if (normalized.endsWith('/') && urlObj.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    // If normalization fails, return original URL
    // This handles cases where URL is relative and we don't have baseUrl
    return url;
  }
}

/**
 * Check if URL is a GBP URL
 */
function isGbpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return GBP_PATTERNS.some(pattern => pattern.test(url));
}

// ============================================================================
// Helper Types for External Use
// ============================================================================

/**
 * Build a summary string for GAP IA prompt
 */
export function buildSocialFootprintSummary(result: SocialDetectionResult): string {
  const parts: string[] = [];

  // GBP
  if (result.gbp && result.gbp.status !== 'missing') {
    parts.push(`GBP: ${result.gbp.status} (${Math.round(result.gbp.confidence * 100)}%)`);
  }

  // Socials
  for (const social of result.socials) {
    if (social.status !== 'missing') {
      const handleStr = social.handle ? ` @${social.handle}` : '';
      parts.push(`${social.network}: ${social.status}${handleStr} (${Math.round(social.confidence * 100)}%)`);
    }
  }

  if (parts.length === 0) {
    return 'No social profiles or GBP detected';
  }

  return parts.join('; ');
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  detectFromHtml,
  detectFromSchemas,
  classifyLinkLocation,
  mapConfidenceToStatus,
  calculateDataConfidence,
  isGbpUrl,
  normalizeUrl,
  extractHandleFromMatch,
  SOCIAL_PATTERNS,
  GBP_PATTERNS,
  ALL_NETWORKS,
};
