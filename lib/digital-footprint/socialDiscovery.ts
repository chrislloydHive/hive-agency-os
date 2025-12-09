// lib/digital-footprint/socialDiscovery.ts
// Robust social media and Google Business Profile detection
//
// This module provides comprehensive detection of social profiles and GBP
// using both on-site signals (HTML, schema.org) and off-site discovery (search).
//
// Usage:
//   const result = await discoverSocialPresence({
//     companyUrl: 'https://example.com',
//     html: homepageHtml,
//     companyName: 'Example Company',
//     locationHint: 'San Francisco, CA',
//   });

// ============================================================================
// Types
// ============================================================================

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'youtube'
  | 'pinterest'
  | 'yelp'
  | 'other';

export type DiscoverySource =
  | 'site_link'
  | 'schema_sameAs'
  | 'schema'
  | 'meta'
  | 'search'
  | 'gbp_link'
  | 'header_footer';

export interface SocialProfile {
  platform: SocialPlatform;
  url: string;
  handle?: string;
  confidence: number; // 0-1
  discoveredFrom: DiscoverySource[];
}

export interface GoogleBusinessProfile {
  url: string;
  confidence: number; // 0-1
  discoveredFrom: DiscoverySource[];
  placeId?: string;
}

export interface SocialDiscoveryResult {
  socialProfiles: SocialProfile[];
  gbp?: GoogleBusinessProfile;

  // Convenience accessors
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasLinkedIn: boolean;
  hasTikTok: boolean;
  hasYouTube: boolean;
  hasGBP: boolean;

  // Aggregated confidence scores (0-100 for context graph)
  socialConfidence: number;
  gbpConfidence: number;

  // Summary for GAP IA prompt
  summary: string;
}

export interface SocialDiscoveryInput {
  companyUrl: string;
  html: string;
  companyName?: string;
  locationHint?: string; // city/state/country for search refinement
}

// ============================================================================
// Platform Detection Patterns
// ============================================================================

const SOCIAL_PLATFORM_PATTERNS: Record<SocialPlatform, RegExp[]> = {
  instagram: [
    /https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi,
  ],
  facebook: [
    /https?:\/\/(www\.|m\.)?facebook\.com\/([a-zA-Z0-9_.]+)\/?/gi,
  ],
  tiktok: [
    /https?:\/\/(www\.)?tiktok\.com\/@?([a-zA-Z0-9_.]+)\/?/gi,
  ],
  x: [
    /https?:\/\/(www\.)?(twitter|x)\.com\/([a-zA-Z0-9_]+)\/?/gi,
  ],
  linkedin: [
    /https?:\/\/(www\.)?linkedin\.com\/(company|in|showcase)\/([a-zA-Z0-9_-]+)\/?/gi,
  ],
  youtube: [
    /https?:\/\/(www\.)?youtube\.com\/(channel|c|user|@)\/([a-zA-Z0-9_-]+)\/?/gi,
    /https?:\/\/(www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)\/?/gi,
  ],
  pinterest: [
    /https?:\/\/(www\.)?pinterest\.com\/([a-zA-Z0-9_]+)\/?/gi,
  ],
  yelp: [
    /https?:\/\/(www\.)?yelp\.com\/biz\/([a-zA-Z0-9_-]+)\/?/gi,
  ],
  other: [],
};

