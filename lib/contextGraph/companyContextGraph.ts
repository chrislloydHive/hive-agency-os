// lib/contextGraph/companyContextGraph.ts
// Root Company Context Graph Schema
//
// CANONICAL CONTEXT DOCTRINE (see docs/context/reuse-affirmation.md):
// =======================================================================
// Context = durable, factual truth about the business.
// Context MUST NOT contain goals, scores, evaluations, or recommendations.
//
// CANONICAL DOMAINS (safe for AI and Strategy to read):
// - identity, brand, audience, productOffer, operationalConstraints,
// - competitive (facts only), ops, performanceMedia, creative, capabilities
//
// DEPRECATED DOMAINS (read-only, no new writes):
// - objectives → belongs in Strategy
// - website, content, seo → scores/evaluations belong in Diagnostics
// =======================================================================

import { z } from 'zod';
import { IdentityDomain, createEmptyIdentityDomain } from './domains/identity';
import { BrandDomain, createEmptyBrandDomain } from './domains/brand';
import { ObjectivesDomain, createEmptyObjectivesDomain } from './domains/objectives';
import { AudienceDomain, createEmptyAudienceDomain } from './domains/audience';
import { ProductOfferDomain, createEmptyProductOfferDomain } from './domains/productOffer';
import { DigitalInfraDomain, createEmptyDigitalInfraDomain } from './domains/digitalInfra';
import { WebsiteDomain, createEmptyWebsiteDomain } from './domains/website';
import { ContentDomain, createEmptyContentDomain } from './domains/content';
import { SeoDomain, createEmptySeoDomain } from './domains/seo';
import { OpsDomain, createEmptyOpsDomain } from './domains/ops';
import { PerformanceMediaDomain, createEmptyPerformanceMediaDomain } from './domains/performanceMedia';
import { BudgetOpsDomain, createEmptyBudgetOpsDomain } from './domains/budgetOps';
import { StoreRiskDomain, createEmptyStoreRiskDomain } from './domains/storeRisk';
import { HistoricalDomain, createEmptyHistoricalDomain } from './domains/historical';
import { CreativeDomain, createEmptyCreativeDomain } from './domains/creative';
import { CompetitiveDomain, createEmptyCompetitiveDomain } from './domains/competitive';
import { OperationalConstraintsDomain, createEmptyOperationalConstraintsDomain } from './domains/operationalConstraints';
import { HistoryRefsDomain, createEmptyHistoryRefsDomain } from './domains/historyRefs';
import { SocialDomain, createEmptySocialDomain } from './domains/social';
import { CapabilitiesDomain, createEmptyCapabilitiesDomain } from './domains/capabilities';

/**
 * Context Graph Metadata
 * Tracks overall graph state and versioning
 */
