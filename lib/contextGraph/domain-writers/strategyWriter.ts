// lib/contextGraph/domain-writers/strategyWriter.ts
// Strategy Writer - Syncs strategic plan edits to Context Graph
//
// This writer is used when:
// - A user edits fields in the QBR Strategic Plan
// - A snapshot is being created
// - SSM produces strategic recommendations
//
// Strategy fields are authoritative (high confidence) since they represent
// deliberate strategic decisions by the user.

import { loadContextGraph, saveContextGraph } from '../storage';
import { setFieldUntyped, createProvenance, type ProvenanceSource } from '../mutate';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import type { ProvenanceTag } from '../types';
import {
  isHumanSource,
  getSourceDisplayName,
  getAuthoritativeSourcesForDomain,
} from '../sourcePriority';

// ============================================================================
// Types
// ============================================================================

export interface StrategyField {
  path: string;        // e.g. 'identity.businessName', 'brand.positioning'
  value: unknown;      // The value to set
  confidence?: number; // Override confidence (default 0.9)
}

export interface WriteStrategyParams {
  companyId: string;
  strategy: Record<string, unknown>;  // path → value mapping
  runId?: string;
  sourceType?: ProvenanceSource;
  sourceName?: string;
}

export interface WriteStrategyResult {
  success: boolean;
  fieldsWritten: number;
  fieldsSkipped: number;
  errors: string[];
}

// ============================================================================
// Strategy Field Definitions
// ============================================================================

/**
 * All strategic fields organized by domain
 */
export const STRATEGY_FIELDS = {
  // Core Identity & Vision
  identity: [
    'businessName',
    'industry',
    'businessModel',
    'geographicFootprint',
    'marketMaturity',
    'competitiveLandscape',
    'uniqueSellingPoints',
    'northStar',
    'vision',
    'mission',
  ],

  // Business Objectives
  objectives: [
    'primaryObjective',
    'secondaryObjectives',
    'kpiLabels',
    'targetCpa',
    'targetRoas',
    'targetRevenue',
    'timeHorizon',
    'growthGoals',
    'successMetrics',
  ],

  // Brand Strategy
  brand: [
    'positioning',
    'valueProps',
    'differentiators',
    'toneOfVoice',
    'brandPersonality',
    'brandStrengths',
    'brandWeaknesses',
    'competitivePosition',
    'brandPromise',
    'brandPillars',
  ],

  // Audience Strategy
  audience: [
    'coreSegments',
    'demographics',
    'geos',
    'primaryMarkets',
    'secondaryMarkets',
    'buyerJourney',
    'personas',
    'jobsToBeDone',
    'painPoints',
    'motivations',
  ],

  // Content Strategy
  content: [
    'contentPillars',
    'contentCalendar',
    'contentFormats',
    'distributionChannels',
    'thoughtLeadership',
    'userGeneratedContent',
    'contentGaps',
  ],

  // SEO Strategy
  seo: [
    'targetKeywords',
    'keywordClusters',
    'contentStrategy',
    'technicalPriorities',
    'localSeoStrategy',
    'linkBuildingApproach',
  ],

  // Media Strategy
  performanceMedia: [
    'channelMix',
    'budgetAllocation',
    'targetingStrategy',
    'bidStrategy',
    'campaignTypes',
    'geoTargeting',
    'audienceTargeting',
    'seasonalityAdjustments',
  ],

  // Website Strategy
  website: [
    'conversionGoals',
    'userExperience',
    'landingPages',
    'cmsStrategy',
    'techStack',
    'performanceTargets',
    'accessibilityGoals',
  ],

  // Product & Offer Strategy
  productOffer: [
    'corePorducts',
    'pricing',
    'promotions',
    'bundling',
    'upsellStrategy',
    'seasonalOffers',
  ],

  // Operational Constraints
  operationalConstraints: [
    'budgetLimits',
    'resourceConstraints',
    'timelineConstraints',
    'complianceRequirements',
    'approvalWorkflows',
  ],

  // Store & Risk
  storeRisk: [
    'storePerformance',
    'inventoryRisks',
    'seasonalFactors',
    'competitiveThreats',
  ],
} as const;

