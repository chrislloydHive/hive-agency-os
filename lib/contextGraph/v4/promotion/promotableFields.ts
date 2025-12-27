// lib/contextGraph/v4/promotion/promotableFields.ts
// Promotable Fields Configuration for GAP/Labs → Context V4 Promotion
//
// Defines which Context V4 fields can be promoted from diagnostic outputs.
// This is a strict allowlist - only fields listed here can be confirmed from proposals.

import type { ContextV4Key } from '@/lib/os/ai/strategyFieldContracts';

// ============================================================================
// Promotable Fields Definition
// ============================================================================

/**
 * Fields that can be promoted from GAP/Labs to Context V4.
 *
 * This is the MVP allowlist - keep it small and expand as needed.
 * Each field is critical for strategy generation and has reliable extraction
 * from diagnostic outputs.
 */
export const PROMOTABLE_FIELDS: ContextV4Key[] = [
  'identity.businessModel',
  'audience.icpDescription',
  'brand.positioning',
  'brand.differentiators',
];

/**
 * Extended promotable fields for Phase 2
 * (Not enabled in MVP, but documented for future expansion)
 */
export const PROMOTABLE_FIELDS_EXTENDED: ContextV4Key[] = [
  // Phase 1 (MVP)
  'identity.businessModel',
  'audience.icpDescription',
  'brand.positioning',
  'brand.differentiators',
  // Phase 2 (Future)
  'productOffer.valueProposition',
  'audience.primaryAudience',
  'audience.painPoints',
  'competitive.competitors',
  'identity.industry',
];

/**
 * Human-readable labels for promotable fields
 */
export const PROMOTABLE_FIELD_LABELS: Record<string, string> = {
  'identity.businessModel': 'Business Model',
  'audience.icpDescription': 'ICP Description',
  'brand.positioning': 'Brand Positioning',
  'brand.differentiators': 'Differentiators',
  'productOffer.valueProposition': 'Value Proposition',
  'audience.primaryAudience': 'Primary Audience',
  'audience.painPoints': 'Pain Points',
  'competitive.competitors': 'Competitors',
  'identity.industry': 'Industry',
};

/**
 * Get the human-readable label for a promotable field
 */