const GBP_PATTERNS: RegExp[] = [
  // Standard Maps URLs
  /https?:\/\/(www\.)?google\.com\/maps\/place\/[^\s"'<>]+/gi,
  /https?:\/\/maps\.google\.com\/[^\s"'<>]+/gi,
  // Short URLs
  /https?:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9]+/gi,
  /https?:\/\/goo\.gl\/maps\/[a-zA-Z0-9]+/gi,
  // G.page URLs (newer format)
  /https?:\/\/g\.page\/[a-zA-Z0-9_-]+\/?/gi,
  // Maps with CID parameter
  /https?:\/\/maps\.google\.com\/\?cid=\d+/gi,
];

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Discover social media presence and Google Business Profile for a company
 *
 * Uses a two-stage approach:
 * 1. On-site detection: Parse HTML for links, schema.org, meta tags
 * 2. Off-site discovery: Search-based fallback for missing profiles
 *
 * @param opts - Discovery input options
 * @returns SocialDiscoveryResult with profiles, GBP, and confidence scores
 */
export async function discoverSocialPresence(
  opts: SocialDiscoveryInput
): Promise<SocialDiscoveryResult> {
  console.log('[SocialDiscovery] Starting discovery for:', opts.companyUrl);

  const profiles: SocialProfile[] = [];
  let gbp: GoogleBusinessProfile | undefined;

  // Stage 1: On-site detection
  const onSiteResult = detectOnSiteSignals(opts.html, opts.companyUrl);

  // Merge on-site profiles
  for (const profile of onSiteResult.profiles) {
    const existing = profiles.find(p => p.platform === profile.platform);
    if (existing) {
      // Merge discovery sources and bump confidence
      existing.discoveredFrom = [...new Set([...existing.discoveredFrom, ...profile.discoveredFrom])];
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      profiles.push(profile);
    }
  }

  if (onSiteResult.gbp) {
    gbp = onSiteResult.gbp;
  }

  console.log('[SocialDiscovery] On-site detection complete:', {
    profilesFound: profiles.length,
    gbpFound: !!gbp,
    platforms: profiles.map(p => p.platform),
  });

  // Stage 2: Off-site discovery (search) for missing high-value platforms
  // Only run if Instagram or GBP not found with high confidence
  const hasHighConfidenceInstagram = profiles.some(
    p => p.platform === 'instagram' && p.confidence >= 0.7
  );
  const hasHighConfidenceGBP = gbp && gbp.confidence >= 0.7;

  if ((!hasHighConfidenceInstagram || !hasHighConfidenceGBP) && opts.companyName) {
    console.log('[SocialDiscovery] Running off-site discovery for missing profiles...');

    const searchResult = await discoverViaSearch({
      companyName: opts.companyName,
      companyUrl: opts.companyUrl,
      locationHint: opts.locationHint,
      searchInstagram: !hasHighConfidenceInstagram,
      searchGBP: !hasHighConfidenceGBP,
    });

    // Merge search-discovered profiles
    for (const profile of searchResult.profiles) {
      const existing = profiles.find(p => p.platform === profile.platform);
      if (existing) {
        existing.discoveredFrom = [...new Set([...existing.discoveredFrom, ...profile.discoveredFrom])];
        existing.confidence = Math.max(existing.confidence, profile.confidence);
      } else {
        profiles.push(profile);
      }
    }

    // Update GBP if search found one with higher confidence
    if (searchResult.gbp) {
      if (!gbp || searchResult.gbp.confidence > gbp.confidence) {
        gbp = searchResult.gbp;
      }
    }

    console.log('[SocialDiscovery] Off-site discovery complete:', {
      additionalProfiles: searchResult.profiles.length,
      gbpFound: !!searchResult.gbp,
    });
  }

  // Build result with convenience accessors
  const result = buildDiscoveryResult(profiles, gbp);

  console.log('[SocialDiscovery] Discovery complete:', {
    hasInstagram: result.hasInstagram,
    hasFacebook: result.hasFacebook,
    hasLinkedIn: result.hasLinkedIn,
    hasGBP: result.hasGBP,
    socialConfidence: result.socialConfidence,
    gbpConfidence: result.gbpConfidence,
  });

  return result;
}

// ============================================================================
// Stage 1: On-Site Detection
// ============================================================================

interface OnSiteResult {
  profiles: SocialProfile[];
  gbp?: GoogleBusinessProfile;
}

/**
 * Detect social profiles and GBP from on-site signals
 */
function detectOnSiteSignals(html: string, baseUrl: string): OnSiteResult {
  const profiles: SocialProfile[] = [];
  let gbp: GoogleBusinessProfile | undefined;

  // 1. Extract all links from HTML
  const linkProfiles = extractLinksFromHtml(html, baseUrl);
  profiles.push(...linkProfiles.socialProfiles);
  if (linkProfiles.gbp) {
    gbp = linkProfiles.gbp;
  }

  // 2. Parse JSON-LD schema.org data
  const schemaProfiles = extractFromSchemaOrg(html);
  for (const profile of schemaProfiles.socialProfiles) {
    const existing = profiles.find(p => p.platform === profile.platform);
    if (existing) {
      existing.discoveredFrom = [...new Set([...existing.discoveredFrom, ...profile.discoveredFrom])];
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      profiles.push(profile);
    }
  }
  if (schemaProfiles.gbp && (!gbp || schemaProfiles.gbp.confidence > gbp.confidence)) {
    gbp = schemaProfiles.gbp;
  }

  // 3. Check meta tags (og:*, twitter:*)
  const metaProfiles = extractFromMetaTags(html);
  for (const profile of metaProfiles) {
    const existing = profiles.find(p => p.platform === profile.platform);
    if (existing) {
      existing.discoveredFrom = [...new Set([...existing.discoveredFrom, ...profile.discoveredFrom])];
      existing.confidence = Math.min(1, existing.confidence + 0.05);
    } else {
      profiles.push(profile);
    }
  }

  return { profiles, gbp };
}

/**
 * Extract social links from HTML anchor tags
 */
function extractLinksFromHtml(
  html: string,
  baseUrl: string
): { socialProfiles: SocialProfile[]; gbp?: GoogleBusinessProfile } {
  const socialProfiles: SocialProfile[] = [];
  let gbp: GoogleBusinessProfile | undefined;

  // Find all href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const matches = html.matchAll(hrefRegex);
  const urls = Array.from(matches, m => m[1]);

  // Also check for common social link patterns in data attributes
  const dataHrefRegex = /data-(?:href|url|link)=["']([^"']+)["']/gi;
  const dataMatches = html.matchAll(dataHrefRegex);
  urls.push(...Array.from(dataMatches, m => m[1]));

  // Detect if URL is in header/footer for confidence boost
  const isInHeaderFooter = (url: string): boolean => {
    const headerMatch = html.match(/<header[^>]*>[\s\S]*?<\/header>/gi);
    const footerMatch = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/gi);
    const navMatch = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/gi);

    const checkContains = (sections: RegExpMatchArray | null) =>
      sections?.some(section => section.includes(url)) ?? false;

    return checkContains(headerMatch) || checkContains(footerMatch) || checkContains(navMatch);
  };

  for (const url of urls) {
    // Check social platforms
    for (const [platform, patterns] of Object.entries(SOCIAL_PLATFORM_PATTERNS)) {
      if (platform === 'other') continue;

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(url);
        if (match) {
          const handle = extractHandle(url, platform as SocialPlatform);
          const inHeaderFooter = isInHeaderFooter(url);
          const baseConfidence = 0.85;
          const confidence = inHeaderFooter ? Math.min(1, baseConfidence + 0.1) : baseConfidence;

          // Check if we already have this platform
          const existing = socialProfiles.find(p => p.platform === platform);
          if (!existing) {
            socialProfiles.push({
              platform: platform as SocialPlatform,
              url: normalizeUrl(url),
              handle,
              confidence,
              discoveredFrom: inHeaderFooter ? ['site_link', 'header_footer'] : ['site_link'],
            });
          }
          break;
        }
      }
    }

    // Check GBP patterns
    for (const pattern of GBP_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(url)) {
        const confidence = 0.9;
        if (!gbp || confidence > gbp.confidence) {
          gbp = {
            url: normalizeUrl(url),
            confidence,
            discoveredFrom: ['site_link'],
          };
        }
        break;
      }
    }
  }

  return { socialProfiles, gbp };
}

