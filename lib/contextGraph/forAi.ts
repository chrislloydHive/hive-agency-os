// lib/contextGraph/forAi.ts
// AI-Ready Context View (Phase 2)
//
// Provides a clean, flattened view of the context graph optimized for
// AI prompt injection. Strips provenance metadata and formats for LLM consumption.

import type { CompanyContextGraph } from './companyContextGraph';
import type { WithMetaType, WithMetaArrayType } from './types';
import { getFieldFreshness, type FreshnessScore } from './freshness';
import { getNeedsRefreshReport } from './needsRefresh';

// ============================================================================
// AI Context Types
// ============================================================================

/**
 * Flattened context view for AI consumption
 * All values are unwrapped from WithMeta containers
 */
export interface AiContextView {
  /** Company identity */
  company: {
    id: string;
    name: string;
    industry: string | null;
    businessModel: string | null;
    website: string | null;
    yearFounded: number | null;
    employeeRange: string | null;
    revenueRange: string | null;
    geographicScope: string | null;
    summary: string | null;
  };

  /** Strategic objectives */
  objectives: {
    primary: string | null;
    kpis: string[];
    timeHorizon: string | null;
    targetCpa: number | null;
    targetRoas: number | null;
    budgetConstraint: string | null;
  };

  /** Target audience */
  audience: {
    segments: string[];
    demographics: Record<string, unknown> | null;
    geos: string[];
    primaryMarkets: string[];
    purchaseBehavior: string | null;
  };

  /** Brand attributes */
  brand: {
    positioning: string | null;
    valueProps: string[];
    differentiators: string[];
    tone: string | null;
    voice: string | null;
  };

  /** Current performance */
  performance: {
    channels: string[];
    currentCpa: number | null;
    currentRoas: number | null;
    ctr: number | null;
    conversionRate: number | null;
    attributionModel: string | null;
    monthlyBudget: number | null;
  };

  /** Digital infrastructure */
  infrastructure: {
    ga4Status: string | null;
    trackingTools: string[];
    callTracking: boolean | null;
    offlineConversion: boolean | null;
  };

  /** Content capabilities */
  content: {
    topics: string[];
    formats: string[];
    capacity: string | null;
    pillars: string[];
  };

  /** Operational context */
  operations: {
    locationCount: number | null;
    capacity: string | null;
    constraints: string[];
    partners: string[];
  };

  /** Competitive context */
  competitive: {
    competitors: string[];
    position: string | null;
  };

  /** Context quality metadata */
  meta: {
    completenessScore: number | null;
    freshnessStatus: 'current' | 'needs_refresh' | 'urgent_refresh';
    staleFieldCount: number;
    lastUpdated: string | null;
  };
}

/**
 * Context section for targeted injection
 */
export type AiContextSection = keyof Omit<AiContextView, 'meta'>;

// ============================================================================
// Value Extraction Helpers
// ============================================================================

/**
 * Safely extract value from a WithMeta field
 */
function extractValue<T>(field: WithMetaType<T> | undefined | null): T | null {
  if (!field) return null;
  return field.value ?? null;
}

/**
 * Safely extract array value from a WithMetaArray field
 */
function extractArray<T>(field: WithMetaArrayType<T> | undefined | null): T[] {
  if (!field) return [];
  return field.value ?? [];
}

/**
 * Extract string value or null
 */
function extractString(field: WithMetaType<unknown> | undefined | null): string | null {
  const value = extractValue(field);
  return typeof value === 'string' ? value : null;
}

/**
 * Extract number value or null
 */
function extractNumber(field: WithMetaType<unknown> | undefined | null): number | null {
  const value = extractValue(field);
  return typeof value === 'number' ? value : null;
}

/**
 * Extract boolean value or null
 */
function extractBoolean(field: WithMetaType<unknown> | undefined | null): boolean | null {
  const value = extractValue(field);
  return typeof value === 'boolean' ? value : null;
}

/**
 * Extract string array
 */
