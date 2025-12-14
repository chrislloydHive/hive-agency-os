// lib/contextGraph/contextGraphV3Mapping.ts
// Domain and Importance Mapping for Context Graph v3
//
// Maps Brain/Context fields to:
// - Strategic domains for clustering
// - Importance weights for sizing
// - Dependency relationships

import type { DomainName } from './companyContextGraph';
import type { DomainClusterLayout, ContextGraphEdge } from './contextGraphV3Types';

// ============================================================================
// Domain Mapping
// ============================================================================

/**
 * Map a field key to its strategic domain for v3 clustering
 *
 * This maps the 18 existing domains into 7 strategic clusters for visualization:
 * - identity: Core business identity
 * - positioning: Brand and positioning
 * - audience: Audience and segments
 * - offers: Products, services, revenue
 * - market: Competition and market landscape
 * - operations: Digital infrastructure, ops, media
 * - other: Everything else
 */
export function mapFieldKeyToDomainCluster(key: string): DomainName {
  // Extract the domain from the key
  const domain = key.split('.')[0] as DomainName;
  return domain;
}

/**
 * Get the strategic cluster for visualization (groups related domains)
 */
export type StrategicCluster =
  | 'identity'      // identity
  | 'positioning'   // brand
  | 'audience'      // audience
  | 'offers'        // productOffer, budgetOps
  | 'market'        // competitive
  | 'operations'    // ops, digitalInfra, performanceMedia
  | 'content'       // website, content, seo, creative
  | 'other';        // historical, constraints, etc.

export function mapDomainToStrategicCluster(domain: DomainName): StrategicCluster {
  switch (domain) {
    case 'identity':
      return 'identity';
    case 'brand':
      return 'positioning';
    case 'audience':
      return 'audience';
    case 'productOffer':
    case 'budgetOps':
    case 'objectives':
      return 'offers';
    case 'competitive':
      return 'market';
    case 'ops':
    case 'digitalInfra':
    case 'performanceMedia':
      return 'operations';
    case 'website':
    case 'content':
    case 'seo':
    case 'creative':
      return 'content';
    default:
      return 'other';
  }
}

// ============================================================================
// Importance Mapping
// ============================================================================

/**
 * Strategic importance weights for specific field paths
 * 5 = Critical for strategy, 1 = Nice to have
 */
const FIELD_IMPORTANCE: Record<string, number> = {
  // Critical fields (5) - Core strategic decisions depend on these
  'identity.icpDescription': 5,
  'identity.primaryObjective': 5,
  'identity.businessName': 5,
  'identity.industry': 5,
  'brand.positioning': 5,
  'brand.marketPosition': 5,
  'competitive.competitors': 5,
  'competitive.primaryCompetitors': 5,
  'objectives.primaryObjective': 5,
  'objectives.primaryKpi': 5,

  // High importance (4) - Key for most features
  'identity.businessModel': 4,
  'identity.businessDescription': 4,
  'identity.primaryOffering': 4,
  'brand.valueProps': 4,
  'brand.differentiators': 4,
  'brand.toneOfVoice': 4,
  'audience.coreSegments': 4,
  'audience.primaryAudience': 4,
  'productOffer.products': 4,
  'productOffer.services': 4,
  'objectives.targetCpa': 4,
  'objectives.targetRoas': 4,
  'competitive.competitorPositioning': 4,

  // Medium importance (3) - Used by multiple features
  'audience.painPoints': 3,
  'audience.motivations': 3,
  'audience.demographics': 3,
  'brand.brandVoice': 3,
  'creative.coreMessages': 3,
  'creative.messagingFramework': 3,
  'performanceMedia.activeChannels': 3,
  'performanceMedia.topPerformingChannel': 3,
  'budgetOps.totalMarketingBudget': 3,
  'budgetOps.mediaSpendBudget': 3,
  'website.overallScore': 3,
  'seo.overallScore': 3,

  // Lower importance (2) - Supporting data
  'content.contentStrategy': 2,
  'content.contentSummary': 2,
  'digitalInfra.trackingTools': 2,
  'digitalInfra.ga4Health': 2,
  'ops.conversionEvents': 2,
  'historical.performanceTrends': 2,

  // Supplementary (1) - Reference data
  'operationalConstraints.seasonalityNotes': 1,
  'operationalConstraints.businessHours': 1,
  'historyRefs.previousStrategies': 1,
  'storeRisk.riskFactors': 1,
};

/**
 * Default importance by domain (for fields not explicitly mapped)
 */
