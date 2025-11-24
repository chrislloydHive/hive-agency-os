/**
 * Competitor Intelligence Heuristics
 *
 * Lightweight competitor detection from outbound links in HTML:
 * - Identifies potential competitors from external links
 * - Classifies as direct, adjacent, or inspirational
 * - Provides context and reasoning
 *
 * Never throws - always returns safe defaults
 */

export type CompetitorType = 'direct' | 'adjacent' | 'inspirational';

export interface Competitor {
  name: string;
  url: string;
  type?: CompetitorType;
  reason?: string;
}

export interface CompetitorHeuristicsInput {
  htmlSnippet: string;
  url: string; // current site
}

export interface CompetitorHeuristicsOutput {
  primaryCompetitors: Competitor[];
  competitorCount: number;
  notes?: string;
}

/**
 * Platforms and services to exclude from competitor detection
 */
const EXCLUDED_DOMAINS = new Set([
  // Social platforms
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'vimeo.com',
  'tiktok.com',
  'pinterest.com',
  'reddit.com',
  'medium.com',

  // Google services
  'google.com',
  'goo.gl',
  'maps.google.com',
  'g.page',

  // Infrastructure
  'cloudflare.com',
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',

  // Common services
  'mailchimp.com',
  'hubspot.com',
  'salesforce.com',
  'zendesk.com',
  'intercom.com',
  'stripe.com',
  'paypal.com',

  // CDN and utilities
  'cloudinary.com',
  'gravatar.com',
  'wordpress.com',
  'wix.com',
  'squarespace.com',

  // Other
  'wikipedia.org',
  'w3.org',
  'schema.org',
]);

/**
 * Known industry leaders (for inspirational classification)
 */
const INDUSTRY_LEADERS = new Set([
  'apple.com',
  'google.com',
  'microsoft.com',
  'amazon.com',
  'shopify.com',
  'salesforce.com',
  'hubspot.com',
  'stripe.com',
  'airbnb.com',
  'uber.com',
  'netflix.com',
  'spotify.com',
  'adobe.com',
]);

/**
 * Extract hostname from URL
 */
function extractHostname(url: string): string | null {
  try {
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    // Handle relative URLs (skip these)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }

    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();

    // Remove www prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    return hostname;
  } catch {
    return null;
  }
}

/**
 * Extract company name from hostname
 */
function extractCompanyName(hostname: string): string {
  // Remove TLD
  const parts = hostname.split('.');
  if (parts.length > 1) {
    // Get the part before the TLD
    const name = parts[parts.length - 2];
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return hostname.charAt(0).toUpperCase() + hostname.slice(1);
}

/**
 * Check if a domain should be excluded
 */
function shouldExclude(hostname: string, currentHostname: string): boolean {
  // Exclude current site
  if (hostname === currentHostname) {
    return true;
  }

  // Check against excluded domains
  for (const excluded of Array.from(EXCLUDED_DOMAINS)) {
    if (hostname === excluded || hostname.endsWith('.' + excluded)) {
      return true;
    }
  }

  return false;
}

/**
 * Classify competitor type based on context
 */
function classifyCompetitor(
  hostname: string,
  context: string,
  currentHostname: string
): { type: CompetitorType; reason?: string } {
  // Check for competitive language in context
  const lowerContext = context.toLowerCase();
  const competitiveKeywords = [
    'compare',
    'alternative',
    'vs',
    'versus',
    'competitor',
    'competing',
    'rival',
  ];

  const hasCompetitiveKeyword = competitiveKeywords.some(keyword =>
    lowerContext.includes(keyword)
  );

  // Check if it's an industry leader
  const isLeader = INDUSTRY_LEADERS.has(hostname);

  if (hasCompetitiveKeyword) {
    return {
      type: 'direct',
      reason: 'Mentioned in competitive context',
    };
  }

  if (isLeader) {
    return {
      type: 'inspirational',
      reason: 'Industry-leading company',
    };
  }

  return {
    type: 'adjacent',
    reason: 'Related company from outbound links',
  };
}

/**
 * Extract context around a URL (surrounding text)
 */
function extractContext(html: string, url: string, contextLength: number = 100): string {
  const index = html.indexOf(url);
  if (index === -1) return '';

  const start = Math.max(0, index - contextLength);
  const end = Math.min(html.length, index + url.length + contextLength);

  return html.substring(start, end);
}

/**
 * Extract all external links from HTML
 */
function extractExternalLinks(html: string): string[] {
  const links: string[] = [];

  // Match href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      links.push(url);
    }
  }

  return links;
}

/**
 * Main competitor detection function
 *
 * Never throws - always returns safe defaults
 */
export function getCompetitorSummary(
  input: CompetitorHeuristicsInput
): CompetitorHeuristicsOutput {
  try {
    const { htmlSnippet, url } = input;

    if (!htmlSnippet || htmlSnippet.length === 0) {
      return {
        primaryCompetitors: [],
        competitorCount: 0,
        notes: 'No HTML content available to analyze competitors.',
      };
    }

    // Extract current hostname
    const currentHostname = extractHostname(url);
    if (!currentHostname) {
      return {
        primaryCompetitors: [],
        competitorCount: 0,
        notes: 'Unable to parse current site URL.',
      };
    }

    // Extract all external links
    const externalLinks = extractExternalLinks(htmlSnippet);

    // Process links to find competitors
    const hostnameMap = new Map<string, { url: string; context: string }>();

    for (const link of externalLinks) {
      const hostname = extractHostname(link);
      if (!hostname) continue;

      // Skip excluded domains
      if (shouldExclude(hostname, currentHostname)) continue;

      // Store first occurrence of each hostname with context
      if (!hostnameMap.has(hostname)) {
        const context = extractContext(htmlSnippet, link);
        hostnameMap.set(hostname, { url: link, context });
      }
    }

    // Convert to competitor objects
    const competitors: Competitor[] = [];

    for (const [hostname, { url: competitorUrl, context }] of Array.from(hostnameMap.entries())) {
      const name = extractCompanyName(hostname);
      const classification = classifyCompetitor(hostname, context, currentHostname);

      competitors.push({
        name,
        url: `https://${hostname}`,
        type: classification.type,
        reason: classification.reason,
      });

      // Limit to 5 competitors
      if (competitors.length >= 5) break;
    }

    // Generate notes
    let notes: string;
    if (competitors.length === 0) {
      notes = 'No obvious competitors detected from homepage; you may need manual competitor research.';
    } else {
      const typeCount = {
        direct: competitors.filter(c => c.type === 'direct').length,
        adjacent: competitors.filter(c => c.type === 'adjacent').length,
        inspirational: competitors.filter(c => c.type === 'inspirational').length,
      };

      const parts: string[] = [];
      if (typeCount.direct > 0) parts.push(`${typeCount.direct} direct`);
      if (typeCount.adjacent > 0) parts.push(`${typeCount.adjacent} adjacent`);
      if (typeCount.inspirational > 0) parts.push(`${typeCount.inspirational} inspirational`);

      notes = `Detected ${competitors.length} potential competitor(s) via outbound links: ${parts.join(', ')}.`;
    }

    return {
      primaryCompetitors: competitors,
      competitorCount: competitors.length,
      notes,
    };
  } catch (error) {
    console.error('[Competitor Heuristics] Error:', error);
    return {
      primaryCompetitors: [],
      competitorCount: 0,
      notes: 'Unable to detect competitors from the homepage HTML.',
    };
  }
}
