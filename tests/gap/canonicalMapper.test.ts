// tests/gap/canonicalMapper.test.ts
// Tests for canonical GAP assessment mapper (GapFullAssessmentV1)

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  mapBaselineCoreToFullAssessment,
  projectToBaselineSummary,
  normalizeMaturityStage,
  type BaselineCoreToCanonicalInput,
} from '@/lib/gap/canonicalMapper';
import {
  mapInitialAssessmentToCanonical,
  mapInitialAssessmentToApiResponse,
  type InitialAssessmentToCanonicalInput,
} from '@/lib/gap/outputMappers';
import { detectSocialAndGbp, type SocialFootprintSnapshot } from '@/lib/gap/socialDetection';
import type {
  GapFullAssessmentV1,
  BaselineGapSummary,
  GapMaturityStage,
  DimensionSummary,
} from '@/lib/gap/types';
import type { InitialAssessmentOutput, DimensionIdType } from '@/lib/gap/outputTemplates';

// ============================================================================
// Fixtures
// ============================================================================

// Atlas Skateboarding-like snapshot: GBP present, Instagram present, YouTube present
const atlasLikeSnapshot: SocialFootprintSnapshot = {
  socials: [
    { network: 'instagram', url: 'https://instagram.com/atlasskateboarding', confidence: 0.85, status: 'present', detectionSources: ['html_link_footer'] },
    { network: 'facebook', url: undefined, confidence: 0.15, status: 'missing', detectionSources: [] },
    { network: 'youtube', url: 'https://youtube.com/@atlasskateboarding', confidence: 0.80, status: 'present', detectionSources: ['html_link_footer'] },
    { network: 'tiktok', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'x', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'linkedin', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
  ],
  gbp: { url: 'https://maps.google.com/maps?cid=123', confidence: 0.90, status: 'present', detectionSources: ['html_link_footer', 'schema_gbp'] },
  dataConfidence: 0.85,
};

// Mock InitialAssessmentOutput that would come from LLM
const mockInitialAssessmentOutput: InitialAssessmentOutput = {
  executiveSummary: 'Atlas Skateboarding is a local brick-and-mortar retailer with emerging marketing foundations. The website shows clear positioning but has room for improvement in digital presence and local search optimization.',
  marketingReadinessScore: 45,
  maturityStage: 'Emerging',
  topOpportunities: [
    'Establish a Google Business Profile to improve local visibility',
    'Begin posting regularly on Instagram to engage customers',
    'Add customer testimonials to build trust',
  ],
  quickWins: [
    { action: 'Create and optimize Google Business Profile', dimensionId: 'digitalFootprint' },
    { action: 'Start Instagram presence to showcase products', dimensionId: 'digitalFootprint' },
    { action: 'Add clear pricing information to website', dimensionId: 'website' },
  ],
  dimensionSummaries: [
    { id: 'brand', score: 55, summary: 'Strong local brand identity with clear positioning in skate culture.', keyIssue: 'Inconsistent visual branding across digital touchpoints.' },
    { id: 'content', score: 40, summary: 'Limited content beyond product listings.', keyIssue: 'No blog or educational content to drive organic traffic.' },
    { id: 'seo', score: 35, summary: 'Basic on-page SEO present but not optimized.', keyIssue: 'Missing meta descriptions and structured data.' },
    { id: 'website', score: 50, summary: 'Functional e-commerce site with clear navigation.', keyIssue: 'Mobile experience needs improvement.' },
    { id: 'digitalFootprint', score: 30, summary: 'No Google Business Profile and weak social media presence.', keyIssue: 'Absence of Google Business Profile limits local discovery.' },
    { id: 'authority', score: 40, summary: 'Limited online authority and backlinks.', keyIssue: 'Few quality backlinks from relevant sites.' },
  ],
  businessType: 'brick_and_mortar',
  brandTier: 'local_business',
  businessName: 'Atlas Skateboarding',
  confidence: 'medium',
};

// Mock GapIaV2AiOutput that comes from core engine
const mockGapIaV2Output = {
  summary: {
    overallScore: 45,
    maturityStage: 'early',
    headlineDiagnosis: 'Local retailer with emerging marketing foundation',
    narrative: mockInitialAssessmentOutput.executiveSummary,
    topOpportunities: mockInitialAssessmentOutput.topOpportunities,
  },
  dimensions: {
    brand: { score: 55, label: 'Brand & Positioning', oneLiner: 'Strong local brand identity.', issues: ['Inconsistent visual branding'] },
    content: { score: 40, label: 'Content & Messaging', oneLiner: 'Limited content.', issues: ['No blog'] },
    seo: { score: 35, label: 'SEO & Visibility', oneLiner: 'Basic on-page SEO.', issues: ['Missing meta descriptions'] },
    website: { score: 50, label: 'Website & Conversion', oneLiner: 'Functional site.', issues: ['Mobile needs work'] },
    digitalFootprint: { score: 30, label: 'Digital Footprint', oneLiner: 'No Google Business Profile.', issues: ['No GBP'], subscores: { googleBusinessProfile: 0, socialPresence: 0, linkedinPresence: 0, reviewsReputation: 50 } },
    authority: { score: 40, label: 'Authority & Trust', oneLiner: 'Limited authority.', issues: ['Few backlinks'], subscores: { domainAuthority: 40, backlinks: 35, brandSearchDemand: 45, industryRecognition: 40 } },
  },
  breakdown: { bullets: [] },
  quickWins: {
    bullets: mockInitialAssessmentOutput.quickWins.map(qw => ({ action: qw.action, category: 'Other', expectedImpact: 'high', effortLevel: 'low' })),
  },
  core: {
    url: 'https://atlasskateboarding.com',
    domain: 'atlasskateboarding.com',
    businessName: 'Atlas Skateboarding',
    companyType: 'brick_and_mortar',
    brandTier: 'local_business',
    brand: { brandScore: 55 },
    content: { contentScore: 40 },
    seo: { seoScore: 35 },
    website: { websiteScore: 50 },
    quickSummary: mockInitialAssessmentOutput.topOpportunities.slice(0, 3).join(' '),
    topOpportunities: mockInitialAssessmentOutput.topOpportunities,
    marketingMaturity: 'early',
  },
  insights: {
    overallSummary: mockInitialAssessmentOutput.executiveSummary,
    brandInsights: ['Strong local identity'],
    contentInsights: ['Limited content'],
    seoInsights: ['Basic SEO'],
    websiteInsights: ['Functional'],
  },
};

// ============================================================================
// Maturity Stage Normalization Tests
// ============================================================================

describe('Maturity Stage Normalization', () => {
  it('should normalize legacy lowercase stages', () => {
    expect(normalizeMaturityStage('early')).toBe('Foundational');
    expect(normalizeMaturityStage('developing')).toBe('Emerging');
    expect(normalizeMaturityStage('advanced')).toBe('Advanced');
  });

  it('should pass through canonical stages', () => {
    expect(normalizeMaturityStage('Foundational')).toBe('Foundational');
    expect(normalizeMaturityStage('Emerging')).toBe('Emerging');
    expect(normalizeMaturityStage('Established')).toBe('Established');
    expect(normalizeMaturityStage('Advanced')).toBe('Advanced');
    expect(normalizeMaturityStage('CategoryLeader')).toBe('CategoryLeader');
  });

  it('should handle variations', () => {
    expect(normalizeMaturityStage('Early Stage')).toBe('Foundational');
    expect(normalizeMaturityStage('SCALING')).toBe('Established');
    expect(normalizeMaturityStage('Leader')).toBe('CategoryLeader');
  });

  it('should default to Emerging for unknown values', () => {
    expect(normalizeMaturityStage('unknown')).toBe('Emerging');
    expect(normalizeMaturityStage(undefined)).toBe('Emerging');
  });
});

// ============================================================================
// mapInitialAssessmentToCanonical Tests
// ============================================================================

describe('mapInitialAssessmentToCanonical', () => {
  it('should produce valid GapFullAssessmentV1 structure', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'test-run-123',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        companyId: 'company-123',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    // Verify metadata
    expect(result.companyName).toBe('Atlas Skateboarding');
    expect(result.url).toBe('https://atlasskateboarding.com');
    expect(result.domain).toBe('atlasskateboarding.com');
    expect(result.source).toBe('baseline_context_build');
    expect(result.runId).toBe('test-run-123');
    expect(result.companyId).toBe('company-123');
    expect(result.generatedAt).toBeDefined();

    // Verify overall metrics
    expect(result.overallScore).toBe(45);
    expect(result.maturityStage).toBe('Emerging');
    expect(result.executiveSummary).toContain('Atlas Skateboarding');

    // Verify dimensions structure
    expect(result.dimensions).toHaveProperty('brand');
    expect(result.dimensions).toHaveProperty('content');
    expect(result.dimensions).toHaveProperty('seo');
    expect(result.dimensions).toHaveProperty('website');
    expect(result.dimensions).toHaveProperty('digitalFootprint');
    expect(result.dimensions).toHaveProperty('authority');

    // Verify quick wins and opportunities
    expect(result.quickWins.length).toBeGreaterThan(0);
    expect(result.topOpportunities.length).toBeGreaterThan(0);

    // Verify detection data preserved
    expect(result.socialFootprint).toBeDefined();
    expect(result.socialFootprint).toBe(atlasLikeSnapshot);

    // Verify business context
    expect(result.businessType).toBe('brick_and_mortar');
    expect(result.brandTier).toBe('local_business');
  });

  it('should apply social footprint gating to digitalFootprint dimension', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'test-run-123',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    // With GBP present, score should be high (not the raw 30 from LLM)
    expect(result.dimensions.digitalFootprint.score).toBeGreaterThan(30);

    // Subscores should reflect detection
    expect(result.dimensions.digitalFootprint.subscores.googleBusinessProfile).toBeGreaterThanOrEqual(80);
    expect(result.dimensions.digitalFootprint.subscores.socialPresence).toBeGreaterThanOrEqual(55);

    // Narrative should NOT contain "No Google Business Profile"
    expect(result.dimensions.digitalFootprint.oneLiner.toLowerCase()).not.toContain('no google business profile');
  });

  it('should sanitize quick wins to avoid contradicting detection', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'test-run-123',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    // Quick wins should be sanitized - no "Create GBP" when GBP is present
    const gbpQuickWin = result.quickWins.find(qw => qw.action.toLowerCase().includes('google business profile'));
    if (gbpQuickWin) {
      expect(gbpQuickWin.action.toLowerCase()).not.toMatch(/create.*google business profile/);
      expect(gbpQuickWin.action.toLowerCase()).toContain('optimize');
    }

    // No "Start Instagram" when Instagram is present
    const igQuickWin = result.quickWins.find(qw => qw.action.toLowerCase().includes('instagram'));
    if (igQuickWin) {
      expect(igQuickWin.action.toLowerCase()).not.toMatch(/start.*instagram/);
    }
  });

  it('should sanitize top opportunities', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'test-run-123',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    // Opportunities should be sanitized
    for (const opp of result.topOpportunities) {
      expect(opp.toLowerCase()).not.toMatch(/establish.*google business profile/);
      expect(opp.toLowerCase()).not.toMatch(/begin posting.*instagram/);
    }
  });
});

