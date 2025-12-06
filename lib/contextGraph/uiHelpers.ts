// lib/contextGraph/uiHelpers.ts
// UI Helper utilities for the Context Graph Viewer
//
// Transforms CompanyContextGraph into UI-friendly structures,
// provides diff computation, and domain metadata.

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import { DOMAIN_NAMES } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { calculateFreshness } from './freshness';

// ============================================================================
// Types
// ============================================================================

/**
 * Domain IDs for UI rendering - maps to actual domain names in the graph
 */
export type ContextDomainId = DomainName;

/**
 * UI-friendly representation of a single field
 */
export interface GraphFieldUi {
  /** Domain this field belongs to */
  domain: ContextDomainId;
  /** Full path e.g., "brand.positioning" */
  path: string;
  /** Human-friendly label e.g., "Positioning" */
  label: string;
  /** Stringified, human-friendly value */
  value: string | null;
  /** Raw value for advanced use */
  rawValue: unknown;
  /** Provenance chain */
  provenance: ProvenanceTag[];
  /** Freshness info */
  freshness: {
    ageDays: number;
    normalized: number; // 0..1 (1 = fresh, 0 = stale)
  } | null;
}

/**
 * A single diff item between two graph versions
 */
export interface GraphDiffItem {
  domain: ContextDomainId;
  path: string;
  label: string;
  before: string | null;
  after: string | null;
  changed: boolean;
}

// ============================================================================
// Domain Metadata
// ============================================================================

/**
 * Metadata for each domain including labels, descriptions, and lab links
 */
export const CONTEXT_DOMAIN_META: Record<
  ContextDomainId,
  {
    label: string;
    description?: string;
    labLink?: (companyId: string) => string | null;
  }
> = {
  identity: {
    label: 'Identity',
    description: 'Who the company is: name, site, basic profile.',
    labLink: () => null,
  },
  brand: {
    label: 'Brand',
    description: 'Positioning, value props, perception, tone.',
    labLink: (companyId) => `/c/${companyId}/diagnostics/brand`,
  },
  objectives: {
    label: 'Objectives & KPIs',
    description: 'Business and marketing objectives and KPIs.',
    labLink: () => null,
  },
  audience: {
    label: 'Audience',
    description: 'Segments, demand states, behaviors & media habits.',
    labLink: (companyId) => `/c/${companyId}/diagnostics/audience`,
  },
  productOffer: {
    label: 'Product & Offers',
    description: 'Product lines, hero offers, price & margins.',
    labLink: () => null,
  },
  digitalInfra: {
    label: 'Digital Infra',
    description: 'Tracking, analytics, CRM, measurement stack.',
    labLink: () => null,
  },
  website: {
    label: 'Website',
    description: 'Funnel, conversion, and UX context.',
    labLink: () => null,
  },
  content: {
    label: 'Content',
    description: 'Content themes, gaps, and needs.',
    labLink: () => null,
  },
  seo: {
    label: 'SEO',
    description: 'Search demand, keyword themes, competitors.',
    labLink: () => null,
  },
  ops: {
    label: 'Ops',
    description: 'Operational context and platform configuration.',
    labLink: () => null,
  },
  performanceMedia: {
    label: 'Media Performance',
    description: 'Channel performance, mix, spend, and hints.',
    labLink: (companyId) => `/c/${companyId}/diagnostics/media`,
  },
  historical: {
    label: 'Historical',
    description: 'Past spend, performance, seasonality, incrementality.',
    labLink: () => null,
  },
  creative: {
    label: 'Creative',
    description: 'Messaging architecture, creative territories, campaign concepts, and asset specs.',
    labLink: (companyId) => `/c/${companyId}/labs/creative`,
  },
  competitive: {
    label: 'Competitive',
    description: 'Competitor profiles, positioning map, differentiation strategy, and market trends.',
    labLink: (companyId) => `/c/${companyId}/labs/competitor`,
  },
  budgetOps: {
    label: 'Budget',
    description: 'Budget ranges, rules, and allocations.',
    labLink: () => null,
  },
  operationalConstraints: {
    label: 'Constraints',
    description: 'Legal, platform, pacing, and other constraints.',
    labLink: () => null,
  },
  storeRisk: {
    label: 'Stores & Risk',
    description: 'Store-level context and risk tolerance.',
    labLink: () => null,
  },
  historyRefs: {
    label: 'History Refs',
    description: 'Pointers to the latest diagnostic runs & plans.',
    labLink: () => null,
  },
};

// ============================================================================
// Label Overrides
// ============================================================================

/**
 * Manual label overrides for specific paths
 */
