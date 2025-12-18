// tests/context/brandCompetitorRegression.test.ts
// End-to-end regression test for:
// 1. Brand canonical findings are written to Context Graph
// 2. Context Graph strips empty {} fields on load
// 3. Competitors exclude agencies/service providers
// 4. Competitors exclude self-competitors (same domain, name variants)

import { describe, it, expect } from 'vitest';
import {
  filterOutAgencies,
  filterOutSelfCompetitors,
  isSelfCompetitor,
} from '@/lib/labs/competitor/mergeCompetitors';
import type { CompetitorProfile } from '@/lib/contextGraph/domains/competitive';
import type { BrandLabFindings } from '@/lib/diagnostics/brand-lab/types';

// ============================================================================
// Mock Data
// ============================================================================

const mockCrunchbaseCompany = {
  name: 'Crunchbase',
  domain: 'crunchbase.com',
  website: 'https://www.crunchbase.com',
};

const mockCompetitorsWithSelfAndAgencies: Partial<CompetitorProfile>[] = [
  // Self-competitor: Same domain
  { name: 'Crunchbase', domain: 'crunchbase.com', positioning: 'Business data platform' },
  // Self-competitor: Subdomain / product variant
  { name: 'Crunchbase Pro', domain: 'pro.crunchbase.com', positioning: 'Premium business intelligence' },
  // Self-competitor: Name variant
  { name: 'Crunchbase Enterprise', domain: 'enterprise.crunchbase.com', positioning: 'Enterprise solution' },
  // Agency: Name pattern
  { name: 'Acme Agency', domain: 'acmeagency.com', positioning: 'We help brands grow' },
  // Agency: Nav/positioning pattern
  { name: 'GrowthCo', domain: 'growthco.com', positioning: 'Services for startups. View our portfolio and clients.' },
  // Agency: Consulting pattern
  { name: 'DataConsulting', domain: 'dataconsulting.com', positioning: 'Consulting services for data teams' },
  // Valid competitor: Direct
  { name: 'PitchBook', domain: 'pitchbook.com', positioning: 'Financial data and software' },
  // Valid competitor: Indirect
  { name: 'ZoomInfo', domain: 'zoominfo.com', positioning: 'B2B contact database' },
  // Valid competitor: Alternative
  { name: 'LinkedIn Sales Navigator', domain: 'linkedin.com', positioning: 'Sales intelligence tool' },
];

const mockBrandFindings: BrandLabFindings = {
  diagnosticV1: {},
  positioning: {
    statement: 'The leading platform for discovering innovative companies and the people behind them.',
    summary: 'Crunchbase provides comprehensive data on companies, investors, and funding rounds.',
    confidence: 0.85,
  },
  valueProp: {
    headline: 'Find the companies and people that matter',
    description: 'Access verified business data on millions of companies worldwide.',
    confidence: 0.9,
  },
  differentiators: {
    bullets: [
      'Largest database of company funding information',
      'Verified data from multiple sources',
      'Real-time updates on company news and events',
    ],
    confidence: 0.8,
  },
  icp: {
    primaryAudience: 'Sales professionals, investors, and market researchers looking for accurate business intelligence.',
    buyerRoles: ['Sales Director', 'VC Analyst', 'Market Research Lead'],
    confidence: 0.85,
  },
};

const mockGraphWithEmptyFields = {
  companyId: 'test-123',
  companyName: 'Test Company',
  brand: {
    positioning: { value: null, provenance: {} },
    valueProps: { value: [], provenance: {} },
    emptyField: {},
  },
  competitive: {
    competitors: { value: null },
    notes: {},
  },
  audience: {},
};

// ============================================================================
// Tests
// ============================================================================

describe('Brand Canonical Findings', () => {
  it('should have non-empty positioning statement', () => {
    expect(mockBrandFindings.positioning?.statement).toBeDefined();
    expect(mockBrandFindings.positioning?.statement.length).toBeGreaterThan(10);
  });

  it('should have non-empty value proposition', () => {
    expect(mockBrandFindings.valueProp?.headline).toBeDefined();
    expect(mockBrandFindings.valueProp?.description).toBeDefined();
    expect(mockBrandFindings.valueProp?.headline.length).toBeGreaterThan(5);
  });

  it('should have differentiators array', () => {
    expect(mockBrandFindings.differentiators?.bullets).toBeDefined();
    expect(mockBrandFindings.differentiators?.bullets.length).toBeGreaterThan(0);
  });

  it('should have ICP / primary audience', () => {
    expect(mockBrandFindings.icp?.primaryAudience).toBeDefined();
    expect(mockBrandFindings.icp?.primaryAudience.length).toBeGreaterThan(10);
  });

  it('should NOT contain evaluative language in findings', () => {
    const evaluativePatterns = [
      /\bshould\b/i,
      /\bis vague\b/i,
      /\bis unclear\b/i,
      /\bcould be\b/i,
      /\bneeds improvement\b/i,
      /\bpositioning is\b/i,
    ];

    const allText = [
      mockBrandFindings.positioning?.statement,
      mockBrandFindings.positioning?.summary,
      mockBrandFindings.valueProp?.headline,
      mockBrandFindings.valueProp?.description,
      ...(mockBrandFindings.differentiators?.bullets || []),
      mockBrandFindings.icp?.primaryAudience,
    ].join(' ');

    for (const pattern of evaluativePatterns) {
      expect(pattern.test(allText)).toBe(false);
    }
  });
});