/**
 * Extract social profiles from JSON-LD schema.org data
 */
function extractFromSchemaOrg(
  html: string
): { socialProfiles: SocialProfile[]; gbp?: GoogleBusinessProfile } {
  const socialProfiles: SocialProfile[] = [];
  let gbp: GoogleBusinessProfile | undefined;

  // Find all JSON-LD script blocks
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = html.matchAll(jsonLdRegex);

  for (const match of matches) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);

      // Handle both single objects and arrays
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Extract sameAs URLs (social profiles)
        if (item.sameAs) {
          const sameAsUrls = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];

          for (const url of sameAsUrls) {
            if (typeof url !== 'string') continue;

            // Match against social platform patterns
            for (const [platform, patterns] of Object.entries(SOCIAL_PLATFORM_PATTERNS)) {
              if (platform === 'other') continue;

              for (const pattern of patterns) {
                pattern.lastIndex = 0;
                if (pattern.test(url)) {
                  const handle = extractHandle(url, platform as SocialPlatform);
                  const existing = socialProfiles.find(p => p.platform === platform);

                  if (!existing) {
                    socialProfiles.push({
                      platform: platform as SocialPlatform,
                      url: normalizeUrl(url),
                      handle,
                      confidence: 0.95, // Schema.org is highly reliable
                      discoveredFrom: ['schema_sameAs'],
                    });
                  } else {
                    existing.discoveredFrom.push('schema_sameAs');
                    existing.confidence = Math.min(1, existing.confidence + 0.1);
                  }
                  break;
                }
              }
            }
          }
        }

        // Check for LocalBusiness schema with hasMap or @type containing location
        const type = item['@type'];
        const isLocalBusiness =
          type === 'LocalBusiness' ||
          type === 'Restaurant' ||
          type === 'Store' ||
          type === 'Organization' ||
          (Array.isArray(type) && type.some(t =>
            ['LocalBusiness', 'Restaurant', 'Store', 'Organization'].includes(t)
          ));

        if (isLocalBusiness) {
          // Check hasMap property
          if (item.hasMap) {
            const mapUrl = typeof item.hasMap === 'string' ? item.hasMap : item.hasMap?.['@id'];
            if (mapUrl && isGoogleMapsUrl(mapUrl)) {
              if (!gbp || 0.95 > gbp.confidence) {
                gbp = {
                  url: normalizeUrl(mapUrl),
                  confidence: 0.95,
                  discoveredFrom: ['schema'],
                };
              }
            }
          }

          // Check @id for Google Maps URL
          if (item['@id'] && isGoogleMapsUrl(item['@id'])) {
            if (!gbp || 0.9 > gbp.confidence) {
              gbp = {
                url: normalizeUrl(item['@id']),
                confidence: 0.9,
                discoveredFrom: ['schema'],
              };
            }
          }
        }
      }
    } catch (e) {
      // Invalid JSON-LD, skip
      continue;
    }
  }

  return { socialProfiles, gbp };
}

