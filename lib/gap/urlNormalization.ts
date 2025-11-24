/**
 * URL Normalization for GAP-IA caching
 *
 * Provides consistent URL keying for "one URL → one canonical report"
 */

/**
 * Normalize a website URL to a consistent key for caching/lookup
 *
 * Behavior:
 * - Lowercase the hostname
 * - Strip protocol (http://, https://)
 * - Strip leading www.
 * - Strip trailing slash
 * - Strip query parameters and fragments
 * - Preserve path (for future path-sensitive analysis)
 *
 * Examples:
 * - https://qafm.org → qafm.org
 * - http://www.qafm.org/ → qafm.org
 * - https://QAFM.org?foo=bar → qafm.org
 * - https://example.com/about → example.com/about
 *
 * @param input - Raw URL string
 * @returns Normalized URL string for use as a cache key
 */
export function normalizeWebsiteUrl(input: string): string {
  try {
    // Parse the URL
    const url = new URL(input);

    // Start with the hostname (already lowercased by URL constructor)
    let normalized = url.hostname.toLowerCase();

    // Strip leading www.
    normalized = normalized.replace(/^www\./, '');

    // Add path if present and not just "/"
    if (url.pathname && url.pathname !== '/') {
      normalized += url.pathname;
    }

    // Strip trailing slash
    normalized = normalized.replace(/\/$/, '');

    return normalized;
  } catch (error) {
    // If URL parsing fails, do basic string normalization
    console.warn('[urlNormalization] Failed to parse URL, using fallback normalization:', input);

    let normalized = input.toLowerCase();

    // Strip protocol
    normalized = normalized.replace(/^https?:\/\//, '');

    // Strip www.
    normalized = normalized.replace(/^www\./, '');

    // Strip query and fragment
    normalized = normalized.replace(/[?#].*$/, '');

    // Strip trailing slash
    normalized = normalized.replace(/\/$/, '');

    return normalized;
  }
}

/**
 * IA Prompt Version
 *
 * Increment this when the IA prompt logic changes significantly
 * to ensure cached runs aren't served for incompatible prompts
 */
export const IA_PROMPT_VERSION = 'ia-v4';
