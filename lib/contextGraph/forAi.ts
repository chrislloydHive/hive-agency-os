// lib/contextGraph/forAi.ts
// AI-Ready Context View (Phase 2)
//
// Provides a clean, flattened view of the context graph optimized for
// AI prompt injection. Strips provenance metadata and formats for LLM consumption.
//
// DOCTRINE INJECTION (Phase 1):
// All AI context builders now include OS Global Context (Hive doctrine) by default.
// This ensures consistent operating principles across all AI interactions.

import type { CompanyContextGraph } from './companyContextGraph';
import type { WithMetaType, WithMetaArrayType } from './types';
import { getFieldFreshness } from './freshness';
import { getNeedsRefreshReport } from './needsRefresh';
import {
  getHiveGlobalContextGraph,
  mergeWithHiveBrain,
  getValueSource,
} from './globalGraph';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_KEYS,
  CAPABILITY_LABELS,
  CATEGORY_LABELS,
  type CapabilitiesDomain,
  type Capability,
} from './domains/capabilities';
import {
  getDoctrineVersion,
  buildOperatingPrinciplesPrompt,
  buildFullDoctrinePrompt,
} from '@/lib/os/globalContext';
import {
  SRM_FIELDS,
  SRM_FIELD_LABELS,
  isStrategyReady,
} from './readiness/strategyReady';

// ============================================================================
// Doctrine Injection Types
// ============================================================================

/**
 * Doctrine injection mode for AI context builders
 * - 'none': No doctrine injected
 * - 'operatingPrinciples': Inject core operating principles only (default)
 * - 'full': Inject complete doctrine (principles + tone + forbidden patterns + strategy)
 */
export type DoctrineMode = 'none' | 'operatingPrinciples' | 'full';

/**
 * Options for AI context building
 */
export interface AiContextOptions {
  /** Doctrine injection mode. Default: 'operatingPrinciples' */
  doctrineMode?: DoctrineMode;
  /** Include freshness warnings in output. Default: false */
  includeFreshness?: boolean;
  /** Log doctrine version for observability. Default: true */
  logDoctrineVersion?: boolean;
}

/**
 * Build the doctrine prompt based on mode
 * @internal
 */
function buildDoctrinePrompt(mode: DoctrineMode): string {
  if (mode === 'none') return '';
  if (mode === 'full') return buildFullDoctrinePrompt();
  // Default: operatingPrinciples
  return buildOperatingPrinciplesPrompt();
}

/**
 * Get doctrine metadata for observability
 */
export function getDoctrineMetadata(): { version: string; injected: boolean } {
  return {
    version: getDoctrineVersion(),
    injected: true,
  };
}

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
function _extractArray<T>(field: WithMetaArrayType<T> | undefined | null): T[] {
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
  /** Doctrine injection mode. Default: 'operatingPrinciples' */
  doctrineMode?: DoctrineMode;
  /** Include freshness warnings. Default: false */
  includeFreshness?: boolean;
}

/**
 * Format AI context for prompt injection
 *
 * DOCTRINE INJECTION: By default, includes operating principles from OS Global Context.
 * Set doctrineMode: 'none' to disable, or 'full' for complete doctrine.
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
    doctrineMode = 'operatingPrinciples', // DEFAULT: inject operating principles
    includeFreshness = false,
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

  // Build the context content
  let contextContent: string;
  if (compact) {
    contextContent = JSON.stringify(truncated);
  } else if (markdown) {
    contextContent = formatAsMarkdown(truncated);
  } else {
    contextContent = JSON.stringify(truncated, null, 2);
  }

  // Build doctrine header if enabled
  const doctrinePrompt = buildDoctrinePrompt(doctrineMode);

  // Add freshness warning if requested and context has meta
  let freshnessWarning = '';
  if (includeFreshness && 'meta' in context && context.meta) {
    const meta = context.meta;
    if (meta.freshnessStatus === 'urgent_refresh') {
      freshnessWarning = `\n⚠️ **Context Warning**: ${meta.staleFieldCount} fields need urgent refresh. Data may be stale.\n`;
    } else if (meta.freshnessStatus === 'needs_refresh') {
      freshnessWarning = `\nℹ️ **Context Note**: ${meta.staleFieldCount} fields should be refreshed for accuracy.\n`;
    }
  }

  // Assemble final prompt: Doctrine → Freshness Warning → Context
  const parts: string[] = [];

  if (doctrinePrompt) {
    parts.push(doctrinePrompt);
    parts.push('---'); // Separator between doctrine and context
  }

  if (freshnessWarning) {
    parts.push(freshnessWarning);
  }

  parts.push('# Company Context');
  parts.push(contextContent);

  // Log doctrine version for observability
  if (doctrineMode !== 'none') {
    console.log(`[forAi] Doctrine injected: version=${getDoctrineVersion()}, mode=${doctrineMode}`);
  }

  return parts.join('\n\n');
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
 *
 * @param graph - The company context graph
 * @param options - AI context options (doctrine defaults to 'operatingPrinciples')
 */