export const ContextGraphMeta = z.object({
  /** Schema version (2.0.0 for Phase 2) */
  version: z.string().default('2.0.0'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastFusionAt: z.string().datetime().nullable(),
  lastFusionRunId: z.string().nullable(),
  completenessScore: z.number().min(0).max(100).nullable(),
  domainCoverage: z.record(z.string(), z.number()).nullable(),
  /** Last snapshot ID for linking */
  lastSnapshotId: z.string().nullable().optional(),
  /** When baseline context build was completed (null = not initialized) */
  contextInitializedAt: z.string().datetime().nullable().optional(),
});

export type ContextGraphMeta = z.infer<typeof ContextGraphMeta>;

/**
 * Company Context Graph
 *
 * The unified, typed, structured representation of everything known about a company.
 * Each domain captures a specific aspect of company knowledge with full provenance tracking.
 *
 * This is the single source of truth that:
 * - Receives writes from all diagnostics (GAP, Labs, Brain)
 * - Provides reads for all AI features (Media Lab, Creative Lab, etc.)
 * - Tracks provenance and confidence for every field
 */
export const CompanyContextGraph = z.object({
  // Core Identifiers
  companyId: z.string(),
  companyName: z.string(),

  // Metadata
  meta: ContextGraphMeta,

  // Domain Schemas - Core
  identity: IdentityDomain,
  brand: BrandDomain,
  objectives: ObjectivesDomain,
  audience: AudienceDomain,
  productOffer: ProductOfferDomain,

  // Domain Schemas - Digital & Content
  digitalInfra: DigitalInfraDomain,
  website: WebsiteDomain,
  content: ContentDomain,
  seo: SeoDomain,
  ops: OpsDomain,

  // Domain Schemas - Media & Performance
  performanceMedia: PerformanceMediaDomain,
  historical: HistoricalDomain,
  creative: CreativeDomain,
  competitive: CompetitiveDomain,

  // Domain Schemas - Operations & Risk
  budgetOps: BudgetOpsDomain,
  operationalConstraints: OperationalConstraintsDomain,
  storeRisk: StoreRiskDomain,

  // Domain Schemas - References
  historyRefs: HistoryRefsDomain,

  // Domain Schemas - Social & Local
  social: SocialDomain,

  // Domain Schemas - Agency Capabilities (primarily Hive Brain)
  capabilities: CapabilitiesDomain,
});

export type CompanyContextGraph = z.infer<typeof CompanyContextGraph>;

/**
 * ALL domain names (including deprecated)
 * Use CANONICAL_DOMAIN_NAMES for new code
 */
export const DOMAIN_NAMES = [
  'identity',
  'brand',
  'objectives',
  'audience',
  'productOffer',
  'digitalInfra',
  'website',
  'content',
  'seo',
  'ops',
  'performanceMedia',
  'historical',
  'creative',
  'competitive',
  'budgetOps',
  'operationalConstraints',
  'storeRisk',
  'historyRefs',
  'social',
  'capabilities',
] as const;

export type DomainName = typeof DOMAIN_NAMES[number];

/**
 * CANONICAL domain names - these are the only domains that should be
 * used for new writes. Deprecated domains are read-only.
 *
 * Per the canonicalization doctrine:
 * - objectives → belongs in Strategy (deprecated)
 * - website, content, seo → scores belong in Diagnostics (deprecated)
 */
export const CANONICAL_DOMAIN_NAMES = [
  'identity',
  'brand',
  'audience',
  'productOffer',
  'ops',
  'performanceMedia',
  'creative',
  'competitive',  // facts only (competitors, notes)
  'operationalConstraints',
  'capabilities',
  'digitalInfra',
  'budgetOps',
  'historical',
  'storeRisk',
  'historyRefs',
  'social',
] as const;

export type CanonicalDomainName = typeof CANONICAL_DOMAIN_NAMES[number];

/**
 * DEPRECATED domain names - these should not receive new writes
 * Existing data is preserved for backward compatibility
 */
export const DEPRECATED_DOMAIN_NAMES = [
  'objectives',  // belongs in Strategy
  'website',     // scores belong in Diagnostics
  'content',     // scores belong in Diagnostics
  'seo',         // scores belong in Diagnostics
] as const;

export type DeprecatedDomainName = typeof DEPRECATED_DOMAIN_NAMES[number];

/**
 * Check if a domain is deprecated
 */
export function isDeprecatedDomain(domain: string): boolean {
  return (DEPRECATED_DOMAIN_NAMES as readonly string[]).includes(domain);
}

/**
 * Check if a domain is canonical
 */
export function isCanonicalDomain(domain: string): boolean {
  return (CANONICAL_DOMAIN_NAMES as readonly string[]).includes(domain);
}

/**
 * Create an empty Company Context Graph
 */
export function createEmptyContextGraph(companyId: string, companyName: string): CompanyContextGraph {
  const now = new Date().toISOString();

  return {
    companyId,
    companyName,
    meta: {
      version: '2.0.0',
      createdAt: now,
      updatedAt: now,
      lastFusionAt: null,
      lastFusionRunId: null,
      completenessScore: null,
      domainCoverage: null,
      lastSnapshotId: null,
    },
    identity: createEmptyIdentityDomain(),
    brand: createEmptyBrandDomain(),
    objectives: createEmptyObjectivesDomain(),
    audience: createEmptyAudienceDomain(),
    productOffer: createEmptyProductOfferDomain(),
    digitalInfra: createEmptyDigitalInfraDomain(),
    website: createEmptyWebsiteDomain(),
    content: createEmptyContentDomain(),
    seo: createEmptySeoDomain(),
    ops: createEmptyOpsDomain(),
    performanceMedia: createEmptyPerformanceMediaDomain(),
    historical: createEmptyHistoricalDomain(),
    creative: createEmptyCreativeDomain(),
    competitive: createEmptyCompetitiveDomain(),
    budgetOps: createEmptyBudgetOpsDomain(),
    operationalConstraints: createEmptyOperationalConstraintsDomain(),
    storeRisk: createEmptyStoreRiskDomain(),
    historyRefs: createEmptyHistoryRefsDomain(),
    social: createEmptySocialDomain(),
    capabilities: createEmptyCapabilitiesDomain(),
  };
}

/**
 * Ensure a domain exists on the graph (initializes if missing)
 * Used when loading graphs from storage that may have stripped empty domains
 */
export function ensureDomain(graph: CompanyContextGraph, domain: DomainName): void {
  if (graph[domain]) return;

  // Initialize missing domain with empty values
  const domainCreators: Record<DomainName, () => any> = {
    identity: createEmptyIdentityDomain,
    brand: createEmptyBrandDomain,
    objectives: createEmptyObjectivesDomain,
    audience: createEmptyAudienceDomain,
    productOffer: createEmptyProductOfferDomain,
    digitalInfra: createEmptyDigitalInfraDomain,
    website: createEmptyWebsiteDomain,
    content: createEmptyContentDomain,
    seo: createEmptySeoDomain,
    ops: createEmptyOpsDomain,
    performanceMedia: createEmptyPerformanceMediaDomain,
    historical: createEmptyHistoricalDomain,
    creative: createEmptyCreativeDomain,
    competitive: createEmptyCompetitiveDomain,
    budgetOps: createEmptyBudgetOpsDomain,
    operationalConstraints: createEmptyOperationalConstraintsDomain,
    storeRisk: createEmptyStoreRiskDomain,
    historyRefs: createEmptyHistoryRefsDomain,
    social: createEmptySocialDomain,
    capabilities: createEmptyCapabilitiesDomain,
  };

  const creator = domainCreators[domain];
  if (creator) {
    (graph as any)[domain] = creator();
  }
}

/**
 * WEIGHTED DOMAIN COMPLETENESS
 *
 * Domain weights for overall completeness (sum = 100):
 * - identity: 15 (business reality)
 * - brand: 20 (positioning, differentiators)
 * - audience: 15 (ICP, targeting)
 * - productOffer: 20 (value prop, products)
 * - competitive: 30 (competition is critical for strategy)
 *
 * Other domains (capabilities, etc.) are optional and don't contribute.
 */
export const DOMAIN_WEIGHTS: Partial<Record<DomainName, number>> = {
  identity: 15,
  brand: 20,
  audience: 15,
  productOffer: 20,
  competitive: 30,
};

/**
 * Required fields per domain for completeness calculation
 *
 * V1 minimal set - domains with alternatives use OR logic:
 * - identity: businessName OR industry OR businessModel (at least 2 of 3 for 100%)
 * - brand: positioning, valueProps
 * - audience: primaryAudience
 * - productOffer: valueProposition OR primaryProducts
 * - competitive: competitors (primaryCompetitors) AND positionSummary
 */
export const DOMAIN_REQUIRED_FIELDS: Partial<Record<DomainName, {
  /** Required fields (AND logic) */
  required?: string[];
  /** Alternative fields (any one satisfies) */
  anyOf?: string[];
  /** At least N of these must be present */
  atLeast?: { count: number; fields: string[] };
}>> = {
  identity: {
    atLeast: { count: 2, fields: ['businessName', 'industry', 'businessModel'] },
  },
  brand: {
    required: ['positioning'],
    anyOf: ['valueProps', 'differentiators'],
  },
  audience: {
    required: ['primaryAudience'],
  },
  productOffer: {
    anyOf: ['valueProposition', 'primaryProducts'],
  },
  competitive: {
    required: ['competitors', 'positionSummary'],
  },
};

/**
 * Legacy flat list for backward compatibility
 */
export const COMPLETENESS_REQUIRED_FIELDS: string[] = [
  'identity.businessModel',
  'audience.primaryAudience',
  'productOffer.valueProposition',
  'brand.positioning',
  'competitive.competitors',
];

/**
 * Check if a field has a meaningful value
 */
function hasFieldValue(graph: CompanyContextGraph, domain: DomainName, field: string): boolean {
  const domainObj = graph[domain];
  if (!domainObj) return false;

  const fieldObj = (domainObj as Record<string, unknown>)[field];
  if (!fieldObj || typeof fieldObj !== 'object') return false;

  const value = (fieldObj as { value?: unknown }).value;
  if (value === null || value === undefined) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'string' && value.trim() === '') return false;

  return true;
}