function extractStringArray(field: WithMetaArrayType<unknown> | WithMetaType<unknown[]> | undefined | null): string[] {
  if (!field) return [];
  const value = field.value;
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build an AI-ready context view from a full context graph
 *
 * This flattens the graph structure, strips provenance metadata,
 * and formats values for optimal LLM consumption.
 *
 * @param graph - The full context graph
 * @returns Flattened AI context view
 */
export function buildAiContextView(graph: CompanyContextGraph): AiContextView {
  const refreshReport = getNeedsRefreshReport(graph);

  return {
    company: {
      id: graph.companyId,
      name: graph.companyName,
      industry: extractString(graph.identity.industry),
      businessModel: extractString(graph.identity.businessModel),
      website: null, // Not in current schema
      yearFounded: null, // Not in current schema
      employeeRange: null, // Not in current schema
      revenueRange: null, // Not in current schema
      geographicScope: extractString(graph.identity.geographicFootprint),
      summary: extractString(graph.identity.competitiveLandscape),
    },

    objectives: {
      primary: extractString(graph.objectives.primaryObjective),
      kpis: extractStringArray(graph.objectives.kpiLabels),
      timeHorizon: extractString(graph.objectives.timeHorizon),
      targetCpa: extractNumber(graph.objectives.targetCpa),
      targetRoas: extractNumber(graph.objectives.targetRoas),
      budgetConstraint: extractString(graph.objectives.contributionMarginRequirement),
    },

    audience: {
      segments: extractStringArray(graph.audience.coreSegments),
      demographics: extractString(graph.audience.demographics) as unknown as Record<string, unknown> | null,
      geos: [extractString(graph.audience.geos)].filter((g): g is string => g !== null),
      primaryMarkets: extractStringArray(graph.audience.primaryMarkets),
      purchaseBehavior: extractStringArray(graph.audience.purchaseBehaviors).join(', ') || null,
    },

    brand: {
      positioning: extractString(graph.brand.positioning),
      valueProps: extractStringArray(graph.brand.valueProps),
      differentiators: extractStringArray(graph.brand.differentiators),
      tone: extractString(graph.brand.toneOfVoice),
      voice: extractString(graph.brand.brandPersonality),
    },

    performance: {
      channels: extractStringArray(graph.performanceMedia.activeChannels),
      currentCpa: extractNumber(graph.performanceMedia.blendedCpa),
      currentRoas: extractNumber(graph.performanceMedia.blendedRoas),
      ctr: extractNumber(graph.performanceMedia.blendedCtr),
      conversionRate: null, // Not in current schema
      attributionModel: extractString(graph.performanceMedia.attributionModel),
      monthlyBudget: extractNumber(graph.budgetOps.mediaSpendBudget),
    },

    infrastructure: {
      ga4Status: extractString(graph.digitalInfra.ga4Health),
      trackingTools: extractStringArray(graph.digitalInfra.trackingTools),
      callTracking: extractBoolean(graph.digitalInfra.callTracking),
      offlineConversion: extractBoolean(graph.digitalInfra.offlineConversionTracking),
    },

    content: {
      topics: extractStringArray(graph.content.keyTopics),
      formats: extractStringArray(graph.content.availableFormats),
      capacity: extractString(graph.content.productionCapacity),
      pillars: extractStringArray(graph.content.contentPillars),
    },

    operations: {
      locationCount: extractNumber(graph.ops.locationCount),
      capacity: extractString(graph.ops.operationalCapacity),
      constraints: extractStringArray(graph.ops.operationalConstraints),
      partners: extractStringArray(graph.ops.agencyPartners),
    },

    competitive: {
      competitors: extractStringArray(graph.storeRisk.primaryCompetitors),
      position: extractString(graph.storeRisk.competitivePosition),
    },

    meta: {
      completenessScore: graph.meta.completenessScore,
      freshnessStatus: refreshReport.overallStatus,
      staleFieldCount: refreshReport.totalStaleFields,
      lastUpdated: graph.meta.updatedAt,
    },
  };
}

// ============================================================================
// Section Extraction
// ============================================================================

/**
 * Extract a specific section of the AI context
 * Useful for targeted prompts that only need part of the context
 */
export function getAiContextSection<S extends AiContextSection>(
  graph: CompanyContextGraph,
  section: S
): AiContextView[S] {
  const fullContext = buildAiContextView(graph);
  return fullContext[section];
}

/**
 * Extract multiple sections
 */
export function getAiContextSections(
  graph: CompanyContextGraph,
  sections: AiContextSection[]
): Partial<AiContextView> {
  const fullContext = buildAiContextView(graph);
  const result: Partial<AiContextView> = {};

  for (const section of sections) {
    (result as Record<string, unknown>)[section] = fullContext[section];
  }

  return result;
}

// ============================================================================
// Prompt Formatting
// ============================================================================

/**
 * Format options for prompt generation
 */
export interface PromptFormatOptions {
  /** Include metadata section */
  includeMeta?: boolean;
  /** Format as markdown */
  markdown?: boolean;
  /** Compact JSON output */
  compact?: boolean;
  /** Only include non-null values */
  skipNulls?: boolean;
  /** Maximum string length before truncation */
  maxStringLength?: number;
}

/**
 * Format AI context for prompt injection
 */
export function formatForPrompt(
  context: AiContextView | Partial<AiContextView>,
  options: PromptFormatOptions = {}
): string {
  const {
    includeMeta = false,
    markdown = true,
    compact = false,
    skipNulls = true,
    maxStringLength = 500,
  } = options;

  // Remove meta if not included
  const toFormat = { ...context };
  if (!includeMeta && 'meta' in toFormat) {
    delete (toFormat as Partial<AiContextView>).meta;
  }

  // Clean nulls if requested
  const cleaned = skipNulls ? removeNulls(toFormat) : toFormat;

  // Truncate long strings
  const truncated = truncateStrings(cleaned, maxStringLength);

  if (compact) {
    return JSON.stringify(truncated);
  }

  if (markdown) {
    return formatAsMarkdown(truncated);
  }

  return JSON.stringify(truncated, null, 2);
}

/**
 * Remove null and empty values recursively
 */
function removeNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const filtered = obj.filter((v) => v !== null && v !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = removeNulls(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
}

/**
 * Truncate long strings
 */
function truncateStrings(obj: unknown, maxLength: number): unknown {
  if (typeof obj === 'string' && obj.length > maxLength) {
    return obj.slice(0, maxLength) + '...';
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => truncateStrings(v, maxLength));
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateStrings(value, maxLength);
    }
    return result;
  }
  return obj;
}