/**
 * Get all strategy field paths as flat array
 */
export function getAllStrategyPaths(): string[] {
  const paths: string[] = [];
  for (const [domain, fields] of Object.entries(STRATEGY_FIELDS)) {
    for (const field of fields) {
      paths.push(`${domain}.${field}`);
    }
  }
  return paths;
}

// ============================================================================
// Strategy Writer
// ============================================================================

/**
 * Write strategy fields to the Context Graph
 *
 * This is the primary function for persisting strategic plan changes.
 * It iterates through all provided fields and writes them with
 * appropriate provenance tracking.
 */
export async function writeStrategyToContextGraph(
  params: WriteStrategyParams
): Promise<WriteStrategyResult> {
  const {
    companyId,
    strategy,
    runId,
    sourceType = 'qbr',
    sourceName = 'QBR-StrategicPlan',
  } = params;

  // Load current graph
  let graph = await loadContextGraph(companyId);

  if (!graph) {
    return {
      success: false,
      fieldsWritten: 0,
      fieldsSkipped: 0,
      errors: [`No context graph found for company ${companyId}`],
    };
  }

  let fieldsWritten = 0;
  let fieldsSkipped = 0;
  const errors: string[] = [];

  // Create base provenance
  const baseProvenance = createProvenance(sourceType, {
    confidence: 0.9, // Strategy is authoritative
    runId,
    notes: sourceName,
  });

  // Iterate through all strategy fields
  for (const [path, value] of Object.entries(strategy)) {
    // Skip null/empty values
    if (value === null || value === undefined || value === '') {
      fieldsSkipped++;
      continue;
    }

    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) {
      fieldsSkipped++;
      continue;
    }

    try {
      // Parse path into domain.field
      const [domain, ...fieldParts] = path.split('.');
      const field = fieldParts.join('.');

      if (!domain || !field) {
        errors.push(`Invalid path: ${path}`);
        fieldsSkipped++;
        continue;
      }

      // Write the field
      graph = setFieldUntyped(
        graph,
        domain,
        field,
        value,
        baseProvenance
      );

      fieldsWritten++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to write ${path}: ${message}`);
      fieldsSkipped++;
    }
  }

  // Save updated graph
  if (fieldsWritten > 0) {
    try {
      await saveContextGraph(graph, 'strategy-writer');
      console.log(`[StrategyWriter] Wrote ${fieldsWritten} fields for ${companyId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        fieldsWritten: 0,
        fieldsSkipped,
        errors: [...errors, `Failed to save graph: ${message}`],
      };
    }
  }

  return {
    success: errors.length === 0,
    fieldsWritten,
    fieldsSkipped,
    errors,
  };
}

/**
 * Write a single strategy field to the Context Graph
 */
export async function writeStrategyField(
  companyId: string,
  path: string,
  value: unknown,
  options?: {
    runId?: string;
    confidence?: number;
    sourceType?: ProvenanceSource;
  }
): Promise<boolean> {
  const result = await writeStrategyToContextGraph({
    companyId,
    strategy: { [path]: value },
    runId: options?.runId,
    sourceType: options?.sourceType || 'qbr',
  });

  return result.success && result.fieldsWritten > 0;
}

// ============================================================================
// Strategy Reading (for Strategic Plan page)
// ============================================================================

/**
 * Read current strategy from Context Graph
 *
 * Returns a flat object with all strategy fields and their values.
 */
export async function readStrategyFromContextGraph(
  companyId: string
): Promise<Record<string, unknown> | null> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return null;
  }

  return extractStrategyFromGraph(graph);
}

/**
 * Extract strategy fields from a loaded graph
 */
export function extractStrategyFromGraph(
  graph: CompanyContextGraph
): Record<string, unknown> {
  const strategy: Record<string, unknown> = {};

  for (const [domain, fields] of Object.entries(STRATEGY_FIELDS)) {
    const domainData = graph[domain as DomainName];

    if (!domainData || typeof domainData !== 'object') continue;

    for (const field of fields) {
      const fieldData = (domainData as Record<string, unknown>)[field];

      if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
        const value = (fieldData as { value: unknown }).value;
        if (value !== null && value !== undefined) {
          strategy[`${domain}.${field}`] = value;
        }
      }
    }
  }

  return strategy;
}