/**
 * Extract social profiles from meta tags
 */
function extractFromMetaTags(html: string): SocialProfile[] {
  const profiles: SocialProfile[] = [];

  // Check for og:see_also, article:author, etc.
  const metaRegex = /<meta[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  const matches = html.matchAll(metaRegex);

  for (const match of matches) {
    const property = match[1].toLowerCase();
    const content = match[2];

    // Check if content is a social URL
    if (property.includes('social') || property.includes('author') || property.includes('see_also')) {
      for (const [platform, patterns] of Object.entries(SOCIAL_PLATFORM_PATTERNS)) {
        if (platform === 'other') continue;

        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          if (pattern.test(content)) {
            const handle = extractHandle(content, platform as SocialPlatform);
            profiles.push({
              platform: platform as SocialPlatform,
              url: normalizeUrl(content),
              handle,
              confidence: 0.75,
              discoveredFrom: ['meta'],
            });
            break;
          }
        }
      }
    }
  }

  return profiles;
}

// ============================================================================
// Stage 2: Off-Site Discovery (Search)
// ============================================================================

interface SearchDiscoveryInput {
  companyName: string;
  companyUrl: string;
  locationHint?: string;
  searchInstagram: boolean;
  searchGBP: boolean;
}

interface SearchDiscoveryResult {
  profiles: SocialProfile[];
  gbp?: GoogleBusinessProfile;
}

