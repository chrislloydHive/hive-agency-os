// lib/os/detection/discoverPages.ts
// Multi-page discovery with depth-2 crawling

import type { DiscoveryResult, DiscoveredPage, MissingPage } from './types';
import { EXPECTED_PAGES } from './types';

/**
 * Options for page discovery
 */
interface DiscoverPagesOptions {
  startUrl: string;
  maxDepth?: number;
  maxPages?: number;
  timeout?: number;
  fetchFn?: (url: string) => Promise<{ html: string; status: number }>;
}

/**
 * Extract internal links from HTML
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  try {
    const base = new URL(baseUrl);
    const baseDomain = base.hostname;

    // Match href attributes
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];

      // Skip non-http links
      if (href.startsWith('mailto:') || href.startsWith('tel:') ||
          href.startsWith('javascript:') || href.startsWith('#')) {
        continue;
      }

      try {
        // Resolve relative URLs
        const resolved = new URL(href, baseUrl);

        // Only include same-domain links
        if (resolved.hostname === baseDomain || resolved.hostname === `www.${baseDomain}`) {
          // Normalize URL
          resolved.hash = '';
          const normalized = resolved.toString();

          // Skip already seen
          if (!seen.has(normalized)) {
            seen.add(normalized);
            links.push(normalized);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  } catch {
    // Invalid base URL
  }

  return links;
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Count links on a page
 */
function countLinks(html: string): number {
  const matches = html.match(/<a\s/gi);
  return matches ? matches.length : 0;
}

/**
 * Default fetch function using native fetch
 */
async function defaultFetch(url: string): Promise<{ html: string; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HiveOS-Crawler/1.0',
        'Accept': 'text/html',
      },
    });

    const html = await response.text();
    return { html, status: response.status };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Normalize path for comparison
 */
function normalizePath(path: string): string {
  // Remove leading/trailing slashes and lowercase
  return path.replace(/^\/+|\/+$/g, '').toLowerCase();
}

/**
 * Check if a discovered URL matches an expected path
 */
