// tests/competition-v3/selfCompetitorFilter.test.ts
// Competition Lab V3.6 - Self-Competitor Filter Tests
//
// Tests the 4-layer self-competitor detection:
// 1. Exact domain match
// 2. Root domain match
// 3. Name similarity (Levenshtein distance)
// 4. Brand alias comparison

import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  extractRootDomain,
  checkExactDomainMatch,
  checkRootDomainMatch,
  checkNameSimilarity,
  checkBrandAliasMatch,
  checkIsSelfCompetitor,
  filterSelfCompetitors,
  calculateNameSimilarity,
  normalizeCompanyName,
  generateBrandAliases,
} from '@/lib/competition-v3/cleanup/selfCompetitorFilter';
import type { CompanyIdentity, CompetitorCandidate } from '@/lib/competition-v3/cleanup/selfCompetitorFilter';

// ============================================================================
// Layer 1: Domain Normalization Tests
// ============================================================================

describe('Domain Normalization', () => {
  it('should normalize domains by removing protocol', () => {
    expect(normalizeDomain('https://example.com')).toBe('example.com');
    expect(normalizeDomain('http://example.com')).toBe('example.com');
  });

  it('should remove www prefix', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
    expect(normalizeDomain('https://www.example.com')).toBe('example.com');
  });

  it('should remove trailing path', () => {
    expect(normalizeDomain('example.com/about')).toBe('example.com');
    expect(normalizeDomain('https://example.com/page/subpage')).toBe('example.com');
  });

  it('should handle null and undefined', () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
  });
});

// ============================================================================
// Layer 2: Root Domain Extraction Tests
// ============================================================================

