// lib/os/strategy/strategyContextBindings.ts
// Strategy ↔ Context Binding Map
//
// SINGLE SOURCE OF TRUTH: Strategy Inputs are a VIEW + EDITOR of ContextNodes.
// This file defines the binding between Strategy Input fields and Context Graph keys.
//
// DOCTRINE (see docs/context/reuse-affirmation.md):
// 1. Context = durable, factual truth about the business (NOT goals, scores, evaluations)
// 2. Context Graph (ContextNodes in Airtable) is CANONICAL
// 3. Strategy "Inputs" are just a view + editor of specific Context fields
// 4. AI proposes only (creates proposed nodes), humans confirm
// 5. Confirmed context is protected from AI overwrite
//
// EXPLICITLY NOT IN CONTEXT (stored in Strategy instead):
// - Objectives/Goals (Primary Objective, Secondary Objectives, Target CPA/ROAS)
// - Position Summary (synthesized conclusion)
// - Competitive Advantages (synthesized conclusion)
// - Whitespace Opportunities (synthesized conclusion)
// - Any scores, ratings, or evaluations
//
// Usage:
// - Strategy page uses these bindings to:
//   a. READ values from Context Graph
//   b. WRITE user edits as confirmed Context values
//   c. Request AI proposals for missing values
// - Readiness/completeness is computed from bindings + confirmed/proposed status

import type { StrategySection } from '@/lib/contextGraph/unifiedRegistry';
import {
  isCanonicalField,
  isRemovedField,
  REMOVED_FIELDS,
} from '@/lib/contextGraph/unifiedRegistry';

// ============================================================================
// Types
// ============================================================================

/**
 * Value type for binding fields
 */
export type BindingValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'object'
  | 'competitors';

/**
 * Strategy Context Binding
 * Links a Strategy Input field to a Context Graph key
 */
export interface StrategyContextBinding {
  /** Strategy Input identifier (e.g., 'businessReality.primaryOffering') */
  strategyInputId: string;

  /** Canonical key in Context Graph (e.g., 'productOffer.primaryProducts') */
  contextKey: string;

  /** Zone for deep link navigation */
  zone: string;

  /** Is this field required for strategy generation? */
  required: boolean;

  /** Data type */
  type: BindingValueType;

  /** Human-readable label */
  label: string;

  /** Short label for compact displays */
  shortLabel?: string;

  /** Strategy section this belongs to */
  section: StrategySection;

  /** Strategy field name within the section */
  strategyField: string;

  /** CTA label when field is empty */
  emptyStateCTA: string;

  /** Route to open Context with focus on this field */
  getRoute: (companyId: string) => string;

  /** AI can propose values for this field */
  aiProposable: boolean;

  /** Prompt hint for AI when generating proposals */
  aiPromptHint?: string;

  /** Weight for readiness calculation (0-1, higher = more important) */
  readinessWeight: number;
}

// ============================================================================
// Binding Definitions
// ============================================================================

/**
 * Complete binding map for Strategy ↔ Context
 *
 * Structure mirrors the Strategy Inputs sections:
 * - businessReality: Core identity, audience, offering
 * - constraints: Budget, compliance, restrictions
 * - competition: Competitive landscape
 * - executionCapabilities: Hive Brain services (special case)
 */