/**
 * Format context as markdown
 */
function formatAsMarkdown(obj: unknown, depth: number = 0): string {
  if (obj === null || obj === undefined) return '';

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '';
    return obj.map((item) => `- ${formatAsMarkdown(item, depth + 1)}`).join('\n');
  }

  if (typeof obj === 'object') {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      const heading = '#'.repeat(Math.min(depth + 2, 4));
      const title = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');

      if (typeof value === 'object') {
        lines.push(`${heading} ${title}`);
        lines.push(formatAsMarkdown(value, depth + 1));
      } else {
        lines.push(`**${title}**: ${value}`);
      }
    }
    return lines.join('\n');
  }

  return String(obj);
}

// ============================================================================
// Specialized Context Builders
// ============================================================================

/**
 * Build context optimized for media planning prompts
 */
export function buildMediaPlanningContext(graph: CompanyContextGraph): string {
  const sections = getAiContextSections(graph, [
    'company',
    'objectives',
    'audience',
    'performance',
  ]);

  return formatForPrompt(sections, { markdown: true, skipNulls: true });
}

/**
 * Build context optimized for creative/brand prompts
 */
export function buildCreativeContext(graph: CompanyContextGraph): string {
  const sections = getAiContextSections(graph, [
    'company',
    'brand',
    'audience',
    'content',
  ]);

  return formatForPrompt(sections, { markdown: true, skipNulls: true });
}

/**
 * Build context optimized for strategy prompts
 */
export function buildStrategyContext(graph: CompanyContextGraph): string {
  const sections = getAiContextSections(graph, [
    'company',
    'objectives',
    'competitive',
    'operations',
    'performance',
  ]);

  return formatForPrompt(sections, { markdown: true, skipNulls: true });
}

/**
 * Build minimal context summary
 */
export function buildContextSummary(graph: CompanyContextGraph): string {
  const view = buildAiContextView(graph);

  const summary = {
    company: `${view.company.name} (${view.company.industry || 'Unknown Industry'})`,
    objective: view.objectives.primary,
    audience: view.audience.segments.slice(0, 3).join(', ') || 'Not specified',
    channels: view.performance.channels.slice(0, 5).join(', ') || 'None active',
    budget: view.performance.monthlyBudget
      ? `$${view.performance.monthlyBudget.toLocaleString()}/mo`
      : 'Not specified',
    targets: [
      view.objectives.targetCpa ? `CPA: $${view.objectives.targetCpa}` : null,
      view.objectives.targetRoas ? `ROAS: ${view.objectives.targetRoas}x` : null,
    ]
      .filter(Boolean)
      .join(', ') || 'Not specified',
  };

  return Object.entries(summary)
    .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
    .join('\n');
}
