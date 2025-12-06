// lib/contextGraph/sourcePriority.ts
// Source Priority Configuration for Context Graph
//
// This module defines per-domain source priority rules that determine
// which source "wins" when multiple sources provide values for the same field.
// Human overrides are ALWAYS top priority and cannot be stomped by automation.

import type { ProvenanceTag } from './types';
import type { DomainName } from './companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Source identifier used in provenance tracking
 */
export type SourceId =
  | 'user'           // Direct user edit via UI - HIGHEST PRIORITY
  | 'manual'         // Manual import/entry
  | 'qbr'            // QBR strategic plan edits
  | 'strategy'       // Strategy editor
  | 'brand_lab'      // Brand Lab diagnostic
  | 'audience_lab'   // Audience Lab diagnostic
  | 'media_lab'      // Media Lab diagnostic
  | 'website_lab'    // Website Lab diagnostic
  | 'ux_lab'         // UX Lab diagnostic
  | 'seo_lab'        // SEO Lab diagnostic
  | 'content_lab'    // Content Lab diagnostic
  | 'demand_lab'     // Demand Lab diagnostic
  | 'ops_lab'        // Ops Lab diagnostic
  | 'gap_heavy'      // GAP Heavy diagnostic
  | 'gap_full'       // GAP Full diagnostic
  | 'gap_ia'         // GAP IA diagnostic
  | 'fcb'            // Foundational Context Builder - auto-populates from website
  | 'brain'          // AI Brain inference
  | 'inferred'       // Generic inference
  | 'airtable'       // Legacy Airtable import
  | 'import'         // Generic import
  | 'setup_wizard'   // Setup wizard
  | 'analytics_ga4'  // GA4 analytics
  | 'analytics_gsc'  // Google Search Console
  | 'analytics_gads' // Google Ads
  | 'media_profile'  // Media profile
  | 'media_cockpit'  // Media Cockpit
  | 'media_memory'   // Media Memory
  | 'external_enrichment'; // External data enrichment

/**
 * Priority configuration for a domain
 */
export interface DomainPriorityConfig {
  /** Ordered list of sources from highest to lowest priority (after human overrides) */
  priority: SourceId[];
  /** Optional: sources that can never overwrite this domain */
  blockedSources?: SourceId[];
  /** Optional: minimum confidence required for a source to write */
  minConfidenceForOverwrite?: number;
}

/**
 * Result of a priority check
 */
export interface PriorityCheckResult {
  /** Whether the new source can overwrite the existing value */
  canOverwrite: boolean;
  /** Reason for the decision */
  reason: 'human_override' | 'higher_priority' | 'same_priority_newer' | 'lower_priority' | 'blocked_source' | 'low_confidence';
  /** Score difference (positive = new wins, negative = existing wins) */
  scoreDelta: number;
}

// ============================================================================
// Human Override Detection
// ============================================================================

/**
 * Sources that represent human input and should NEVER be overwritten by automation
 */
export const HUMAN_SOURCES: Set<SourceId> = new Set([
  'user',
  'manual',
  'qbr',
  'strategy',
]);

/**
 * Check if a source represents human input
 */
export function isHumanSource(source: string): boolean {
  return HUMAN_SOURCES.has(source as SourceId);
}

/**
 * Check if a field has been edited by a human
 * Returns true if any provenance entry is from a human source
 */
export function hasHumanOverride(provenance: ProvenanceTag[]): boolean {
  return provenance.some(p => isHumanSource(p.source));
}

/**
 * Get the human override provenance if present
 */
export function getHumanOverride(provenance: ProvenanceTag[]): ProvenanceTag | null {
  return provenance.find(p => isHumanSource(p.source)) ?? null;
}

// ============================================================================
// Per-Domain Priority Configuration
// ============================================================================

/**
 * Domain-specific source priority rules
 * Human sources (user, manual, qbr, strategy) always win - this config
 * determines priority among automated/diagnostic sources.
 */