export function getPromotableFieldLabel(fieldKey: string): string {
  return PROMOTABLE_FIELD_LABELS[fieldKey] || fieldKey.split('.').pop() || fieldKey;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a field key is promotable (in the allowlist)
 */
export function isPromotableField(fieldKey: string): boolean {
  return PROMOTABLE_FIELDS.includes(fieldKey as ContextV4Key);
}

/**
 * Filter a list of field keys to only promotable ones
 */
export function filterPromotableFields(fieldKeys: string[]): string[] {
  return fieldKeys.filter(isPromotableField);
}

/**
 * Get the set of promotable fields for quick lookup
 */
export function getPromotableFieldSet(): Set<string> {
  return new Set(PROMOTABLE_FIELDS);
}

// ============================================================================
// Source Configuration
// ============================================================================

/**
 * Source types that can generate promotable proposals
 */
export type PromotionSourceType =
  | 'full_gap'       // Full GAP Report
  | 'gap_ia'         // GAP Initial Assessment
  | 'website_lab'    // Website Lab
  | 'brand_lab'      // Brand Lab
  | 'audience_lab'   // Audience Lab (Personas/Models)
  | 'competition_lab' // Competition Lab
  | 'content_lab'    // Content Lab
  | 'seo_lab'        // SEO Lab
  | 'manual';        // Manual entry

/**
 * Priority ordering for promotion sources (higher = more trusted)
 */
export const PROMOTION_SOURCE_PRIORITY: Record<PromotionSourceType, number> = {
  full_gap: 90,        // Highest - comprehensive analysis
  gap_ia: 75,          // Initial assessment
  brand_lab: 80,       // Brand-focused deep analysis
  audience_lab: 75,    // Audience-focused analysis
  competition_lab: 70, // Competition-focused analysis
  website_lab: 65,     // Website extraction
  content_lab: 60,     // Content analysis
  seo_lab: 55,         // SEO analysis
  manual: 100,         // Manual always wins
};

/**
 * Get priority for a promotion source
 */
export function getPromotionSourcePriority(source: PromotionSourceType): number {
  return PROMOTION_SOURCE_PRIORITY[source] ?? 50;
}

/**
 * Human-readable labels for promotion sources
 */
export const PROMOTION_SOURCE_LABELS: Record<PromotionSourceType, string> = {
  full_gap: 'Full GAP Report',
  gap_ia: 'GAP Initial Assessment',
  website_lab: 'Website Lab',
  brand_lab: 'Brand Lab',
  audience_lab: 'Audience Lab',
  competition_lab: 'Competition Lab',
  content_lab: 'Content Lab',
  seo_lab: 'SEO Lab',
  manual: 'Manual Entry',
};

/**
 * Get the human-readable label for a promotion source
 */
export function getPromotionSourceLabel(source: PromotionSourceType): string {
  return PROMOTION_SOURCE_LABELS[source] || source;
}

// ============================================================================
// Field-to-Source Mapping
// ============================================================================

/**
 * Which sources can provide which fields
 * Used to determine which diagnostics to check for a given field
 */
export const FIELD_SOURCE_MAPPING: Record<string, PromotionSourceType[]> = {
  'identity.businessModel': ['full_gap', 'brand_lab', 'website_lab'],
  'audience.icpDescription': ['brand_lab', 'audience_lab', 'full_gap'],
  'brand.positioning': ['brand_lab', 'full_gap'],
  'brand.differentiators': ['brand_lab', 'full_gap', 'competition_lab'],
  'productOffer.valueProposition': ['brand_lab', 'website_lab', 'full_gap'],
  'audience.primaryAudience': ['brand_lab', 'audience_lab'],
  'audience.painPoints': ['audience_lab', 'brand_lab'],
  'competitive.competitors': ['competition_lab'],
  'identity.industry': ['website_lab', 'brand_lab', 'full_gap'],
};

/**
 * Get the preferred sources for a field
 */
export function getFieldSources(fieldKey: string): PromotionSourceType[] {
  return FIELD_SOURCE_MAPPING[fieldKey] || [];
}

/**
 * Get the best source for a field (first in priority list)
 */
export function getBestSourceForField(fieldKey: string): PromotionSourceType | null {
  const sources = FIELD_SOURCE_MAPPING[fieldKey];
  if (!sources || sources.length === 0) return null;

  // Sort by priority and return highest
  return sources.sort((a, b) =>
    getPromotionSourcePriority(b) - getPromotionSourcePriority(a)
  )[0];
}

// ============================================================================
// Field Configuration
// ============================================================================

/**
 * Configuration for a promotable field
 */
export interface PromotableFieldConfig {
  /** Field key */
  key: string;
  /** Human-readable label */
  label: string;
  /** Allowed sources for this field */
  sources: PromotionSourceType[];
  /** Whether this field is in the MVP allowlist */
  isMvp: boolean;
}

/**
 * Get full configuration for a promotable field
 */
export function getPromotableFieldConfig(fieldKey: string): PromotableFieldConfig | null {
  const label = PROMOTABLE_FIELD_LABELS[fieldKey];
  if (!label) return null;

  return {
    key: fieldKey,
    label,
    sources: FIELD_SOURCE_MAPPING[fieldKey] || [],
    isMvp: PROMOTABLE_FIELDS.includes(fieldKey as ContextV4Key),
  };
}

/**
 * Get all promotable field configurations
 */
export function getAllPromotableFieldConfigs(): PromotableFieldConfig[] {
  return PROMOTABLE_FIELDS.map((key) => ({
    key,
    label: PROMOTABLE_FIELD_LABELS[key] || key,
    sources: FIELD_SOURCE_MAPPING[key] || [],
    isMvp: true,
  }));
}