const DOMAIN_DEFAULT_IMPORTANCE: Record<DomainName, number> = {
  identity: 4,
  brand: 4,
  objectives: 4,
  audience: 3,
  productOffer: 3,
  competitive: 4,
  creative: 3,
  performanceMedia: 3,
  budgetOps: 3,
  website: 2,
  content: 2,
  seo: 2,
  ops: 2,
  digitalInfra: 2,
  historical: 2,
  operationalConstraints: 2,
  storeRisk: 2,
  historyRefs: 1,
  social: 3,
  capabilities: 3,
};

/**
 * Map a field key to its strategic importance (1-5)
 *
 * @param key - Field path like "identity.icpDescription"
 * @returns Importance score 1-5
 */
export function mapFieldKeyToImportance(key: string): number {
  // Check explicit mapping first
  if (FIELD_IMPORTANCE[key]) {
    return FIELD_IMPORTANCE[key];
  }

  // Fall back to domain default
  const domain = key.split('.')[0] as DomainName;
  return DOMAIN_DEFAULT_IMPORTANCE[domain] ?? 2;
}

// ============================================================================
// Domain Cluster Layout
// ============================================================================

/**
 * Generate cluster layout positions for all domains
 *
 * Arranges domains in a radial layout with strategic clusters grouped together
 */
export function generateDomainClusterLayout(
  width: number,
  height: number
): DomainClusterLayout {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.38;

  // Strategic positioning - related domains near each other
  const domainAngles: Record<DomainName, number> = {
    // Top - Strategy & Identity
    identity: -Math.PI / 2,              // 12 o'clock
    brand: -Math.PI / 3,                 // 2 o'clock
    objectives: -2 * Math.PI / 3,        // 10 o'clock

    // Right side - Audience & Market
    audience: -Math.PI / 6,              // 1 o'clock
    competitive: Math.PI / 6,            // 5 o'clock

    // Left side - Products & Budget
    productOffer: -5 * Math.PI / 6,      // 11 o'clock
    budgetOps: 5 * Math.PI / 6,          // 7 o'clock

    // Bottom right - Creative & Content
    creative: Math.PI / 3,               // 4 o'clock
    content: Math.PI / 2.5,              // 4:30

    // Bottom - Digital
    website: Math.PI / 2,                // 6 o'clock
    seo: 2 * Math.PI / 3,                // 8 o'clock

    // Bottom left - Operations
    performanceMedia: 3 * Math.PI / 4,   // 7:30
    ops: 5 * Math.PI / 6,                // 8:30
    digitalInfra: 11 * Math.PI / 12,     // 9 o'clock

    // Center-ish - Supporting
    historical: Math.PI,                 // 9 o'clock (inner)
    operationalConstraints: -Math.PI,    // 9 o'clock (outer)
    storeRisk: 7 * Math.PI / 8,          // 8 o'clock (inner)
    historyRefs: -7 * Math.PI / 8,       // 10 o'clock (inner)

    // Social & Local (near digital footprint)
    social: Math.PI / 4,                 // 5 o'clock

    // Capabilities (near ops)
    capabilities: 11 * Math.PI / 12,     // 9:30 o'clock
  };

  // Domain colors (matching existing SECTION_COLORS)
  const domainColors: Record<DomainName, string> = {
    identity: '#14b8a6',        // teal-500
    brand: '#8b5cf6',           // violet-500
    objectives: '#f59e0b',      // amber-500
    audience: '#ec4899',        // pink-500
    productOffer: '#06b6d4',    // cyan-500
    digitalInfra: '#6366f1',    // indigo-500
    website: '#22c55e',         // green-500
    content: '#f97316',         // orange-500
    seo: '#0ea5e9',             // sky-500
    ops: '#64748b',             // slate-500
    performanceMedia: '#d946ef', // fuchsia-500
    historical: '#78716c',      // stone-500
    creative: '#a855f7',        // purple-500
    competitive: '#ef4444',     // red-500
    budgetOps: '#84cc16',       // lime-500
    operationalConstraints: '#f43f5e', // rose-500
    storeRisk: '#eab308',       // yellow-500
    historyRefs: '#71717a',     // zinc-500
    social: '#10b981',          // emerald-500
    capabilities: '#3b82f6',    // blue-500
  };

  // Domain labels
  const domainLabels: Record<DomainName, string> = {
    identity: 'Identity',
    brand: 'Brand',
    objectives: 'Objectives',
    audience: 'Audience',
    productOffer: 'Product/Offer',
    digitalInfra: 'Digital Infra',
    website: 'Website',
    content: 'Content',
    seo: 'SEO',
    ops: 'Operations',
    performanceMedia: 'Media',
    historical: 'Historical',
    creative: 'Creative',
    competitive: 'Competitive',
    budgetOps: 'Budget',
    operationalConstraints: 'Constraints',
    storeRisk: 'Risk',
    historyRefs: 'History',
    social: 'Social & Local',
    capabilities: 'Capabilities',
  };

  const layout: Partial<DomainClusterLayout> = {};

  for (const domain of Object.keys(domainAngles) as DomainName[]) {
    const angle = domainAngles[domain];
    layout[domain] = {
      center: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      color: domainColors[domain],
      label: domainLabels[domain],
      angle,
    };
  }

  return layout as DomainClusterLayout;
}