describe('Root Domain Extraction', () => {
  it('should extract root domain from subdomain', () => {
    expect(extractRootDomain('shop.example.com')).toBe('example.com');
    expect(extractRootDomain('www.shop.example.com')).toBe('example.com');
  });

  it('should handle country TLDs correctly', () => {
    expect(extractRootDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(extractRootDomain('www.example.com.au')).toBe('example.com.au');
  });

  it('should return null for null input', () => {
    expect(extractRootDomain(null)).toBeNull();
  });
});

// ============================================================================
// Layer 1: Exact Domain Match Tests
// ============================================================================

describe('Exact Domain Match (Layer 1)', () => {
  it('should detect exact domain match', () => {
    const company: CompanyIdentity = { name: 'Atlas Skate', domain: 'atlasskate.com' };
    const candidate: CompetitorCandidate = { name: 'Atlas Skateshop', domain: 'atlasskate.com' };

    expect(checkExactDomainMatch(company, candidate)).toBe(true);
  });

  it('should match with different protocols and www', () => {
    const company: CompanyIdentity = { name: 'Test Co', domain: 'https://www.test.com' };
    const candidate: CompetitorCandidate = { name: 'Test Company', domain: 'test.com' };

    expect(checkExactDomainMatch(company, candidate)).toBe(true);
  });

  it('should not match different domains', () => {
    const company: CompanyIdentity = { name: 'Atlas Skate', domain: 'atlasskate.com' };
    const candidate: CompetitorCandidate = { name: 'CCS', domain: 'ccs.com' };

    expect(checkExactDomainMatch(company, candidate)).toBe(false);
  });
});

// ============================================================================
// Layer 2: Root Domain Match Tests
// ============================================================================

describe('Root Domain Match (Layer 2)', () => {
  it('should detect subdomain match', () => {
    const company: CompanyIdentity = { name: 'Example Corp', domain: 'example.com' };
    const candidate: CompetitorCandidate = { name: 'Example Shop', domain: 'shop.example.com' };

    expect(checkRootDomainMatch(company, candidate)).toBe(true);
  });

  it('should not match different root domains', () => {
    const company: CompanyIdentity = { name: 'Example Corp', domain: 'example.com' };
    const candidate: CompetitorCandidate = { name: 'Other Corp', domain: 'other.com' };

    expect(checkRootDomainMatch(company, candidate)).toBe(false);
  });
});

// ============================================================================
// Layer 3: Name Similarity Tests
// ============================================================================

describe('Name Similarity (Layer 3)', () => {
  it('should calculate high similarity for similar names', () => {
    const similarity = calculateNameSimilarity('atlas skate', 'atlas skateshop');
    expect(similarity).toBeGreaterThan(0.7);
  });

  it('should calculate low similarity for different names', () => {
    const similarity = calculateNameSimilarity('atlas skate', 'zumiez');
    expect(similarity).toBeLessThan(0.5);
  });

  it('should normalize company names before comparison', () => {
    const normalized = normalizeCompanyName('Atlas Skate, Inc.');
    expect(normalized).toBe('atlas skate');
  });

  it('should remove common business suffixes', () => {
    expect(normalizeCompanyName('Example Corp')).toBe('example');
    expect(normalizeCompanyName('Example LLC')).toBe('example');
    expect(normalizeCompanyName('Example, Inc.')).toBe('example');
  });

  it('should detect similar company names', () => {
    const company: CompanyIdentity = { name: 'Atlas Skate Shop' };
    const candidate: CompetitorCandidate = { name: 'Atlas Skateshop' };

    expect(checkNameSimilarity(company, candidate)).toBe(true);
  });
});

// ============================================================================
// Layer 4: Brand Alias Tests
// ============================================================================

describe('Brand Alias Match (Layer 4)', () => {
  it('should generate brand aliases', () => {
    const aliases = generateBrandAliases('Atlas Skate Shop');

    expect(aliases).toContain('atlas skate shop');
    expect(aliases.some(a => a.includes('ass') || a.length <= 4)).toBe(true); // Initials or abbreviated
  });

  it('should detect brand alias match', () => {
    const company: CompanyIdentity = { name: 'The Atlas Skate Shop', aliases: ['atlas'] };
    const candidate: CompetitorCandidate = { name: 'Atlas' };

    expect(checkBrandAliasMatch(company, candidate)).toBe(true);
  });
});

// ============================================================================
// Combined 4-Layer Detection Tests
// ============================================================================

describe('Combined Self-Competitor Detection', () => {
  it('should detect self through exact domain', () => {
    const company: CompanyIdentity = { name: 'Atlas Skate', domain: 'atlasskate.com' };
    const candidate: CompetitorCandidate = { name: 'Atlas Skateshop', domain: 'atlasskate.com' };

    const result = checkIsSelfCompetitor(company, candidate);

    expect(result.isMatch).toBe(true);
    expect(result.matchType).toBe('exact-domain');
    expect(result.confidence).toBe(1.0);
  });

  it('should detect self through root domain', () => {
    const company: CompanyIdentity = { name: 'Example', domain: 'example.com' };
    const candidate: CompetitorCandidate = { name: 'Example Shop', domain: 'shop.example.com' };

    const result = checkIsSelfCompetitor(company, candidate);

    expect(result.isMatch).toBe(true);
    expect(result.matchType).toBe('root-domain');
  });

  it('should detect self through name similarity', () => {
    const company: CompanyIdentity = { name: 'Car Toys' };
    const candidate: CompetitorCandidate = { name: 'CarToys' };

    const result = checkIsSelfCompetitor(company, candidate);

    expect(result.isMatch).toBe(true);
    expect(result.matchType).toBe('name-similarity');
  });

  it('should NOT detect unrelated competitor', () => {
    const company: CompanyIdentity = { name: 'Atlas Skate', domain: 'atlasskate.com' };
    const candidate: CompetitorCandidate = { name: 'Zumiez', domain: 'zumiez.com' };

    const result = checkIsSelfCompetitor(company, candidate);

    expect(result.isMatch).toBe(false);
    expect(result.matchType).toBe('none');
  });
});

// ============================================================================
// Filter Function Tests
// ============================================================================

describe('Filter Self Competitors', () => {
  it('should filter out self-competitors from list', () => {
    const company: CompanyIdentity = {
      name: 'Atlas Skate Shop',
      domain: 'atlasskate.com',
    };

    const candidates: CompetitorCandidate[] = [
      { name: 'Atlas Skateshop', domain: 'atlasskate.com' }, // Should be filtered (exact domain)
      { name: 'Atlas Skate', domain: 'shop.atlasskate.com' }, // Should be filtered (root domain)
      { name: 'Zumiez', domain: 'zumiez.com' }, // Should remain
      { name: 'CCS Skateboards', domain: 'ccs.com' }, // Should remain
      { name: 'Tactics', domain: 'tactics.com' }, // Should remain
    ];

    const { filtered, removed } = filterSelfCompetitors(company, candidates);

    expect(filtered).toHaveLength(3);
    expect(removed).toHaveLength(2);
    expect(filtered.find(c => c.name === 'Zumiez')).toBeDefined();
    expect(filtered.find(c => c.name === 'CCS Skateboards')).toBeDefined();
    expect(filtered.find(c => c.name === 'Tactics')).toBeDefined();
  });

  it('should return removal reasons', () => {
    const company: CompanyIdentity = { name: 'Test Co', domain: 'test.com' };
    const candidates: CompetitorCandidate[] = [
      { name: 'Test Company', domain: 'test.com' },
    ];

    const { removed } = filterSelfCompetitors(company, candidates);

    expect(removed[0].check.matchType).toBe('exact-domain');
    expect(removed[0].check.reason).toContain('test.com');
  });
});

// ============================================================================
// Real-World Scenarios
// ============================================================================

describe('Real-World Self-Competitor Scenarios', () => {
  it('Car Toys: should filter self from competitors', () => {
    const company: CompanyIdentity = {
      name: 'Car Toys',
      domain: 'cartoys.com',
      website: 'https://www.cartoys.com',
    };

    const candidates: CompetitorCandidate[] = [
      { name: 'Car Toys', domain: 'cartoys.com' },
      { name: 'CarToys.com', domain: 'cartoys.com' },
      { name: 'Best Buy Car Audio', domain: 'bestbuy.com' },
      { name: 'Crutchfield', domain: 'crutchfield.com' },
    ];

    const { filtered, removed } = filterSelfCompetitors(company, candidates);

    expect(removed.length).toBeGreaterThanOrEqual(2);
    expect(filtered.find(c => c.domain === 'cartoys.com')).toBeUndefined();
    expect(filtered.find(c => c.name === 'Crutchfield')).toBeDefined();
  });

  it('Atlas Skate: should filter self from competitors', () => {
    const company: CompanyIdentity = {
      name: 'Atlas Skate Shop',
      domain: 'atlasskate.com',
      aliases: ['Atlas'],
    };

    const candidates: CompetitorCandidate[] = [
      { name: 'Atlas Skateshop', domain: 'atlasskate.com' },
      { name: 'Atlas Skate', website: 'https://atlasskate.com/shop' },
      { name: 'Zumiez', domain: 'zumiez.com' },
      { name: 'Tactics Boardshop', domain: 'tactics.com' },
    ];

    const { filtered, removed } = filterSelfCompetitors(company, candidates);

    expect(removed.length).toBeGreaterThanOrEqual(2);
    expect(filtered.find(c => c.name === 'Zumiez')).toBeDefined();
    expect(filtered.find(c => c.name === 'Tactics Boardshop')).toBeDefined();
  });
});
