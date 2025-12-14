// lib/contextGraph/visibility.ts
// Domain Visibility Configuration
//
// Defines which Context Graph domains appear in different UI contexts.
// This is the single source of truth for domain visibility.
//
// Visibility levels:
// - core: Always visible in main Context UI (SRM fields + curated)
// - advanced: Visible in "Advanced" accordion (power users)
// - hidden: Not visible in normal UI (admin/debug only)

import type { DomainName } from './companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Domain visibility level
 */
export type DomainVisibility = 'core' | 'advanced' | 'hidden';

// ============================================================================
// Visibility Configuration
// ============================================================================

/**
 * Domain visibility configuration
 *
 * Core domains: Strategy-critical, shown to all users
 * Advanced domains: Power-user features, shown in accordion
 * Hidden domains: Lab/diagnostic data, not shown in normal UI
 */
export const DOMAIN_VISIBILITY: Record<DomainName, DomainVisibility> = {
  // Core domains - Strategy-critical, always visible
  identity: 'core',
  audience: 'core',
  productOffer: 'core',
  objectives: 'core',
  brand: 'core',
  competitive: 'core',
  operationalConstraints: 'core',

  // Advanced domains - Power-user features
  budgetOps: 'advanced',
  performanceMedia: 'advanced',
  website: 'advanced',
  ops: 'advanced',

  // Hidden domains - Lab/diagnostic data, admin-only
  digitalInfra: 'hidden',
  historical: 'hidden',
  historyRefs: 'hidden',
  storeRisk: 'hidden',
  social: 'hidden',
  content: 'hidden',
  seo: 'hidden',
  creative: 'hidden',
  capabilities: 'hidden', // Agency-scoped, edited in Hive Brain only
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get visibility level for a domain
 */
export function getDomainVisibility(domain: DomainName): DomainVisibility {
  return DOMAIN_VISIBILITY[domain] ?? 'hidden';
}

/**
 * Check if a domain is visible at a given level or above
 */
export function isDomainVisible(domain: DomainName, minLevel: DomainVisibility): boolean {
  const visibility = getDomainVisibility(domain);
  if (minLevel === 'hidden') return true;
  if (minLevel === 'advanced') return visibility === 'core' || visibility === 'advanced';
  return visibility === 'core';
}

/**
 * Get all domains at a specific visibility level
 */
export function getDomainsAtLevel(level: DomainVisibility): DomainName[] {
  return Object.entries(DOMAIN_VISIBILITY)
    .filter(([, v]) => v === level)
    .map(([k]) => k as DomainName);
}

/**
 * Get core domains (always visible)
 */
export function getCoreDomains(): DomainName[] {
  return getDomainsAtLevel('core');
}

/**
 * Get advanced domains (visible in advanced accordion)
 */
export function getAdvancedDomains(): DomainName[] {
  return getDomainsAtLevel('advanced');
}

/**
 * Get hidden domains (admin/debug only)
 */
export function getHiddenDomains(): DomainName[] {
  return getDomainsAtLevel('hidden');
}

// ============================================================================
// Domain Metadata
// ============================================================================

/**
 * Human-readable labels for domains
 */
export const DOMAIN_LABELS: Record<DomainName, string> = {
  identity: 'Company Identity',
  brand: 'Brand & Positioning',
  objectives: 'Objectives & KPIs',
  audience: 'Audience & ICP',
  productOffer: 'Product & Offer',
  digitalInfra: 'Digital Infrastructure',
  website: 'Website & UX',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  performanceMedia: 'Performance Media',
  historical: 'Historical Data',
  creative: 'Creative',
  competitive: 'Competitive Landscape',
  budgetOps: 'Budget & Unit Economics',
  operationalConstraints: 'Constraints & Compliance',
  storeRisk: 'Store Risk',
  historyRefs: 'History References',
  social: 'Social Media',
  capabilities: 'Hive Capabilities',
};

/**
 * Get human-readable label for a domain
 */
export function getDomainLabel(domain: DomainName): string {
  return DOMAIN_LABELS[domain] || domain;
}

/**
 * Domain descriptions for UI tooltips
 */
export const DOMAIN_DESCRIPTIONS: Record<DomainName, string> = {
  identity: 'Business fundamentals: model, category, geography',
  brand: 'Brand identity, positioning, and messaging',
  objectives: 'Marketing objectives, KPIs, and targets',
  audience: 'Target audience segments and ICP',
  productOffer: 'Products, services, and pricing',
  digitalInfra: 'Analytics, tracking, and tech stack',
  website: 'Website performance and UX metrics',
  content: 'Content strategy and production',
  seo: 'Search engine optimization data',
  ops: 'Operational capacity and partners',
  performanceMedia: 'Paid media channels and metrics',
  historical: 'Historical performance data',
  creative: 'Creative assets and testing',
  competitive: 'Competitor analysis',
  budgetOps: 'Budget allocation and unit economics',
  operationalConstraints: 'Compliance, restrictions, blackouts',
  storeRisk: 'Store-level risk factors',
  historyRefs: 'References to historical records',
  social: 'Social media presence and metrics',
  capabilities: 'Agency service capabilities',
};

/**
 * Get description for a domain
 */
export function getDomainDescription(domain: DomainName): string {
  return DOMAIN_DESCRIPTIONS[domain] || '';
}
