// lib/gap/urlDiscovery.ts
// Shallow multi-URL discovery for GAP-IA content intelligence

import type { DiscoveredPageType, DiscoveredPageSnippet } from './types';

// ============================================================================
// Constants
// ============================================================================

const SNIPPET_MAX_CHARS = 2500;

const DISCOVERY_KEYWORDS: { type: DiscoveredPageType; patterns: RegExp[] }[] = [
  {
    type: 'blog',
    patterns: [/blog/i, /insight/i, /article/i, /news/i, /post/i],
  },
  {
    type: 'pricing',
    patterns: [/pricing/i, /plans/i, /plan/i, /fees/i, /subscribe/i],
  },
  {
    type: 'resource',
    patterns: [/resource/i, /library/i, /guide/i, /ebook/i, /whitepaper/i, /download/i],
  },
  {
    type: 'case_study',
    patterns: [/case-stud/i, /case stud/i, /stories/i, /success/i, /customer/i, /client/i],
  },
  {
    type: 'services',
    patterns: [/service/i, /solution/i, /what-we-do/i, /offerings/i, /product/i],
  },
];

// ============================================================================
// Types
// ============================================================================

interface DiscoveredUrl {
  url: string;
  type: DiscoveredPageType;
  path: string;
}

// ============================================================================
// URL Discovery
// ============================================================================

/**
 * Extract and classify candidate URLs from homepage HTML
 */
export function discoverCandidateUrls(
  homepageHtml: string,
  baseUrl: URL,
  maxUrls = 5
): DiscoveredUrl[] {
  const discovered = new Map<string, DiscoveredUrl>();

  // Enhanced regex to find all href attributes, including those in buttons, divs, etc.
  // Pattern 1: Standard <a> tags with text content
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  // Pattern 2: Any element with href (catches Next.js Link components, buttons, etc.)
  const hrefRegex = /href=["']([^"']+)["']/gi;

  // First pass: Extract from <a> tags with link text
  let match;
  while ((match = linkRegex.exec(homepageHtml)) !== null) {
    const href = match[1];
    const linkText = match[2] || '';

    try {
      // Normalize to absolute URL
      const absoluteUrl = new URL(href, baseUrl.toString());

      // Only keep same-domain links
      if (absoluteUrl.hostname !== baseUrl.hostname) {
        continue;
      }

      // Skip common non-content URLs
      if (
        absoluteUrl.pathname === '/' ||
        absoluteUrl.pathname.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js)$/i) ||
        absoluteUrl.pathname.includes('/cdn-cgi/') ||
        absoluteUrl.pathname.includes('/#') ||
        absoluteUrl.hash.startsWith('#')
      ) {
        continue;
      }

      // Classify the URL based on href and link text
      const type = classifyUrl(absoluteUrl.pathname, href, linkText);

      // Deduplicate by path
      const path = absoluteUrl.pathname;
      if (!discovered.has(path)) {
        discovered.set(path, {
          url: absoluteUrl.toString(),
          type,
          path,
        });
      }
    } catch {
      // Invalid URL, skip
      continue;
    }
  }

  // Second pass: Extract all href attributes (catches JS-rendered navigation)
  while ((match = hrefRegex.exec(homepageHtml)) !== null) {
    const href = match[1];

    try {
      // Normalize to absolute URL
      const absoluteUrl = new URL(href, baseUrl.toString());

      // Only keep same-domain links
      if (absoluteUrl.hostname !== baseUrl.hostname) {
        continue;
      }

      // Skip common non-content URLs
      if (
        absoluteUrl.pathname === '/' ||
        absoluteUrl.pathname.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js)$/i) ||
        absoluteUrl.pathname.includes('/cdn-cgi/') ||
        absoluteUrl.pathname.includes('/#') ||
        absoluteUrl.hash.startsWith('#')
      ) {
        continue;
      }

      // Classify based on path only (no link text available)
      const type = classifyUrl(absoluteUrl.pathname, href, '');

      // Only add if not already discovered
      const path = absoluteUrl.pathname;
      if (!discovered.has(path)) {
        discovered.set(path, {
          url: absoluteUrl.toString(),
          type,
          path,
        });
      }
    } catch {
      // Invalid URL, skip
      continue;
    }
  }

  // Add common paths as fallback if not already discovered
  // This catches blogs/pricing pages that exist but aren't linked in nav
  const commonPaths = [
    { path: '/blog', type: 'blog' as DiscoveredPageType },
    { path: '/blog/', type: 'blog' as DiscoveredPageType },
    { path: '/insights', type: 'blog' as DiscoveredPageType },
    { path: '/articles', type: 'blog' as DiscoveredPageType },
    { path: '/news', type: 'blog' as DiscoveredPageType },
    { path: '/pricing', type: 'pricing' as DiscoveredPageType },
    { path: '/plans', type: 'pricing' as DiscoveredPageType },
    { path: '/resources', type: 'resource' as DiscoveredPageType },
    { path: '/case-studies', type: 'case_study' as DiscoveredPageType },
    { path: '/customers', type: 'case_study' as DiscoveredPageType },
  ];

  for (const commonPath of commonPaths) {
    if (!discovered.has(commonPath.path) && !discovered.has(commonPath.path.replace(/\/$/, ''))) {
      // Add as a candidate - will be validated when fetched
      discovered.set(commonPath.path, {
        url: new URL(commonPath.path, baseUrl.toString()).toString(),
        type: commonPath.type,
        path: commonPath.path,
      });
    }
  }

  // Convert to array and prioritize by type
  const typePriority: Record<DiscoveredPageType, number> = {
    blog: 1,
    pricing: 2,
    resource: 3,
    case_study: 4,
    services: 5,
    other: 6,
  };

  const sorted = Array.from(discovered.values()).sort((a, b) => {
    return typePriority[a.type] - typePriority[b.type];
  });

  // Return top N URLs
  return sorted.slice(0, maxUrls);
}