export function buildMediaPlanningContext(
  graph: CompanyContextGraph,
  options: AiContextOptions = {}
): string {
  const sections = getAiContextSections(graph, [
    'company',
    'objectives',
    'audience',
    'performance',
  ]);

  return formatForPrompt(sections, {
    markdown: true,
    skipNulls: true,
    doctrineMode: options.doctrineMode ?? 'operatingPrinciples',
    includeFreshness: options.includeFreshness,
  });
}

/**
 * Build context optimized for creative/brand prompts
 *
 * @param graph - The company context graph
 * @param options - AI context options (doctrine defaults to 'operatingPrinciples')
 */
export function buildCreativeContext(
  graph: CompanyContextGraph,
  options: AiContextOptions = {}
): string {
  const sections = getAiContextSections(graph, [
    'company',
    'brand',
    'audience',
    'content',
  ]);

  return formatForPrompt(sections, {
    markdown: true,
    skipNulls: true,
    doctrineMode: options.doctrineMode ?? 'operatingPrinciples',
    includeFreshness: options.includeFreshness,
  });
}

/**
 * Build context optimized for strategy prompts
 *
 * NOTE: Strategy prompts use FULL doctrine by default (includes strategy doctrine)
 *
 * @param graph - The company context graph
 * @param options - AI context options (doctrine defaults to 'full' for strategy)
 */
export function buildStrategyContext(
  graph: CompanyContextGraph,
  options: AiContextOptions = {}
): string {
  const sections = getAiContextSections(graph, [
    'company',
    'objectives',
    'competitive',
    'operations',
    'performance',
  ]);

  // Strategy prompts get FULL doctrine by default (includes strategy doctrine)
  return formatForPrompt(sections, {
    markdown: true,
    skipNulls: true,
    doctrineMode: options.doctrineMode ?? 'full',
    includeFreshness: options.includeFreshness,
  });
}

// ============================================================================
// Enhanced Strategy Context (with SRM field annotations)
// ============================================================================

/**
 * SRM Field annotation for AI context
 */
interface SrmFieldAnnotation {
  /** Field path (domain.field) */
  path: string;
  /** Human-readable label */
  label: string;
  /** Whether field has a value */
  hasValue: boolean;
  /** Source type: user-confirmed, ai-inferred, or unknown */
  source: 'user-confirmed' | 'ai-inferred' | 'unknown';
  /** Freshness status */
  freshness: 'fresh' | 'stale' | 'unknown';
  /** The actual value (truncated if too long) */
  value: string | null;
}

/** Maximum length for field values in prompts */
const MAX_VALUE_LENGTH = 500;

/**
 * Truncate a value safely for prompt injection
 */
function truncateValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (Array.isArray(value)) {
    str = value.slice(0, 5).join(', ') + (value.length > 5 ? ` (+${value.length - 5} more)` : '');
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  if (str.length > MAX_VALUE_LENGTH) {
    return str.slice(0, MAX_VALUE_LENGTH) + '...';
  }
  return str;
}

/**
 * Determine source type from provenance
 */
function getSourceType(field: WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined): SrmFieldAnnotation['source'] {
  if (!field?.provenance?.length) return 'unknown';
  const latestProvenance = field.provenance[0];
  const source = latestProvenance.source?.toLowerCase() ?? '';

  // User-confirmed sources
  if (source.includes('user') || source.includes('manual') || source.includes('brain') || source.includes('setup_wizard')) {
    return 'user-confirmed';
  }

  // AI-inferred sources
  if (source.includes('ai') || source.includes('inferred') || source.includes('fcb') || source.includes('gap') || source.includes('lab')) {
    return 'ai-inferred';
  }

  return 'unknown';
}

