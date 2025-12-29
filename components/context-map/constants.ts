// components/context-map/constants.ts
// Constants for the Context Map visualization

import type { ZoneDefinition, EdgeDefinition, ZoneId } from './types';

// ============================================================================
// Zone Definitions (3x3 Grid Layout)
// ============================================================================

// CANONICALIZATION: Objectives zone REMOVED (belongs in Strategy)
// CANONICALIZATION: website, content, seo domains REMOVED (scores belong in Diagnostics)
export const ZONE_DEFINITIONS: ZoneDefinition[] = [
  {
    id: 'business-reality',
    label: 'Business Reality',
    domains: ['identity'],
    position: { row: 0, col: 0 },
    color: '#14b8a6', // teal-500
  },
  {
    id: 'brand',
    label: 'Brand',
    domains: ['brand'],
    position: { row: 0, col: 1 },
    color: '#8b5cf6', // violet-500
  },
  // NOTE: Objectives zone REMOVED - belongs in Strategy, not Context
  {
    id: 'constraints',
    label: 'Constraints',
    domains: ['operationalConstraints', 'budgetOps'],
    position: { row: 0, col: 2 },
    color: '#f43f5e', // rose-500
  },
  {
    id: 'audience',
    label: 'Audience / ICP',
    domains: ['audience'],
    position: { row: 1, col: 0 },
    color: '#ec4899', // pink-500
  },
  {
    id: 'offer',
    label: 'Offer',
    domains: [], // Field-level mapping used instead
    position: { row: 1, col: 1 },
    color: '#f97316', // orange-500
  },
  {
    id: 'go-to-market',
    label: 'Go-to-Market',
    domains: ['performanceMedia'],
    position: { row: 1, col: 2 },
    color: '#06b6d4', // cyan-500
  },
  {
    id: 'competitive',
    label: 'Competitive Landscape',
    domains: ['competitive'],
    position: { row: 2, col: 0 },
    color: '#ef4444', // red-500
  },
  {
    id: 'execution',
    label: 'Execution Capabilities',
    // NOTE: website, content, seo REMOVED - scores belong in Diagnostics
    domains: ['creative'],
    position: { row: 2, col: 2 },
    color: '#22c55e', // green-500
  },
];

export const OVERFLOW_ZONE: ZoneDefinition = {
  id: 'overflow',
  label: 'Other',
  domains: ['ops', 'historical', 'digitalInfra', 'storeRisk', 'historyRefs', 'social', 'capabilities'],
  position: { row: 2, col: 1 },
  color: '#64748b', // slate-500
};

export const ALL_ZONES: ZoneDefinition[] = [...ZONE_DEFINITIONS, OVERFLOW_ZONE];

// ============================================================================
// Domain to Zone Mapping
// ============================================================================

// ============================================================================
// Field-Level Zone Mapping (takes precedence over domain mapping)
// ============================================================================

/**
 * SINGLE SOURCE OF TRUTH for field → zone mapping
 * Use this for fields that need different zone placement than their domain default
 */
export const FIELD_TO_ZONE: Record<string, ZoneId> = {
  // Brand zone - positioning and brand identity
  'brand.positioning': 'brand',
  'brand.voiceTone': 'brand',
  'brand.coreValues': 'brand',

  // Offer zone - what we sell (value prop + products)
  'productOffer.valueProposition': 'offer',
  'productOffer.primaryProducts': 'offer',
  'productOffer.productsServices': 'offer',
  'productOffer.heroProducts': 'offer',

  // Go-to-Market zone - how we sell
  'productOffer.primaryConversionAction': 'go-to-market',
  'gtm.conversionAction': 'go-to-market',

  // Constraints zone - explicit budget fields
  'operationalConstraints.minBudget': 'constraints',
  'operationalConstraints.maxBudget': 'constraints',
  'operationalConstraints.budgetCapsFloors': 'constraints',
};

// ============================================================================
// Domain-Level Zone Mapping (fallback when field not in FIELD_TO_ZONE)
// ============================================================================

