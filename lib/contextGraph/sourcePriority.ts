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
  | 'competition_lab' // Competition Lab V3 - competitive intelligence (legacy)
  | 'competition_v4' // Competition V4 - preferred over V3
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
  reason: 'human_override' | 'higher_priority' | 'same_priority_newer' | 'lower_priority' | 'blocked_source' | 'low_confidence' | 'human_confirmed';
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

  // Competitive domain - Competition V4 is authoritative, V3 is fallback
  // IMPORTANT: V4 and V3 are mutually exclusive - never mix results
  competitive: {
    priority: [
      'competition_v4', // Competition V4 - PREFERRED for competitive data
      'competition_lab', // Competition Lab V3 - fallback if no V4 run exists
      'gap_heavy',
      'gap_full',
      'gap_ia',
      'brand_lab',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Social & Local domain - GAP-IA is authoritative for social discovery
  social: {
    priority: [
      'gap_ia',
      'gap_heavy',
      'gap_full',
      'fcb',
      'brain',
      'inferred',
    ],
  },

  // Capabilities domain - Human-only (Hive Brain admin)
  capabilities: {
    priority: [
      'brain',
      'manual',
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
  competition_lab: 'Competition Lab V3',
  competition_v4: 'Competition V4',
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

// ============================================================================
// Confidence-Aware Upgrade Rules
// ============================================================================

/**
 * GAP Plan sources that can be upgraded by higher-confidence sources
 */
export const GAP_PLAN_SOURCES: Set<string> = new Set([
  'gap_full',
  'gap_ia',
]);

/**
 * Standard confidence levels by source type
 */
export const SOURCE_CONFIDENCE_LEVELS: Record<string, number> = {
  // Human sources - highest
  user: 1.0,
  manual: 1.0,
  qbr: 0.95,
  strategy: 0.95,

  // Lab sources - high
  brand_lab: 0.85,
  audience_lab: 0.85,
  media_lab: 0.85,
  website_lab: 0.85,
  seo_lab: 0.85,
  content_lab: 0.85,
  demand_lab: 0.85,
  ops_lab: 0.85,
  competition_v4: 0.85,
  competition_lab: 0.85,

  // GAP sources - varies
  gap_heavy: 0.8,
  gap_full: 0.6, // GAP Plan secondary source
  gap_ia: 0.7,

  // Inference sources - lowest
  fcb: 0.65,
  brain: 0.5,
  inferred: 0.4,
};

/**
 * Check if a field can be upgraded from GAP Plan to a higher-confidence source
 *
 * Rules:
 * 1. GAP Plan can NEVER overwrite GAP Plan (no self-upgrade)
 * 2. Human sources can NEVER be overwritten
 * 3. Labs (confidence >= 0.85) CAN upgrade GAP Plan fields (confidence <= 0.6)
 * 4. GAP Plan can only fill EMPTY fields
 *
 * @param existingProvenance - Current field provenance
 * @param newSource - Source attempting to write
 * @param newConfidence - Confidence of new source (defaults to SOURCE_CONFIDENCE_LEVELS)
 * @returns Whether the upgrade is allowed
 */
export function canUpgradeFromGapPlan(
  existingProvenance: ProvenanceTag[],
  newSource: string,
  newConfidence?: number
): { canUpgrade: boolean; reason: string } {
  // No existing provenance = allow write (not an upgrade scenario)
  if (existingProvenance.length === 0) {
    return { canUpgrade: true, reason: 'empty_field' };
  }

  const existingSource = existingProvenance[0]?.source;
  const existingConfidence = existingProvenance[0]?.confidence ?? 0.5;

  // Rule 1: Human sources can NEVER be overwritten
  if (isHumanSource(existingSource)) {
    return { canUpgrade: false, reason: 'human_confirmed' };
  }

  // Rule 2: GAP Plan cannot overwrite itself (no self-upgrade)
  if (GAP_PLAN_SOURCES.has(existingSource) && GAP_PLAN_SOURCES.has(newSource)) {
    return { canUpgrade: false, reason: 'gap_plan_no_self_overwrite' };
  }

  // Rule 3: Higher-confidence Labs can upgrade GAP Plan fields
  if (GAP_PLAN_SOURCES.has(existingSource)) {
    const effectiveNewConfidence = newConfidence ?? SOURCE_CONFIDENCE_LEVELS[newSource] ?? 0.5;
    const gapPlanThreshold = 0.6;

    // Lab must have higher confidence than GAP Plan threshold
    if (effectiveNewConfidence > gapPlanThreshold && existingConfidence <= gapPlanThreshold) {
      return {
        canUpgrade: true,
        reason: `lab_upgrade_gap_plan (${existingConfidence} → ${effectiveNewConfidence})`,
      };
    }

    return {
      canUpgrade: false,
      reason: `confidence_not_higher (${existingConfidence} vs ${effectiveNewConfidence})`,
    };
  }

  // Rule 4: Non-GAP-Plan fields follow standard priority rules
  return { canUpgrade: false, reason: 'use_standard_priority' };
}

/**
 * Check if a source is a GAP Plan source
 */
export function isGapPlanSource(source: string): boolean {
  return GAP_PLAN_SOURCES.has(source);
}