/**
 * Calculate coverage for a single domain
 */
function calculateSingleDomainCoverage(graph: CompanyContextGraph, domain: DomainName): number {
  const spec = DOMAIN_REQUIRED_FIELDS[domain];
  if (!spec) return 0;

  let score = 0;
  let total = 0;

  // Handle "atLeast" rule (e.g., identity needs 2 of 3)
  if (spec.atLeast) {
    const { count, fields } = spec.atLeast;
    const presentCount = fields.filter(f => hasFieldValue(graph, domain, f)).length;
    // Score is proportional: 0/count, 1/count, 2/count, etc., maxing at 100%
    score += Math.min(presentCount / count, 1);
    total += 1;
  }

  // Handle required fields (all must be present)
  if (spec.required) {
    for (const field of spec.required) {
      total += 1;
      if (hasFieldValue(graph, domain, field)) {
        score += 1;
      }
    }
  }

  // Handle anyOf fields (at least one must be present)
  if (spec.anyOf && spec.anyOf.length > 0) {
    total += 1;
    const hasAny = spec.anyOf.some(f => hasFieldValue(graph, domain, f));
    if (hasAny) {
      score += 1;
    }
  }

  return total > 0 ? (score / total) * 100 : 0;
}

/**
 * Calculate completeness score for a context graph
 * Returns a percentage (0-100) based on WEIGHTED domains and REQUIRED fields only.
 *
 * IMPORTANT:
 * - Completeness is based on REQUIRED fields, not all schema fields
 * - Domains are weighted (competitive = 30%, brand = 20%, etc.)
 * - Missing competitive context has significant impact on score
 *
 * @param graph - The context graph to evaluate
 * @param _canonicalOnly - Deprecated parameter (kept for backward compatibility)
 */
