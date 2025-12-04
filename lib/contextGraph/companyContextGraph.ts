// lib/contextGraph/companyContextGraph.ts
// Root Company Context Graph Schema

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

/**
 * Context Graph Metadata
 * Tracks overall graph state and versioning
 */
export const ContextGraphMeta = z.object({
  version: z.string().default('1.0.0'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastFusionAt: z.string().datetime().nullable(),
  lastFusionRunId: z.string().nullable(),
  completenessScore: z.number().min(0).max(100).nullable(),
  domainCoverage: z.record(z.string(), z.number()).nullable(),
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

  // Domain Schemas
  identity: IdentityDomain,
  brand: BrandDomain,
  objectives: ObjectivesDomain,
  audience: AudienceDomain,
  productOffer: ProductOfferDomain,
  digitalInfra: DigitalInfraDomain,
  website: WebsiteDomain,
  content: ContentDomain,
  seo: SeoDomain,
  ops: OpsDomain,
  performanceMedia: PerformanceMediaDomain,
  budgetOps: BudgetOpsDomain,
  storeRisk: StoreRiskDomain,
});

export type CompanyContextGraph = z.infer<typeof CompanyContextGraph>;

/**
 * Domain names for iteration and coverage tracking
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
  'budgetOps',
  'storeRisk',
] as const;

export type DomainName = typeof DOMAIN_NAMES[number];

/**
 * Create an empty Company Context Graph
 */
export function createEmptyContextGraph(companyId: string, companyName: string): CompanyContextGraph {
  const now = new Date().toISOString();

  return {
    companyId,
    companyName,
    meta: {
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      lastFusionAt: null,
      lastFusionRunId: null,
      completenessScore: null,
      domainCoverage: null,
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
    budgetOps: createEmptyBudgetOpsDomain(),
    storeRisk: createEmptyStoreRiskDomain(),
  };
}

/**
 * Calculate completeness score for a context graph
 * Returns a percentage (0-100) based on how many fields have values
 */
export function calculateCompleteness(graph: CompanyContextGraph): number {
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

  // Count fields in each domain
  for (const domain of DOMAIN_NAMES) {
    countFields(graph[domain]);
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