/**
 * Get freshness status for a field
 */
function getFieldFreshnessStatus(field: WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined): 'fresh' | 'stale' | 'unknown' {
  if (!field?.provenance?.length) return 'unknown';
  const freshness = getFieldFreshness(field as WithMetaType<unknown>);
  if (!freshness) return 'unknown';
  return freshness.score >= 0.5 ? 'fresh' : 'stale';
}

/**
 * Get a field from the graph by domain and field name
 */
function getGraphField(
  graph: CompanyContextGraph,
  domain: string,
  field: string
): WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined {
  const domainObj = graph[domain as keyof CompanyContextGraph];
  if (!domainObj || typeof domainObj !== 'object') return undefined;
  return (domainObj as Record<string, unknown>)[field] as WithMetaType<unknown> | WithMetaArrayType<unknown> | undefined;
}

/**
 * Build SRM field annotations for strategy context
 * Uses the SRM_FIELDS definition from readiness module
 */
function buildSrmFieldAnnotations(graph: CompanyContextGraph): SrmFieldAnnotation[] {
  const annotations: SrmFieldAnnotation[] = [];

  for (const srmField of SRM_FIELDS) {
    const { domain, field, label, isArray } = srmField;
    const alternatives = 'alternatives' in srmField ? srmField.alternatives : undefined;
    let fieldObj = getGraphField(graph, domain, field);
    let usedPath = `${domain}.${field}`;

    // Check alternatives if primary is empty
    const hasMainValue = isArray
      ? (fieldObj as WithMetaArrayType<unknown>)?.value?.length > 0
      : (fieldObj as WithMetaType<unknown>)?.value !== null && (fieldObj as WithMetaType<unknown>)?.value !== undefined;

    if (!hasMainValue && alternatives) {
      for (const alt of alternatives) {
        const [altDomain, altField] = alt.includes('.') ? alt.split('.') : [domain, alt];
        const altFieldObj = getGraphField(graph, altDomain, altField);
        const altHasValue = (altFieldObj as WithMetaArrayType<unknown>)?.value?.length > 0 ||
          ((altFieldObj as WithMetaType<unknown>)?.value !== null && (altFieldObj as WithMetaType<unknown>)?.value !== undefined);

        if (altHasValue) {
          fieldObj = altFieldObj;
          usedPath = `${altDomain}.${altField}`;
          break;
        }
      }
    }

    const fieldValue = fieldObj?.value;
    const hasValue = isArray
      ? Array.isArray(fieldValue) && fieldValue.length > 0
      : fieldValue !== null && fieldValue !== undefined;

    annotations.push({
      path: usedPath,
      label: SRM_FIELD_LABELS[usedPath] || label,
      hasValue,
      source: getSourceType(fieldObj),
      freshness: getFieldFreshnessStatus(fieldObj),
      value: hasValue ? truncateValue(fieldValue) : null,
    });
  }

  return annotations;
}

/**
 * Build enhanced strategy context with SRM field annotations
 *
 * This version includes:
 * - Full doctrine
 * - SRM fields listed first with source annotations (user-confirmed, AI-inferred, stale)
 * - Truncated long values to keep prompt bounded
 * - Strategy readiness summary
 *
 * @param graph - The company context graph
 * @param options - AI context options
 */
