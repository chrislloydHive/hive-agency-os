// lib/gap-ia/benchmarks.ts
// Benchmark data for "How You Stack Up" section in GAP-IA reports

/**
 * Supported business types for benchmarking
 * Maps to businessContext.businessType from IA output
 */
export type BusinessTypeId =
  | 'local-consumer'
  | 'ecommerce'
  | 'b2b-saas'
  | 'professional-services'
  | 'nonprofit'
  | 'media-personal'
  | 'other';

/**
 * GAP dimension IDs
 */
export type DimensionId =
  | 'brand'
  | 'content'
  | 'seo'
  | 'website'
  | 'digitalFootprint'
  | 'authority';

/**
 * Benchmark anchors for a single dimension
 * - avg: Typical/median score for businesses in this category
 * - leader: Strong/best-in-class score (75th-90th percentile)
 */
export interface DimensionBenchmark {
  avg: number;
  leader: number;
}

/**
 * Complete benchmark set for a business type (all 6 dimensions)
 */
export type BusinessTypeBenchmarks = Record<DimensionId, DimensionBenchmark>;

/**
 * User-friendly labels for business types
 */
export const BUSINESS_TYPE_LABELS: Record<BusinessTypeId, string> = {
  'local-consumer': 'similar local businesses',
  'ecommerce': 'e-commerce companies',
  'b2b-saas': 'B2B SaaS companies',
  'professional-services': 'professional services firms',
  'nonprofit': 'nonprofit organizations',
  'media-personal': 'content creators and publishers',
  'other': 'similar businesses',
};

/**
 * Benchmark ranges by business type
 *
 * Guidelines:
 * - avg: Represents median/typical performance (40th-60th percentile)
 * - leader: Represents strong performance (75th-90th percentile)
 * - Scores are 0-100 scale
 *
 * Rationale by business type:
 *
 * Local Consumer:
 * - Lower digital footprint/authority (local presence focus)
 * - Higher website importance (conversion-focused)
 * - Moderate content (blogs, events)
 *
 * E-commerce:
 * - Strong website/SEO (discovery + conversion critical)
 * - Moderate authority (competitive space)
 * - High content (product descriptions, guides)
 *
 * B2B SaaS:
 * - Very high content/SEO (inbound marketing model)
 * - Strong digital footprint (multi-channel presence)
 * - High authority (thought leadership)
 *
 * Professional Services:
 * - Moderate across most dimensions
 * - Lower content (relationship-driven)
 * - Variable authority (depends on niche)
 *
 * Nonprofit:
 * - Lower brand/authority (budget constraints)
 * - Variable content (storytelling important)
 * - Moderate digital footprint (social focus)
 *
 * Media/Personal:
 * - Very high content (core business)
 * - Variable authority (depends on reach)
 * - Strong SEO (organic discovery)
 */
export const BENCHMARKS_BY_BUSINESS_TYPE: Record<BusinessTypeId, BusinessTypeBenchmarks> = {
  'local-consumer': {
    brand: { avg: 55, leader: 75 },
    content: { avg: 50, leader: 70 },
    seo: { avg: 45, leader: 68 },
    website: { avg: 60, leader: 80 },
    digitalFootprint: { avg: 40, leader: 65 },
    authority: { avg: 35, leader: 60 },
  },
  'ecommerce': {
    brand: { avg: 60, leader: 80 },
    content: { avg: 65, leader: 82 },
    seo: { avg: 68, leader: 85 },
    website: { avg: 70, leader: 88 },
    digitalFootprint: { avg: 55, leader: 75 },
    authority: { avg: 50, leader: 72 },
  },
  'b2b-saas': {
    brand: { avg: 65, leader: 83 },
    content: { avg: 70, leader: 88 },
    seo: { avg: 68, leader: 86 },
    website: { avg: 72, leader: 87 },
    digitalFootprint: { avg: 65, leader: 82 },
    authority: { avg: 60, leader: 80 },
  },
  'professional-services': {
    brand: { avg: 58, leader: 76 },
    content: { avg: 52, leader: 72 },
    seo: { avg: 55, leader: 74 },
    website: { avg: 62, leader: 80 },
    digitalFootprint: { avg: 48, leader: 70 },
    authority: { avg: 52, leader: 74 },
  },
  'nonprofit': {
    brand: { avg: 50, leader: 70 },
    content: { avg: 55, leader: 75 },
    seo: { avg: 48, leader: 68 },
    website: { avg: 55, leader: 75 },
    digitalFootprint: { avg: 52, leader: 72 },
    authority: { avg: 45, leader: 68 },
  },
  'media-personal': {
    brand: { avg: 62, leader: 82 },
    content: { avg: 75, leader: 90 },
    seo: { avg: 65, leader: 84 },
    website: { avg: 58, leader: 78 },
    digitalFootprint: { avg: 60, leader: 80 },
    authority: { avg: 55, leader: 78 },
  },
  'other': {
    brand: { avg: 55, leader: 75 },
    content: { avg: 55, leader: 75 },
    seo: { avg: 55, leader: 75 },
    website: { avg: 58, leader: 78 },
    digitalFootprint: { avg: 50, leader: 72 },
    authority: { avg: 50, leader: 72 },
  },
};

/**
 * Get benchmarks for a specific business type
 * Falls back to "other" if type is unknown or missing
 */
export function getBenchmarksForBusinessType(
  businessType?: string
): BusinessTypeBenchmarks {
  const normalized = (businessType || 'other').toLowerCase();

  // Check if it's a known type
  if (normalized in BENCHMARKS_BY_BUSINESS_TYPE) {
    return BENCHMARKS_BY_BUSINESS_TYPE[normalized as BusinessTypeId];
  }

  // Fallback to "other"
  return BENCHMARKS_BY_BUSINESS_TYPE.other;
}

/**
 * Get user-friendly label for a business type
 */
export function getBusinessTypeLabel(businessType?: string): string {
  const normalized = (businessType || 'other').toLowerCase();

  if (normalized in BUSINESS_TYPE_LABELS) {
    return BUSINESS_TYPE_LABELS[normalized as BusinessTypeId];
  }

  return BUSINESS_TYPE_LABELS.other;
}