// CANONICALIZATION: Deprecated domains are NOT mapped (filtered at nodeGrouping level)
export const DOMAIN_TO_ZONE: Record<string, ZoneId> = {
  // Business Reality - core identity facts
  identity: 'business-reality',

  // Brand - positioning and brand elements
  brand: 'brand',

  // NOTE: objectives REMOVED - belongs in Strategy
  // objectives: 'objectives',

  // Constraints
  operationalConstraints: 'constraints',
  budgetOps: 'constraints',

  // Audience
  audience: 'audience',

  // Go-to-Market (default for productOffer unless overridden by FIELD_TO_ZONE)
  productOffer: 'go-to-market',
  performanceMedia: 'go-to-market',

  // Competitive
  competitive: 'competitive',

  // Execution (only creative remains)
  // NOTE: website, content, seo REMOVED - scores belong in Diagnostics
  creative: 'execution',

  // Overflow
  ops: 'overflow',
  historical: 'overflow',
  digitalInfra: 'overflow',
  storeRisk: 'overflow',
  historyRefs: 'overflow',
  social: 'overflow',
  capabilities: 'overflow',
};

// ============================================================================
// Edge Definitions (Read-only connections between zones)
// ============================================================================

// CANONICALIZATION: Edges referencing objectives REMOVED
export const EDGE_DEFINITIONS: EdgeDefinition[] = [
  // NOTE: objectives edges REMOVED
  { fromZone: 'go-to-market', toZone: 'audience' },
  { fromZone: 'execution', toZone: 'go-to-market' },
  { fromZone: 'competitive', toZone: 'go-to-market' },
  { fromZone: 'business-reality', toZone: 'audience' },
  { fromZone: 'constraints', toZone: 'go-to-market' },
];

// ============================================================================
// Layout Constants
// ============================================================================

export const LAYOUT = {
  // Canvas
  CANVAS_PADDING: 24,
  ZONE_GAP: 16,
  GRID_COLS: 3,
  GRID_ROWS: 3,

  // Nodes
  NODE_WIDTH: 200,
  NODE_HEIGHT: 72,
  NODE_GAP: 8,
  MAX_VISIBLE_NODES: 12,
  ZONE_HEADER_HEIGHT: 40,

  // Pan/Zoom
  MIN_SCALE: 0.3,
  MAX_SCALE: 2,
  ZOOM_STEP: 0.04, // Reduced from 0.1 for smoother scroll zooming
};

// ============================================================================
// Visual Constants
// ============================================================================

export const COLORS = {
  // Backgrounds
  CANVAS_BG: '#0f172a', // slate-900
  ZONE_BG: 'rgba(30, 41, 59, 0.5)', // slate-800/50
  NODE_BG: '#1e293b', // slate-800

  // Borders
  NODE_BORDER_CONFIRMED: 2,
  NODE_BORDER_PROPOSED: 2,

  // Status
  PROPOSED_COLOR: '#f59e0b', // amber-500
  CONFIRMED_OPACITY: 1,
  PROPOSED_OPACITY: 0.85,

  // Edges
  EDGE_COLOR: 'rgba(148, 163, 184, 0.3)', // slate-400/30
  EDGE_HIGHLIGHT_COLOR: 'rgba(148, 163, 184, 0.6)', // slate-400/60
  EDGE_WIDTH: 1.5,
};

// ============================================================================
// Visual Hierarchy (Signal vs Noise)
// ============================================================================

/**
 * Visual tier styling for different node prominence levels
 */
export const VISUAL_TIERS = {
  CONFIRMED: {
    opacity: 1,
    borderStyle: 'solid' as const,
    borderWidth: 2,
    scale: 1,
    bgOpacity: 0.5,
  },
  PROPOSED_HIGH: {
    opacity: 0.85,
    borderStyle: 'dashed' as const,
    borderWidth: 2,
    scale: 0.95,
    bgOpacity: 0.4,
  },
  PROPOSED_LOW: {
    opacity: 0.5,
    borderStyle: 'dashed' as const,
    borderWidth: 1,
    scale: 0.9,
    bgOpacity: 0.2,
  },
  GHOST: {
    opacity: 0.3,
    borderStyle: 'dotted' as const,
    borderWidth: 1,
    scale: 0.85,
    bgOpacity: 0.1,
  },
} as const;

/** Confidence threshold for high vs low confidence proposed nodes */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Maximum visible nodes per zone before collapsing */
export const MAX_VISIBLE_BEFORE_COLLAPSE = 4;

/** Maximum visible competitive nodes before collapsing */
export const MAX_COMPETITIVE_VISIBLE = 3;

// ============================================================================
// Node Taxonomy: Core vs Supporting
// ============================================================================

