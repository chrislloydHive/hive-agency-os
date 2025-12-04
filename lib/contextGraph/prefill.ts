// lib/contextGraph/prefill.ts
// Extract prefill data from Company Context Graph
//
// This module provides a clean way to prefill the Media Lab planner
// from the context graph, with full provenance tracking.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { loadContextGraph } from './storage';

// ============================================================================
// Prefill Result Types
// ============================================================================

export interface FieldMeta {
  source: string;
  confidence: number;
  timestamp?: string;
}

export interface ContextGraphPrefillResult {
  /** Extracted field values keyed by field name */
  values: Record<string, unknown>;
  /** Provenance metadata for each extracted field */
  fieldMeta: Record<string, FieldMeta>;
  /** Graph completeness percentage */
  completenessScore: number;
  /** Whether a graph exists for this company */
  graphExists: boolean;
}

// ============================================================================
// Main Prefill Function
// ============================================================================

/**
 * Extract prefill data from a company's context graph
 *
 * This is the primary way to get values from the context graph for prefilling
 * UI forms. Returns both the values and their provenance metadata.
 */
export async function prefillFromContextGraph(
  companyId: string
): Promise<ContextGraphPrefillResult> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return {
      values: {},
      fieldMeta: {},
      completenessScore: 0,
      graphExists: false,
    };
  }

  return extractPrefillValues(graph);
}

/**
 * Extract prefill values from an already-loaded context graph
 */