/**
 * Discover social profiles and GBP via web search
 */
async function discoverViaSearch(
  opts: SearchDiscoveryInput
): Promise<SearchDiscoveryResult> {
  const profiles: SocialProfile[] = [];
  let gbp: GoogleBusinessProfile | undefined;

  // Extract domain name without TLD for search queries
  const domain = extractDomainName(opts.companyUrl);

  // Search for Instagram if needed
  if (opts.searchInstagram) {
    const instagramProfile = await searchForInstagram({
      companyName: opts.companyName,
      domain,
      locationHint: opts.locationHint,
    });
    if (instagramProfile) {
      profiles.push(instagramProfile);
    }
  }

  // Search for GBP if needed
  if (opts.searchGBP) {
    const gbpResult = await searchForGBP({
      companyName: opts.companyName,
      domain,
      locationHint: opts.locationHint,
    });
    if (gbpResult) {
      gbp = gbpResult;
    }
  }

  return { profiles, gbp };
}

/**
 * Search for Instagram profile
 */
async function searchForInstagram(opts: {
  companyName: string;
  domain: string;
  locationHint?: string;
}): Promise<SocialProfile | undefined> {
  // Build search queries
  const queries = [
    `"${opts.companyName}" instagram`,
    opts.locationHint ? `"${opts.companyName}" "${opts.locationHint}" instagram` : null,
    `site:instagram.com "${opts.companyName}"`,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    try {
      const result = await performWebSearch(query, 3);

      for (const item of result) {
        // Check if this is an Instagram URL
        const instagramPattern = /https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/i;
        const match = item.url.match(instagramPattern);

        if (match) {
          const handle = match[2];

          // Validate: Does the profile seem to match the company?
          const nameWords = opts.companyName.toLowerCase().split(/\s+/);
          const handleLower = handle.toLowerCase();
          const titleLower = (item.title || '').toLowerCase();
          const snippetLower = (item.snippet || '').toLowerCase();

          // Check if company name appears in handle, title, or snippet
          const nameInHandle = nameWords.some(word =>
            word.length > 2 && handleLower.includes(word)
          );
          const nameInTitle = nameWords.some(word =>
            word.length > 2 && titleLower.includes(word)
          );
          const nameInSnippet = nameWords.some(word =>
            word.length > 2 && snippetLower.includes(word)
          );

          // Check if location appears in snippet (if provided)
          const locationMatches = opts.locationHint
            ? snippetLower.includes(opts.locationHint.toLowerCase().split(',')[0])
            : true;

          if ((nameInHandle || nameInTitle || nameInSnippet) && locationMatches) {
            // Calculate confidence based on match quality
            let confidence = 0.6;
            if (nameInHandle) confidence += 0.2;
            if (nameInTitle) confidence += 0.1;
            if (opts.locationHint && locationMatches) confidence += 0.1;

            console.log('[SocialDiscovery] Found Instagram via search:', {
              handle,
              confidence,
              query,
            });

            return {
              platform: 'instagram',
              url: `https://instagram.com/${handle}`,
              handle,
              confidence: Math.min(0.85, confidence),
              discoveredFrom: ['search'],
            };
          }
        }
      }
    } catch (e) {
      console.warn('[SocialDiscovery] Instagram search failed for query:', query, e);
      continue;
    }
  }

  return undefined;
}

/**
 * Search for Google Business Profile
 */