/**
 * Core nodes are HARD BLOCKERS for strategy/program readiness.
 * Missing these blocks Labs/GAP execution.
 *
 * BLOCKING RULES (per Context Map Doctrine):
 * - Context Map should ONLY block when required factual domains are entirely empty
 * - Example legitimate blockers: No ICP/Audience, No Offer/Product, No Business Model
 *
 * EXPLICITLY NOT BLOCKERS:
 * - Positioning (strategic conclusion, not raw context)
 * - Budget (optional context, finalized in Strategy Frame)
 * - Competitors (informational gap, affects AI confidence only)
 *
 * CANONICALIZATION: Only canonical factual fields (no objectives, no scores, no strategic conclusions)
 */
export const CORE_NODE_KEYS: string[] = [
  // Business Reality zone - What type of business
  'identity.businessModel',
  // Offer zone - What we sell and why
  'productOffer.valueProposition',
  'productOffer.primaryProducts',
  // Audience zone - Who we serve
  'audience.primaryAudience',
  'audience.icpDescription',
];

/**
 * Recommended nodes improve AI confidence but DON'T block workflow.
 * These show as "Context gaps" (amber) not "Context incomplete" (red).
 *
 * NOTE: Positioning and Budget are NOT included here because they are
 * STRATEGY fields, not Context fields. They live in the Strategic Frame.
 */
export const RECOMMENDED_NODE_KEYS: string[] = [
  // Go-to-Market zone
  'gtm.conversionAction',
  // Competitive zone - Informational gaps
  'competitive.competitors',
];

/**
 * Supporting/meta nodes provide context but aren't critical.
 * These can be collapsed under "System" or "Meta" by default.
 */
export const SUPPORTING_NODE_PATTERNS: string[] = [
  'Score',
  'validatedAt',
  'confidence',
  'meta.',
  'healthScore',
  'lastUpdated',
  'revisionId',
];

/**
 * Check if a node key is a "core" node
 */
export function isCoreNode(nodeKey: string): boolean {
  return CORE_NODE_KEYS.includes(nodeKey);
}

/**
 * Check if a node key is a "supporting/meta" node
 */
