// lib/contextGraph/fcb/extractors/index.ts
// Extractor Registry for Foundational Context Builder
//
// Each extractor takes a SignalBundle and returns extracted fields
// for a specific domain with confidence scores.

import type { ExtractorRegistry, SignalBundle, ExtractorResult } from '../types';
import { extractIdentity } from './identityExtractor';
import { extractAudience } from './audienceExtractor';
import { extractProductOffer } from './productOfferExtractor';
import { extractBrand } from './brandExtractor';
import { extractWebsite } from './websiteExtractor';
import { extractCompetitors } from './competitorExtractor';

// ============================================================================
// Extractor Registry
// ============================================================================

export const extractors: ExtractorRegistry = {
  identity: extractIdentity,
  audience: extractAudience,
  productOffer: extractProductOffer,
  brand: extractBrand,
  website: extractWebsite,
  competitive: extractCompetitors,
};

/**
 * Run all extractors on a signal bundle
 */
export async function runAllExtractors(
  signals: SignalBundle
): Promise<Record<keyof ExtractorRegistry, ExtractorResult>> {
  console.log(`[FCB Extractors] Running all extractors for ${signals.companyName}`);

  const results = await Promise.all([
    extractors.identity(signals),
    extractors.audience(signals),
    extractors.productOffer(signals),
    extractors.brand(signals),
    extractors.website(signals),
    extractors.competitive(signals),
  ]);

  return {
    identity: results[0],
    audience: results[1],
    productOffer: results[2],
    brand: results[3],
    website: results[4],
    competitive: results[5],
  };
}

// Re-export individual extractors
export { extractIdentity } from './identityExtractor';
export { extractAudience } from './audienceExtractor';
export { extractProductOffer } from './productOfferExtractor';
export { extractBrand } from './brandExtractor';
export { extractWebsite } from './websiteExtractor';
export { extractCompetitors } from './competitorExtractor';