// ============================================================================
// Dependency Mapping
// ============================================================================

/**
 * Strategic dependencies between fields
 *
 * Format: "sourceField" -> ["targetField1", "targetField2"]
 * Meaning: targetFields depend on sourceField
 */
const FIELD_DEPENDENCIES: Record<string, Array<{ target: string; weight: number }>> = {
  // Identity dependencies - foundational fields that inform everything
  'identity.icpDescription': [
    { target: 'audience.coreSegments', weight: 0.9 },
    { target: 'audience.primaryAudience', weight: 0.9 },
    { target: 'brand.positioning', weight: 0.8 },
    { target: 'creative.coreMessages', weight: 0.7 },
  ],
  'identity.industry': [
    { target: 'competitive.competitors', weight: 0.8 },
    { target: 'audience.coreSegments', weight: 0.6 },
  ],
  'identity.businessModel': [
    { target: 'objectives.primaryObjective', weight: 0.7 },
    { target: 'budgetOps.totalMarketingBudget', weight: 0.6 },
  ],

  // Brand dependencies
  'brand.positioning': [
    { target: 'creative.coreMessages', weight: 0.9 },
    { target: 'brand.valueProps', weight: 0.8 },
    { target: 'brand.differentiators', weight: 0.8 },
  ],
  'brand.valueProps': [
    { target: 'creative.coreMessages', weight: 0.8 },
    { target: 'creative.proofPoints', weight: 0.7 },
  ],

  // Audience dependencies
  'audience.coreSegments': [
    { target: 'audience.painPoints', weight: 0.9 },
    { target: 'audience.motivations', weight: 0.9 },
    { target: 'performanceMedia.activeChannels', weight: 0.7 },
  ],
  'audience.painPoints': [
    { target: 'brand.valueProps', weight: 0.8 },
    { target: 'creative.coreMessages', weight: 0.8 },
  ],

  // Objectives dependencies
  'objectives.primaryObjective': [
    { target: 'objectives.targetCpa', weight: 0.8 },
    { target: 'objectives.targetRoas', weight: 0.8 },
    { target: 'budgetOps.mediaSpendBudget', weight: 0.7 },
  ],

  // Competitive dependencies
  'competitive.competitors': [
    { target: 'competitive.competitorPositioning', weight: 0.9 },
    { target: 'brand.differentiators', weight: 0.7 },
  ],
  'competitive.primaryCompetitors': [
    { target: 'brand.positioning', weight: 0.7 },
    { target: 'competitive.competitorPositioning', weight: 0.9 },
  ],

  // Media dependencies
  'performanceMedia.activeChannels': [
    { target: 'budgetOps.mediaSpendBudget', weight: 0.8 },
    { target: 'performanceMedia.topPerformingChannel', weight: 0.7 },
  ],

  // Creative dependencies
  'creative.coreMessages': [
    { target: 'creative.messagingFramework', weight: 0.8 },
  ],
};

/**
 * Derive edges from the dependency mapping for a set of nodes
 *
 * @param nodeIds - Set of node IDs present in the graph
 * @returns Array of edges connecting dependent nodes
 */
export function deriveEdgesFromDependencies(nodeIds: Set<string>): ContextGraphEdge[] {
  const edges: ContextGraphEdge[] = [];

  for (const [source, targets] of Object.entries(FIELD_DEPENDENCIES)) {
    if (!nodeIds.has(source)) continue;

    for (const { target, weight } of targets) {
      if (!nodeIds.has(target)) continue;

      edges.push({
        source,
        target,
        kind: 'dependency',
        weight,
      });
    }
  }

  return edges;
}

/**
 * Get all fields that a given field depends on
 */
export function getFieldDependencies(fieldKey: string): string[] {
  const deps: string[] = [];

  for (const [source, targets] of Object.entries(FIELD_DEPENDENCIES)) {
    for (const { target } of targets) {
      if (target === fieldKey) {
        deps.push(source);
      }
    }
  }

  return deps;
}

/**
 * Get all fields that depend on a given field
 */
export function getFieldDependents(fieldKey: string): string[] {
  const dependents = FIELD_DEPENDENCIES[fieldKey];
  if (!dependents) return [];
  return dependents.map(d => d.target);
}