const LABEL_OVERRIDES: Record<string, string> = {
  // Brand
  'brand.positioning': 'Positioning',
  'brand.valueProps': 'Value Propositions',
  'brand.differentiators': 'Differentiators',
  'brand.brandPerception': 'Brand Perception',
  'brand.toneOfVoice': 'Tone of Voice',
  'brand.tagline': 'Tagline',
  'brand.brandPersonality': 'Brand Personality',
  'brand.messagingPillars': 'Messaging Pillars',
  'brand.uniqueSellingPoints': 'Unique Selling Points',
  'brand.brandStrengths': 'Brand Strengths',
  'brand.brandWeaknesses': 'Brand Weaknesses',
  'brand.competitivePosition': 'Competitive Position',
  // Audience
  'audience.coreSegments': 'Core Segments',
  'audience.behavioralDrivers': 'Behavioral Drivers',
  'audience.demandStates': 'Demand States',
  'audience.mediaHabits': 'Media Habits',
  'audience.demographics': 'Demographics',
  'audience.primaryMarkets': 'Primary Markets',
  'audience.painPoints': 'Pain Points',
  'audience.motivations': 'Motivations',
  'audience.audienceNeeds': 'Audience Needs',
  'audience.preferredChannels': 'Preferred Channels',
  // Objectives
  'objectives.primaryObjective': 'Primary Objective',
  'objectives.primaryBusinessGoal': 'Primary Business Goal',
  'objectives.targetCpa': 'Target CPA',
  'objectives.targetCpl': 'Target CPL',
  'objectives.targetRoas': 'Target ROAS',
  'objectives.targetMer': 'Target MER',
  'objectives.timeHorizon': 'Time Horizon',
  // Identity
  'identity.businessName': 'Business Name',
  'identity.industry': 'Industry',
  'identity.businessModel': 'Business Model',
  'identity.marketMaturity': 'Market Maturity',
  'identity.geographicFootprint': 'Geographic Footprint',
  'identity.seasonalityNotes': 'Seasonality Notes',
  'identity.primaryCompetitors': 'Primary Competitors',
  // Performance Media
  'performanceMedia.activeChannels': 'Active Channels',
  'performanceMedia.topPerformingChannel': 'Top Performing Channel',
  'performanceMedia.underperformingChannels': 'Underperforming Channels',
  'performanceMedia.totalMonthlySpend': 'Total Monthly Spend',
  'performanceMedia.blendedCpa': 'Blended CPA',
  'performanceMedia.blendedRoas': 'Blended ROAS',
  'performanceMedia.mediaScore': 'Media Score',
  'performanceMedia.topCreatives': 'Top Creatives',
  // Product Offer
  'productOffer.heroProducts': 'Hero Products',
  'productOffer.productLines': 'Product Lines',
  'productOffer.pricingNotes': 'Pricing Notes',
  'productOffer.uniqueOffers': 'Unique Offers',
  'productOffer.conversionOffers': 'Conversion Offers',
  'productOffer.leadMagnets': 'Lead Magnets',
  // Historical
  'historical.pastPerformanceSummary': 'Past Performance Summary',
  'historical.seasonalityOverlays': 'Seasonality Overlays',
  'historical.keyLearnings': 'Key Learnings',
  'historical.historicalCpa': 'Historical CPA',
  'historical.historicalRoas': 'Historical ROAS',
  // Digital Infra
  'digitalInfra.trackingStackSummary': 'Tracking Stack Summary',
  'digitalInfra.ga4Health': 'GA4 Health',
  'digitalInfra.measurementLimits': 'Measurement Limits',
  'digitalInfra.attributionModel': 'Attribution Model',
  // Competitive
  'competitive.primaryCompetitors': 'Primary Competitors',
  'competitive.positioningAxes': 'Positioning Axes',
  'competitive.ownPositionPrimary': 'Own Position (Primary Axis)',
  'competitive.ownPositionSecondary': 'Own Position (Secondary Axis)',
  'competitive.positioningSummary': 'Positioning Summary',
  'competitive.whitespaceOpportunities': 'Whitespace Opportunities',
  'competitive.competitiveAdvantages': 'Competitive Advantages',
  'competitive.marketTrends': 'Market Trends',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a path like "brand.positioning" into a human-friendly label
 */
function pathToLabel(path: string): string {
  if (LABEL_OVERRIDES[path]) return LABEL_OVERRIDES[path];

  const parts = path.split('.');
  const last = parts[parts.length - 1];

  // Convert camelCase to Title Case with spaces
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Check if a node is a WithMeta object
 */
function isWithMetaNode(node: unknown): node is { value: unknown; provenance: ProvenanceTag[] } {
  return (
    node !== null &&
    typeof node === 'object' &&
    'value' in node &&
    'provenance' in node
  );
}

/**
 * Stringify a value for display
 */
function stringifyValue(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Get freshness info from provenance array
 */
function getFreshnessFromProvenance(
  provenance: ProvenanceTag[]
): GraphFieldUi['freshness'] {
  if (!provenance || provenance.length === 0) return null;

  try {
    const freshness = calculateFreshness(provenance[0]);
    return {
      ageDays: freshness.ageDays,
      normalized: freshness.score,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Flatten all fields in a domain into UI-friendly structures
 */
export function flattenDomainToFields(
  domainId: ContextDomainId,
  domainValue: unknown,
  prefix: string = domainId
): GraphFieldUi[] {
  const result: GraphFieldUi[] = [];

  const walk = (node: unknown, pathParts: string[]) => {
    // WithMeta node - this is a leaf field
    if (isWithMetaNode(node)) {
      const path = pathParts.join('.');
      const label = pathToLabel(path);
      const provenance = node.provenance ?? [];

      result.push({
        domain: domainId,
        path,
        label,
        value: stringifyValue(node.value),
        rawValue: node.value,
        provenance,
        freshness: getFreshnessFromProvenance(provenance),
      });
      return;
    }

    // Nested object - recurse
    if (node && typeof node === 'object') {
      Object.entries(node as Record<string, unknown>).forEach(([key, child]) => {
        walk(child, [...pathParts, key]);
      });
    }
  };

  walk(domainValue, [prefix]);
  return result;
}

/**
 * Flatten entire graph into a list of UI-friendly fields
 */
export function flattenGraphToFields(graph: CompanyContextGraph): GraphFieldUi[] {
  const fields: GraphFieldUi[] = [];

  DOMAIN_NAMES.forEach((domainId) => {
    const domainValue = graph[domainId];
    if (!domainValue) return;
    fields.push(...flattenDomainToFields(domainId, domainValue, domainId));
  });

  return fields;
}

/**
 * Compute a diff between two graphs by comparing flattened fields
 */
export function diffGraphs(
  before: CompanyContextGraph,
  after: CompanyContextGraph
): GraphDiffItem[] {
  const beforeFields = flattenGraphToFields(before);
  const afterFields = flattenGraphToFields(after);

  const beforeMap = new Map<string, GraphFieldUi>();
  beforeFields.forEach((f) => beforeMap.set(f.path, f));

  const afterMap = new Map<string, GraphFieldUi>();
  afterFields.forEach((f) => afterMap.set(f.path, f));

  const allPaths = new Set<string>([
    ...Array.from(beforeMap.keys()),
    ...Array.from(afterMap.keys()),
  ]);

  const diff: GraphDiffItem[] = [];

  allPaths.forEach((path) => {
    const beforeField = beforeMap.get(path);
    const afterField = afterMap.get(path);

    const domain = (beforeField ?? afterField)?.domain ?? 'identity';
    const label = pathToLabel(path);

    const beforeValue = beforeField?.value ?? null;
    const afterValue = afterField?.value ?? null;

    const changed = beforeValue !== afterValue;

    // Only include changed fields
    if (!changed) return;

    diff.push({
      domain,
      path,
      label,
      before: beforeValue,
      after: afterValue,
      changed,
    });
  });

  // Sort by domain then by label
  diff.sort((a, b) => {
    if (a.domain === b.domain) return a.label.localeCompare(b.label);
    return a.domain.localeCompare(b.domain);
  });

  return diff;
}

/**
 * Get fields grouped by domain
 */
export function groupFieldsByDomain(
  fields: GraphFieldUi[]
): Map<ContextDomainId, GraphFieldUi[]> {
  const map = new Map<ContextDomainId, GraphFieldUi[]>();

  // Initialize all domains
  DOMAIN_NAMES.forEach((d) => map.set(d, []));

  // Group fields
  fields.forEach((f) => {
    const arr = map.get(f.domain);
    if (arr) arr.push(f);
  });

  // Sort each domain's fields by label
  map.forEach((arr) => arr.sort((a, b) => a.label.localeCompare(b.label)));

  return map;
}

/**
 * Count fields with values in a domain
 */
export function countPopulatedFields(fields: GraphFieldUi[]): number {
  return fields.filter((f) => f.value !== null && f.value !== '').length;
}

/**
 * Filter fields based on various criteria
 */
export function filterFields(
  fields: GraphFieldUi[],
  options: {
    showOnlyWithValue?: boolean;
    showOnlyStale?: boolean;
    searchTerm?: string;
    needsRefreshPaths?: Set<string>;
  }
): GraphFieldUi[] {
  let result = [...fields];

  if (options.showOnlyWithValue) {
    result = result.filter((f) => f.value !== null && f.value !== '');
  }

  if (options.showOnlyStale && options.needsRefreshPaths) {
    result = result.filter((f) => options.needsRefreshPaths!.has(f.path));
  }

  if (options.searchTerm?.trim()) {
    const term = options.searchTerm.toLowerCase();
    result = result.filter(
      (f) =>
        f.label.toLowerCase().includes(term) ||
        f.path.toLowerCase().includes(term) ||
        (f.value ?? '').toLowerCase().includes(term)
    );
  }

  return result;
}
