// tests/context/v4-autoProposeBaseline.test.ts
// Tests for auto-propose baseline functionality
//
// Verifies that required strategy fields are automatically proposed
// after Labs complete, without auto-confirming.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock feature flags
vi.mock('@/lib/types/contextField', () => ({
  isContextV4Enabled: vi.fn(() => true),
  isContextV4IngestWebsiteLabEnabled: vi.fn(() => true),
  isContextV4AutoProposeBaselineEnabled: vi.fn(() => true),
}));

// Mock fieldStoreV4
vi.mock('@/lib/contextGraph/fieldStoreV4', () => ({
  loadContextFieldsV4: vi.fn(() => Promise.resolve({
    companyId: 'test-company',
    meta: { lastUpdated: new Date().toISOString() },
    fields: {},
  })),
}));

// Mock diagnostic runs
vi.mock('@/lib/os/diagnostics/runs', () => ({
  getLatestRunForCompanyAndTool: vi.fn(() =>
    Promise.resolve({
      id: 'run-123',
      companyId: 'test-company',
      toolId: 'websiteLab',
      status: 'complete',
      rawJson: {
        rawEvidence: {
          labResultV4: {
            siteAssessment: {
              score: 75,
              executiveSummary: 'Test summary',
            },
            siteGraph: {
              nodes: [],
              edges: [],
            },
          },
        },
      },
    })
  ),
}));

// Mock websiteLabCandidates - provide candidates that match required fields
vi.mock('@/lib/contextGraph/v4/websiteLabCandidates', () => ({
  extractWebsiteLabResult: vi.fn(() => ({
    siteAssessment: { score: 75 },
  })),
  buildWebsiteLabCandidates: vi.fn(() => ({
    candidates: [
      // Brand positioning is a required field
      {
        key: 'brand.positioning',
        value: 'Test brand positioning',
        confidence: 0.85,
        source: 'lab',
      },
      // Also include a non-required field to verify filtering
      {
        key: 'website.websiteScore',
        value: 75,
        confidence: 0.85,
        source: 'lab',
      },
    ],
    extractionPath: 'rawEvidence.labResultV4',
    skipped: { wrongDomain: 0 },
    skippedWrongDomainKeys: [],
  })),
}));

// Mock requiredStrategyFields to return predictable missing fields
vi.mock('@/lib/contextGraph/v4/requiredStrategyFields', () => ({
  getMissingRequiredV4: vi.fn(() => [
    {
      path: 'brand.positioning',
      domain: 'brand',
      field: 'positioning',
      label: 'Brand Positioning',
      reason: 'Strategy must align with brand positioning',
      alternatives: ['brand.valueProps'],
    },
  ]),
}));

// Mock propose - use hoisted vi.fn()
vi.mock('@/lib/contextGraph/v4/propose', () => ({
  proposeFromLabResult: vi.fn(() =>
    Promise.resolve({
      proposed: 1,
      blocked: 0,
      replaced: 0,
      errors: [],
      proposedKeys: ['website.websiteScore'],
      blockedKeys: [],
    })
  ),
}));

// Import after mocks are set up
import { autoProposeBaselineIfNeeded } from '@/lib/contextGraph/v4/autoProposeBaseline';
import { proposeFromLabResult } from '@/lib/contextGraph/v4/propose';

// ============================================================================
// Tests
// ============================================================================

describe('autoProposeBaselineIfNeeded', () => {
  const mockProposeFromLabResult = vi.mocked(proposeFromLabResult);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when feature flag is enabled', () => {
    it('should propose missing required fields after WebsiteLab completion', async () => {
      const result = await autoProposeBaselineIfNeeded({
        companyId: 'test-company',
        triggeredBy: 'websiteLab',
        runId: 'run-123',
      });

      // Should attempt to propose
      expect(result.attempted).toBeGreaterThan(0);

      // Should have called proposeFromLabResult
      expect(mockProposeFromLabResult).toHaveBeenCalled();
    });

    it('should be idempotent - second call should be debounced', async () => {
      // First call
      await autoProposeBaselineIfNeeded({
        companyId: 'test-debounce',
        triggeredBy: 'websiteLab',
        runId: 'run-123',
      });

      // Clear mock to count second call
      mockProposeFromLabResult.mockClear();

      // Second call within debounce window
      const result2 = await autoProposeBaselineIfNeeded({
        companyId: 'test-debounce',
        triggeredBy: 'websiteLab',
        runId: 'run-123',
      });

      // Should be debounced (no proposals)
      expect(result2.attempted).toBe(0);
      expect(mockProposeFromLabResult).not.toHaveBeenCalled();
    });
  });

  describe('when feature flag is disabled', () => {
    it('should return early with no proposals', async () => {
      // Temporarily disable the flag
      const { isContextV4AutoProposeBaselineEnabled } = await import('@/lib/types/contextField');
      vi.mocked(isContextV4AutoProposeBaselineEnabled).mockReturnValue(false);

      const result = await autoProposeBaselineIfNeeded({
        companyId: 'test-company-disabled',
        triggeredBy: 'websiteLab',
      });

      expect(result.attempted).toBe(0);
      expect(result.created).toBe(0);

      // Restore
      vi.mocked(isContextV4AutoProposeBaselineEnabled).mockReturnValue(true);
    });
  });

  describe('error handling', () => {
    it('should not throw when proposal fails', async () => {
      // Make proposeFromLabResult throw
      mockProposeFromLabResult.mockRejectedValueOnce(new Error('Test error'));

      // Should not throw
      const result = await autoProposeBaselineIfNeeded({
        companyId: 'test-company-error',
        triggeredBy: 'websiteLab',
      });

      // Should report failure
      expect(result.failed).toBeGreaterThan(0);
    });
  });
});
