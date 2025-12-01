// lib/analytics/searchLinks.ts
// Helper functions for generating external search links

/**
 * Generate a Google search URL for a query with a site: filter
 * @param query - The search query
 * @param websiteUrl - The website URL (e.g., "https://example.com")
 * @returns The Google search URL
 */
export function getGoogleSearchUrl(query: string, websiteUrl: string | undefined): string {
  if (!websiteUrl) {
    // Just search for the query without site filter
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./, '');
    return `https://www.google.com/search?q=${encodeURIComponent(query)}+site:${domain}`;
  } catch {
    // If URL parsing fails, just search for the query
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}

/**
 * Generate a Google Search Console performance URL for a specific query
 * Note: This requires the user to be logged into GSC with access to the property
 * @param query - The search query
 * @param siteUrl - The Search Console site URL (e.g., "sc-domain:example.com")
 * @returns The Google Search Console URL or null if not available
 */
export function getSearchConsoleQueryUrl(
  query: string,
  siteUrl: string | undefined
): string | null {
  if (!siteUrl) return null;

  // GSC URLs use encoded site URLs
  const encodedSite = encodeURIComponent(siteUrl);
  const encodedQuery = encodeURIComponent(query);

  return `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodedSite}&query=*${encodedQuery}*`;
}

/**
 * External link component props helper
 */
export interface QueryExternalLinks {
  googleSearch: string;
  searchConsole: string | null;
}

/**
 * Get all external links for a search query
 */
export function getQueryExternalLinks(
  query: string,
  websiteUrl: string | undefined,
  gscSiteUrl?: string
): QueryExternalLinks {
  return {
    googleSearch: getGoogleSearchUrl(query, websiteUrl),
    searchConsole: getSearchConsoleQueryUrl(query, gscSiteUrl),
  };
}
