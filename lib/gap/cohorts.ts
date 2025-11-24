// lib/gap/cohorts.ts
// Benchmark cohort derivation and utilities

import type { CompanyType, LegacyTitleCaseCompanyType, CompanyTier, BenchmarkCohort } from './types';

/**
 * Derive a benchmark cohort string from company type and tier
 *
 * @param companyType - The company's industry/business type
 * @param tier - The company's tier (1, 2, or 3)
 * @returns Cohort string like "SaaS | Tier 1" or null if inputs are missing
 */
export function deriveBenchmarkCohort(
  companyType: string | null | undefined,
  tier: string | null | undefined
): BenchmarkCohort | null {
  if (!companyType || !tier) {
    return null;
  }

  return `${companyType} | ${tier}`;
}

/**
 * Extract company type from a cohort string
 *
 * @param cohort - Cohort string like "SaaS | Tier 1"
 * @returns Company type like "SaaS" or null
 */
export function extractCompanyTypeFromCohort(
  cohort: string | null | undefined
): string | null {
  if (!cohort) return null;

  const parts = cohort.split('|').map(p => p.trim());
  return parts[0] || null;
}

/**
 * Extract tier from a cohort string
 *
 * @param cohort - Cohort string like "SaaS | Tier 1"
 * @returns Tier like "Tier 1" or null
 */
export function extractTierFromCohort(
  cohort: string | null | undefined
): string | null {
  if (!cohort) return null;

  const parts = cohort.split('|').map(p => p.trim());
  return parts[1] || null;
}

/**
 * Normalize company type string to match our canonical types
 *
 * @param rawType - Raw company type string from user input or Airtable
 * @returns Normalized CompanyType or null
 */
export function normalizeCompanyType(rawType: string | null | undefined): LegacyTitleCaseCompanyType | null {
  if (!rawType) return null;

  const normalized = rawType.trim().toLowerCase();

  // Map common variations to canonical types
  const typeMap: Record<string, LegacyTitleCaseCompanyType> = {
    'local service': 'Local Service',
    'local services': 'Local Service',
    'local': 'Local Service',

    'b2b service': 'B2B Service',
    'b2b services': 'B2B Service',
    'b2b': 'B2B Service',

    'saas': 'SaaS',
    'software': 'SaaS',
    'software as a service': 'SaaS',

    'ecommerce': 'Ecommerce',
    'e-commerce': 'Ecommerce',
    'ecom': 'Ecommerce',
    'retail': 'Retail',

    'manufacturing': 'Manufacturing',
    'manufacturer': 'Manufacturing',

    'healthcare': 'Healthcare',
    'health care': 'Healthcare',
    'medical': 'Healthcare',

    'financial services': 'Financial Services',
    'finance': 'Financial Services',
    'fintech': 'Financial Services',

    'technology': 'Technology',
    'tech': 'Technology',
  };

  return typeMap[normalized] || 'Other';
}

/**
 * Normalize tier string to match our canonical tiers
 *
 * @param rawTier - Raw tier string from user input or Airtable
 * @returns Normalized CompanyTier or null
 */
export function normalizeTier(rawTier: string | number | null | undefined): CompanyTier | null {
  if (rawTier === null || rawTier === undefined) return null;

  const normalized = String(rawTier).trim().toLowerCase();

  // Map common variations to canonical tiers
  if (normalized === 'tier 1' || normalized === '1' || normalized === 'tier1') {
    return 'Tier 1';
  }
  if (normalized === 'tier 2' || normalized === '2' || normalized === 'tier2') {
    return 'Tier 2';
  }
  if (normalized === 'tier 3' || normalized === '3' || normalized === 'tier3') {
    return 'Tier 3';
  }

  // Default to Tier 3 for unknown values (safest assumption for small businesses)
  return 'Tier 3';
}