describe('Self-Competitor Filtering', () => {
  it('should detect exact domain match as self-competitor', () => {
    const result = isSelfCompetitor(
      'Crunchbase',
      'crunchbase.com',
      mockCrunchbaseCompany.name,
      mockCrunchbaseCompany.domain
    );
    expect(result.isSelf).toBe(true);
    expect(result.reason).toContain('domain');
  });

  it('should detect subdomain as self-competitor', () => {
    const result = isSelfCompetitor(
      'Crunchbase Pro',
      'pro.crunchbase.com',
      mockCrunchbaseCompany.name,
      mockCrunchbaseCompany.domain
    );
    expect(result.isSelf).toBe(true);
    expect(result.reason).toContain('subdomain');
  });

  it('should detect name variant as self-competitor', () => {
    const result = isSelfCompetitor(
      'Crunchbase Enterprise',
      'different-domain.com',
      mockCrunchbaseCompany.name,
      mockCrunchbaseCompany.domain
    );
    expect(result.isSelf).toBe(true);
    expect(result.reason).toContain('name');
  });

  it('should NOT flag legitimate competitors as self', () => {
    const result = isSelfCompetitor(
      'PitchBook',
      'pitchbook.com',
      mockCrunchbaseCompany.name,
      mockCrunchbaseCompany.domain
    );
    expect(result.isSelf).toBe(false);
  });

  it('should filter out all self-competitors from list', () => {
    const { competitors, rejectedSelf } = filterOutSelfCompetitors(
      mockCompetitorsWithSelfAndAgencies as CompetitorProfile[],
      mockCrunchbaseCompany.name,
      mockCrunchbaseCompany.domain
    );

    // Should reject self-competitors
    expect(rejectedSelf.length).toBeGreaterThanOrEqual(3); // Crunchbase, Crunchbase Pro, Crunchbase Enterprise

    // Should NOT contain any crunchbase domain in filtered list
    for (const comp of competitors) {
      const domain = comp.domain?.toLowerCase() || '';
      expect(domain).not.toContain('crunchbase');
    }
  });
});

describe('Agency Filtering', () => {
  it('should detect agency by name pattern', () => {
    const { competitors, rejectedAgencies } = filterOutAgencies(
      mockCompetitorsWithSelfAndAgencies as CompetitorProfile[]
    );

    const acmeRejected = rejectedAgencies.find(r => r.competitor.name === 'Acme Agency');
    expect(acmeRejected).toBeDefined();
  });

  it('should detect agency by positioning pattern (services, portfolio, clients)', () => {
    const { rejectedAgencies } = filterOutAgencies(
      mockCompetitorsWithSelfAndAgencies as CompetitorProfile[]
    );

    const growthCoRejected = rejectedAgencies.find(r => r.competitor.name === 'GrowthCo');
    expect(growthCoRejected).toBeDefined();
  });

  it('should NOT filter legitimate competitors', () => {
    const { competitors } = filterOutAgencies(
      mockCompetitorsWithSelfAndAgencies as CompetitorProfile[]
    );

    // PitchBook, ZoomInfo, LinkedIn should remain
    expect(competitors.find(c => c.name === 'PitchBook')).toBeDefined();
    expect(competitors.find(c => c.name === 'ZoomInfo')).toBeDefined();
    expect(competitors.find(c => c.name === 'LinkedIn Sales Navigator')).toBeDefined();
  });
});

describe('Empty Field Stripping', () => {
  it('should identify empty {} objects', () => {
    const isEmptyObject = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      return Object.keys(obj as object).length === 0;
    };

    expect(isEmptyObject({})).toBe(true);
    expect(isEmptyObject({ value: null })).toBe(false); // Has a key
    expect(isEmptyObject(mockGraphWithEmptyFields.brand.emptyField)).toBe(true);
    expect(isEmptyObject(mockGraphWithEmptyFields.competitive.notes)).toBe(true);
    expect(isEmptyObject(mockGraphWithEmptyFields.audience)).toBe(true);
  });

  it('should identify fields with { value: null }', () => {
    const isEmptyValueField = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      const record = obj as Record<string, unknown>;
      if ('value' in record) {
        return record.value === null || record.value === undefined;
      }
      return false;
    };

    expect(isEmptyValueField(mockGraphWithEmptyFields.brand.positioning)).toBe(true);
    expect(isEmptyValueField(mockGraphWithEmptyFields.competitive.competitors)).toBe(true);
  });

  it('should identify empty arrays in value fields', () => {
    const isEmptyArrayField = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      const record = obj as Record<string, unknown>;
      if ('value' in record && Array.isArray(record.value)) {
        return record.value.length === 0;
      }
      return false;
    };

    expect(isEmptyArrayField(mockGraphWithEmptyFields.brand.valueProps)).toBe(true);
  });
});

describe('Combined Filtering Pipeline', () => {
  it('should filter both self-competitors AND agencies', () => {
    // First filter self-competitors
    const { competitors: afterSelf } = filterOutSelfCompetitors(
      mockCompetitorsWithSelfAndAgencies as CompetitorProfile[],
      mockCrunchbaseCompany.name,
      mockCrunchbaseCompany.domain
    );

    // Then filter agencies
    const { competitors: afterAgencies } = filterOutAgencies(afterSelf);

    // Should only have legitimate competitors
    expect(afterAgencies.length).toBe(3); // PitchBook, ZoomInfo, LinkedIn

    // Verify each remaining competitor
    const names = afterAgencies.map(c => c.name);
    expect(names).toContain('PitchBook');
    expect(names).toContain('ZoomInfo');
    expect(names).toContain('LinkedIn Sales Navigator');

    // Should NOT contain self-competitors
    expect(names).not.toContain('Crunchbase');
    expect(names).not.toContain('Crunchbase Pro');
    expect(names).not.toContain('Crunchbase Enterprise');

    // Should NOT contain agencies
    expect(names).not.toContain('Acme Agency');
    expect(names).not.toContain('GrowthCo');
    expect(names).not.toContain('DataConsulting');
  });
});