function matchesExpectedPath(url: string, expectedPath: string): boolean {
  try {
    const parsed = new URL(url);
    const urlPath = normalizePath(parsed.pathname);
    const expected = normalizePath(expectedPath);

    // Exact match
    if (urlPath === expected) return true;

    // Partial match (e.g., /about-us matches /about)
    if (urlPath.startsWith(expected)) return true;

    // Common variations
    const variations: Record<string, string[]> = {
      'about': ['about-us', 'about-company', 'our-story', 'who-we-are'],
      'contact': ['contact-us', 'get-in-touch', 'reach-us'],
      'services': ['our-services', 'what-we-do'],
      'products': ['our-products', 'shop', 'store'],
      'blog': ['news', 'articles', 'insights', 'resources'],
      'team': ['our-team', 'about-us/team', 'people', 'leadership'],
      'faq': ['faqs', 'help', 'support', 'questions'],
      'privacy': ['privacy-policy', 'privacy-notice'],
      'terms': ['terms-of-service', 'tos', 'terms-and-conditions'],
    };

    const expectedBase = expected.replace(/^\//, '');
    const urlPathBase = urlPath.replace(/^\//, '');

    if (variations[expectedBase]) {
      if (variations[expectedBase].some(v => urlPathBase.includes(v))) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Discover pages starting from a URL
 */
export async function discoverPages(options: DiscoverPagesOptions): Promise<DiscoveryResult> {
  const {
    startUrl,
    maxDepth = 2,
    maxPages = 50,
    fetchFn = defaultFetch,
  } = options;

  const discoveredPages: DiscoveredPage[] = [];
  const visited = new Set<string>();
  const errors: string[] = [];
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  try {
    while (queue.length > 0 && discoveredPages.length < maxPages) {
      const { url, depth } = queue.shift()!;

      // Skip if already visited
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const { html, status } = await fetchFn(url);

        const page: DiscoveredPage = {
          url,
          depth,
          status,
          title: extractTitle(html),
          type: 'internal',
          linkCount: countLinks(html),
        };

        discoveredPages.push(page);

        // If we haven't reached max depth, queue internal links
        if (depth < maxDepth) {
          const internalLinks = extractInternalLinks(html, url);

          for (const link of internalLinks) {
            if (!visited.has(link) && !queue.some(q => q.url === link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        // Page failed to load
        discoveredPages.push({
          url,
          depth,
          status: null,
          title: null,
          type: 'internal',
          linkCount: 0,
        });

        errors.push(`fetch-error: Failed to fetch ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    errors.push(`discovery-error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check for missing expected pages
  const missingPages: MissingPage[] = [];
  const foundPaths = discoveredPages.map(p => {
    try {
      return new URL(p.url).pathname;
    } catch {
      return '';
    }
  });

  for (const expected of EXPECTED_PAGES) {
    const found = discoveredPages.some(p => matchesExpectedPath(p.url, expected.path));

    if (!found) {
      missingPages.push({
        path: expected.path,
        importance: expected.importance,
        reason: expected.reason,
      });
    }
  }

  // Calculate confidence
  const expectedCount = EXPECTED_PAGES.filter(p =>
    p.importance === 'critical' || p.importance === 'high'
  ).length;
  const foundImportant = EXPECTED_PAGES.filter(p =>
    (p.importance === 'critical' || p.importance === 'high') &&
    discoveredPages.some(d => matchesExpectedPath(d.url, p.path))
  ).length;

  const completenessScore = expectedCount > 0 ? (foundImportant / expectedCount) * 100 : 50;
  const successRate = discoveredPages.filter(p => p.status === 200).length / Math.max(discoveredPages.length, 1) * 100;
  const confidence = Math.round((completenessScore * 0.6) + (successRate * 0.4));

  return {
    discoveredPages,
    missingPages,
    totalLinksFound: discoveredPages.reduce((sum, p) => sum + p.linkCount, 0),
    maxDepthReached: Math.max(...discoveredPages.map(p => p.depth), 0),
    confidence,
    errors,
  };
}

/**
 * Get a quick page inventory without deep crawling
 */
export function analyzeHomepageLinks(html: string, baseUrl: string): {
  internalLinks: string[];
  externalLinks: string[];
  socialLinks: string[];
  foundExpectedPages: string[];
  missingExpectedPages: string[];
} {
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const socialLinks: string[] = [];

  try {
    const base = new URL(baseUrl);
    const baseDomain = base.hostname.replace('www.', '');

    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    const socialDomains = [
      'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
      'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
    ];

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];

      if (href.startsWith('mailto:') || href.startsWith('tel:') ||
          href.startsWith('javascript:') || href.startsWith('#')) {
        continue;
      }

      try {
        const resolved = new URL(href, baseUrl);
        const linkDomain = resolved.hostname.replace('www.', '');

        // Check if social
        if (socialDomains.some(d => linkDomain.includes(d))) {
          socialLinks.push(resolved.toString());
        }
        // Check if internal
        else if (linkDomain === baseDomain) {
          internalLinks.push(resolved.toString());
        }
        // External
        else if (resolved.protocol.startsWith('http')) {
          externalLinks.push(resolved.toString());
        }
      } catch {
        // Invalid URL
      }
    }
  } catch {
    // Invalid base URL
  }

  // Check expected pages
  const foundExpectedPages: string[] = [];
  const missingExpectedPages: string[] = [];

  for (const expected of EXPECTED_PAGES) {
    const found = internalLinks.some(link => matchesExpectedPath(link, expected.path));
    if (found) {
      foundExpectedPages.push(expected.path);
    } else {
      missingExpectedPages.push(expected.path);
    }
  }

  return {
    internalLinks: [...new Set(internalLinks)],
    externalLinks: [...new Set(externalLinks)],
    socialLinks: [...new Set(socialLinks)],
    foundExpectedPages,
    missingExpectedPages,
  };
}
