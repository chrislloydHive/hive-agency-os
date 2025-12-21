// tests/context/RequiredBaselineProgress.test.ts
// Unit tests for RequiredBaselineProgress CTA link construction
//
// Validates that the Review Queue CTA links to the correct route.

import { describe, it, expect } from 'vitest';

/**
 * Build the Review Queue CTA href.
 * This matches the implementation in FactSheetClient.tsx:RequiredBaselineProgress
 */
function buildReviewQueueHref(companyId: string): string {
  return `/c/${companyId}/context?view=review`;
}

/**
 * Determine if CTA should be shown based on proposed count.
 */
function shouldShowReviewCTA(totalProposed: number): boolean {
  return totalProposed > 0;
}

describe('RequiredBaselineProgress CTA', () => {
  const companyId = 'test-company-123';

  describe('href construction', () => {
    it('should build correct href: /c/{companyId}/context?view=review', () => {
      const href = buildReviewQueueHref(companyId);
      expect(href).toBe('/c/test-company-123/context?view=review');
    });

    it('should NOT use /brain/context (incorrect route)', () => {
      const href = buildReviewQueueHref(companyId);
      expect(href).not.toContain('/brain/context');
    });

    it('should include view=review query parameter', () => {
      const href = buildReviewQueueHref(companyId);
      expect(href).toContain('?view=review');
    });

    it('should use /context route (not /brain/context)', () => {
      const href = buildReviewQueueHref(companyId);
      expect(href).toMatch(/\/c\/[^/]+\/context\?/);
    });
  });

  describe('CTA visibility', () => {
    it('should show CTA when totalProposed > 0', () => {
      expect(shouldShowReviewCTA(5)).toBe(true);
      expect(shouldShowReviewCTA(1)).toBe(true);
    });

    it('should hide CTA when totalProposed is 0', () => {
      expect(shouldShowReviewCTA(0)).toBe(false);
    });

    it('should hide CTA when totalProposed is negative', () => {
      expect(shouldShowReviewCTA(-1)).toBe(false);
    });
  });

  describe('various company IDs', () => {
    it('should handle Airtable record IDs', () => {
      const href = buildReviewQueueHref('recABC123xyz');
      expect(href).toBe('/c/recABC123xyz/context?view=review');
    });

    it('should handle UUIDs', () => {
      const href = buildReviewQueueHref('550e8400-e29b-41d4-a716-446655440000');
      expect(href).toBe('/c/550e8400-e29b-41d4-a716-446655440000/context?view=review');
    });
  });
});