export const DOMAIN_PRIORITY_CONFIG: Record<DomainName, DomainPriorityConfig> = {
  // Identity domain - GAP is most authoritative, then setup wizard, then FCB
  identity: {
    priority: [
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'setup_wizard',
      'fcb',
      'airtable',
      'brain',
      'inferred',
    ],
  },

  // Brand domain - Brand Lab is authoritative, FCB provides initial foundation
  brand: {
    priority: [
      'brand_lab',
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Audience domain - Audience Lab is authoritative, FCB provides initial foundation
  audience: {
    priority: [
      'audience_lab',
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Website domain - Website Lab / UX Lab are authoritative, FCB provides initial foundation
  website: {
    priority: [
      'website_lab',
      'ux_lab',
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Content domain - GAP and Content Lab, FCB provides initial foundation
  content: {
    priority: [
      'gap_heavy',
      'content_lab',
      'seo_lab',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // SEO domain - SEO Lab is authoritative
  seo: {
    priority: [
      'seo_lab',
      'gap_heavy',
      'content_lab',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Performance Media domain - Media Lab is authoritative
  performanceMedia: {
    priority: [
      'media_lab',
      'media_cockpit',
      'media_memory',
      'demand_lab',
      'gap_heavy',
      'gap_full',
      'analytics_gads',
      'brain',
      'inferred',
    ],
  },

  // Budget/Ops domain - Media systems are authoritative
  budgetOps: {
    priority: [
      'media_lab',
      'media_cockpit',
      'ops_lab',
      'media_memory',
      'airtable',
      'brain',
      'inferred',
    ],
  },

  // Objectives domain - GAP is authoritative, FCB provides initial foundation
  objectives: {
    priority: [
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'setup_wizard',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Product/Offer domain - GAP is authoritative, FCB provides initial foundation
  productOffer: {
    priority: [
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Operational constraints - Ops Lab is authoritative
  operationalConstraints: {
    priority: [
      'ops_lab',
      'gap_heavy',
      'airtable',
      'brain',
      'inferred',
    ],
  },

  // Store risk - Ops Lab is authoritative
  storeRisk: {
    priority: [
      'ops_lab',
      'gap_heavy',
      'airtable',
      'brain',
      'inferred',
    ],
  },

  // Historical domain - Media systems and analytics are authoritative
  historical: {
    priority: [
      'media_lab',
      'media_cockpit',
      'media_memory',
      'analytics_ga4',
      'analytics_gads',
      'gap_heavy',
      'brain',
      'inferred',
    ],
  },

  // History refs - Lab runs are authoritative (tracking latest run IDs)
  historyRefs: {
    priority: [
      'website_lab',
      'brand_lab',
      'audience_lab',
      'media_lab',
      'gap_heavy',
      'gap_full',
      'gap_ia',
    ],
  },

  // Digital Infrastructure - Website Lab is authoritative, FCB provides initial foundation
  digitalInfra: {
    priority: [
      'website_lab',
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Ops domain - Ops Lab is authoritative
  ops: {
    priority: [
      'ops_lab',
      'gap_heavy',
      'airtable',
      'brain',
      'inferred',
    ],
  },

  // Creative domain - Creative Lab is authoritative, FCB provides initial foundation
  creative: {
    priority: [
      'gap_heavy',
      'brand_lab',
      'content_lab',
      'gap_full',
      'gap_ia',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Competitive domain - GAP is authoritative, FCB provides initial foundation
  competitive: {
    priority: [
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'brand_lab',
      'fcb',
      'brain',
      'inferred',
    ],
  },
};

// ============================================================================
// Priority Scoring
// ============================================================================

/**
 * Get the priority score for a source within a domain
 * Higher score = higher priority
 * Human sources always return MAX_SAFE_INTEGER
 */
export function getSourcePriorityForDomain(
  domain: DomainName,
  source: string
): number {
  // Human sources always win
  if (isHumanSource(source)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const config = DOMAIN_PRIORITY_CONFIG[domain];
  if (!config) {
    // Unknown domain, use fallback score
    return 0;
  }

  const index = config.priority.indexOf(source as SourceId);
  if (index === -1) {
    // Source not in priority list, lowest priority
    return 0;
  }

  // Higher index = lower priority, so invert
  // Priority list length gives us max score
  return config.priority.length - index;
}

/**
 * Check if a source is blocked for a domain
 */
export function isSourceBlockedForDomain(
  domain: DomainName,
  source: string
): boolean {
  const config = DOMAIN_PRIORITY_CONFIG[domain];
  if (!config?.blockedSources) {
    return false;
  }
  return config.blockedSources.includes(source as SourceId);
}

// ============================================================================
// Priority Decision Logic
// ============================================================================

/**
 * Determine if a new source can overwrite an existing value
 *
 * Rules:
 * 1. Human overrides can NEVER be stomped by automation
 * 2. Human sources can always overwrite anything
 * 3. Higher priority sources can overwrite lower priority
 * 4. Same priority: newer wins (recency tiebreaker)
 * 5. Blocked sources cannot write at all
 */
export function canSourceOverwrite(
  domain: DomainName,
  existingProvenance: ProvenanceTag[],
  newSource: string,
  newConfidence: number = 0.8
): PriorityCheckResult {
  // Check if new source is blocked
  if (isSourceBlockedForDomain(domain, newSource)) {
    return {
      canOverwrite: false,
      reason: 'blocked_source',
      scoreDelta: -1,
    };
  }

  // No existing provenance = always can write
  if (existingProvenance.length === 0) {
    return {
      canOverwrite: true,
      reason: 'higher_priority',
      scoreDelta: 1,
    };
  }

  const existingSource = existingProvenance[0]?.source ?? 'inferred';
  const existingIsHuman = isHumanSource(existingSource);
  const newIsHuman = isHumanSource(newSource);

  // Rule 1: Human overrides can NEVER be stomped by automation
  if (existingIsHuman && !newIsHuman) {
    return {
      canOverwrite: false,
      reason: 'human_override',
      scoreDelta: -Number.MAX_SAFE_INTEGER,
    };
  }

  // Rule 2: Human sources can always overwrite anything
  if (newIsHuman) {
    return {
      canOverwrite: true,
      reason: 'human_override',
      scoreDelta: Number.MAX_SAFE_INTEGER,
    };
  }

  // Check confidence threshold
  const config = DOMAIN_PRIORITY_CONFIG[domain];
  if (config?.minConfidenceForOverwrite && newConfidence < config.minConfidenceForOverwrite) {
    return {
      canOverwrite: false,
      reason: 'low_confidence',
      scoreDelta: -1,
    };
  }

  // Compare priorities
  const existingPriority = getSourcePriorityForDomain(domain, existingSource);
  const newPriority = getSourcePriorityForDomain(domain, newSource);
  const scoreDelta = newPriority - existingPriority;

  // Higher priority wins
  if (newPriority > existingPriority) {
    return {
      canOverwrite: true,
      reason: 'higher_priority',
      scoreDelta,
    };
  }

  // Same priority: newer wins (recency tiebreaker)
  if (newPriority === existingPriority) {
    return {
      canOverwrite: true,
      reason: 'same_priority_newer',
      scoreDelta: 0,
    };
  }

  // Lower priority cannot overwrite
  return {
    canOverwrite: false,
    reason: 'lower_priority',
    scoreDelta,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get human-readable source name
 */
export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  user: 'Manual Edit',
  manual: 'Manual Import',
  qbr: 'Strategic Plan',
  strategy: 'Strategy Editor',
  brand_lab: 'Brand Lab',
  audience_lab: 'Audience Lab',
  media_lab: 'Media Lab',
  website_lab: 'Website Lab',
  ux_lab: 'UX Lab',
  seo_lab: 'SEO Lab',
  content_lab: 'Content Lab',
  demand_lab: 'Demand Lab',
  ops_lab: 'Ops Lab',
  gap_heavy: 'GAP Heavy',
  gap_full: 'GAP Full',
  gap_ia: 'GAP IA',
  fcb: 'Auto-filled from Website',
  brain: 'AI Brain',
  inferred: 'Inferred',
  airtable: 'Airtable Import',
  import: 'Data Import',
  setup_wizard: 'Setup Wizard',
  analytics_ga4: 'GA4 Analytics',
  analytics_gsc: 'Search Console',
  analytics_gads: 'Google Ads',
  media_profile: 'Media Profile',
  media_cockpit: 'Media Cockpit',
  media_memory: 'Media Memory',
  external_enrichment: 'External Enrichment',
};

/**
 * Get display name for a source
 */
export function getSourceDisplayName(source: string): string {
  return SOURCE_DISPLAY_NAMES[source] ?? source;
}

/**
 * Get the authoritative sources for a domain (for UI display)
 */
export function getAuthoritativeSourcesForDomain(domain: DomainName): string[] {
  const config = DOMAIN_PRIORITY_CONFIG[domain];
  if (!config) return [];

  // Return top 3 priority sources
  return config.priority.slice(0, 3).map(getSourceDisplayName);
}

/**
 * Summary of why a field has its current value
 */
export interface FieldSourceSummary {
  currentSource: string;
  currentSourceName: string;
  isHumanOverride: boolean;
  canBeOverwritten: boolean;
  authoritativeSources: string[];
}

/**
 * Get a summary of the source status for a field
 */
export function getFieldSourceSummary(
  domain: DomainName,
  provenance: ProvenanceTag[]
): FieldSourceSummary {
  const currentSource = provenance[0]?.source ?? 'unknown';
  const isHuman = isHumanSource(currentSource);

  return {
    currentSource,
    currentSourceName: getSourceDisplayName(currentSource),
    isHumanOverride: isHuman,
    canBeOverwritten: !isHuman, // Only human overrides are protected
    authoritativeSources: getAuthoritativeSourcesForDomain(domain),
  };
}