// ============================================================================
// mapBaselineCoreToFullAssessment Tests
// ============================================================================

describe('mapBaselineCoreToFullAssessment', () => {
  it('should produce valid GapFullAssessmentV1 from V2 API output', () => {
    const input: BaselineCoreToCanonicalInput = {
      coreResult: mockGapIaV2Output as any,
      metadata: {
        runId: 'test-run-456',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        companyId: 'company-456',
        source: 'os_baseline',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
      businessContext: {
        businessType: 'brick_and_mortar',
        brandTier: 'local_business',
      },
    };

    const result = mapBaselineCoreToFullAssessment(input);

    // Verify structure matches GapFullAssessmentV1
    expect(result.companyName).toBe('Atlas Skateboarding');
    expect(result.source).toBe('os_baseline');
    expect(result.overallScore).toBe(45);
    expect(result.dimensions).toBeDefined();
    expect(result.quickWins).toBeDefined();
    expect(result.topOpportunities).toBeDefined();

    // Full GAP sections should be undefined for baseline
    expect(result.strategicPriorities).toBeUndefined();
    expect(result.roadmap90Days).toBeUndefined();
    expect(result.kpis).toBeUndefined();
  });

  it('should apply gating to dimensions', () => {
    const input: BaselineCoreToCanonicalInput = {
      coreResult: mockGapIaV2Output as any,
      metadata: {
        runId: 'test-run-456',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
    };

    const result = mapBaselineCoreToFullAssessment(input);

    // DigitalFootprint should have gated subscores
    expect(result.dimensions.digitalFootprint.subscores.googleBusinessProfile).toBeGreaterThanOrEqual(80);
    expect(result.dimensions.digitalFootprint.subscores.socialPresence).toBeGreaterThanOrEqual(55);
  });
});

// ============================================================================
// projectToBaselineSummary Tests
// ============================================================================

describe('projectToBaselineSummary', () => {
  it('should produce lean projection from GapFullAssessmentV1', () => {
    const fullAssessment: GapFullAssessmentV1 = {
      companyName: 'Atlas Skateboarding',
      url: 'https://atlasskateboarding.com',
      domain: 'atlasskateboarding.com',
      source: 'baseline_context_build',
      runId: 'test-run-789',
      generatedAt: new Date().toISOString(),
      companyId: 'company-789',
      overallScore: 45,
      maturityStage: 'Emerging',
      executiveSummary: 'Atlas Skateboarding is a local retailer...',
      dimensions: mockGapIaV2Output.dimensions as any,
      quickWins: [{ action: 'Optimize GBP', dimensionId: 'digitalFootprint' }],
      topOpportunities: ['Strengthen digital presence'],
      socialFootprint: atlasLikeSnapshot,
      dataConfidence: { score: 85, level: 'high', reason: 'High detection confidence' },
      businessType: 'brick_and_mortar',
      brandTier: 'local_business',
      // Full GAP sections (should be excluded from projection)
      strategicPriorities: [{ title: 'Improve SEO', description: 'Focus on local SEO' }],
      roadmap90Days: {
        phase0_30: { whyItMatters: 'Foundation', actions: ['Set up tracking'] },
        phase30_60: { whyItMatters: 'Growth', actions: ['Expand content'] },
        phase60_90: { whyItMatters: 'Scale', actions: ['Build authority'] },
      },
      kpis: [{ name: 'Organic Traffic', whatItMeasures: 'Traffic from search', whyItMatters: 'Growth indicator', whatGoodLooksLike: '+20% MoM' }],
    };

    const summary = projectToBaselineSummary(fullAssessment);

    // Verify projection includes expected fields
    expect(summary.companyName).toBe('Atlas Skateboarding');
    expect(summary.url).toBe('https://atlasskateboarding.com');
    expect(summary.domain).toBe('atlasskateboarding.com');
    expect(summary.source).toBe('baseline_context_build');
    expect(summary.runId).toBe('test-run-789');
    expect(summary.overallScore).toBe(45);
    expect(summary.maturityStage).toBe('Emerging');
    expect(summary.dimensions).toBeDefined();
    expect(summary.quickWins).toBeDefined();
    expect(summary.topOpportunities).toBeDefined();
    expect(summary.socialFootprint).toBe(atlasLikeSnapshot);
    expect(summary.businessType).toBe('brick_and_mortar');

    // Verify projection does NOT include full GAP sections
    expect((summary as any).strategicPriorities).toBeUndefined();
    expect((summary as any).roadmap90Days).toBeUndefined();
    expect((summary as any).kpis).toBeUndefined();
  });

  it('should be a valid subset of GapFullAssessmentV1', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'test-run-subset',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasLikeSnapshot,
      },
    };

    const fullAssessment = mapInitialAssessmentToCanonical(input);
    const summary = projectToBaselineSummary(fullAssessment);

    // All BaselineGapSummary fields should match GapFullAssessmentV1
    expect(summary.companyName).toBe(fullAssessment.companyName);
    expect(summary.url).toBe(fullAssessment.url);
    expect(summary.domain).toBe(fullAssessment.domain);
    expect(summary.source).toBe(fullAssessment.source);
    expect(summary.runId).toBe(fullAssessment.runId);
    expect(summary.overallScore).toBe(fullAssessment.overallScore);
    expect(summary.maturityStage).toBe(fullAssessment.maturityStage);
    expect(summary.dimensions).toBe(fullAssessment.dimensions);
    expect(summary.quickWins).toBe(fullAssessment.quickWins);
    expect(summary.topOpportunities).toBe(fullAssessment.topOpportunities);
  });
});