/**
 * Field status types
 */
export type FieldStatus = 'populated' | 'stale' | 'missing';

/**
 * Recommended diagnostic for filling a missing field
 */
export interface RecommendedDiagnostic {
  id: string;
  label: string;
  toolId?: string; // DiagnosticToolId if linkable
}

/**
 * Get strategy fields with metadata (for UI display)
 */
export interface StrategyFieldWithMeta {
  path: string;
  domain: string;
  field: string;
  value: unknown;
  confidence: number;
  updatedAt: string | null;
  source: string | null;
  /** Human-readable source name */
  sourceName: string | null;
  /** Field status: populated, stale, or missing */
  status: FieldStatus;
  /** Freshness score 0-1 (1 = fresh, 0 = expired) */
  freshnessScore: number | null;
  /** Age in days since last update */
  ageDays: number | null;
  /** Recommended diagnostics to fill this field */
  recommendedDiagnostics: RecommendedDiagnostic[];
  /** Whether this field has been manually edited by a human */
  isHumanOverride: boolean;
  /** Authoritative sources for this domain (for UI hint) */
  authoritativeSources: string[];
  /** Full provenance history for revert UI */
  provenanceHistory: ProvenanceTag[];
  /** Previous value (from second provenance entry) for quick revert */
  previousValue?: unknown;
  /** Previous source name for revert hint */
  previousSourceName?: string | null;
}

/**
 * Map source codes to human-readable names
 */
const SOURCE_NAMES: Record<string, string> = {
  gap_ia: 'GAP Snapshot',
  gap_full: 'GAP Full',
  gap_heavy: 'GAP Heavy',
  website_lab: 'Website Lab',
  brand_lab: 'Brand Lab',
  content_lab: 'Content Lab',
  seo_lab: 'SEO Lab',
  audience_lab: 'Audience Lab',
  media_lab: 'Media Lab',
  demand_lab: 'Demand Lab',
  ops_lab: 'Ops Lab',
  qbr: 'Strategic Plan',
  ssm: 'SSM',
  user: 'Manual Entry',
  brain: 'Brain',
  strategy: 'Strategy',
  import: 'Import',
};

/**
 * Map domains to recommended diagnostics
 */
const DOMAIN_DIAGNOSTICS: Record<string, RecommendedDiagnostic[]> = {
  identity: [
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
    { id: 'gap-snapshot', label: 'GAP Snapshot', toolId: 'gapSnapshot' },
  ],
  objectives: [
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
    { id: 'gap-snapshot', label: 'GAP Snapshot', toolId: 'gapSnapshot' },
  ],
  brand: [
    { id: 'brand-lab', label: 'Brand Lab', toolId: 'brandLab' },
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
  ],
  audience: [
    { id: 'audience-lab', label: 'Audience Lab' },
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
  ],
  content: [
    { id: 'content-lab', label: 'Content Lab', toolId: 'contentLab' },
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
  ],
  seo: [
    { id: 'seo-lab', label: 'SEO Lab', toolId: 'seoLab' },
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
  ],
  performanceMedia: [
    { id: 'media-lab', label: 'Media Lab' },
    { id: 'demand-lab', label: 'Demand Lab', toolId: 'demandLab' },
  ],
  website: [
    { id: 'website-lab', label: 'Website Lab', toolId: 'websiteLab' },
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
  ],
  productOffer: [
    { id: 'gap-heavy', label: 'GAP Heavy', toolId: 'gapHeavy' },
  ],
  operationalConstraints: [
    { id: 'ops-lab', label: 'Ops Lab', toolId: 'opsLab' },
  ],
  storeRisk: [
    { id: 'ops-lab', label: 'Ops Lab', toolId: 'opsLab' },
  ],
};

/**
 * Calculate freshness and status for a field
 */
