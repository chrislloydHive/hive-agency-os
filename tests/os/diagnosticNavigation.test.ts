// tests/os/diagnosticNavigation.test.ts
// Tests for diagnostic navigation helpers
//
// Verifies that getPrimaryRunViewHref routes to the correct pages.

import { describe, it, expect } from 'vitest';
import {
  getPrimaryRunViewHref,
  getToolHubHref,
  hasDedicatedViewPage,
  normalizeToolId,
} from '@/lib/os/diagnostics/navigation';

describe('Diagnostic Navigation', () => {
  describe('getPrimaryRunViewHref', () => {
    it('should route websiteLab to dedicated V5 page with runId', () => {
      const href = getPrimaryRunViewHref({
        companyId: 'company_123',
        toolId: 'websiteLab',
        runId: 'run_456',
      });

      expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
    });

    it('should route websiteLab without runId to hub page', () => {
      const href = getPrimaryRunViewHref({
        companyId: 'company_123',
        toolId: 'websiteLab',
      });

      expect(href).toBe('/c/company_123/diagnostics/website');
    });

    it('should route brandLab to generic report page with runId', () => {
      const href = getPrimaryRunViewHref({
        companyId: 'company_123',
        toolId: 'brandLab',
        runId: 'run_789',
      });

      expect(href).toBe('/c/company_123/reports/brand/run_789');
    });

    it('should route brandLab without runId to diagnostics hub', () => {
      const href = getPrimaryRunViewHref({
        companyId: 'company_123',
        toolId: 'brandLab',
      });

      expect(href).toBe('/c/company_123/diagnostics/brand');
    });

    it('should route gapSnapshot to generic report page', () => {
      const href = getPrimaryRunViewHref({
        companyId: 'company_abc',
        toolId: 'gapSnapshot',
        runId: 'gap_run_1',
      });

      expect(href).toBe('/c/company_abc/reports/gapsnapshot/gap_run_1');
    });

    it('should route competitionLab correctly', () => {
      const href = getPrimaryRunViewHref({
        companyId: 'company_xyz',
        toolId: 'competitionLab',
        runId: 'comp_run',
      });

      expect(href).toBe('/c/company_xyz/reports/competition/comp_run');
    });

    // Tool ID alias tests - all variants should resolve to the same canonical URL
    describe('tool ID aliases', () => {
      it('should normalize "website" alias to websiteLab canonical route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'website',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
      });

      it('should normalize "website-lab" alias to websiteLab canonical route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'website-lab',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
      });

      it('should normalize "websiteLab" (camelCase) to canonical route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'websiteLab',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
      });

      it('should normalize "websiteLabV5" alias to websiteLab canonical route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'websiteLabV5',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
      });

      it('should normalize "brand" alias to brandLab route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'brand',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/reports/brand/run_456');
      });

      it('should normalize "brand-lab" alias to brandLab route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'brand-lab',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/reports/brand/run_456');
      });

      it('should normalize "gap" alias to gapSnapshot route', () => {
        const href = getPrimaryRunViewHref({
          companyId: 'company_123',
          toolId: 'gap',
          runId: 'run_456',
        });

        expect(href).toBe('/c/company_123/reports/gapsnapshot/run_456');
      });
    });
  });

  describe('getToolHubHref', () => {
    it('should return hub path for websiteLab', () => {
      const href = getToolHubHref('company_123', 'websiteLab');
      expect(href).toBe('/c/company_123/diagnostics/website');
    });

    it('should return hub path for brandLab', () => {
      const href = getToolHubHref('company_123', 'brandLab');
      expect(href).toBe('/c/company_123/diagnostics/brand');
    });
  });

  describe('hasDedicatedViewPage', () => {
    it('should return true for websiteLab', () => {
      expect(hasDedicatedViewPage('websiteLab')).toBe(true);
    });

    it('should return false for brandLab', () => {
      expect(hasDedicatedViewPage('brandLab')).toBe(false);
    });

    it('should return false for gapSnapshot', () => {
      expect(hasDedicatedViewPage('gapSnapshot')).toBe(false);
    });
  });

  describe('normalizeToolId', () => {
    it('should normalize websiteLab variants', () => {
      expect(normalizeToolId('websiteLab')).toBe('websiteLab');
      expect(normalizeToolId('website')).toBe('websiteLab');
      expect(normalizeToolId('website-lab')).toBe('websiteLab');
      expect(normalizeToolId('websiteLabV5')).toBe('websiteLab');
      expect(normalizeToolId('WEBSITE')).toBe('websiteLab');
      expect(normalizeToolId('Website-Lab')).toBe('websiteLab');
    });

    it('should normalize brandLab variants', () => {
      expect(normalizeToolId('brandLab')).toBe('brandLab');
      expect(normalizeToolId('brand')).toBe('brandLab');
      expect(normalizeToolId('brand-lab')).toBe('brandLab');
    });

    it('should normalize competitionLab variants', () => {
      expect(normalizeToolId('competitionLab')).toBe('competitionLab');
      expect(normalizeToolId('competition')).toBe('competitionLab');
      expect(normalizeToolId('competition-lab')).toBe('competitionLab');
    });

    it('should normalize seoLab variants', () => {
      expect(normalizeToolId('seoLab')).toBe('seoLab');
      expect(normalizeToolId('seo')).toBe('seoLab');
      expect(normalizeToolId('seo-lab')).toBe('seoLab');
    });

    it('should normalize gapSnapshot variants', () => {
      expect(normalizeToolId('gapSnapshot')).toBe('gapSnapshot');
      expect(normalizeToolId('gap')).toBe('gapSnapshot');
      expect(normalizeToolId('GAP')).toBe('gapSnapshot');
    });

    it('should pass through unknown tool IDs unchanged', () => {
      expect(normalizeToolId('unknownTool')).toBe('unknownTool');
      expect(normalizeToolId('customDiagnostic')).toBe('customDiagnostic');
    });
  });
});

describe('Artifact Visibility', () => {
  // Import dynamically to avoid module resolution issues in test
  it('should return documents_only for lab reports', async () => {
    const { getDefaultVisibility, ArtifactType, ArtifactVisibility } = await import('@/lib/types/artifactTaxonomy');

    expect(getDefaultVisibility(ArtifactType.LabReportWebsite)).toBe(ArtifactVisibility.DocumentsOnly);
    expect(getDefaultVisibility(ArtifactType.LabReportBrand)).toBe(ArtifactVisibility.DocumentsOnly);
    expect(getDefaultVisibility(ArtifactType.GapReport)).toBe(ArtifactVisibility.DocumentsOnly);
  });

  it('should return nav_visible for strategy docs', async () => {
    const { getDefaultVisibility, ArtifactType, ArtifactVisibility } = await import('@/lib/types/artifactTaxonomy');

    expect(getDefaultVisibility(ArtifactType.StrategyDoc)).toBe(ArtifactVisibility.NavVisible);
    expect(getDefaultVisibility(ArtifactType.StrategyBrief)).toBe(ArtifactVisibility.NavVisible);
  });

  it('should return documents_only by default', async () => {
    const { getDefaultVisibility, ArtifactType, ArtifactVisibility } = await import('@/lib/types/artifactTaxonomy');

    expect(getDefaultVisibility(ArtifactType.Custom)).toBe(ArtifactVisibility.DocumentsOnly);
    expect(getDefaultVisibility(ArtifactType.RfpResponse)).toBe(ArtifactVisibility.DocumentsOnly);
  });
});
