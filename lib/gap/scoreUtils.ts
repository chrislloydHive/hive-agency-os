// lib/gap/scoreUtils.ts
// Utility functions for GAP scoring with 4-pillar weighting

/**
 * Compute overall score from pillar scores using the official weighting:
 * - Brand & Positioning: 30%
 * - Content & Messaging: 30%
 * - SEO & Visibility: 20%
 * - Website & Conversion: 20%
 *
 * This ensures our system reflects the strategic priority of brand and content
 * over purely technical website/SEO mechanics.
 */
export function computeOverallFromPillars(params: {
  brand: number;
  content: number;
  seo: number;
  website: number;
}): number {
  const { brand, content, seo, website } = params;

  const weighted =
    0.3 * brand +
    0.3 * content +
    0.2 * seo +
    0.2 * website;

  return Math.round(weighted);
}

/**
 * Validate that dimension scores align with expected weighting
 * Returns a validation message if scores seem misaligned
 */
export function validatePillarBalance(params: {
  brand: number;
  content: number;
  seo: number;
  website: number;
  overall: number;
}): { valid: boolean; message?: string } {
  const { brand, content, seo, website, overall } = params;

  const computed = computeOverallFromPillars({ brand, content, seo, website });
  const diff = Math.abs(overall - computed);

  // Allow 5 point tolerance
  if (diff > 5) {
    return {
      valid: false,
      message: `Overall score (${overall}) deviates from weighted average (${computed}) by ${diff} points. Expected ≈30% brand + 30% content + 20% SEO + 20% website.`
    };
  }

  return { valid: true };
}