// ============================================================================
// Atlas Integration Test with Real Fixture
// ============================================================================

describe('Atlas Canonical Mapper Integration', () => {
  const fixtureDir = path.join(__dirname, '../fixtures');
  let atlasSnapshot: SocialFootprintSnapshot | null = null;

  try {
    const atlasHtml = fs.readFileSync(path.join(fixtureDir, 'atlas-skateboarding.html'), 'utf-8');
    atlasSnapshot = detectSocialAndGbp({ html: atlasHtml, schemas: [] });
  } catch (e) {
    console.warn('Atlas fixture not found, using synthetic snapshot');
    atlasSnapshot = atlasLikeSnapshot;
  }

  it('should produce correct digitalFootprint subscores for Atlas', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'atlas-integration',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasSnapshot!,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);
    const df = result.dimensions.digitalFootprint;

    // Atlas has GBP - should score 80+
    expect(df.subscores.googleBusinessProfile).toBeGreaterThanOrEqual(80);

    // Atlas has Instagram + YouTube = 2 networks - should score 55+
    expect(df.subscores.socialPresence).toBeGreaterThanOrEqual(55);

    // Atlas has no LinkedIn detected - should be 0
    expect(df.subscores.linkedinPresence).toBe(0);

    // Reviews default to 50
    expect(df.subscores.reviewsReputation).toBe(50);

    // Overall score should be weighted average
    // 0.35 * 80+ + 0.35 * 55+ + 0.15 * 0 + 0.15 * 50 = 28+ + 19+ + 0 + 7.5 = 54+
    expect(df.score).toBeGreaterThanOrEqual(50);
  });

  it('should NOT produce "no GBP" narrative for Atlas', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'atlas-integration',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasSnapshot!,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    // DigitalFootprint narrative should not contradict detection
    expect(result.dimensions.digitalFootprint.oneLiner.toLowerCase()).not.toContain('no google business profile');
    expect(result.dimensions.digitalFootprint.oneLiner.toLowerCase()).not.toContain('absence of google business');
    expect(result.dimensions.digitalFootprint.oneLiner.toLowerCase()).not.toContain('lacks google business');
  });

  it('should NOT produce "Establish GBP" quick win for Atlas', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'atlas-integration',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasSnapshot!,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    for (const qw of result.quickWins) {
      expect(qw.action.toLowerCase()).not.toMatch(/establish.*google business profile/);
      expect(qw.action.toLowerCase()).not.toMatch(/create.*google business profile/);
      expect(qw.action.toLowerCase()).not.toMatch(/set up.*google business profile/);
    }
  });

  it('should NOT produce "Start Instagram" opportunity for Atlas', () => {
    const input: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'atlas-integration',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasSnapshot!,
      },
    };

    const result = mapInitialAssessmentToCanonical(input);

    for (const opp of result.topOpportunities) {
      expect(opp.toLowerCase()).not.toMatch(/begin posting.*instagram/);
      expect(opp.toLowerCase()).not.toMatch(/start.*instagram/);
    }
  });

  it('should produce consistent types across both mapping paths', () => {
    const canonicalInput: InitialAssessmentToCanonicalInput = {
      templateOutput: mockInitialAssessmentOutput,
      metadata: {
        runId: 'consistency-test',
        url: 'https://atlasskateboarding.com',
        domain: 'atlasskateboarding.com',
        companyName: 'Atlas Skateboarding',
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: atlasSnapshot!,
      },
    };

    const canonical = mapInitialAssessmentToCanonical(canonicalInput);

    // Verify we get the same dimensional structure regardless of mapping path
    expect(canonical.dimensions.brand).toHaveProperty('score');
    expect(canonical.dimensions.brand).toHaveProperty('label');
    expect(canonical.dimensions.brand).toHaveProperty('oneLiner');
    expect(canonical.dimensions.brand).toHaveProperty('issues');

    expect(canonical.dimensions.digitalFootprint).toHaveProperty('subscores');
    expect(canonical.dimensions.authority).toHaveProperty('subscores');
  });
});
