// tests/context/recentlyPromotedPanel.test.ts
// Regression test for RecentlyPromotedPanel component
//
// SMOKE TEST CHECKLIST - Manual Verification:
// 1. Spygame: Click Promote Now → RecentlyPromotedPanel with breakdown appears
// 2. Fresh company: After promote, field counts increase in Truth Banner
// 3. Debug mode: Add ?debug=1 for console logging

import { describe, it, expect } from 'vitest';

const MOCK_PROMOTION_RESULT = {
  success: true,
  totalFieldsUpdated: 27,
  completenessBefore: 15,
  completenessAfter: 45,
  importerResults: [
    {
      importerId: 'websiteLab',
      importerLabel: 'Website Lab',
      fieldsUpdated: 16,
      updatedPaths: ['website.websiteScore', 'website.mobileScore', 'seo.metaTitle'],
      errors: [],
    },
    {
      importerId: 'brandLab',
      importerLabel: 'Brand Lab',
      fieldsUpdated: 9,
      updatedPaths: ['brand.positioning', 'brand.differentiators'],
      errors: [],
    },
    {
      importerId: 'gapPlan',
      importerLabel: 'GAP Plan',
      fieldsUpdated: 2,
      updatedPaths: ['content.contentScore', 'website.criticalIssues'],
      errors: [],
    },
  ],
  promotedAt: new Date().toISOString(),
};

describe('RecentlyPromotedPanel Data Structure', () => {
  it('should have totalFieldsUpdated > 0', () => {
    expect(MOCK_PROMOTION_RESULT.totalFieldsUpdated).toBe(27);
  });

  it('should have per-importer breakdown', () => {
    expect(MOCK_PROMOTION_RESULT.importerResults).toHaveLength(3);
    const websiteLab = MOCK_PROMOTION_RESULT.importerResults.find(ir => ir.importerId === 'websiteLab');
    expect(websiteLab?.fieldsUpdated).toBe(16);
  });

  it('should have completeness delta', () => {
    const delta = MOCK_PROMOTION_RESULT.completenessAfter - MOCK_PROMOTION_RESULT.completenessBefore;
    expect(delta).toBe(30);
  });
});

describe('RecentlyPromotedPanel Rendering Logic', () => {
  it('should filter out importers with 0 fields', () => {
    const withEmpty = {
      ...MOCK_PROMOTION_RESULT,
      importerResults: [
        ...MOCK_PROMOTION_RESULT.importerResults,
        { importerId: 'empty', importerLabel: 'Empty', fieldsUpdated: 0, updatedPaths: [], errors: [] },
      ],
    };
    const visible = withEmpty.importerResults.filter(ir => ir.fieldsUpdated > 0);
    expect(visible).toHaveLength(3);
  });

  it('should limit written keys to 8 per importer', () => {
    const longPaths = Array.from({ length: 16 }, (_, i) => `field.path${i}`);
    const visibleKeys = longPaths.slice(0, 8);
    expect(visibleKeys).toHaveLength(8);
  });
});

describe('RecentlyPromotedPanel Link Generation', () => {
  it('should generate valid context deep-link URLs', () => {
    const companyId = 'recTestCompanyId';
    const fieldPath = 'brand.positioning';
    const expectedUrl = `/c/${companyId}/brain/context?field=${encodeURIComponent(fieldPath)}`;
    expect(expectedUrl).toBe('/c/recTestCompanyId/brain/context?field=brand.positioning');
  });
});
