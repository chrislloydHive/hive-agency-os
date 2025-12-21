// lib/utils/urls.ts
// Central URL normalization for Labs/GAP runners
//
// All diagnostic tools (WebsiteLab, BrandLab, GAPs) should receive normalized
// absolute URLs. This module provides utilities to ensure URLs have proper
// schemes and are valid before network calls.

// ============================================================================
// Types
// ============================================================================

export interface UrlNormalizationSuccess {
  ok: true;
  url: string;
}

export interface UrlNormalizationFailure {
  ok: false;
  error: string;
}

export type UrlNormalizationResult = UrlNormalizationSuccess | UrlNormalizationFailure;

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize a website URL to an absolute URL with https scheme.
 *
 * Handles:
 * - Bare domains (crateandbarrel.com → https://crateandbarrel.com/)
 * - HTTP URLs (upgraded to HTTPS)
 * - Already-valid HTTPS URLs (unchanged)
 * - URLs with paths preserved
 *
 * @param input - The input URL (may be bare domain or full URL)
 * @returns Normalized absolute URL
 * @throws Error if input is empty or unparseable after normalization
 */
export function normalizeWebsiteUrl(input: string): string {
  const result = tryNormalizeWebsiteUrl(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.url;
}

/**
 * Try to normalize a website URL, returning a result object.
 *
 * This is the "safe" version that never throws.
 *
 * @param input - The input URL (may be bare domain or full URL)
 * @returns { ok: true, url: string } on success, { ok: false, error: string } on failure
 */
export function tryNormalizeWebsiteUrl(input: string): UrlNormalizationResult {
  // Handle empty/null input
  if (!input || typeof input !== 'string') {
    return {
      ok: false,
      error: 'URL is empty or not a string',
    };
  }

  // Trim whitespace
  let normalized = input.trim();

  // Handle empty after trim
  if (normalized === '') {
    return {
      ok: false,
      error: 'URL is empty after trimming whitespace',
    };
  }

  // If no scheme, prepend https://
  if (!normalized.match(/^[a-z][a-z0-9+.-]*:\/\//i)) {
    // Check for common malformed patterns
    if (normalized.startsWith('//')) {
      // Protocol-relative URL → add https:
      normalized = `https:${normalized}`;
    } else if (normalized.startsWith('/')) {
      // Absolute path without domain → invalid
      return {
        ok: false,
        error: 'URL appears to be a path without a domain',
      };
    } else {
      // Bare domain (most common case: crateandbarrel.com)
      normalized = `https://${normalized}`;
    }
  }

  // Upgrade http to https
  if (normalized.toLowerCase().startsWith('http://')) {
    normalized = normalized.replace(/^http:/i, 'https:');
  }

  // Validate by attempting to parse as URL
  try {
    const parsed = new URL(normalized);

    // Ensure we have a valid hostname
    if (!parsed.hostname || parsed.hostname.length === 0) {
      return {
        ok: false,
        error: 'URL has no valid hostname',
      };
    }

    // Basic domain validation (at least one dot, no spaces)
    if (!parsed.hostname.includes('.') || parsed.hostname.includes(' ')) {
      return {
        ok: false,
        error: `Invalid hostname: ${parsed.hostname}`,
      };
    }

    // Return the normalized URL (this also normalizes trailing slashes, etc.)
    return {
      ok: true,
      url: parsed.href,
    };
  } catch (e) {
    return {
      ok: false,
      error: `Failed to parse URL: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Extract the hostname (domain) from a URL.
 * Returns null if extraction fails.
 */
export function extractHostname(input: string): string | null {
  const result = tryNormalizeWebsiteUrl(input);
  if (!result.ok) {
    return null;
  }

  try {
    const url = new URL(result.url);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like a valid website URL (with or without scheme).
 * Does not modify the input, just validates.
 */
export function isValidWebsiteUrl(input: string): boolean {
  return tryNormalizeWebsiteUrl(input).ok;
}
