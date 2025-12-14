// lib/contextGraph/readiness/autoFill.ts
// Auto-Fill Readiness Checker
//
// Checks whether a company has the minimum and recommended fields
// populated before running the baseline context build (Autocomplete).

import type { CompanyRecord } from '@/lib/airtable/companies';
import type { CompanyContextGraph } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Auto-fill readiness status for each key field
 */
export interface AutoFillReadiness {
  /** Website domain is present (REQUIRED) */
  hasDomain: boolean;
  /** Industry is populated (recommended) */
  hasIndustry: boolean;
  /** Business model is populated (recommended) */
  hasBusinessModel: boolean;
  /** ICP hint is populated (recommended) - audience.primaryAudience or identity.icpDescription */
  hasIcpHint: boolean;
  /** Primary offering is populated (recommended) - productOffer.heroProducts or similar */
  hasPrimaryOffering: boolean;
}

/**
 * Readiness check result with actionable guidance
 */
export interface ReadinessCheckResult {
  /** The readiness status for each field */
  readiness: AutoFillReadiness;
  /** Whether the minimum requirements are met (hasDomain) */
  canProceed: boolean;
  /** Whether all recommended fields are filled */
  isFullyReady: boolean;
  /** Count of missing recommended fields */
  missingRecommendedCount: number;
  /** List of missing recommended items with labels and navigation hints */
  missingItems: ReadinessMissingItem[];
}

/**
 * A missing recommended item with navigation hint
 */
export interface ReadinessMissingItem {
  key: keyof Omit<AutoFillReadiness, 'hasDomain'>;
  label: string;
  hint: string;
  /** Where to navigate to add this field */
  navigationPath: string;
  /** Query param for deep-linking (optional) */
  navigationQuery?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a field value is considered "populated"
 */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    // Check if it's a WithMeta field
    const obj = value as Record<string, unknown>;
    if ('value' in obj) {
      return isPopulated(obj.value);
    }
    return Object.keys(obj).length > 0;
  }
  return true;
}

/**
 * Get value from a WithMeta field
 */
function getMetaValue<T>(field: { value: T | null; provenance: unknown[] } | undefined): T | null {
  return field?.value ?? null;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get auto-fill readiness status for a company
 *
 * Checks both company record fields and context graph fields to determine
 * what data is available before running the baseline build.
 *
 * @param company - The company record from Airtable
 * @param graph - The current context graph (can be null if not yet created)
 * @returns AutoFillReadiness with boolean flags for each key field
 */
export function getAutoFillReadiness(
  company: CompanyRecord,
  graph: CompanyContextGraph | null
): AutoFillReadiness {
  // Check domain from company record
  const hasDomain = Boolean(
    company.domain &&
    company.domain !== 'unknown.com' &&
    company.domain.length > 0
  );

  // Check industry - from company record OR context graph
  const hasIndustry = Boolean(
    company.industry ||
    isPopulated(getMetaValue(graph?.identity?.industry))
  );

  // Check business model - from company record (companyType) OR context graph
  const hasBusinessModel = Boolean(
    company.companyType ||
    isPopulated(getMetaValue(graph?.identity?.businessModel))
  );

  // Check ICP hint - from context graph (primaryAudience or icpDescription)
  const hasIcpHint = Boolean(
    isPopulated(getMetaValue(graph?.audience?.primaryAudience)) ||
    isPopulated(getMetaValue(graph?.identity?.icpDescription))
  );

  // Check primary offering - from context graph (heroProducts, productLines, or products)
  const hasPrimaryOffering = Boolean(
    isPopulated(getMetaValue(graph?.productOffer?.heroProducts)) ||
    isPopulated(getMetaValue(graph?.productOffer?.productLines)) ||
    isPopulated(getMetaValue(graph?.productOffer?.products))
  );

  return {
    hasDomain,
    hasIndustry,
    hasBusinessModel,
    hasIcpHint,
    hasPrimaryOffering,
  };
}

/**
 * Perform a full readiness check with actionable guidance
 *
 * @param company - The company record from Airtable
 * @param graph - The current context graph (can be null if not yet created)
 * @param companyId - The company ID for generating navigation paths
 * @returns ReadinessCheckResult with full details
 */
export function checkAutoFillReadiness(
  company: CompanyRecord,
  graph: CompanyContextGraph | null,
  companyId: string
): ReadinessCheckResult {
  const readiness = getAutoFillReadiness(company, graph);

  // Build list of missing recommended items
  const missingItems: ReadinessMissingItem[] = [];

  if (!readiness.hasIndustry) {
    missingItems.push({
      key: 'hasIndustry',
      label: 'Industry',
      hint: 'What industry does this company operate in?',
      navigationPath: `/c/${companyId}/brain/setup`,
    });
  }

  if (!readiness.hasBusinessModel) {
    missingItems.push({
      key: 'hasBusinessModel',
      label: 'Business Model',
      hint: 'SaaS, Services, eCom, Local, etc.',
      navigationPath: `/c/${companyId}/brain/setup`,
    });
  }

  if (!readiness.hasIcpHint) {
    missingItems.push({
      key: 'hasIcpHint',
      label: 'Target Customers (ICP)',
      hint: 'Who is the ideal customer?',
      navigationPath: `/c/${companyId}/brain/context`,
      navigationQuery: 'section=audience',
    });
  }

  if (!readiness.hasPrimaryOffering) {
    missingItems.push({
      key: 'hasPrimaryOffering',
      label: 'Primary Offering',
      hint: 'Main products or services offered',
      navigationPath: `/c/${companyId}/brain/context`,
      navigationQuery: 'section=productOffer',
    });
  }

  const canProceed = readiness.hasDomain;
  const isFullyReady = canProceed && missingItems.length === 0;

  return {
    readiness,
    canProceed,
    isFullyReady,
    missingRecommendedCount: missingItems.length,
    missingItems,
  };
}

/**
 * Get the best navigation path for adding missing fields
 *
 * If multiple fields are missing, navigates to Setup (general).
 * If only one specific field is missing, navigates directly to that section.
 *
 * @param result - The readiness check result
 * @returns The recommended navigation path
 */
export function getRecommendedNavigationPath(result: ReadinessCheckResult): string {
  if (result.missingItems.length === 0) {
    return ''; // No navigation needed
  }

  // If multiple items missing, go to Setup
  if (result.missingItems.length > 1) {
    const companyId = result.missingItems[0].navigationPath.split('/')[2];
    return `/c/${companyId}/brain/setup`;
  }

  // Single item missing - go directly there
  const item = result.missingItems[0];
  if (item.navigationQuery) {
    return `${item.navigationPath}?${item.navigationQuery}`;
  }
  return item.navigationPath;
}
