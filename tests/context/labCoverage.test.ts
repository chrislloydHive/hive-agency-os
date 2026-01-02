// tests/context/labCoverage.test.ts
// Tests for Lab Coverage Summary, Findings, and Promote-to-Fact APIs

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  LabCoverageSummaryResponse,
  LabFindingsResponse,
  PromoteToFactRequest,
  PromoteToFactResponse,
  LabFinding,
  LabRunSummary,
  LabKey,
} from '@/lib/types/labSummary';
import { LAB_DISPLAY_NAMES, LAB_DESCRIPTIONS } from '@/lib/types/labSummary';

// ============================================================================
// Lab Summary Types Tests
// ============================================================================

describe('Lab Summary Types', () => {
  it('defines all lab keys', () => {
    const labKeys: LabKey[] = ['websiteLab', 'competitionLab', 'brandLab', 'gapPlan'];
    expect(labKeys).toHaveLength(4);
  });

  it('has display names for all labs', () => {
    expect(LAB_DISPLAY_NAMES.websiteLab).toBe('Website Lab');
    expect(LAB_DISPLAY_NAMES.competitionLab).toBe('Competition Lab');
    expect(LAB_DISPLAY_NAMES.brandLab).toBe('Brand Lab');
    expect(LAB_DISPLAY_NAMES.gapPlan).toBe('GAP Plan');
  });

  it('has descriptions for all labs', () => {
    expect(LAB_DESCRIPTIONS.websiteLab).toBeTruthy();
    expect(LAB_DESCRIPTIONS.competitionLab).toBeTruthy();
    expect(LAB_DESCRIPTIONS.brandLab).toBeTruthy();
    expect(LAB_DESCRIPTIONS.gapPlan).toBeTruthy();
  });
});

// ============================================================================
// Lab Run Summary Structure Tests
// ============================================================================

describe('Lab Run Summary', () => {
  const mockSummary: LabRunSummary = {
    labKey: 'websiteLab',
    displayName: 'Website Lab',
    status: 'completed',
    runId: 'run-123',
    completedAt: '2024-01-15T10:00:00Z',
    findingsCount: 15,
    proposedFactsCount: 8,
    pendingReviewCount: 5,
    confirmedCount: 3,
    rejectedCount: 0,
    description: 'Analyzes website for UX, conversion, messaging, and technical issues',
  };

  it('has required fields', () => {
    expect(mockSummary.labKey).toBeDefined();
    expect(mockSummary.displayName).toBeDefined();
    expect(mockSummary.status).toBeDefined();
    expect(mockSummary.findingsCount).toBeGreaterThanOrEqual(0);
    expect(mockSummary.proposedFactsCount).toBeGreaterThanOrEqual(0);
  });

  it('tracks pending review count', () => {
    expect(mockSummary.pendingReviewCount).toBeLessThanOrEqual(mockSummary.proposedFactsCount);
  });

  it('status can be completed, running, failed, pending, or not_run', () => {
    const validStatuses = ['completed', 'running', 'failed', 'pending', 'not_run'];
    expect(validStatuses).toContain(mockSummary.status);
  });
});

// ============================================================================
// Lab Coverage Summary Response Tests
// ============================================================================

