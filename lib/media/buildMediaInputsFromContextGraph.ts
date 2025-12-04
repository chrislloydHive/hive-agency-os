// lib/media/buildMediaInputsFromContextGraph.ts
// Build Media Planning Inputs from Context Graph
//
// This module extracts relevant data from the Context Graph to prefill
// the Media Lab planner with company context.

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Extracted field with provenance info
 */
export interface ExtractedField<T> {
  value: T | null;
  source?: string;
  confidence?: number;
  updatedAt?: string;
}

/**
 * Media planner prefill data structure
 * Flat object for UI form prefilling
 */
export interface MediaPlannerPrefill {
  // Goals
  primaryObjective: 'leads' | 'conversions' | 'awareness' | 'store_visits' | 'traffic' | 'blended' | null;
  targetCpa: number | null;
  targetRoas: number | null;
  kpis: string[];

  // Audience
  targetAudiences: string[];
  geographicScope: string | null;
  demographics: string | null;

  // Budget
  monthlyBudget: number | null;
  budgetMin: number | null;
  budgetMax: number | null;

  // Channels
  activeChannels: string[];
  requiredChannels: string[];
  disallowedChannels: string[];

  // Performance
  currentCpa: number | null;
  currentRoas: number | null;
  attributionModel: string | null;

  // Brand
  brandPositioning: string | null;
  valueProps: string[];
  brandVoice: string | null;

  // Context
  industry: string | null;
  businessModel: string | null;
  competitors: string[];

  // Meta (internal use)
  _contextGraphScore: number | null;
  _contextLastUpdated: string | null;
}

/**
 * Media planning context extracted from Context Graph
 */
export interface MediaPlanningContext {
  // Company Identity
  company: {
    id: string;
    name: string;
    industry: ExtractedField<string>;
    businessModel: ExtractedField<string>;
    geographicScope: ExtractedField<string>;
  };

  // Objectives
  objectives: {
    primary: ExtractedField<string>;
    kpis: ExtractedField<string[]>;
    targetCpa: ExtractedField<number>;
    targetRoas: ExtractedField<number>;
    timeHorizon: ExtractedField<string>;
  };

  // Audience
  audience: {
    segments: ExtractedField<string[]>;
    demographics: ExtractedField<string>;
    geos: ExtractedField<string[]>;
    primaryMarkets: ExtractedField<string[]>;
  };

  // Personas - for targeting and creative messaging
  personas: {
    names: ExtractedField<string[]>;
    triggers: ExtractedField<string[]>;
    objections: ExtractedField<string[]>;
    keyMessages: ExtractedField<string[]>;
    preferredChannels: ExtractedField<string[]>;
    contentFormats: ExtractedField<string[]>;
  };

  // Brand
  brand: {
    positioning: ExtractedField<string>;
    valueProps: ExtractedField<string[]>;
    differentiators: ExtractedField<string[]>;
    tone: ExtractedField<string>;
  };

  // Performance
  performance: {
    activeChannels: ExtractedField<string[]>;
    currentCpa: ExtractedField<number>;
    currentRoas: ExtractedField<number>;
    attributionModel: ExtractedField<string>;
  };

  // Budget
  budget: {
    monthly: ExtractedField<number>;
    minBudget: ExtractedField<number>;
    maxBudget: ExtractedField<number>;
  };

  // Competitive
  competitive: {
    shareOfVoice: ExtractedField<string>;
    competitors: ExtractedField<string[]>;
  };

  // Meta
  meta: {
    completenessScore: number | null;
    lastUpdated: string | null;
  };
}

// ============================================================================
// Extraction Helpers
// ============================================================================

/**
 * Extract a field with its provenance
 */
function extractField<T>(
  field: { value: T | null; provenance?: Array<{ source: string; confidence: number; updatedAt?: string }> } | undefined
): ExtractedField<T> {
  if (!field) {
    return { value: null };
  }

  const provenance = field.provenance?.[0];

  return {
    value: field.value,
    source: provenance?.source,
    confidence: provenance?.confidence,
    updatedAt: provenance?.updatedAt,
  };
}

/**
 * Extract array field
 */