export function buildEnhancedStrategyContext(
  graph: CompanyContextGraph,
  options: AiContextOptions = {}
): string {
  const annotations = buildSrmFieldAnnotations(graph);
  const readiness = isStrategyReady(graph);
  const baseContext = buildStrategyContext(graph, options);

  // Build SRM section with annotations
  const srmLines: string[] = [];

  // Strategy readiness summary
  if (readiness.ready) {
    srmLines.push('**Status**: Strategy-Ready');
  } else {
    srmLines.push(`**Status**: Not Strategy-Ready (${readiness.missing.length} missing)`);
  }

  srmLines.push('');
  srmLines.push('**Strategy-Ready Minimum (SRM) Fields:**');

  // List each SRM field with its annotation
  for (const ann of annotations) {
    if (!ann.hasValue) {
      srmLines.push(`- ${ann.label}: ❌ MISSING`);
    } else {
      const sourceTag = ann.source === 'user-confirmed'
        ? '[user-confirmed]'
        : ann.source === 'ai-inferred'
        ? '[AI-inferred]'
        : '';
      const freshnessTag = ann.freshness === 'stale' ? '[stale]' : '';
      const tags = [sourceTag, freshnessTag].filter(Boolean).join(' ');
      const valuePreview = ann.value ? `: ${ann.value.slice(0, 100)}${ann.value.length > 100 ? '...' : ''}` : '';
      srmLines.push(`- ${ann.label}${tags ? ' ' + tags : ''}${valuePreview}`);
    }
  }

  // Add warnings for stale fields
  const staleFields = annotations.filter(a => a.hasValue && a.freshness === 'stale');
  if (staleFields.length > 0) {
    srmLines.push('');
    srmLines.push(`**Note**: ${staleFields.length} SRM field(s) are stale and may need review.`);
  }

  // Insert SRM section after doctrine, before context
  const srmSection = `## Strategy-Ready Context\n${srmLines.join('\n')}\n`;

  // Find where doctrine ends (after the first ---) and insert SRM section
  const doctrineSeparator = '---';
  const separatorIndex = baseContext.indexOf(doctrineSeparator);

  if (separatorIndex !== -1) {
    const afterSeparator = separatorIndex + doctrineSeparator.length;
    return (
      baseContext.slice(0, afterSeparator) +
      '\n\n' +
      srmSection +
      '\n' +
      baseContext.slice(afterSeparator)
    );
  }

  // No separator found, prepend SRM section
  return srmSection + '\n' + baseContext;
}

/**
 * Build minimal context summary
 * NOTE: Summary does NOT inject doctrine (it's for display, not AI prompts)
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

/**
 * Build a raw context prompt without doctrine
 * Use this when you need company context but will inject doctrine separately
 */
export function buildRawContextPrompt(
  graph: CompanyContextGraph,
  sections?: AiContextSection[]
): string {
  const contextSections = sections
    ? getAiContextSections(graph, sections)
    : buildAiContextView(graph);

  return formatForPrompt(contextSections, {
    markdown: true,
    skipNulls: true,
    doctrineMode: 'none', // Explicitly no doctrine
  });
}

// ============================================================================
// Hive Brain Composition
// ============================================================================

/**
 * Options for Hive Brain composition
 */
export interface HiveBrainOptions extends AiContextOptions {
  /** Include Hive Brain defaults. Default: true */
  includeHiveBrain?: boolean;
  /** Show source provenance (company vs hive) in output. Default: false */
  showSourceProvenance?: boolean;
}

/**
 * Build context with Hive Brain defaults merged in
 *
 * This loads the Hive Global context graph and merges it with the company graph.
 * Company values always take precedence over Hive Brain defaults.
 *
 * @param companyGraph - The company's context graph
 * @param options - Options including Hive Brain settings
 * @returns Merged context prompt string
 */
export async function buildContextWithHiveBrain(
  companyGraph: CompanyContextGraph,
  options: HiveBrainOptions = {}
): Promise<string> {
  const {
    includeHiveBrain = true,
    showSourceProvenance = false,
    doctrineMode = 'operatingPrinciples',
    includeFreshness = false,
  } = options;

  let effectiveGraph = companyGraph;
  let hiveGraph: CompanyContextGraph | null = null;

  // Load and merge Hive Brain if enabled
  if (includeHiveBrain) {
    try {
      hiveGraph = await getHiveGlobalContextGraph();
      effectiveGraph = mergeWithHiveBrain(companyGraph, hiveGraph);
      console.log('[forAi] Merged Hive Brain defaults with company context');
    } catch (error) {
      console.warn('[forAi] Could not load Hive Brain, using company context only:', error);
    }
  }

  // Build the AI context view
  const contextView = buildAiContextView(effectiveGraph);

  // Format base context
  let formattedContext = formatForPrompt(contextView, {
    markdown: true,
    skipNulls: true,
    doctrineMode,
    includeFreshness,
  });

  // Add source provenance section if requested
  if (showSourceProvenance && hiveGraph) {
    const provenanceSection = buildSourceProvenanceSection(companyGraph, hiveGraph);
    formattedContext = provenanceSection + '\n\n' + formattedContext;
  }

  return formattedContext;
}