export function extractPrefillValues(
  graph: CompanyContextGraph
): ContextGraphPrefillResult {
  const values: Record<string, unknown> = {};
  const fieldMeta: Record<string, FieldMeta> = {};

  // Helper to safely extract from a field with provenance
  function extractField(
    field: { value: unknown; provenance: ProvenanceTag[] } | undefined | null,
    key: string,
    transform?: (value: unknown) => unknown
  ): void {
    if (!field || field.value === null || field.value === undefined) return;

    // Skip empty arrays
    if (Array.isArray(field.value) && field.value.length === 0) return;

    const provenance = field.provenance[0];
    const value = transform ? transform(field.value) : field.value;

    values[key] = value;
    fieldMeta[key] = {
      source: formatSource(provenance?.source),
      confidence: provenance?.confidence ?? 0,
      timestamp: provenance?.timestamp,
    };
  }

  // =========================================================================
  // Extract from Identity Domain
  // =========================================================================
  extractField(graph.identity.businessName, 'companyName');
  extractField(graph.identity.industry, 'industry');
  extractField(graph.identity.businessModel, 'businessModel');
  extractField(graph.identity.geographicFootprint, 'geographicScope');
  extractField(graph.identity.primaryCompetitors, 'competitors');

  // =========================================================================
  // Extract from Objectives Domain
  // =========================================================================
  extractField(graph.objectives.primaryObjective, 'primaryObjective', mapObjective);
  extractField(graph.objectives.kpiLabels, 'kpis');
  extractField(graph.objectives.timeHorizon, 'timeHorizon');
  extractField(graph.objectives.targetCpa, 'targetCpa');
  extractField(graph.objectives.targetRoas, 'targetRoas');

  // =========================================================================
  // Extract from Audience Domain
  // =========================================================================
  extractField(graph.audience.coreSegments, 'targetAudiences');
  extractField(graph.audience.geos, 'geographicScope');
  extractField(graph.audience.demographics, 'demographics');
  extractField(graph.audience.primaryMarkets, 'primaryMarkets');

  // =========================================================================
  // Extract from Budget/Ops Domain
  // =========================================================================
  extractField(graph.budgetOps.mediaSpendBudget, 'monthlyBudget');
  extractField(graph.budgetOps.cpaTarget, 'targetCpa');
  extractField(graph.budgetOps.roasTarget, 'targetRoas');
  extractField(graph.budgetOps.riskTolerance, 'riskTolerance');

  // =========================================================================
  // Extract from Performance Media Domain
  // =========================================================================
  extractField(graph.performanceMedia.activeChannels, 'activeChannels');
  extractField(graph.performanceMedia.attributionModel, 'attributionModel');
  extractField(graph.performanceMedia.blendedCpa, 'currentCpa');
  extractField(graph.performanceMedia.blendedRoas, 'currentRoas');

  // =========================================================================
  // Extract from Digital Infra Domain
  // =========================================================================
  extractField(graph.digitalInfra.ga4Health, 'ga4Status');
  extractField(graph.digitalInfra.callTracking, 'callTracking');
  extractField(graph.digitalInfra.offlineConversionTracking, 'offlineConversion');
  extractField(graph.digitalInfra.trackingTools, 'trackingTools');

  // =========================================================================
  // Extract from Brand Domain
  // =========================================================================
  extractField(graph.brand.valueProps, 'valueProps');
  extractField(graph.brand.differentiators, 'differentiators');
  extractField(graph.brand.positioning, 'positioning');
  extractField(graph.brand.toneOfVoice, 'brandVoice');

  // =========================================================================
  // Extract from Content Domain
  // =========================================================================
  extractField(graph.content.keyTopics, 'keyTopics');
  extractField(graph.content.availableFormats, 'creativeFormats');
  extractField(graph.content.productionCapacity, 'creativeCapacity');
  extractField(graph.content.contentPillars, 'contentPillars');

  // =========================================================================
  // Extract from Ops Domain
  // =========================================================================
  extractField(graph.ops.operationalCapacity, 'operationalCapacity');
  extractField(graph.ops.operationalConstraints, 'constraints');
  extractField(graph.ops.locationCount, 'locationCount');
  extractField(graph.ops.agencyPartners, 'agencyPartners');

  // =========================================================================
  // Extract from Store/Risk Domain
  // =========================================================================
  extractField(graph.storeRisk.storeCount, 'storeCount');
  extractField(graph.storeRisk.primaryCompetitors, 'competitors');
  extractField(graph.storeRisk.competitivePosition, 'competitivePosition');

  // =========================================================================
  // Extract from Website Domain
  // =========================================================================
  extractField(graph.website.websiteScore, 'websiteScore');
  extractField(graph.website.websiteSummary, 'websiteSummary');
  extractField(graph.website.criticalIssues, 'websiteIssues');

  // =========================================================================
  // Extract from SEO Domain
  // =========================================================================
  extractField(graph.seo.seoScore, 'seoScore');
  extractField(graph.seo.topKeywords, 'topKeywords');
  extractField(graph.seo.domainAuthority, 'domainAuthority');

  return {
    values,
    fieldMeta,
    completenessScore: graph.meta.completenessScore ?? 0,
    graphExists: true,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format source tag for display
 */
function formatSource(source?: string): string {
  if (!source) return 'Unknown';

  const sourceMap: Record<string, string> = {
    brain: 'Client Brain',
    gap_ia: 'GAP Assessment',
    gap_full: 'Full GAP Report',
    gap_heavy: 'GAP Heavy Analysis',
    website_lab: 'Website Lab',
    brand_lab: 'Brand Lab',
    content_lab: 'Content Lab',
    seo_lab: 'SEO Lab',
    demand_lab: 'Demand Lab',
    ops_lab: 'Ops Lab',
    media_profile: 'Media Profile',
    media_lab: 'Media Lab',
    media_cockpit: 'Media Cockpit',
    media_memory: 'Media Memory',
    manual: 'Manual Entry',
    inferred: 'AI Inferred',
    airtable: 'CRM Data',
  };

  return sourceMap[source] || source;
}

/**
 * Map context graph objective to standard objective value
 */
function mapObjective(objective: unknown): string {
  if (typeof objective !== 'string') return String(objective);

  const objectiveMap: Record<string, string> = {
    lead_generation: 'leads',
    leads: 'leads',
    awareness: 'awareness',
    brand_awareness: 'awareness',
    store_visits: 'store_visits',
    foot_traffic: 'store_visits',
    sales_conversions: 'conversions',
    conversions: 'conversions',
    traffic_growth: 'traffic',
    engagement: 'engagement',
    retention: 'retention',
    blended: 'blended',
  };

  return objectiveMap[objective.toLowerCase()] || objective;
}

/**
 * Get a specific field value from a context graph with its provenance
 */
export function getFieldWithProvenance(
  graph: CompanyContextGraph,
  domainName: keyof CompanyContextGraph,
  fieldName: string
): { value: unknown; source: string; confidence: number } | null {
  const domain = graph[domainName];
  if (!domain || typeof domain !== 'object') return null;

  const field = (domain as Record<string, unknown>)[fieldName];
  if (!field || typeof field !== 'object') return null;

  const fieldObj = field as { value?: unknown; provenance?: ProvenanceTag[] };
  if (fieldObj.value === null || fieldObj.value === undefined) return null;

  const provenance = fieldObj.provenance?.[0];

  return {
    value: fieldObj.value,
    source: formatSource(provenance?.source),
    confidence: provenance?.confidence ?? 0,
  };
}