async function searchForGBP(opts: {
  companyName: string;
  domain: string;
  locationHint?: string;
}): Promise<GoogleBusinessProfile | undefined> {
  // Build search queries
  const queries = [
    `"${opts.companyName}" "Google Maps"`,
    opts.locationHint ? `"${opts.companyName}" "${opts.locationHint}" "Google Maps"` : null,
    `site:google.com/maps "${opts.companyName}"`,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    try {
      const result = await performWebSearch(query, 3);

      for (const item of result) {
        // Check if this is a Google Maps URL
        if (isGoogleMapsUrl(item.url)) {
          // Validate: Does the result seem to match the company?
          const nameWords = opts.companyName.toLowerCase().split(/\s+/);
          const titleLower = (item.title || '').toLowerCase();
          const snippetLower = (item.snippet || '').toLowerCase();

          const nameInTitle = nameWords.some(word =>
            word.length > 2 && titleLower.includes(word)
          );
          const nameInSnippet = nameWords.some(word =>
            word.length > 2 && snippetLower.includes(word)
          );

          if (nameInTitle || nameInSnippet) {
            let confidence = 0.6;
            if (nameInTitle) confidence += 0.15;
            if (nameInSnippet) confidence += 0.1;
            if (opts.locationHint) {
              const locationInSnippet = snippetLower.includes(
                opts.locationHint.toLowerCase().split(',')[0]
              );
              if (locationInSnippet) confidence += 0.1;
            }

            console.log('[SocialDiscovery] Found GBP via search:', {
              url: item.url,
              confidence,
              query,
            });

            return {
              url: item.url,
              confidence: Math.min(0.85, confidence),
              discoveredFrom: ['search'],
            };
          }
        }
      }
    } catch (e) {
      console.warn('[SocialDiscovery] GBP search failed for query:', query, e);
      continue;
    }
  }

  return undefined;
}

/**
 * Perform a web search (placeholder - uses simple fetch-based approach)
 */
