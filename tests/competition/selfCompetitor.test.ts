// tests/competition/selfCompetitor.test.ts
// Regression test: Company should NEVER appear as its own competitor

import { describe, it, expect } from 'vitest';
import cartoysFixture from '../fixtures/competition-cartoys.json';

/**
 * Normalize a domain for comparison - removes protocol, www, and trailing slashes
 */
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let normalized = domain.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.split('/')[0];
  return normalized || null;
}

/**
 * Check if two domains are the same company
 */
function isSameDomain(domain1: string | null | undefined, domain2: string | null | undefined): boolean {
  const norm1 = normalizeDomain(domain1);
  const norm2 = normalizeDomain(domain2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

/**
 * Filter out self-competitors (same domain as company)
 */
function filterSelfCompetitors<T extends { domain?: string; name?: string }>(
  competitors: T[],
  companyDomain: string,
  companyName: string
): T[] {
  const normalizedCompanyDomain = normalizeDomain(companyDomain);
  const normalizedCompanyName = companyName?.toLowerCase().trim();

  return competitors.filter((c) => {
    // Filter by domain match
    if (normalizedCompanyDomain && isSameDomain(c.domain, companyDomain)) {
      return false;
    }
    // Filter by name match
    if (normalizedCompanyName && c.name?.toLowerCase().trim() === normalizedCompanyName) {
      return false;
    }
    return true;
  });
}

describe('Self-Competitor Filtering', () => {
  const { company, mockCompetitors } = cartoysFixture;

  it('should filter out Car Toys from its own competitors list', () => {
    const filtered = filterSelfCompetitors(mockCompetitors, company.domain, company.name);

    // Car Toys should NOT be in the filtered list
    const selfCompetitor = filtered.find(
      (c) => isSameDomain(c.domain, company.domain) || c.name?.toLowerCase() === company.name.toLowerCase()
    );

    expect(selfCompetitor).toBeUndefined();
  });

  it('should not filter out legitimate competitors', () => {
    const filtered = filterSelfCompetitors(mockCompetitors, company.domain, company.name);

    // Should have all competitors except Car Toys
    expect(filtered.length).toBe(mockCompetitors.length - 1);

    // Best Buy, Audio Express, Crutchfield, and Amazon should remain
    expect(filtered.find((c) => c.domain?.includes('bestbuy'))).toBeDefined();
    expect(filtered.find((c) => c.domain?.includes('audioexpress'))).toBeDefined();
    expect(filtered.find((c) => c.domain?.includes('crutchfield'))).toBeDefined();
    expect(filtered.find((c) => c.domain?.includes('amazon'))).toBeDefined();
  });

  it('should handle various URL formats for cartoys.com', () => {
    const urlVariations = [
      'cartoys.com',
      'www.cartoys.com',
      'https://cartoys.com',
      'https://www.cartoys.com',
      'https://www.cartoys.com/',
      'http://cartoys.com/about',
      'CARTOYS.COM',
    ];

    for (const url of urlVariations) {
      expect(isSameDomain(url, company.domain)).toBe(true);
    }
  });

  it('should not match partial domain overlaps', () => {
    // These should NOT match cartoys.com
    const nonMatches = [
      'cartoysplus.com',
      'mycartosy.com',
      'cartoys.net',
      'cart.com',
    ];

    for (const url of nonMatches) {
      expect(isSameDomain(url, company.domain)).toBe(false);
    }
  });
});