describe('Lab Coverage Summary Response', () => {
  const mockResponse: LabCoverageSummaryResponse = {
    ok: true,
    companyId: 'company-123',
    labs: [
      {
        labKey: 'websiteLab',
        displayName: 'Website Lab',
        status: 'completed',
        runId: 'run-1',
        findingsCount: 10,
        proposedFactsCount: 5,
        pendingReviewCount: 3,
        confirmedCount: 2,
        rejectedCount: 0,
        description: 'Website analysis',
      },
      {
        labKey: 'competitionLab',
        displayName: 'Competition Lab',
        status: 'not_run',
        findingsCount: 0,
        proposedFactsCount: 0,
        pendingReviewCount: 0,
        confirmedCount: 0,
        rejectedCount: 0,
        description: 'Competition analysis',
      },
    ],
    totalFindings: 10,
    totalProposedFacts: 5,
    totalPendingReview: 3,
    labsWithUnmappedFindings: [],
    lastUpdated: '2024-01-15T10:00:00Z',
  };

  it('calculates totals correctly', () => {
    const calculatedFindings = mockResponse.labs.reduce((sum, lab) => sum + lab.findingsCount, 0);
    expect(mockResponse.totalFindings).toBe(calculatedFindings);
  });

  it('identifies labs with unmapped findings', () => {
    // Lab with findings but no proposed facts should be flagged
    const labWithUnmapped: LabRunSummary = {
      labKey: 'brandLab',
      displayName: 'Brand Lab',
      status: 'completed',
      findingsCount: 5,
      proposedFactsCount: 0, // No proposed facts despite having findings
      pendingReviewCount: 0,
      confirmedCount: 0,
      rejectedCount: 0,
      description: 'Brand analysis',
    };

    const hasUnmappedFindings = labWithUnmapped.findingsCount > 0 && labWithUnmapped.proposedFactsCount === 0;
    expect(hasUnmappedFindings).toBe(true);
  });
});

// ============================================================================
// Lab Finding Structure Tests
// ============================================================================