export function calculateCompleteness(graph: CompanyContextGraph, _canonicalOnly = true): number {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [domain, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    if (weight <= 0) continue;

    const domainCoverage = calculateSingleDomainCoverage(graph, domain as DomainName);
    weightedScore += (domainCoverage / 100) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
}

/**
 * Check if a domain object has any meaningful data
 */
function checkDomainForData(obj: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    if ('value' in record && 'provenance' in record) {
      const value = record.value;
      if (value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        return true;
      }
    } else {
      for (const v of Object.values(record)) {
        if (checkDomainForData(v, depth + 1)) return true;
      }
    }
  }
  return false;
}

/**
 * Calculate coverage per domain
 * Returns a record of domain -> percentage
 *
 * For domains with required fields, returns % of required fields populated.
 * For domains without required fields, returns 100 if any data exists, 0 otherwise.
 */
export function calculateDomainCoverage(graph: CompanyContextGraph): Record<DomainName, number> {
  const coverage: Record<string, number> = {};

  for (const domain of DOMAIN_NAMES) {
    const spec = DOMAIN_REQUIRED_FIELDS[domain];

    if (spec) {
      // Domain has required fields specification - use the new logic
      coverage[domain] = Math.round(calculateSingleDomainCoverage(graph, domain));
    } else {
      // Domain has no required fields - check if any data exists
      const hasData = checkDomainForData(graph[domain]);
      coverage[domain] = hasData ? 100 : 0;
    }
  }

  return coverage as Record<DomainName, number>;
}
