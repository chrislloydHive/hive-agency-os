// lib/contextGraph/domains/capabilities.ts
// Hive Capabilities Domain
//
// Represents the service taxonomy for what Hive can deliver.
// Agency-scoped (stored in Hive Brain) but can be overridden per-company.
//
// IMPORTANT: This domain is human-edited only. No AI auto-writes.

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

// ============================================================================
// Capability Strength Levels
// ============================================================================

export const CapabilityStrength = z.enum(['basic', 'strong', 'elite']);
export type CapabilityStrength = z.infer<typeof CapabilityStrength>;

// ============================================================================
// Single Capability Schema
// ============================================================================

/**
 * A single service capability
 */
export const Capability = z.object({
  /** Whether this capability is offered */
  enabled: WithMeta(z.boolean()),
  /** Strength/depth of capability */
  strength: WithMeta(CapabilityStrength),
  /** What we deliver for this capability */
  deliverables: WithMetaArray(z.string()),
  /** Constraints or limitations */
  constraints: WithMetaArray(z.string()),
});

export type Capability = z.infer<typeof Capability>;

/**
 * Create an empty capability (default: disabled)
 */
export function createEmptyCapability(): Capability {
  return {
    enabled: { value: false, provenance: [] },
    strength: { value: 'basic', provenance: [] },
    deliverables: { value: [], provenance: [] },
    constraints: { value: [], provenance: [] },
  };
}

// ============================================================================
// Capability Categories
// ============================================================================

/**
 * Strategy capabilities
 */
export const StrategyCapabilities = z.object({
  growthStrategy: Capability,
  measurementStrategy: Capability,
});

export type StrategyCapabilities = z.infer<typeof StrategyCapabilities>;

/**
 * Web capabilities
 */
export const WebCapabilities = z.object({
  webDesignBuild: Capability,
  conversionOptimization: Capability,
  technicalSeoFixes: Capability,
});

export type WebCapabilities = z.infer<typeof WebCapabilities>;

/**
 * Content & Creative capabilities
 */
export const ContentCreativeCapabilities = z.object({
  seoContent: Capability,
  brandContent: Capability,
  socialContent: Capability,
  performanceCreative: Capability,
  creativeTesting: Capability,
});

export type ContentCreativeCapabilities = z.infer<typeof ContentCreativeCapabilities>;

/**
 * SEO capabilities
 */
export const SeoCapabilities = z.object({
  technicalSeo: Capability,
  onPageSeo: Capability,
  contentSeo: Capability,
  localSeo: Capability,
});

export type SeoCapabilities = z.infer<typeof SeoCapabilities>;

/**
 * Paid Media capabilities
 */
export const PaidMediaCapabilities = z.object({
  search: Capability,
  socialAds: Capability,
  pmaxShopping: Capability,
  retargeting: Capability,
  landingPageProgram: Capability,
});

export type PaidMediaCapabilities = z.infer<typeof PaidMediaCapabilities>;

/**
 * Analytics capabilities
 */
export const AnalyticsCapabilities = z.object({
  ga4GtmSetup: Capability,
  conversionTracking: Capability,
  reportingDashboards: Capability,
  experimentation: Capability,
});

export type AnalyticsCapabilities = z.infer<typeof AnalyticsCapabilities>;

// ============================================================================
// Full Capabilities Domain
// ============================================================================

/**
 * Hive Capabilities Domain
 *
 * Represents all service capabilities Hive can deliver.
 * Stored in Hive Brain as agency-wide defaults.
 */
export const CapabilitiesDomain = z.object({
  strategy: StrategyCapabilities,
  web: WebCapabilities,
  contentCreative: ContentCreativeCapabilities,
  seo: SeoCapabilities,
  paidMedia: PaidMediaCapabilities,
  analytics: AnalyticsCapabilities,
});

export type CapabilitiesDomain = z.infer<typeof CapabilitiesDomain>;

// ============================================================================
// Factory Functions
// ============================================================================

function createEmptyStrategyCapabilities(): StrategyCapabilities {
  return {
    growthStrategy: createEmptyCapability(),
    measurementStrategy: createEmptyCapability(),
  };
}

function createEmptyWebCapabilities(): WebCapabilities {
  return {
    webDesignBuild: createEmptyCapability(),
    conversionOptimization: createEmptyCapability(),
    technicalSeoFixes: createEmptyCapability(),
  };
}

function createEmptyContentCreativeCapabilities(): ContentCreativeCapabilities {
  return {
    seoContent: createEmptyCapability(),
    brandContent: createEmptyCapability(),
    socialContent: createEmptyCapability(),
    performanceCreative: createEmptyCapability(),
    creativeTesting: createEmptyCapability(),
  };
}

