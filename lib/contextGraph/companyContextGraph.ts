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
 * Calculate completeness score for a context graph
 * Returns a percentage (0-100) based on how many fields have values
 *
 * @param graph - The context graph to evaluate
 * @param canonicalOnly - If true, only count canonical domains (default: true)
 */
export function calculateCompleteness(graph: CompanyContextGraph, canonicalOnly = true): number {
  let totalFields = 0;
  let populatedFields = 0;

  function countFields(obj: unknown, depth = 0): void {
    if (depth > 10) return; // Prevent infinite recursion

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const record = obj as Record<string, unknown>;

      // Check if this is a WithMeta object
      if ('value' in record && 'provenance' in record) {
        totalFields++;
        if (record.value !== null && record.value !== undefined) {
          if (Array.isArray(record.value) && record.value.length === 0) {
            // Empty arrays don't count as populated
          } else {
            populatedFields++;
          }
        }
      } else {
        // Recurse into nested objects
        for (const value of Object.values(record)) {
          countFields(value, depth + 1);
        }
      }
    }
  }

  // Count fields in selected domains
  const domainsToCount = canonicalOnly ? CANONICAL_DOMAIN_NAMES : DOMAIN_NAMES;
  for (const domain of domainsToCount) {
    if (graph[domain]) {
      countFields(graph[domain]);
    }
  }

  return totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
}

/**
 * Calculate coverage per domain
 * Returns a record of domain -> percentage
 */
export function calculateDomainCoverage(graph: CompanyContextGraph): Record<DomainName, number> {
  const coverage: Record<string, number> = {};

  for (const domain of DOMAIN_NAMES) {
    let totalFields = 0;
    let populatedFields = 0;

    function countDomainFields(obj: unknown, depth = 0): void {
      if (depth > 10) return;

      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const record = obj as Record<string, unknown>;

        if ('value' in record && 'provenance' in record) {
          totalFields++;
          if (record.value !== null && record.value !== undefined) {
            if (Array.isArray(record.value) && record.value.length === 0) {
              // Empty arrays don't count
            } else {
              populatedFields++;
            }
          }
        } else {
          for (const value of Object.values(record)) {
            countDomainFields(value, depth + 1);
          }
        }
      }
    }

    countDomainFields(graph[domain]);
    coverage[domain] = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
  }

  return coverage as Record<DomainName, number>;
}