/**
 * Classify a URL based on patterns in the path, href, and link text
 */
function classifyUrl(
  pathname: string,
  href: string,
  linkText: string
): DiscoveredPageType {
  const combined = `${pathname} ${href} ${linkText}`.toLowerCase();

  for (const { type, patterns } of DISCOVERY_KEYWORDS) {
    if (patterns.some((pattern) => pattern.test(combined))) {
      return type;
    }
  }

  return 'other';
}

// ============================================================================
// Page Fetching
// ============================================================================

/**
 * Fetch a tiny, fast snippet of HTML for a discovered URL
 */
export async function fetchPageSnippet(
  url: string,
  type: DiscoveredPageType
): Promise<DiscoveredPageSnippet | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const text = await res.text();

    // Try to extract <title> tag
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Truncate snippet
    const snippet = text.slice(0, SNIPPET_MAX_CHARS);

    const u = new URL(url);

    return {
      url,
      type,
      path: u.pathname || '/',
      title,
      snippet,
    };
  } catch (error) {
    // Timeout or network error - skip this URL
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[url-discovery] Failed to fetch snippet for ${url}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    return null;
  }
}

/**
 * Fetch multiple page snippets in parallel with a concurrency limit
 */
export async function fetchPageSnippets(
  urls: DiscoveredUrl[],
  maxConcurrent = 3
): Promise<DiscoveredPageSnippet[]> {
  const results: DiscoveredPageSnippet[] = [];

  // Process in batches to limit concurrency
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const promises = batch.map((u) => fetchPageSnippet(u.url, u.type));
    const snippets = await Promise.all(promises);

    // Filter out failed fetches
    const successful = snippets.filter(
      (s): s is DiscoveredPageSnippet => s !== null
    );
    results.push(...successful);
  }

  return results;
}