function extractArrayField<T>(
  field: { value: T[]; provenance?: Array<{ source: string; confidence: number; updatedAt?: string }> } | undefined
): ExtractedField<T[]> {
  if (!field) {
    return { value: [] };
  }

  const provenance = field.provenance?.[0];

  return {
    value: field.value || [],
    source: provenance?.source,
    confidence: provenance?.confidence,
    updatedAt: provenance?.updatedAt,
  };
}

/**
 * Extract geos field - handles both string and string[] types
 */
function extractGeosField(
  field: { value: string | string[] | null; provenance?: Array<{ source: string; confidence: number; updatedAt?: string }> } | undefined
): ExtractedField<string[]> {
  if (!field) {
    return { value: [] };
  }

  const provenance = field.provenance?.[0];
  const value = field.value;

  // Convert to array if it's a string
  const arrayValue: string[] = Array.isArray(value)
    ? value
    : value
    ? [value]
    : [];

  return {
    value: arrayValue,
    source: provenance?.source,
    confidence: provenance?.confidence,
    updatedAt: provenance?.updatedAt,
  };
}

/**
 * Extract competitors field - handles competitor objects or strings
 */
function extractCompetitorsField(
  field: { value: Array<string | { name: string }> | null; provenance?: Array<{ source: string; confidence: number; updatedAt?: string }> } | undefined
): ExtractedField<string[]> {
  if (!field || !field.value) {
    return { value: [] };
  }

  const provenance = field.provenance?.[0];

  // Map competitors to string names
  const names = field.value.map(c =>
    typeof c === 'string' ? c : c.name
  );

  return {
    value: names,
    source: provenance?.source,
    confidence: provenance?.confidence,
    updatedAt: provenance?.updatedAt,
  };
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build Media Planning Context from Context Graph
 *
 * Extracts relevant fields for media planning with provenance info
 */
export function buildMediaPlanningContext(
  graph: CompanyContextGraph
): MediaPlanningContext {
  return {
    company: {
      id: graph.companyId,
      name: graph.companyName,
      industry: extractField(graph.identity.industry),
      businessModel: extractField(graph.identity.businessModel),
      geographicScope: extractField(graph.identity.geographicFootprint),
    },

    objectives: {
      primary: extractField(graph.objectives.primaryObjective),
      kpis: extractArrayField(graph.objectives.kpiLabels),
      targetCpa: extractField(graph.objectives.targetCpa),
      targetRoas: extractField(graph.objectives.targetRoas),
      timeHorizon: extractField(graph.objectives.timeHorizon),
    },

    audience: {
      segments: extractArrayField(graph.audience.coreSegments),
      demographics: extractField(graph.audience.demographics),
      geos: extractGeosField(graph.audience.geos),
      primaryMarkets: extractArrayField(graph.audience.primaryMarkets),
    },

    personas: {
      names: extractArrayField(graph.audience.personaNames),
      triggers: extractArrayField(graph.audience.audienceTriggers),
      objections: extractArrayField(graph.audience.audienceObjections),
      keyMessages: extractArrayField(graph.audience.keyMessages),
      preferredChannels: extractArrayField(graph.audience.preferredChannels),
      contentFormats: extractArrayField(graph.audience.contentFormatsPreferred),
    },

    brand: {
      positioning: extractField(graph.brand.positioning),
      valueProps: extractArrayField(graph.brand.valueProps),
      differentiators: extractArrayField(graph.brand.differentiators),
      tone: extractField(graph.brand.toneOfVoice),
    },

    performance: {
      activeChannels: extractArrayField(graph.performanceMedia.activeChannels),
      currentCpa: extractField(graph.performanceMedia.blendedCpa),
      currentRoas: extractField(graph.performanceMedia.blendedRoas),
      attributionModel: extractField(graph.performanceMedia.attributionModel),
    },

    budget: {
      monthly: extractField(graph.budgetOps.mediaSpendBudget),
      minBudget: extractField(graph.operationalConstraints.minBudget),
      maxBudget: extractField(graph.operationalConstraints.maxBudget),
    },

    competitive: {
      shareOfVoice: extractField(graph.competitive.shareOfVoice),
      competitors: extractCompetitorsField(graph.competitive.primaryCompetitors),
    },

    meta: {
      completenessScore: graph.meta.completenessScore,
      lastUpdated: graph.meta.updatedAt,
    },
  };
}

// ============================================================================
// Prefill Builder
// ============================================================================

/**
 * Build Media Planner Prefill from Context Graph
 *
 * Returns a flat prefill object for the Media Lab planner UI
 */
export function buildMediaPlannerPrefill(
  graph: CompanyContextGraph
): MediaPlannerPrefill {
  const ctx = buildMediaPlanningContext(graph);

  return {
    // Goals
    primaryObjective: mapObjectiveToEnum(ctx.objectives.primary.value),
    targetCpa: ctx.objectives.targetCpa.value,
    targetRoas: ctx.objectives.targetRoas.value,
    kpis: ctx.objectives.kpis.value || [],

    // Audience
    targetAudiences: ctx.audience.segments.value || [],
    geographicScope: ctx.audience.geos.value?.join(', ') || ctx.company.geographicScope.value,
    demographics: ctx.audience.demographics.value,

    // Budget
    monthlyBudget: ctx.budget.monthly.value,
    budgetMin: ctx.budget.minBudget.value,
    budgetMax: ctx.budget.maxBudget.value,

    // Channels
    activeChannels: ctx.performance.activeChannels.value || [],
    requiredChannels: [], // Would need media profile data
    disallowedChannels: [],

    // Performance
    currentCpa: ctx.performance.currentCpa.value,
    currentRoas: ctx.performance.currentRoas.value,
    attributionModel: ctx.performance.attributionModel.value,

    // Brand
    brandPositioning: ctx.brand.positioning.value,
    valueProps: ctx.brand.valueProps.value || [],
    brandVoice: ctx.brand.tone.value,

    // Context
    industry: ctx.company.industry.value,
    businessModel: ctx.company.businessModel.value,
    competitors: typeof ctx.competitive.competitors === 'object' && 'value' in ctx.competitive.competitors
      ? ctx.competitive.competitors.value || []
      : [],

    // Meta
    _contextGraphScore: ctx.meta.completenessScore,
    _contextLastUpdated: ctx.meta.lastUpdated,
  };
}

/**
 * Map objective string to enum value
 */
function mapObjectiveToEnum(
  objective: string | null
): 'leads' | 'conversions' | 'awareness' | 'store_visits' | 'traffic' | 'blended' | null {
  if (!objective) return null;

  const normalized = objective.toLowerCase();

  if (normalized.includes('lead')) return 'leads';
  if (normalized.includes('sales') || normalized.includes('conversion')) return 'conversions';
  if (normalized.includes('awareness') || normalized.includes('brand')) return 'awareness';
  if (normalized.includes('store') || normalized.includes('visit')) return 'store_visits';
  if (normalized.includes('traffic')) return 'traffic';
  if (normalized.includes('blended') || normalized.includes('mixed')) return 'blended';

  return null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a prefill field has high-confidence data
 */
export function isHighConfidence(
  field: ExtractedField<unknown>,
  threshold: number = 0.8
): boolean {
  return field.confidence !== undefined && field.confidence >= threshold;
}

/**
 * Get provenance badge label
 */
export function getProvenanceLabel(source: string | undefined): string {
  if (!source) return 'Unknown';

  const labels: Record<string, string> = {
    gap_ia: 'GAP Assessment',
    gap_full: 'Full GAP',
    gap_heavy: 'GAP Heavy',
    website_lab: 'Website Lab',
    brand_lab: 'Brand Lab',
    content_lab: 'Content Lab',
    seo_lab: 'SEO Lab',
    demand_lab: 'Demand Lab',
    ops_lab: 'Ops Lab',
    media_lab: 'Media Lab',
    media_cockpit: 'Media Cockpit',
    brain: 'Client Brain',
    user: 'User Input',
    manual: 'Manual Entry',
    airtable: 'CRM Data',
    inferred: 'AI Inferred',
  };

  return labels[source] || source;
}
