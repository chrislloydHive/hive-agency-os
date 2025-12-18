// lib/os/context/requiredContextKeys.ts
// Canonical Required-Keys Registry for Strategy
//
// Defines the MINIMUM fields required for strategy generation.
// These must exist as nodes (or ghost placeholders) in the Context Graph.
//
// This is the SINGLE SOURCE OF TRUTH for:
// - What fields block strategy generation
// - What ghost nodes to create when missing
// - What the Fix button should focus on

import type { ZoneId } from '@/components/context-map/types';

// ============================================================================
// Types
// ============================================================================

/**
 * A required context key for strategy generation
 */
export interface RequiredContextKey {
  /** Canonical key matching context graph path (e.g., 'audience.icpDescription') */
  key: string;

  /** Zone where this field appears in the Context Map */
  zoneId: ZoneId;

  /** Human-readable label for display */
  label: string;

  /** Short label for compact displays */
  shortLabel?: string;

  /** Description shown in ghost cards */
  description?: string;

  /** Field type for rendering */
  type: 'string' | 'string[]' | 'number' | 'object';

  /** What features require this field */
  requiredFor: ('strategy' | 'websiteProgram' | 'demandProgram')[];

  /** Priority for ordering (lower = higher priority) */
  priority: number;

  /** Deep link hint for navigation */
  deepLinkHint?: string;

  /** Why this field is needed for strategy */
  reason: string;

  /** The domain in the context graph */
  domain: string;

  /** Field name within the domain */
  fieldName: string;

  /** Alternative fields that can satisfy this requirement */
  alternatives?: string[];
}

// ============================================================================
// Required Keys Registry
// ============================================================================

/**
 * Canonical required keys for strategy generation
 *
 * These are the MINIMUM fields needed for quality strategy output.
 * If any of these are missing, they will be shown as ghost nodes
 * and listed as blockers in the Fix UI.
 */
export const REQUIRED_CONTEXT_KEYS: RequiredContextKey[] = [
  // ============================================================================
  // Audience Zone - Who we serve
  // ============================================================================
  {
    key: 'audience.icpDescription',
    zoneId: 'audience',
    label: 'ICP Description',
    shortLabel: 'ICP',
    description: 'Ideal Customer Profile - detailed description of your target customer',
    type: 'string',
    requiredFor: ['strategy', 'demandProgram'],
    priority: 1,
    reason: 'Strategy needs audience context beyond just a name',
    domain: 'audience',
    fieldName: 'icpDescription',
    alternatives: ['audience.demographics'],
  },
  {
    key: 'audience.primaryAudience',
    zoneId: 'audience',
    label: 'Primary Audience',
    shortLabel: 'Audience',
    description: 'Primary target audience segment',
    type: 'string',
    requiredFor: ['strategy'],
    priority: 2,
    reason: 'Strategy must target a defined audience',
    domain: 'audience',
    fieldName: 'primaryAudience',
    alternatives: ['audience.coreSegments'],
  },

  // ============================================================================
  // Business Reality Zone - Who we are
  // ============================================================================
  {
    key: 'identity.businessModel',
    zoneId: 'business-reality',
    label: 'Business Model',
    shortLabel: 'Model',
    description: 'Primary business model (B2B, B2C, SaaS, eCommerce, etc.)',
    type: 'string',
    requiredFor: ['strategy'],
    priority: 3,
    reason: 'Strategy must understand how the business makes money',
    domain: 'identity',
    fieldName: 'businessModel',
  },
  // ============================================================================
  // Brand Zone - REMOVED: Positioning is a strategic conclusion, not raw context
  // It lives in the Strategic Frame, not Context Map
  // ============================================================================

  // ============================================================================
  // Offer Zone - What we sell (value prop + products)
  // ============================================================================
  {
    key: 'productOffer.valueProposition',
    zoneId: 'offer',
    label: 'Value Proposition',
    shortLabel: 'Value Prop',
    description: 'Why customers choose you over alternatives',
    type: 'string',
    requiredFor: ['strategy'],
    priority: 5,
    reason: 'Strategy must articulate why customers choose you',
    domain: 'productOffer',
    fieldName: 'valueProposition',
  },
  {
    key: 'productOffer.primaryProducts',
    zoneId: 'offer',
    label: 'Primary Products/Services',
    shortLabel: 'Products',
    description: 'Main products or services offered',
    type: 'string[]',
    requiredFor: ['strategy', 'websiteProgram'],
    priority: 6,
    reason: 'Strategy needs to know what is being sold',
    domain: 'productOffer',
    fieldName: 'primaryProducts',
    alternatives: ['productOffer.heroProducts', 'productOffer.productLines'],
  },

  // ============================================================================
  // Go-to-Market Zone - How we sell
  // ============================================================================
  {
    key: 'productOffer.primaryConversionAction',
    zoneId: 'go-to-market',
    label: 'Primary Conversion Action',
    shortLabel: 'Conversion',
    description: 'Main action you want users to take (buy, signup, contact)',
    type: 'string',
    requiredFor: ['demandProgram'],
    priority: 7,
    reason: 'Demand strategy needs to optimize for a specific action',
    domain: 'productOffer',
    fieldName: 'primaryConversionAction',
  },

  // ============================================================================
  // NOTE: Objectives Zone REMOVED per canonicalization doctrine
  // Objectives belong in Strategy, not Context
  // ============================================================================

  // ============================================================================
  // Constraints Zone - REMOVED: Budget is optional context, finalized in Strategy Frame
  // Min/Max budget are not required for strategy generation
  // ============================================================================

  // ============================================================================
  // Competitive Zone - Who we compete with (INFORMATIONAL ONLY - not required)
  // Competitors are helpful context but don't block strategy generation
  // ============================================================================
];