export function isSupportingNode(nodeKey: string): boolean {
  return SUPPORTING_NODE_PATTERNS.some(pattern =>
    nodeKey.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Get node tier: 'core' | 'supporting' | 'standard'
 */
export function getNodeTier(nodeKey: string): 'core' | 'supporting' | 'standard' {
  if (isCoreNode(nodeKey)) return 'core';
  if (isSupportingNode(nodeKey)) return 'supporting';
  return 'standard';
}

// ============================================================================
// Source Icons (for node cards)
// ============================================================================

export const SOURCE_LABELS: Record<string, string> = {
  user: 'User',
  ai: 'AI',
  lab: 'Lab',
  strategy: 'Strategy',
  import: 'Import',
};

// ============================================================================
// Field Label Overrides (short names for node cards)
// ============================================================================

// CANONICALIZATION: Removed objectives.*, website scores, content scores, seo scores
export const FIELD_LABEL_SHORT: Record<string, string> = {
  // Business Reality
  'identity.businessModel': 'Business Model',
  'identity.businessType': 'Business Type',
  'identity.industry': 'Industry',
  'identity.geographicFootprint': 'Geography',
  'identity.marketMaturity': 'Market Stage',
  // Brand
  'brand.positioning': 'Positioning',
  'brand.tagline': 'Tagline',
  'brand.valueProps': 'Value Props',
  'brand.differentiators': 'Differentiators',
  'brand.voiceTone': 'Voice & Tone',
  'brand.coreValues': 'Core Values',
  // Audience
  'audience.primaryAudience': 'Primary Audience',
  'audience.icpDescription': 'ICP Description',
  'audience.coreSegments': 'Segments',
  // Offer
  'productOffer.valueProposition': 'Value Proposition',
  'productOffer.primaryProducts': 'Products/Services',
  'productOffer.productsServices': 'Products/Services',
  'productOffer.heroProducts': 'Hero Products',
  // Go-to-Market
  'gtm.conversionAction': 'Primary Conversion Action',
  // Constraints
  'operationalConstraints.minBudget': 'Min Budget',
  'operationalConstraints.maxBudget': 'Max Budget',
  'operationalConstraints.budgetCapsFloors': 'Budget Policy',
  // Competitive (facts only)
  'competitive.competitors': 'Competitors',
  'competitive.competitorsNotes': 'Competitive Notes',
  // Execution
  'creative.brandAssets': 'Brand Assets',
  // NOTE: objectives.*, website/content/seo scores REMOVED
};

/**
 * Get a short label for a field path
 */
export function getShortLabel(fieldPath: string): string {
  if (FIELD_LABEL_SHORT[fieldPath]) {
    return FIELD_LABEL_SHORT[fieldPath];
  }
  // Extract last part of path and convert to title case
  const lastPart = fieldPath.split('.').pop() || fieldPath;
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Build inverse mapping for label → key lookups (for blocker click navigation)
const SHORT_LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_LABEL_SHORT).map(([key, label]) => [label, key])
);

/**
 * Get field key from short label (inverse of getShortLabel)
 * Used for blocker click navigation
 */
export function getKeyFromShortLabel(label: string): string | null {
  // First check direct mapping
  if (SHORT_LABEL_TO_KEY[label]) {
    return SHORT_LABEL_TO_KEY[label];
  }

  // Try to find in CORE_NODE_KEYS by generating labels
  for (const key of CORE_NODE_KEYS) {
    if (getShortLabel(key) === label) {
      return key;
    }
  }

  // Try to find in RECOMMENDED_NODE_KEYS
  for (const key of RECOMMENDED_NODE_KEYS) {
    if (getShortLabel(key) === label) {
      return key;
    }
  }

  return null;
}

/**
 * Get zone color by ID
 */
export function getZoneColor(zoneId: ZoneId): string {
  const zone = ALL_ZONES.find((z) => z.id === zoneId);
  return zone?.color || COLORS.NODE_BG;
}

/**
 * Get zone by domain name (fallback only - prefer getZoneForField)
 */
export function getZoneForDomain(domain: string): ZoneId {
  return DOMAIN_TO_ZONE[domain] || 'overflow';
}

/**
 * Get zone for a specific field key (PREFERRED)
 * Checks FIELD_TO_ZONE first, then falls back to DOMAIN_TO_ZONE
 *
 * @param fieldKey - Full field key like 'brand.positioning' or 'identity.businessModel'
 */
export function getZoneForField(fieldKey: string): ZoneId {
  // 1. Check field-level mapping first (takes precedence)
  if (FIELD_TO_ZONE[fieldKey]) {
    return FIELD_TO_ZONE[fieldKey];
  }

  // 2. Fall back to domain-level mapping
  const domain = fieldKey.split('.')[0];
  return DOMAIN_TO_ZONE[domain] || 'overflow';
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format a node value for display - handles all types cleanly
 * Prevents [object Object] from showing
 */
export function formatNodeValue(value: unknown, maxLength: number = 200): string {
  if (value === null || value === undefined) return '(empty)';

  // Strings - trim and return
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '(empty)';
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + '...' : trimmed;
  }

  // Numbers and booleans - direct string conversion
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  // Arrays - show comma preview with count
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty list)';

    // Handle array of strings
    const stringItems = value
      .slice(0, 3)
      .map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          // Extract known fields from objects in array
          const obj = item as Record<string, unknown>;
          return obj.name || obj.title || obj.label || obj.value || obj.url || JSON.stringify(item).slice(0, 40);
        }
        return String(item);
      })
      .filter(Boolean);

    const preview = stringItems.join(', ');
    const suffix = value.length > 3 ? ` (+${value.length - 3} more)` : '';
    return preview + suffix;
  }

  // Objects - extract known fields or show JSON preview
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Try known field names first
    const knownFields = ['name', 'title', 'label', 'value', 'summary', 'description', 'url'];
    for (const field of knownFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        const str = obj[field] as string;
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
      }
    }

    // Fallback: Show key count and preview
    const keys = Object.keys(obj);
    if (keys.length === 0) return '(empty object)';

    // Try to create a readable preview
    const previewParts: string[] = [];
    for (const key of keys.slice(0, 2)) {
      const val = obj[key];
      if (typeof val === 'string') {
        previewParts.push(`${key}: ${val.slice(0, 30)}`);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        previewParts.push(`${key}: ${val}`);
      }
    }

    if (previewParts.length > 0) {
      const suffix = keys.length > 2 ? ` (+${keys.length - 2} fields)` : '';
      return previewParts.join(', ') + suffix;
    }

    // Last resort: JSON snippet
    const json = JSON.stringify(obj);
    return json.length > maxLength ? json.slice(0, maxLength) + '...' : json;
  }

  return String(value);
}

/**
 * Truncate value for preview (short version for node cards)
 */
export function truncateValue(value: unknown, maxLength: number = 80): string {
  return formatNodeValue(value, maxLength);
}