function createEmptySeoCapabilities(): SeoCapabilities {
  return {
    technicalSeo: createEmptyCapability(),
    onPageSeo: createEmptyCapability(),
    contentSeo: createEmptyCapability(),
    localSeo: createEmptyCapability(),
  };
}

function createEmptyPaidMediaCapabilities(): PaidMediaCapabilities {
  return {
    search: createEmptyCapability(),
    socialAds: createEmptyCapability(),
    pmaxShopping: createEmptyCapability(),
    retargeting: createEmptyCapability(),
    landingPageProgram: createEmptyCapability(),
  };
}

function createEmptyAnalyticsCapabilities(): AnalyticsCapabilities {
  return {
    ga4GtmSetup: createEmptyCapability(),
    conversionTracking: createEmptyCapability(),
    reportingDashboards: createEmptyCapability(),
    experimentation: createEmptyCapability(),
  };
}

/**
 * Create an empty Capabilities domain
 */
export function createEmptyCapabilitiesDomain(): CapabilitiesDomain {
  return {
    strategy: createEmptyStrategyCapabilities(),
    web: createEmptyWebCapabilities(),
    contentCreative: createEmptyContentCreativeCapabilities(),
    seo: createEmptySeoCapabilities(),
    paidMedia: createEmptyPaidMediaCapabilities(),
    analytics: createEmptyAnalyticsCapabilities(),
  };
}

// ============================================================================
// Capability Taxonomy (for UI and AI)
// ============================================================================

/**
 * Capability category names
 */
export const CAPABILITY_CATEGORIES = [
  'strategy',
  'web',
  'contentCreative',
  'seo',
  'paidMedia',
  'analytics',
] as const;

export type CapabilityCategory = typeof CAPABILITY_CATEGORIES[number];

/**
 * All capability keys within each category
 */
export const CAPABILITY_KEYS: Record<CapabilityCategory, readonly string[]> = {
  strategy: ['growthStrategy', 'measurementStrategy'],
  web: ['webDesignBuild', 'conversionOptimization', 'technicalSeoFixes'],
  contentCreative: ['seoContent', 'brandContent', 'socialContent', 'performanceCreative', 'creativeTesting'],
  seo: ['technicalSeo', 'onPageSeo', 'contentSeo', 'localSeo'],
  paidMedia: ['search', 'socialAds', 'pmaxShopping', 'retargeting', 'landingPageProgram'],
  analytics: ['ga4GtmSetup', 'conversionTracking', 'reportingDashboards', 'experimentation'],
} as const;

/**
 * Human-readable labels for capabilities
 */
export const CAPABILITY_LABELS: Record<string, string> = {
  // Strategy
  growthStrategy: 'Growth Strategy',
  measurementStrategy: 'Measurement Strategy',
  // Web
  webDesignBuild: 'Web Design & Build',
  conversionOptimization: 'Conversion Optimization',
  technicalSeoFixes: 'Technical SEO Fixes',
  // Content & Creative
  seoContent: 'SEO Content',
  brandContent: 'Brand Content',
  socialContent: 'Social Content',
  performanceCreative: 'Performance Creative',
  creativeTesting: 'Creative Testing',
  // SEO
  technicalSeo: 'Technical SEO',
  onPageSeo: 'On-Page SEO',
  contentSeo: 'Content SEO',
  localSeo: 'Local SEO',
  // Paid Media
  search: 'Search (Google/Bing)',
  socialAds: 'Social Ads',
  pmaxShopping: 'PMax/Shopping',
  retargeting: 'Retargeting',
  landingPageProgram: 'Landing Page Program',
  // Analytics
  ga4GtmSetup: 'GA4/GTM Setup',
  conversionTracking: 'Conversion Tracking',
  reportingDashboards: 'Reporting Dashboards',
  experimentation: 'Experimentation',
};

/**
 * Human-readable labels for categories
 */
export const CATEGORY_LABELS: Record<CapabilityCategory, string> = {
  strategy: 'Strategy',
  web: 'Web',
  contentCreative: 'Content & Creative',
  seo: 'SEO',
  paidMedia: 'Paid Media',
  analytics: 'Analytics',
};

/**
 * Get human-readable label for a capability
 */
export function getCapabilityLabel(key: string): string {
  return CAPABILITY_LABELS[key] || key;
}

/**
 * Get human-readable label for a category
 */
export function getCategoryLabel(category: CapabilityCategory): string {
  return CATEGORY_LABELS[category] || category;
}