function calculateFieldStatus(
  value: unknown,
  updatedAt: string | null,
  validForDays: number = 90
): { status: FieldStatus; freshnessScore: number | null; ageDays: number | null } {
  // Check if value is empty
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    return { status: 'missing', freshnessScore: null, ageDays: null };
  }

  if (!updatedAt) {
    return { status: 'populated', freshnessScore: null, ageDays: null };
  }

  // Calculate age
  const updatedDate = new Date(updatedAt);
  const now = new Date();
  const ageMs = now.getTime() - updatedDate.getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));

  // Calculate freshness score (1 = fresh, 0 = expired)
  const freshnessScore = Math.max(0, Math.min(1, 1 - ageDays / validForDays));

  // Determine status
  const status: FieldStatus = freshnessScore < 0.5 ? 'stale' : 'populated';

  return {
    status,
    freshnessScore: Math.round(freshnessScore * 1000) / 1000,
    ageDays: Math.round(ageDays * 10) / 10,
  };
}

export function extractStrategyWithMeta(
  graph: CompanyContextGraph
): StrategyFieldWithMeta[] {
  const fields: StrategyFieldWithMeta[] = [];

  for (const [domain, fieldNames] of Object.entries(STRATEGY_FIELDS)) {
    const domainData = graph[domain as DomainName];
    const authoritativeSources = getAuthoritativeSourcesForDomain(domain as DomainName);

    if (!domainData || typeof domainData !== 'object') {
      // Domain doesn't exist, add missing fields
      for (const fieldName of fieldNames) {
        fields.push({
          path: `${domain}.${fieldName}`,
          domain,
          field: fieldName,
          value: null,
          confidence: 0,
          updatedAt: null,
          source: null,
          sourceName: null,
          status: 'missing',
          freshnessScore: null,
          ageDays: null,
          recommendedDiagnostics: DOMAIN_DIAGNOSTICS[domain] || [],
          isHumanOverride: false,
          authoritativeSources,
          provenanceHistory: [],
        });
      }
      continue;
    }

    for (const fieldName of fieldNames) {
      const fieldData = (domainData as Record<string, unknown>)[fieldName];

      if (fieldData && typeof fieldData === 'object' && 'value' in fieldData) {
        const typed = fieldData as {
          value: unknown;
          provenance: ProvenanceTag[];
        };

        const latestProvenance = typed.provenance?.[0];
        const previousProvenance = typed.provenance?.[1];
        const { status, freshnessScore, ageDays } = calculateFieldStatus(
          typed.value,
          latestProvenance?.updatedAt ?? null
        );

        // Get source name using priority module
        const sourceCode = latestProvenance?.source ?? null;
        const sourceName = sourceCode
          ? getSourceDisplayName(sourceCode)
          : null;

        // Check if human override
        const isHumanOverride = sourceCode ? isHumanSource(sourceCode) : false;

        // Get previous source info for revert hint
        const previousSourceName = previousProvenance?.source
          ? getSourceDisplayName(previousProvenance.source)
          : null;

        fields.push({
          path: `${domain}.${fieldName}`,
          domain,
          field: fieldName,
          value: typed.value,
          confidence: latestProvenance?.confidence ?? 0,
          updatedAt: latestProvenance?.updatedAt ?? null,
          source: sourceCode,
          sourceName,
          status,
          freshnessScore,
          ageDays,
          recommendedDiagnostics: status === 'missing' ? (DOMAIN_DIAGNOSTICS[domain] || []) : [],
          isHumanOverride,
          authoritativeSources,
          provenanceHistory: typed.provenance || [],
          previousValue: undefined, // We don't have the actual previous value in provenance
          previousSourceName,
        });
      } else {
        // Field doesn't exist in domain
        fields.push({
          path: `${domain}.${fieldName}`,
          domain,
          field: fieldName,
          value: null,
          confidence: 0,
          updatedAt: null,
          source: null,
          sourceName: null,
          status: 'missing',
          freshnessScore: null,
          ageDays: null,
          recommendedDiagnostics: DOMAIN_DIAGNOSTICS[domain] || [],
          isHumanOverride: false,
          authoritativeSources,
          provenanceHistory: [],
        });
      }
    }
  }

  return fields;
}