/**
 * Build strategy context with Hive Brain defaults
 *
 * @param companyGraph - The company's context graph
 * @param options - Options including Hive Brain settings
 */
export async function buildStrategyContextWithHiveBrain(
  companyGraph: CompanyContextGraph,
  options: HiveBrainOptions = {}
): Promise<string> {
  const {
    includeHiveBrain = true,
    showSourceProvenance = true,
    doctrineMode = 'full',
    includeFreshness = true,
  } = options;

  let effectiveGraph = companyGraph;
  let hiveGraph: CompanyContextGraph | null = null;

  // Load and merge Hive Brain if enabled
  if (includeHiveBrain) {
    try {
      hiveGraph = await getHiveGlobalContextGraph();
      effectiveGraph = mergeWithHiveBrain(companyGraph, hiveGraph);
      console.log('[forAi] Merged Hive Brain for strategy context');
    } catch (error) {
      console.warn('[forAi] Could not load Hive Brain:', error);
    }
  }

  // Build enhanced strategy context with merged graph
  let context = buildEnhancedStrategyContext(effectiveGraph, {
    doctrineMode,
    includeFreshness,
  });

  // Add source provenance section
  if (showSourceProvenance && hiveGraph) {
    const provenanceSection = buildSourceProvenanceSection(companyGraph, hiveGraph);
    // Insert after doctrine separator
    const separatorIndex = context.indexOf('---');
    if (separatorIndex !== -1) {
      const afterSeparator = separatorIndex + 3;
      context = (
        context.slice(0, afterSeparator) +
        '\n\n' +
        provenanceSection +
        context.slice(afterSeparator)
      );
    } else {
      context = provenanceSection + '\n\n' + context;
    }
  }

  // Add capabilities section (from merged graph - includes Hive Brain capabilities)
  const capabilitiesSection = buildCapabilitiesSection(effectiveGraph);
  if (capabilitiesSection) {
    context += '\n\n' + capabilitiesSection;
  }

  return context;
}

/**
 * Build creative context with Hive Brain defaults
 */
export async function buildCreativeContextWithHiveBrain(
  companyGraph: CompanyContextGraph,
  options: HiveBrainOptions = {}
): Promise<string> {
  const { includeHiveBrain = true, doctrineMode = 'operatingPrinciples' } = options;

  let effectiveGraph = companyGraph;

  if (includeHiveBrain) {
    try {
      const hiveGraph = await getHiveGlobalContextGraph();
      effectiveGraph = mergeWithHiveBrain(companyGraph, hiveGraph);
    } catch (error) {
      console.warn('[forAi] Could not load Hive Brain:', error);
    }
  }

  let context = buildCreativeContext(effectiveGraph, { doctrineMode });

  // Add capabilities section (relevant for creative work)
  const capabilitiesSection = buildCapabilitiesSection(effectiveGraph);
  if (capabilitiesSection) {
    context += '\n\n' + capabilitiesSection;
  }

  return context;
}

/**
 * Build media planning context with Hive Brain defaults
 */
export async function buildMediaPlanningContextWithHiveBrain(
  companyGraph: CompanyContextGraph,
  options: HiveBrainOptions = {}
): Promise<string> {
  const { includeHiveBrain = true, doctrineMode = 'operatingPrinciples' } = options;

  let effectiveGraph = companyGraph;

  if (includeHiveBrain) {
    try {
      const hiveGraph = await getHiveGlobalContextGraph();
      effectiveGraph = mergeWithHiveBrain(companyGraph, hiveGraph);
    } catch (error) {
      console.warn('[forAi] Could not load Hive Brain:', error);
    }
  }

  let context = buildMediaPlanningContext(effectiveGraph, { doctrineMode });

  // Add capabilities section (relevant for media planning)
  const capabilitiesSection = buildCapabilitiesSection(effectiveGraph);
  if (capabilitiesSection) {
    context += '\n\n' + capabilitiesSection;
  }

  return context;
}

/**
 * Build a source provenance section showing which values come from Hive Brain
 * @internal
 */