export const STRATEGY_CONTEXT_BINDINGS: StrategyContextBinding[] = [
  // ============================================================================
  // Business Reality Section
  // ============================================================================
  {
    strategyInputId: 'businessReality.businessModel',
    contextKey: 'identity.businessModel',
    zone: 'business-reality',
    required: true,
    type: 'string',
    label: 'Business Model',
    shortLabel: 'Model',
    section: 'businessReality',
    strategyField: 'businessModel',
    emptyStateCTA: 'Define your business model',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=identity.businessModel&zone=business-reality`,
    aiProposable: true,
    aiPromptHint: 'Infer the business model from company description (B2B, B2C, SaaS, etc.)',
    readinessWeight: 1.0,
  },
  {
    strategyInputId: 'businessReality.stage',
    contextKey: 'identity.marketMaturity',
    zone: 'business-reality',
    required: false,
    type: 'string',
    label: 'Market Maturity',
    shortLabel: 'Stage',
    section: 'businessReality',
    strategyField: 'stage',
    emptyStateCTA: 'Set company stage',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=identity.marketMaturity&zone=business-reality`,
    aiProposable: true,
    aiPromptHint: 'Determine growth stage: Startup, Growth, Mature, or Declining',
    readinessWeight: 0.3,
  },
  {
    strategyInputId: 'businessReality.primaryOffering',
    contextKey: 'productOffer.primaryProducts',
    zone: 'business-reality',
    required: true,
    type: 'string[]',
    label: 'Primary Products/Services',
    shortLabel: 'Offering',
    section: 'businessReality',
    strategyField: 'primaryOffering',
    emptyStateCTA: 'Define your primary offering',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=productOffer.primaryProducts&zone=business-reality`,
    aiProposable: true,
    aiPromptHint: 'List the primary products or services offered',
    readinessWeight: 1.0,
  },
  {
    strategyInputId: 'businessReality.primaryAudience',
    contextKey: 'audience.primaryAudience',
    zone: 'audience',
    required: true,
    type: 'string',
    label: 'Primary Audience',
    shortLabel: 'Audience',
    section: 'businessReality',
    strategyField: 'primaryAudience',
    emptyStateCTA: 'Define your target audience',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=audience.primaryAudience&zone=audience`,
    aiProposable: true,
    aiPromptHint: 'Describe the primary target audience or customer segment',
    readinessWeight: 1.0,
  },
  {
    strategyInputId: 'businessReality.icpDescription',
    contextKey: 'audience.icpDescription',
    zone: 'audience',
    required: false,
    type: 'string',
    label: 'ICP Description',
    shortLabel: 'ICP',
    section: 'businessReality',
    strategyField: 'icpDescription',
    emptyStateCTA: 'Describe your ideal customer profile',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=audience.icpDescription&zone=audience`,
    aiProposable: true,
    aiPromptHint: 'Describe the ideal customer profile in detail',
    readinessWeight: 0.7,
  },
  {
    strategyInputId: 'businessReality.valueProposition',
    contextKey: 'brand.positioning',
    zone: 'business-reality',
    required: true,
    type: 'string',
    label: 'Value Proposition',
    shortLabel: 'Value Prop',
    section: 'businessReality',
    strategyField: 'valueProposition',
    emptyStateCTA: 'Define your value proposition',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=brand.positioning&zone=business-reality`,
    aiProposable: true,
    aiPromptHint: 'Define the unique market position and core value proposition',
    readinessWeight: 0.9,
  },
  // NOTE: Goals/Objectives are stored in STRATEGY, not Context
  // Per doctrine: "Objectives (entire zone) → These belong exclusively in Strategy"
  {
    strategyInputId: 'businessReality.industry',
    contextKey: 'identity.industry',
    zone: 'business-reality',
    required: false,
    type: 'string',
    label: 'Industry',
    shortLabel: 'Industry',
    section: 'businessReality',
    strategyField: 'industry',
    emptyStateCTA: 'Specify your industry',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=identity.industry&zone=business-reality`,
    aiProposable: true,
    readinessWeight: 0.5,
  },
  {
    strategyInputId: 'businessReality.geographicFootprint',
    contextKey: 'identity.geographicFootprint',
    zone: 'business-reality',
    required: false,
    type: 'string',
    label: 'Geographic Footprint',
    shortLabel: 'Geography',
    section: 'businessReality',
    strategyField: 'geographicFootprint',
    emptyStateCTA: 'Define your service area',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=identity.geographicFootprint&zone=business-reality`,
    aiProposable: true,
    readinessWeight: 0.4,
  },

  // ============================================================================
  // Constraints Section
  // ============================================================================
  {
    strategyInputId: 'constraints.minBudget',
    contextKey: 'operationalConstraints.minBudget',
    zone: 'constraints',
    required: false,
    type: 'number',
    label: 'Minimum Budget',
    shortLabel: 'Min Budget',
    section: 'constraints',
    strategyField: 'minBudget',
    emptyStateCTA: 'Set minimum budget',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=operationalConstraints.minBudget&zone=constraints`,
    aiProposable: false,
    readinessWeight: 0.3,
  },
  {
    strategyInputId: 'constraints.maxBudget',
    contextKey: 'operationalConstraints.maxBudget',
    zone: 'constraints',
    required: false,
    type: 'number',
    label: 'Maximum Budget',
    shortLabel: 'Max Budget',
    section: 'constraints',
    strategyField: 'maxBudget',
    emptyStateCTA: 'Set maximum budget',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=operationalConstraints.maxBudget&zone=constraints`,
    aiProposable: false,
    readinessWeight: 0.3,
  },
  {
    strategyInputId: 'constraints.complianceRequirements',
    contextKey: 'operationalConstraints.complianceRequirements',
    zone: 'constraints',
    required: false,
    type: 'string[]',
    label: 'Compliance Requirements',
    shortLabel: 'Compliance',
    section: 'constraints',
    strategyField: 'complianceRequirements',
    emptyStateCTA: 'Add compliance requirements',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=operationalConstraints.complianceRequirements&zone=constraints`,
    aiProposable: false,
    readinessWeight: 0.2,
  },
  {
    strategyInputId: 'constraints.legalRestrictions',
    contextKey: 'operationalConstraints.legalRestrictions',
    zone: 'constraints',
    required: false,
    type: 'string',
    label: 'Legal Restrictions',
    shortLabel: 'Legal',
    section: 'constraints',
    strategyField: 'legalRestrictions',
    emptyStateCTA: 'Add legal restrictions',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=operationalConstraints.legalRestrictions&zone=constraints`,
    aiProposable: false,
    readinessWeight: 0.2,
  },
  {
    strategyInputId: 'constraints.launchDeadlines',
    contextKey: 'operationalConstraints.launchDeadlines',
    zone: 'constraints',
    required: false,
    type: 'string[]',
    label: 'Launch Deadlines',
    shortLabel: 'Deadlines',
    section: 'constraints',
    strategyField: 'launchDeadlines',
    emptyStateCTA: 'Set launch deadlines',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=operationalConstraints.launchDeadlines&zone=constraints`,
    aiProposable: false,
    readinessWeight: 0.2,
  },

  // ============================================================================
  // Competition Section
  // ============================================================================
  {
    strategyInputId: 'competition.competitors',
    contextKey: 'competitive.competitors',
    zone: 'competition',
    required: false,
    type: 'competitors',
    label: 'Competitors',
    shortLabel: 'Competitors',
    section: 'competition',
    strategyField: 'competitors',
    emptyStateCTA: 'Run competition analysis',
    getRoute: (companyId) => `/c/${companyId}/context?focusKey=competitive.competitors&zone=competition`,
    aiProposable: false, // Competition comes from Competition Lab
    readinessWeight: 0.5,
  },
  // NOTE: Position Summary and Competitive Advantages are synthesized conclusions
  // Per doctrine: These belong in Strategy/Labs outputs, not canonical Context
];

// ============================================================================
// Lookup Maps (for performance)
// ============================================================================

/** Lookup by strategyInputId */
export const BINDINGS_BY_STRATEGY_ID = new Map<string, StrategyContextBinding>(
  STRATEGY_CONTEXT_BINDINGS.map(b => [b.strategyInputId, b])
);

/** Lookup by contextKey */
export const BINDINGS_BY_CONTEXT_KEY = new Map<string, StrategyContextBinding>(
  STRATEGY_CONTEXT_BINDINGS.map(b => [b.contextKey, b])
);

/** Bindings grouped by section */
export const BINDINGS_BY_SECTION = new Map<StrategySection, StrategyContextBinding[]>();
for (const binding of STRATEGY_CONTEXT_BINDINGS) {
  if (!binding.section) continue;
  const list = BINDINGS_BY_SECTION.get(binding.section) || [];
  list.push(binding);
  BINDINGS_BY_SECTION.set(binding.section, list);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get binding by strategy input ID
 */
export function getBindingByStrategyId(strategyInputId: string): StrategyContextBinding | undefined {
  return BINDINGS_BY_STRATEGY_ID.get(strategyInputId);
}

/**
 * Get binding by context key
 */
export function getBindingByContextKey(contextKey: string): StrategyContextBinding | undefined {
  return BINDINGS_BY_CONTEXT_KEY.get(contextKey);
}

/**
 * Get all bindings for a section
 */
export function getBindingsForSection(section: StrategySection): StrategyContextBinding[] {
  return BINDINGS_BY_SECTION.get(section) || [];
}

/**
 * Get all required bindings
 */
export function getRequiredBindings(): StrategyContextBinding[] {
  return STRATEGY_CONTEXT_BINDINGS.filter(b => b.required);
}

/**
 * Get all AI-proposable bindings
 */
export function getAIProposableBindings(): StrategyContextBinding[] {
  return STRATEGY_CONTEXT_BINDINGS.filter(b => b.aiProposable);
}

/**
 * Get all context keys from bindings
 */
export function getAllContextKeys(): string[] {
  return STRATEGY_CONTEXT_BINDINGS.map(b => b.contextKey);
}

/**
 * Get all required context keys
 */
export function getRequiredContextKeys(): string[] {
  return getRequiredBindings().map(b => b.contextKey);
}

// ============================================================================
// Readiness Computation
// ============================================================================

/**
 * Resolved binding value with status
 */
export interface ResolvedBinding {
  binding: StrategyContextBinding;
  value: unknown;
  status: 'confirmed' | 'proposed' | 'missing';
  source: string | null;
  confidence: number | null;
  updatedAt: string | null;
}

/**
 * Strategy readiness result computed from bindings
 */
export interface BindingReadinessResult {
  /** Overall readiness percentage (0-100) */
  readinessPercent: number;

  /** Count of required fields that are confirmed */
  confirmedRequiredCount: number;

  /** Count of required fields that are proposed but not confirmed */
  proposedRequiredCount: number;

  /** Count of required fields that are missing */
  missingRequiredCount: number;

  /** Total required fields */
  totalRequiredCount: number;

  /** Resolved bindings with values */
  resolvedBindings: ResolvedBinding[];

  /** Missing required bindings (for CTA) */
  missingRequired: StrategyContextBinding[];

  /** Can synthesize strategy (< 2 missing required) */
  canSynthesize: boolean;

  /** Block reason if canSynthesize is false */
  synthesizeBlockReason: string | null;
}

/**
 * Check if a value is considered "present"
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Compute readiness from resolved bindings
 *
 * @param resolvedBindings - Array of resolved binding values
 * @returns Readiness result
 */
export function computeBindingReadiness(
  resolvedBindings: ResolvedBinding[]
): BindingReadinessResult {
  const requiredBindings = resolvedBindings.filter(r => r.binding.required);

  let confirmedWeight = 0;
  let totalWeight = 0;
  const missingRequired: StrategyContextBinding[] = [];

  for (const resolved of requiredBindings) {
    totalWeight += resolved.binding.readinessWeight;

    if (resolved.status === 'confirmed' && hasValue(resolved.value)) {
      confirmedWeight += resolved.binding.readinessWeight;
    } else if (resolved.status === 'proposed' && hasValue(resolved.value)) {
      // Proposed values contribute partially (50% weight)
      confirmedWeight += resolved.binding.readinessWeight * 0.5;
    } else {
      missingRequired.push(resolved.binding);
    }
  }

  const readinessPercent = totalWeight > 0
    ? Math.round((confirmedWeight / totalWeight) * 100)
    : 0;

  const confirmedRequiredCount = requiredBindings.filter(
    r => r.status === 'confirmed' && hasValue(r.value)
  ).length;

  const proposedRequiredCount = requiredBindings.filter(
    r => r.status === 'proposed' && hasValue(r.value)
  ).length;

  const missingRequiredCount = missingRequired.length;

  // Soft gate: block Synthesize if 2+ critical inputs missing
  const canSynthesize = missingRequiredCount < 2;
  const synthesizeBlockReason = missingRequiredCount >= 2
    ? `${missingRequiredCount} required inputs missing: ${missingRequired.map(b => b.shortLabel || b.label).join(', ')}`
    : null;

  return {
    readinessPercent,
    confirmedRequiredCount,
    proposedRequiredCount,
    missingRequiredCount,
    totalRequiredCount: requiredBindings.length,
    resolvedBindings,
    missingRequired,
    canSynthesize,
    synthesizeBlockReason,
  };
}

/**
 * Get the recommended next field to complete
 *
 * Priority:
 * 1. Required fields that are missing (by readiness weight)
 * 2. Required fields that are proposed but not confirmed
 * 3. Optional fields that are missing (by readiness weight)
 */
export function getRecommendedNextBinding(
  resolvedBindings: ResolvedBinding[]
): StrategyContextBinding | null {
  // Sort by: required first, then by readiness weight (descending)
  const sorted = [...resolvedBindings].sort((a, b) => {
    // Required first
    if (a.binding.required !== b.binding.required) {
      return a.binding.required ? -1 : 1;
    }
    // Higher weight first
    return b.binding.readinessWeight - a.binding.readinessWeight;
  });

  // Find first missing required
  for (const resolved of sorted) {
    if (resolved.binding.required && resolved.status === 'missing') {
      return resolved.binding;
    }
  }

  // Find first proposed required (needs confirmation)
  for (const resolved of sorted) {
    if (resolved.binding.required && resolved.status === 'proposed') {
      return resolved.binding;
    }
  }

  // Find first missing optional
  for (const resolved of sorted) {
    if (!resolved.binding.required && resolved.status === 'missing') {
      return resolved.binding;
    }
  }

  return null;
}

// ============================================================================
// Validation (Development Only)
// ============================================================================

/**
 * Validate that all binding contextKeys exist in the canonical registry
 * Runs at module load time in development to catch mismatches early
 */
export function validateBindingsAgainstRegistry(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const binding of STRATEGY_CONTEXT_BINDINGS) {
    const { contextKey, strategyInputId } = binding;

    // Check if it references a removed field (error)
    if (isRemovedField(contextKey)) {
      errors.push(
        `Binding "${strategyInputId}" references removed field "${contextKey}". ` +
        `This field was removed per canonicalization doctrine.`
      );
      continue;
    }

    // Check if it's a canonical field (warning if not found)
    if (!isCanonicalField(contextKey)) {
      warnings.push(
        `Binding "${strategyInputId}" references unknown field "${contextKey}". ` +
        `Consider adding it to the unified registry.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Run validation in development
if (process.env.NODE_ENV === 'development') {
  const validation = validateBindingsAgainstRegistry();

  if (validation.errors.length > 0) {
    console.error('[strategyContextBindings] VALIDATION ERRORS:');
    validation.errors.forEach(e => console.error(`  ❌ ${e}`));
  }

  if (validation.warnings.length > 0) {
    console.warn('[strategyContextBindings] Validation warnings:');
    validation.warnings.forEach(w => console.warn(`  ⚠️ ${w}`));
  }

  if (validation.valid && validation.warnings.length === 0) {
    console.info('[strategyContextBindings] ✅ All bindings validated against canonical registry');
  }
}