async function performWebSearch(
  query: string,
  maxResults: number
): Promise<Array<{ url: string; title?: string; snippet?: string }>> {
  // Note: This is a simplified implementation. In production, you'd want to use
  // a proper search API (Google Custom Search, Bing, SerpAPI, etc.)
  //
  // For now, we'll return empty results and rely on on-site detection.
  // The search functionality can be enabled by implementing the actual API call.

  console.log('[SocialDiscovery] Web search not implemented, query:', query);
  return [];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract handle/username from a social profile URL
 */
function extractHandle(url: string, platform: SocialPlatform): string | undefined {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    switch (platform) {
      case 'instagram':
      case 'facebook':
      case 'pinterest':
        // /username or /username/
        const simplePath = path.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
        return simplePath || undefined;

      case 'tiktok':
        // /@username
        const tiktokMatch = path.match(/^\/@?([a-zA-Z0-9_.]+)/);
        return tiktokMatch?.[1];

      case 'x':
        // /username
        const xMatch = path.match(/^\/([a-zA-Z0-9_]+)/);
        return xMatch?.[1];

      case 'linkedin':
        // /company/name or /in/name
        const linkedinMatch = path.match(/^\/(company|in|showcase)\/([a-zA-Z0-9_-]+)/);
        return linkedinMatch?.[2];

      case 'youtube':
        // /channel/id, /c/name, /@name, /user/name
        const ytMatch = path.match(/^\/(channel|c|user|@)?\/?\/?([a-zA-Z0-9_-]+)/);
        return ytMatch?.[2];

      case 'yelp':
        // /biz/business-name
        const yelpMatch = path.match(/^\/biz\/([a-zA-Z0-9_-]+)/);
        return yelpMatch?.[1];

      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Normalize a URL (lowercase host, remove trailing slash)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.hostname = urlObj.hostname.toLowerCase();
    let normalized = urlObj.toString();
    // Remove trailing slash for consistency
    if (normalized.endsWith('/') && urlObj.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is a Google Maps URL
 */
function isGoogleMapsUrl(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return (
    urlLower.includes('google.com/maps') ||
    urlLower.includes('maps.google.com') ||
    urlLower.includes('maps.app.goo.gl') ||
    urlLower.includes('goo.gl/maps') ||
    urlLower.includes('g.page/')
  );
}

/**
 * Extract domain name from URL (without TLD)
 */
function extractDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    // Remove TLD
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(0, -1).join('.');
    }
    return hostname;
  } catch {
    return url;
  }
}

// ============================================================================
// Result Builder
// ============================================================================

/**
 * Build the final SocialDiscoveryResult with convenience accessors
 */
function buildDiscoveryResult(
  profiles: SocialProfile[],
  gbp?: GoogleBusinessProfile
): SocialDiscoveryResult {
  // Find best profile per platform (highest confidence)
  const bestProfiles = new Map<SocialPlatform, SocialProfile>();
  for (const profile of profiles) {
    const existing = bestProfiles.get(profile.platform);
    if (!existing || profile.confidence > existing.confidence) {
      bestProfiles.set(profile.platform, profile);
    }
  }

  const uniqueProfiles = Array.from(bestProfiles.values());

  // Calculate aggregated social confidence (average of top profiles)
  const socialConfidences = uniqueProfiles.map(p => p.confidence);
  const socialConfidence = socialConfidences.length > 0
    ? Math.round((socialConfidences.reduce((a, b) => a + b, 0) / socialConfidences.length) * 100)
    : 0;

  const gbpConfidence = gbp ? Math.round(gbp.confidence * 100) : 0;

  // Build summary for GAP IA prompt
  const summaryParts: string[] = [];

  const instagram = bestProfiles.get('instagram');
  const facebook = bestProfiles.get('facebook');
  const linkedin = bestProfiles.get('linkedin');
  const tiktok = bestProfiles.get('tiktok');
  const youtube = bestProfiles.get('youtube');

  if (instagram && instagram.confidence >= 0.7) {
    summaryParts.push(`Instagram: ${instagram.handle || 'found'} (${Math.round(instagram.confidence * 100)}% confidence)`);
  }
  if (facebook && facebook.confidence >= 0.7) {
    summaryParts.push(`Facebook: found (${Math.round(facebook.confidence * 100)}% confidence)`);
  }
  if (linkedin && linkedin.confidence >= 0.7) {
    summaryParts.push(`LinkedIn: ${linkedin.handle || 'found'} (${Math.round(linkedin.confidence * 100)}% confidence)`);
  }
  if (tiktok && tiktok.confidence >= 0.7) {
    summaryParts.push(`TikTok: ${tiktok.handle || 'found'} (${Math.round(tiktok.confidence * 100)}% confidence)`);
  }
  if (youtube && youtube.confidence >= 0.7) {
    summaryParts.push(`YouTube: found (${Math.round(youtube.confidence * 100)}% confidence)`);
  }
  if (gbp && gbp.confidence >= 0.7) {
    summaryParts.push(`Google Business Profile: found (${Math.round(gbp.confidence * 100)}% confidence)`);
  }

  const summary = summaryParts.length > 0
    ? `Detected: ${summaryParts.join('; ')}`
    : 'No high-confidence social profiles or GBP detected';

  return {
    socialProfiles: uniqueProfiles,
    gbp,
    hasInstagram: !!(instagram && instagram.confidence >= 0.5),
    hasFacebook: !!(facebook && facebook.confidence >= 0.5),
    hasLinkedIn: !!(linkedin && linkedin.confidence >= 0.5),
    hasTikTok: !!(tiktok && tiktok.confidence >= 0.5),
    hasYouTube: !!(youtube && youtube.confidence >= 0.5),
    hasGBP: !!(gbp && gbp.confidence >= 0.5),
    socialConfidence,
    gbpConfidence,
    summary,
  };
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  extractLinksFromHtml,
  extractFromSchemaOrg,
  extractFromMetaTags,
  extractHandle,
  normalizeUrl,
  isGoogleMapsUrl,
  buildDiscoveryResult,
};