// ============================================================================
// Lookup Maps (pre-computed for performance)
// ============================================================================

/** Map of key to RequiredContextKey */
export const REQUIRED_KEYS_BY_KEY = new Map<string, RequiredContextKey>(
  REQUIRED_CONTEXT_KEYS.map(entry => [entry.key, entry])
);

/** Map of zoneId to RequiredContextKey[] */
export const REQUIRED_KEYS_BY_ZONE = REQUIRED_CONTEXT_KEYS.reduce((acc, key) => {
  if (!acc.has(key.zoneId)) {
    acc.set(key.zoneId, []);
  }
  acc.get(key.zoneId)!.push(key);
  return acc;
}, new Map<ZoneId, RequiredContextKey[]>());

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get a required key by its canonical key
 */
export function getRequiredKey(key: string): RequiredContextKey | undefined {
  return REQUIRED_KEYS_BY_KEY.get(key);
}

/**
 * Get all required keys for a specific zone
 */
export function getRequiredKeysForZone(zoneId: ZoneId): RequiredContextKey[] {
  return REQUIRED_KEYS_BY_ZONE.get(zoneId) || [];
}

/**
 * Get all required keys sorted by priority
 */
export function getRequiredKeysByPriority(): RequiredContextKey[] {
  return [...REQUIRED_CONTEXT_KEYS].sort((a, b) => a.priority - b.priority);
}

/**
 * Get required keys for a specific feature
 */
export function getRequiredKeysForFeature(
  feature: 'strategy' | 'websiteProgram' | 'demandProgram'
): RequiredContextKey[] {
  return REQUIRED_CONTEXT_KEYS.filter(key => key.requiredFor.includes(feature));
}

/**
 * Check if a key is a required key (or an alternative to one)
 */
export function isRequiredKey(key: string): boolean {
  if (REQUIRED_KEYS_BY_KEY.has(key)) return true;

  // Check if this key is an alternative for any required key
  for (const required of REQUIRED_CONTEXT_KEYS) {
    if (required.alternatives?.includes(key)) return true;
  }

  return false;
}

/**
 * Get the canonical required key for a given key (handles alternatives)
 */
export function getCanonicalRequiredKey(key: string): RequiredContextKey | undefined {
  // Direct lookup
  const direct = REQUIRED_KEYS_BY_KEY.get(key);
  if (direct) return direct;

  // Check alternatives
  for (const required of REQUIRED_CONTEXT_KEYS) {
    if (required.alternatives?.includes(key)) return required;
  }

  return undefined;
}

/**
 * Get all keys (primary + alternatives) for a required key
 */
export function getAllKeysForRequirement(key: string): string[] {
  const required = getRequiredKey(key);
  if (!required) return [key];

  const keys = [required.key];
  if (required.alternatives) {
    keys.push(...required.alternatives);
  }
  return keys;
}