function buildSourceProvenanceSection(
  companyGraph: CompanyContextGraph,
  hiveGraph: CompanyContextGraph
): string {
  const lines: string[] = [];
  lines.push('## Context Sources');
  lines.push('');

  const hiveFills: string[] = [];
  const companyConfirmed: string[] = [];

  // Check key fields in Hive Brain domains
  const fieldsToCheck = [
    { domain: 'brand', field: 'positioning', label: 'Brand Positioning' },
    { domain: 'brand', field: 'toneOfVoice', label: 'Tone of Voice' },
    { domain: 'objectives', field: 'primaryObjective', label: 'Primary Objective' },
    { domain: 'operationalConstraints', field: 'complianceRequirements', label: 'Compliance Requirements' },
    { domain: 'ops', field: 'operationalCapacity', label: 'Operational Capacity' },
    { domain: 'creative', field: 'creativeDirection', label: 'Creative Direction' },
    { domain: 'performanceMedia', field: 'attributionModel', label: 'Attribution Model' },
  ];

  for (const { domain, field, label } of fieldsToCheck) {
    const valueSource = getValueSource(companyGraph, hiveGraph, domain, field);

    if (valueSource.source === 'hive') {
      hiveFills.push(label);
    } else if (valueSource.source === 'company' && valueSource.isHumanConfirmed) {
      companyConfirmed.push(label);
    }
  }

  if (companyConfirmed.length > 0) {
    lines.push(`**Company-confirmed**: ${companyConfirmed.join(', ')}`);
  }

  if (hiveFills.length > 0) {
    lines.push(`**Using Hive defaults**: ${hiveFills.join(', ')}`);
  }

  if (hiveFills.length === 0 && companyConfirmed.length === 0) {
    lines.push('*No Hive Brain defaults applied - all values are company-specific*');
  }

  return lines.join('\n');
}

// ============================================================================
// Hive Capabilities Formatting
// ============================================================================

/**
 * Format Hive Capabilities for prompt injection
 *
 * Only includes enabled capabilities with their strength, deliverables, and constraints.
 * Output is compact and bounded to avoid prompt bloat.
 *
 * @param capabilities - The capabilities domain from the context graph
 * @returns Formatted capabilities section string, or empty string if none enabled
 */
export function formatCapabilitiesForPrompt(
  capabilities: CapabilitiesDomain | undefined
): string {
  if (!capabilities) return '';

  const lines: string[] = [];
  let hasAnyEnabled = false;

  for (const category of CAPABILITY_CATEGORIES) {
    const categoryCapabilities = capabilities[category];
    if (!categoryCapabilities) continue;

    const enabledInCategory: string[] = [];
    const capabilityKeys = CAPABILITY_KEYS[category];

    for (const key of capabilityKeys) {
      const cap = categoryCapabilities[key as keyof typeof categoryCapabilities] as Capability | undefined;
      if (!cap) continue;

      const isEnabled = cap.enabled?.value === true;
      if (!isEnabled) continue;

      hasAnyEnabled = true;
      const strength = cap.strength?.value || 'basic';
      const deliverables = cap.deliverables?.value || [];
      const constraints = cap.constraints?.value || [];

      const label = CAPABILITY_LABELS[key] || key;

      // Build compact capability line
      let capLine = `- **${label}** (${strength})`;

      // Add deliverables if present (truncate to first 3)
      if (deliverables.length > 0) {
        const truncated = deliverables.slice(0, 3);
        const more = deliverables.length > 3 ? ` +${deliverables.length - 3} more` : '';
        capLine += `: ${truncated.join(', ')}${more}`;
      }

      // Add constraints as a note if present (truncate to first 2)
      if (constraints.length > 0) {
        const truncated = constraints.slice(0, 2);
        capLine += ` ⚠️ ${truncated.join('; ')}`;
      }

      enabledInCategory.push(capLine);
    }

    if (enabledInCategory.length > 0) {
      lines.push(`### ${CATEGORY_LABELS[category]}`);
      lines.push(...enabledInCategory);
      lines.push('');
    }
  }

  if (!hasAnyEnabled) return '';

  return `## Hive Capabilities\n*Services available from Hive for this engagement:*\n\n${lines.join('\n')}`;
}

/**
 * Build capabilities section from a merged context graph
 * @internal
 */
function buildCapabilitiesSection(graph: CompanyContextGraph): string {
  return formatCapabilitiesForPrompt(graph.capabilities);
}
