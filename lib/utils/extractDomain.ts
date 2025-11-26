// lib/utils/extractDomain.ts
// Domain extraction and normalization utilities

/**
 * Extract and normalize domain from a URL or domain string
 * Removes protocol, www prefix, trailing slashes, paths, query params
 */
export function extractDomain(input: string): string {
  if (!input) return '';

  let domain = input.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www prefix
  domain = domain.replace(/^www\./, '');

  // Remove everything after the domain (paths, query params, hash)
  domain = domain.split('/')[0];
  domain = domain.split('?')[0];
  domain = domain.split('#')[0];

  // Remove port if present
  domain = domain.split(':')[0];

  return domain;
}

/**
 * Convert a domain to a readable company name
 * e.g., "acme-corp.com" → "Acme Corp"
 */
export function domainToDisplayName(domain: string): string {
  if (!domain) return '';

  // Get the name part (before TLD)
  const parts = domain.split('.');
  if (parts.length === 0) return '';

  // Take everything except the TLD
  const namePart = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];

  // Convert hyphens and underscores to spaces
  const cleaned = namePart.replace(/[-_]/g, ' ');

  // Capitalize each word
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validate if a string looks like a valid domain
 */
export function isValidDomain(domain: string): boolean {
  if (!domain) return false;

  // Basic domain pattern: at least one character, a dot, and a TLD
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Extract domain from a URL, with validation
 * Returns null if extraction fails or domain is invalid
 */
export function extractValidDomain(input: string): string | null {
  const domain = extractDomain(input);
  return isValidDomain(domain) ? domain : null;
}

/**
 * Normalize a company name for matching
 * Removes common suffixes, lowercases, removes special chars
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    // Remove common company suffixes
    .replace(/\s*(llc|inc|incorporated|corp|corporation|ltd|limited|co|company|llp|pllc|pc|pa)\.?$/gi, '')
    // Remove special characters
    .replace(/[^\w\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two company names match (fuzzy)
 */
export function companyNamesMatch(name1: string, name2: string): boolean {
  const normalized1 = normalizeCompanyName(name1);
  const normalized2 = normalizeCompanyName(name2);

  if (!normalized1 || !normalized2) return false;

  // Exact match after normalization
  if (normalized1 === normalized2) return true;

  // One contains the other (for cases like "Acme" vs "Acme Corporation")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    // Only match if the shorter one is reasonably long
    const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
    return shorter.length >= 3;
  }

  return false;
}
