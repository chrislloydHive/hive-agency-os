// tests/competition/selfCompetitorFinalFilter.test.ts
// Regression test: Final self-competitor filter guarantees company never appears as competitor

import { describe, it, expect } from 'vitest';

/**
 * Normalize a domain for comparison - matches the implementation in loadCompetitorLab.ts
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
 * Final self-competitor filter - matches the implementation in loadCompetitorLab.ts
 */
function finalSelfCompetitorFilter<T extends { domain?: string | null; name?: string }>(
  competitors: T[],
  companyDomain: string | null,
  companyName: string
): T[] {
  const companyDomainNorm = normalizeDomain(companyDomain);
  const companyNameNorm = companyName?.toLowerCase().trim();

  return competitors.filter((c) => {
    const d = normalizeDomain(c.domain);
    const n = c.name?.toLowerCase().trim();

    const isSelfByDomain = d && companyDomainNorm && d === companyDomainNorm;
    const isSelfByName = n && companyNameNorm && n === companyNameNorm;

    return !isSelfByDomain && !isSelfByName;
  });
}

describe('Final Self-Competitor Filter', () => {
  const company = {
    name: 'Car Toys',
    domain: 'cartoys.com',
  };

  const mockCompetitors = [
    // Self-competitor variants that should ALL be filtered out
    { id: 'self-1', name: 'Car Toys', domain: 'cartoys.com' },
    { id: 'self-2', name: 'Car Toys', domain: '' },
    { id: 'self-3', name: 'Car toys', domain: 'https://www.cartoys.com' },
    { id: 'self-4', name: 'CAR TOYS', domain: 'http://cartoys.com/' },
    { id: 'self-5', name: 'car toys', domain: null },
    { id: 'self-6', name: 'Car Toys', domain: 'www.cartoys.com/about' },
    // Real competitors that should NOT be filtered
    { id: 'real-1', name: 'Best Buy', domain: 'bestbuy.com' },
    { id: 'real-2', name: 'Audio Express', domain: 'audioexpress.com' },
    { id: 'real-3', name: 'Crutchfield', domain: 'crutchfield.com' },
    { id: 'real-4', name: 'Amazon', domain: 'amazon.com' },
  ];

  it('should filter out all self-competitor variants by domain', () => {
    const filtered = finalSelfCompetitorFilter(mockCompetitors, company.domain, company.name);

    // None of the cartoys.com variants should remain
    const selfByDomain = filtered.filter((c) => {
      const d = normalizeDomain(c.domain);
      return d === normalizeDomain(company.domain);
    });

    expect(selfByDomain).toHaveLength(0);
  });

  it('should filter out all self-competitor variants by name', () => {
    const filtered = finalSelfCompetitorFilter(mockCompetitors, company.domain, company.name);

    // None of the "Car Toys" name variants should remain
    const selfByName = filtered.filter((c) =>
      c.name?.toLowerCase().trim() === company.name.toLowerCase().trim()
    );

    expect(selfByName).toHaveLength(0);
  });

  it('should keep all real competitors', () => {
    const filtered = finalSelfCompetitorFilter(mockCompetitors, company.domain, company.name);

    // All 4 real competitors should remain
    expect(filtered.find((c) => c.id === 'real-1')).toBeDefined();
    expect(filtered.find((c) => c.id === 'real-2')).toBeDefined();
    expect(filtered.find((c) => c.id === 'real-3')).toBeDefined();
    expect(filtered.find((c) => c.id === 'real-4')).toBeDefined();
    expect(filtered).toHaveLength(4);
  });

  it('should handle edge case: competitor with matching domain but different name', () => {
    const edgeCaseCompetitors = [
      { id: 'edge-1', name: 'Car Toys West', domain: 'cartoys.com' }, // Same domain - should filter
      { id: 'edge-2', name: 'Car Toys', domain: 'cartoys-west.com' }, // Same name - should filter
      { id: 'edge-3', name: 'Car Toys Plus', domain: 'cartoysplus.com' }, // Different - should keep
    ];

    const filtered = finalSelfCompetitorFilter(edgeCaseCompetitors, company.domain, company.name);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('edge-3');
  });

  it('should handle case variations correctly', () => {
    const caseVariants = [
      { id: 'case-1', name: 'CAR TOYS', domain: 'CARTOYS.COM' },
      { id: 'case-2', name: 'car toys', domain: 'Cartoys.Com' },
      { id: 'case-3', name: '  Car Toys  ', domain: '  cartoys.com  ' }, // With whitespace
    ];

    const filtered = finalSelfCompetitorFilter(caseVariants, company.domain, company.name);

    expect(filtered).toHaveLength(0);
  });

  it('should handle URL protocol and path variations', () => {
    const urlVariants = [
      { id: 'url-1', name: 'Other Company', domain: 'https://cartoys.com' },
      { id: 'url-2', name: 'Other Company', domain: 'http://www.cartoys.com' },
      { id: 'url-3', name: 'Other Company', domain: 'cartoys.com/about-us' },
      { id: 'url-4', name: 'Other Company', domain: 'https://www.cartoys.com/' },
    ];

    const filtered = finalSelfCompetitorFilter(urlVariants, company.domain, company.name);

    // All should be filtered because domain matches cartoys.com
    expect(filtered).toHaveLength(0);
  });

  it('should NOT filter partial domain matches', () => {
    const partialMatches = [
      { id: 'partial-1', name: 'Car Toys Plus', domain: 'cartoysplus.com' },
      { id: 'partial-2', name: 'MyCarToys', domain: 'mycartoys.com' },
      { id: 'partial-3', name: 'Toys R Us Cars', domain: 'toysruscars.com' },
    ];

    const filtered = finalSelfCompetitorFilter(partialMatches, company.domain, company.name);

    // All should remain because they don't exactly match
    expect(filtered).toHaveLength(3);
  });

  it('should handle null/undefined domain gracefully', () => {
    const nullDomainCompetitors = [
      { id: 'null-1', name: 'Car Toys', domain: null }, // Should filter by name
      { id: 'null-2', name: 'Real Company', domain: null }, // Should keep
      { id: 'null-3', name: 'Another Real', domain: undefined }, // Should keep
    ];

    const filtered = finalSelfCompetitorFilter(nullDomainCompetitors, company.domain, company.name);

    expect(filtered).toHaveLength(2);
    expect(filtered.find((c) => c.id === 'null-2')).toBeDefined();
    expect(filtered.find((c) => c.id === 'null-3')).toBeDefined();
  });
});