describe('Lab Finding', () => {
  const mockFinding: LabFinding = {
    findingId: 'wl-crit-abc123',
    labKey: 'websiteLab',
    runId: 'run-123',
    title: 'Missing call-to-action on homepage',
    description: 'The homepage lacks a clear call-to-action button, reducing conversion potential.',
    impact: 'high',
    category: 'conversion',
    confidence: 0.85,
    evidence: [
      { type: 'url', url: 'https://example.com', label: 'Homepage' },
    ],
    canonicalHash: 'abc123def456',
    promotionStatus: 'not_promoted',
    recommendedTargetFields: [
      {
        fieldKey: 'website.conversionBlocks',
        fieldLabel: 'Conversion Blocks',
        reason: 'Based on conversion category',
        matchScore: 85,
        hasConfirmedValue: false,
        hasProposedValue: false,
      },
    ],
    createdAt: '2024-01-15T10:00:00Z',
  };

  it('has required fields', () => {
    expect(mockFinding.findingId).toBeDefined();
    expect(mockFinding.labKey).toBeDefined();
    expect(mockFinding.title).toBeDefined();
    expect(mockFinding.description).toBeDefined();
    expect(mockFinding.impact).toBeDefined();
    expect(mockFinding.category).toBeDefined();
    expect(mockFinding.canonicalHash).toBeDefined();
  });

  it('impact is high, medium, or low', () => {
    expect(['high', 'medium', 'low']).toContain(mockFinding.impact);
  });

  it('has valid confidence score', () => {
    expect(mockFinding.confidence).toBeGreaterThanOrEqual(0);
    expect(mockFinding.confidence).toBeLessThanOrEqual(1);
  });

  it('has promotion status', () => {
    const validStatuses = ['not_promoted', 'promoted_pending', 'promoted_confirmed', 'promoted_rejected'];
    expect(validStatuses).toContain(mockFinding.promotionStatus);
  });

  it('has recommended target fields', () => {
    expect(mockFinding.recommendedTargetFields.length).toBeGreaterThan(0);
    const firstRec = mockFinding.recommendedTargetFields[0];
    expect(firstRec.fieldKey).toBeDefined();
    expect(firstRec.matchScore).toBeGreaterThanOrEqual(0);
    expect(firstRec.matchScore).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Canonical Hash Tests
// ============================================================================

describe('Canonical Finding Hash', () => {
  it('generates consistent hash for same input', () => {
    const crypto = require('crypto');

    const generateHash = (text: string, labKey: string, findingType: string) => {
      const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
      const input = `${normalized}|${labKey}|${findingType}|`;
      return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
    };

    const hash1 = generateHash('Missing CTA button', 'websiteLab', 'critical_issue');
    const hash2 = generateHash('Missing CTA button', 'websiteLab', 'critical_issue');
    expect(hash1).toBe(hash2);
  });

  it('normalizes whitespace', () => {
    const crypto = require('crypto');

    const generateHash = (text: string, labKey: string, findingType: string) => {
      const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
      const input = `${normalized}|${labKey}|${findingType}|`;
      return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
    };

    const hash1 = generateHash('Missing  CTA   button', 'websiteLab', 'issue');
    const hash2 = generateHash('Missing CTA button', 'websiteLab', 'issue');
    expect(hash1).toBe(hash2);
  });

  it('case-insensitive', () => {
    const crypto = require('crypto');

    const generateHash = (text: string, labKey: string, findingType: string) => {
      const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
      const input = `${normalized}|${labKey}|${findingType}|`;
      return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
    };

    const hash1 = generateHash('MISSING CTA BUTTON', 'websiteLab', 'issue');
    const hash2 = generateHash('missing cta button', 'websiteLab', 'issue');
    expect(hash1).toBe(hash2);
  });

  it('different inputs produce different hashes', () => {
    const crypto = require('crypto');

    const generateHash = (text: string, labKey: string, findingType: string) => {
      const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
      const input = `${normalized}|${labKey}|${findingType}|`;
      return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
    };

    const hash1 = generateHash('Missing CTA button', 'websiteLab', 'issue');
    const hash2 = generateHash('Missing contact form', 'websiteLab', 'issue');
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// Promote to Fact Request Tests
// ============================================================================

describe('Promote to Fact Request', () => {
  const mockRequest: PromoteToFactRequest = {
    labKey: 'websiteLab',
    findingId: 'wl-crit-abc123',
    targetFieldKey: 'website.conversionBlocks',
    summary: 'Homepage lacks clear CTA button',
    detailedText: 'The homepage lacks a clear call-to-action button, reducing conversion potential.',
    evidenceRefs: ['https://example.com'],
    confidence: 0.85,
  };

  it('has required fields', () => {
    expect(mockRequest.labKey).toBeDefined();
    expect(mockRequest.findingId).toBeDefined();
    expect(mockRequest.targetFieldKey).toBeDefined();
    expect(mockRequest.summary).toBeDefined();
  });

  it('targetFieldKey has correct format', () => {
    expect(mockRequest.targetFieldKey).toContain('.');
  });

  it('confidence is optional', () => {
    const requestWithoutConfidence: PromoteToFactRequest = {
      labKey: 'websiteLab',
      findingId: 'wl-crit-abc123',
      targetFieldKey: 'website.conversionBlocks',
      summary: 'Homepage lacks clear CTA button',
    };
    expect(requestWithoutConfidence.confidence).toBeUndefined();
  });
});

// ============================================================================
// Promote to Fact Response Tests
// ============================================================================

describe('Promote to Fact Response', () => {
  it('success response has proposed fact', () => {
    const successResponse: PromoteToFactResponse = {
      ok: true,
      proposedFact: {
        key: 'website.conversionBlocks',
        value: 'Homepage lacks clear CTA button',
        dedupeKey: 'abc123',
      },
    };

    expect(successResponse.ok).toBe(true);
    expect(successResponse.proposedFact).toBeDefined();
    expect(successResponse.proposedFact?.key).toBe('website.conversionBlocks');
  });

  it('duplicate response has duplicate flag', () => {
    const duplicateResponse: PromoteToFactResponse = {
      ok: true,
      duplicate: true,
      proposedFact: {
        key: 'website.conversionBlocks',
        value: 'Homepage lacks clear CTA button',
        dedupeKey: 'abc123',
      },
    };

    expect(duplicateResponse.ok).toBe(true);
    expect(duplicateResponse.duplicate).toBe(true);
  });

  it('blocked response has block reason', () => {
    const blockedResponse: PromoteToFactResponse = {
      ok: false,
      blocked: true,
      blockReason: 'This field has a confirmed value that cannot be overwritten',
      error: 'Field website.conversionBlocks is already confirmed',
    };

    expect(blockedResponse.ok).toBe(false);
    expect(blockedResponse.blocked).toBe(true);
    expect(blockedResponse.blockReason).toBeDefined();
  });
});

// ============================================================================
// Findings Grouping Tests
// ============================================================================

describe('Findings Grouping', () => {
  const mockFindings: LabFinding[] = [
    {
      findingId: 'f1',
      labKey: 'websiteLab',
      runId: 'run-1',
      title: 'CTA Issue',
      description: 'Missing CTA',
      impact: 'high',
      category: 'conversion',
      confidence: 0.9,
      evidence: [],
      canonicalHash: 'hash1',
      promotionStatus: 'not_promoted',
      recommendedTargetFields: [],
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      findingId: 'f2',
      labKey: 'websiteLab',
      runId: 'run-1',
      title: 'UX Issue',
      description: 'Navigation confusing',
      impact: 'medium',
      category: 'ux',
      confidence: 0.8,
      evidence: [],
      canonicalHash: 'hash2',
      promotionStatus: 'not_promoted',
      recommendedTargetFields: [],
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      findingId: 'f3',
      labKey: 'websiteLab',
      runId: 'run-1',
      title: 'Another Conversion Issue',
      description: 'Form too long',
      impact: 'high',
      category: 'conversion',
      confidence: 0.85,
      evidence: [],
      canonicalHash: 'hash3',
      promotionStatus: 'not_promoted',
      recommendedTargetFields: [],
      createdAt: '2024-01-15T10:00:00Z',
    },
  ];

  it('groups findings by category', () => {
    const groups = new Map<string, LabFinding[]>();
    for (const finding of mockFindings) {
      const existing = groups.get(finding.category) || [];
      existing.push(finding);
      groups.set(finding.category, existing);
    }

    expect(groups.get('conversion')?.length).toBe(2);
    expect(groups.get('ux')?.length).toBe(1);
  });

  it('counts high impact findings per group', () => {
    const groups = new Map<string, LabFinding[]>();
    for (const finding of mockFindings) {
      const existing = groups.get(finding.category) || [];
      existing.push(finding);
      groups.set(finding.category, existing);
    }

    const conversionGroup = groups.get('conversion') || [];
    const highImpactCount = conversionGroup.filter(f => f.impact === 'high').length;
    expect(highImpactCount).toBe(2);
  });

  it('calculates stats correctly', () => {
    const stats = {
      byImpact: {
        high: mockFindings.filter(f => f.impact === 'high').length,
        medium: mockFindings.filter(f => f.impact === 'medium').length,
        low: mockFindings.filter(f => f.impact === 'low').length,
      },
      promoted: mockFindings.filter(f => f.promotionStatus !== 'not_promoted').length,
      notPromoted: mockFindings.filter(f => f.promotionStatus === 'not_promoted').length,
    };

    expect(stats.byImpact.high).toBe(2);
    expect(stats.byImpact.medium).toBe(1);
    expect(stats.byImpact.low).toBe(0);
    expect(stats.notPromoted).toBe(3);
  });
});

// ============================================================================
// Dedupe Group Tests
// ============================================================================

describe('Dedupe Grouping', () => {
  it('identifies duplicate proposals by canonical hash', () => {
    const proposals = [
      { key: 'website.summary', canonicalHash: 'hash1', value: 'Summary text' },
      { key: 'brand.positioning', canonicalHash: 'hash1', value: 'Summary text' }, // Same hash
      { key: 'productOffer.description', canonicalHash: 'hash2', value: 'Different text' },
    ];

    // Group by canonical hash
    const groups = new Map<string, typeof proposals>();
    for (const proposal of proposals) {
      const existing = groups.get(proposal.canonicalHash) || [];
      existing.push(proposal);
      groups.set(proposal.canonicalHash, existing);
    }

    // hash1 has 2 proposals
    expect(groups.get('hash1')?.length).toBe(2);
    // hash2 has 1 proposal
    expect(groups.get('hash2')?.length).toBe(1);
  });

  it('generates used-by-X-fields count', () => {
    const dedupeGroups = [
      { canonicalHash: 'hash1', targetFieldKeys: ['website.summary', 'brand.positioning'] },
      { canonicalHash: 'hash2', targetFieldKeys: ['productOffer.description'] },
    ];

    expect(dedupeGroups[0].targetFieldKeys.length).toBe(2);
    expect(dedupeGroups[1].targetFieldKeys.length).toBe(1);
  });
});
