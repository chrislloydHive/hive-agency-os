// lib/os/strategy/strategyHydration.ts
// Strategy Hydration Layer
//
// In-memory hydration that fills missing Strategy fields from Context.
// This is display-only - values are NOT persisted automatically.
//
// Rules:
// - Never overwrite user-defined values
// - Inherited values are marked with source and confidence
// - Extensible pattern for future inheritance (budget, geography, etc.)

import type { CompanyContext } from '@/lib/types/context';
import type { StrategyViewModel, StrategyPillarViewModel } from './strategyViewModel';
import type { StrategyFrame } from '@/lib/types/strategy';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Inherited Field Types
// ============================================================================

/**
 * Source of an inherited field value
 */
export type InheritedSource = 'Context' | 'AudienceLab' | 'User';

/**
 * Confidence level for inherited values
 */
export type InheritedConfidence = 'High' | 'Medium' | 'Low';

/**
 * Metadata for an inherited field value
 */
export interface InheritedFieldMeta {
  /** Where the value came from */
  source: InheritedSource;
  /** Confidence in this inherited value */
  confidence: InheritedConfidence;
  /** Whether this was inherited (vs user-defined) */
  inherited: boolean;
  /** Soft flag - value should be reviewed but isn't blocking */
  needsReview: boolean;
  /** Optional explanation of the source */
  sourceLabel?: string;
}

/**
 * A field value that may be inherited from Context
 */
export interface InheritableField {
  /** The actual value */
  value: string;
  /** Inheritance metadata */
  meta: InheritedFieldMeta;
}

/**
 * Create a user-defined (non-inherited) field
 */
export function createUserField(value: string): InheritableField {
  return {
    value,
    meta: {
      source: 'User',
      confidence: 'High',
      inherited: false,
      needsReview: false,
    },
  };
}

/**
 * Create an inherited field from Context
 */
export function createInheritedField(
  value: string,
  source: InheritedSource,
  sourceLabel?: string
): InheritableField {
  return {
    value,
    meta: {
      source,
      confidence: 'Medium',
      inherited: true,
      needsReview: true,
      sourceLabel,
    },
  };
}

/**
 * Check if a field value is empty/undefined
 */
function isEmpty(value: string | undefined | null): boolean {
  return !value || value.trim() === '' || value === 'Needs definition';
}

// ============================================================================
// Extended Pillar View Model with Inheritable Fields
// ============================================================================

/**
 * Extended pillar view model with inheritable field support
 */
export interface HydratedPillarViewModel extends Omit<StrategyPillarViewModel, 'targetAudience'> {
  /** Target audience with inheritance metadata */
  targetAudience: InheritableField;
}

/**
 * Extended strategy view model with hydrated pillars
 */
export interface HydratedStrategyViewModel extends Omit<StrategyViewModel, 'strategyPillars'> {
  /** Hydrated pillars with inheritance metadata */
  strategyPillars: HydratedPillarViewModel[];
  /** Default audience from Context (for display reference) */
  contextDefaultAudience?: string;
}

// ============================================================================
// Context Audience Extraction
// ============================================================================

/**
 * Priority order for audience source selection:
 * 1. AudienceLab primaryAudience.description (most specific)
 * 2. Context primaryAudience field
 * 3. Context audienceSummary (fallback)
 *
 * Returns null if no audience is available
 */
export interface AudienceFromContext {
  value: string;
  source: InheritedSource;
  sourceLabel: string;
}

/**
 * Get the best available audience from Context (V1 format)
 *
 * Priority:
 * 1. primaryAudience (most specific)
 * 2. icpDescription
 * 3. secondaryAudience (fallback)
 */
export function getDefaultAudienceFromContext(
  context: CompanyContext | null | undefined
): AudienceFromContext | null {
  if (!context) return null;

  // Priority 1: primaryAudience (most common and specific)
  if (!isEmpty(context.primaryAudience)) {
    return {
      value: context.primaryAudience!,
      source: 'Context',
      sourceLabel: 'Primary Audience',
    };
  }

  // Priority 2: ICP description (more detailed)
  if (!isEmpty(context.icpDescription)) {
    return {
      value: context.icpDescription!,
      source: 'Context',
      sourceLabel: 'ICP Description',
    };
  }

  // Priority 3: secondaryAudience (fallback)
  if (!isEmpty(context.secondaryAudience)) {
    return {
      value: context.secondaryAudience!,
      source: 'Context',
      sourceLabel: 'Secondary Audience',
    };
  }

  return null;
}

// ============================================================================
// Strategy Hydration
// ============================================================================

/**
 * Hydrate a strategy view model with inherited values from Context.
 * This is display-only - does NOT persist changes.
 *
 * Rules:
 * - If pillar.targetAudience exists and is non-empty → keep as user-defined
 * - If pillar.targetAudience is empty → inject inherited from Context
 * - If no Context audience available → leave empty (current behavior)
 */
export function hydrateStrategyForDisplay(
  strategy: StrategyViewModel,
  context: CompanyContext | null | undefined
): HydratedStrategyViewModel {
  // Get default audience from Context
  const defaultAudience = getDefaultAudienceFromContext(context);

  // Hydrate each pillar
  const hydratedPillars: HydratedPillarViewModel[] = strategy.strategyPillars.map(pillar => {
    // Convert targetAudience to InheritableField
    let targetAudience: InheritableField;

    if (!isEmpty(pillar.targetAudience)) {
      // User-defined value exists - keep it
      targetAudience = createUserField(pillar.targetAudience);
    } else if (defaultAudience) {
      // Inherit from Context
      targetAudience = createInheritedField(
        defaultAudience.value,
        defaultAudience.source,
        defaultAudience.sourceLabel
      );
    } else {
      // No value available
      targetAudience = {
        value: '',
        meta: {
          source: 'User',
          confidence: 'Low',
          inherited: false,
          needsReview: true,
        },
      };
    }

    return {
      ...pillar,
      targetAudience,
    };
  });

  return {
    ...strategy,
    strategyPillars: hydratedPillars,
    contextDefaultAudience: defaultAudience?.value,
  };
}

// ============================================================================
// Dehydration (for saving)
// ============================================================================

/**
 * Convert hydrated view model back to standard view model for saving.
 * Strips inheritance metadata - only keeps values.
 *
 * Important: If user edited an inherited field, it becomes user-defined.
 * If user cleared a field, it goes back to empty (will re-inherit on next load).
 */
export function dehydrateStrategyForSave(
  hydrated: HydratedStrategyViewModel
): StrategyViewModel {
  const pillars: StrategyPillarViewModel[] = hydrated.strategyPillars.map(pillar => {
    // If the value was edited (inherited but changed), mark as user-defined
    // If inherited and unchanged, save as empty to allow re-inheritance
    let targetAudienceValue: string;

    if (pillar.targetAudience.meta.inherited) {
      // Inherited value - save as empty so it re-inherits on next load
      // UNLESS user explicitly edited it (which would have set inherited=false)
      targetAudienceValue = '';
    } else {
      // User-defined value - save as-is
      targetAudienceValue = pillar.targetAudience.value;
    }

    return {
      id: pillar.id,
      pillarName: pillar.pillarName,
      decision: pillar.decision,
      targetAudience: targetAudienceValue,
      competitiveRationale: pillar.competitiveRationale,
      explicitTradeoff: pillar.explicitTradeoff,
      priority: pillar.priority,
      order: pillar.order,
      needsReview: pillar.needsReview,
      services: pillar.services,
      kpis: pillar.kpis,
    };
  });

  // Remove hydration-specific fields
  const { contextDefaultAudience, ...rest } = hydrated;

  return {
    ...rest,
    strategyPillars: pillars,
  };
}

/**
 * Mark a field as user-confirmed (removes inherited flag)
 */
export function confirmInheritedField(field: InheritableField, newValue?: string): InheritableField {
  return {
    value: newValue ?? field.value,
    meta: {
      source: 'User',
      confidence: 'High',
      inherited: false,
      needsReview: false,
    },
  };
}

// ============================================================================
// Strategic Frame Hydration
// ============================================================================

/**
 * Hydrated field with provenance tracking
 */
export interface HydratedFrameField {
  value: string;
  source: 'user' | 'context' | 'derived' | 'empty';
  sourceLabel?: string;
  contextPath?: string;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Hydrated Strategic Frame with provenance for each field
 */
export interface HydratedStrategyFrame {
  audience: HydratedFrameField;
  offering: HydratedFrameField;
  valueProp: HydratedFrameField;
  positioning: HydratedFrameField;
  constraints: HydratedFrameField;
  successMetrics: string[];
  nonGoals: string[];
  isLocked?: boolean;
}

/**
 * Create an empty hydrated field
 */
function createEmptyHydratedField(): HydratedFrameField {
  return {
    value: '',
    source: 'empty',
    confidence: 'low',
  };
}

/**
 * Create a user-defined hydrated field
 */
function createUserHydratedField(value: string): HydratedFrameField {
  return {
    value,
    source: 'user',
    confidence: 'high',
  };
}

/**
 * Create a context-derived hydrated field
 */
function createContextHydratedField(
  value: string,
  sourceLabel: string,
  contextPath: string
): HydratedFrameField {
  return {
    value,
    source: 'context',
    sourceLabel,
    contextPath,
    confidence: 'medium',
  };
}

/**
 * Hydrate Strategic Frame from Context Graph
 *
 * Field mapping (using actual CompanyContextGraph schema):
 * - audience → audience.primaryAudience OR audience.icpDescription
 * - offering → productOffer.primaryProducts[0] OR productOffer.services[0]
 * - valueProp → productOffer.valueProposition
 * - positioning → identity.marketPosition OR productOffer.keyDifferentiators[0]
 * - constraints → operationalConstraints.legalRestrictions, identity.geographicFootprint
 */
export function hydrateStrategyFrameFromContext(
  frame: StrategyFrame | undefined,
  graph: CompanyContextGraph | null | undefined
): HydratedStrategyFrame {
  // Helper to check if a value is non-empty
  const hasValue = (val: unknown): boolean => {
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val);
  };

  // Helper to safely extract value from WithMeta wrapper
  const unwrap = <T>(field: { value: T | null } | undefined | null): T | null => {
    if (!field) return null;
    return field.value ?? null;
  };

  // Initialize with empty values
  const hydrated: HydratedStrategyFrame = {
    audience: createEmptyHydratedField(),
    offering: createEmptyHydratedField(),
    valueProp: createEmptyHydratedField(),
    positioning: createEmptyHydratedField(),
    constraints: createEmptyHydratedField(),
    successMetrics: [],
    nonGoals: [],
    isLocked: frame?.isLocked,
  };

  // --- Audience ---
  if (hasValue(frame?.audience)) {
    hydrated.audience = createUserHydratedField(frame!.audience!);
  } else if (hasValue(frame?.targetAudience)) {
    // Legacy fallback
    hydrated.audience = createUserHydratedField(frame!.targetAudience!);
  } else if (graph) {
    // Try Context Graph: audience.primaryAudience > audience.icpDescription
    const audiencePrimary = unwrap(graph.audience?.primaryAudience);
    const audienceIcp = unwrap(graph.audience?.icpDescription);

    if (audiencePrimary) {
      hydrated.audience = createContextHydratedField(
        audiencePrimary,
        'Primary Audience',
        'audience.primaryAudience'
      );
    } else if (audienceIcp) {
      hydrated.audience = createContextHydratedField(
        audienceIcp,
        'ICP Description',
        'audience.icpDescription'
      );
    }
  }

  // --- Offering ---
  if (hasValue(frame?.offering)) {
    hydrated.offering = createUserHydratedField(frame!.offering!);
  } else if (hasValue(frame?.primaryOffering)) {
    // Legacy fallback
    hydrated.offering = createUserHydratedField(frame!.primaryOffering!);
  } else if (graph) {
    // Try Context Graph: productOffer.primaryProducts > productOffer.services
    const primaryProducts = unwrap(graph.productOffer?.primaryProducts);
    const services = unwrap(graph.productOffer?.services);

    // Helper to format value (handles both string and array)
    const formatValue = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0) return val.join(', ');
      return null;
    };

    const productsStr = formatValue(primaryProducts);
    const servicesStr = formatValue(services);

    if (productsStr) {
      hydrated.offering = createContextHydratedField(
        productsStr,
        'Primary Products',
        'productOffer.primaryProducts'
      );
    } else if (servicesStr) {
      hydrated.offering = createContextHydratedField(
        servicesStr,
        'Services',
        'productOffer.services'
      );
    }
  }

  // --- Value Proposition ---
  if (hasValue(frame?.valueProp)) {
    hydrated.valueProp = createUserHydratedField(frame!.valueProp!);
  } else if (hasValue(frame?.valueProposition)) {
    // Legacy fallback
    hydrated.valueProp = createUserHydratedField(frame!.valueProposition!);
  } else if (graph) {
    // Try Context Graph: productOffer.valueProposition > brand.valueProps (canonical)
    const valueProp = unwrap(graph.productOffer?.valueProposition);
    const brandValueProps = unwrap((graph.brand as any)?.valueProps);

    if (valueProp) {
      hydrated.valueProp = createContextHydratedField(
        valueProp,
        'Value Proposition',
        'productOffer.valueProposition'
      );
    } else if (brandValueProps && typeof brandValueProps === 'string') {
      // Canonical field from Brand Lab
      hydrated.valueProp = createContextHydratedField(
        brandValueProps,
        'Value Props (Brand Lab)',
        'brand.valueProps'
      );
    }
  }

  // --- Positioning ---
  if (hasValue(frame?.positioning)) {
    hydrated.positioning = createUserHydratedField(frame!.positioning!);
  } else if (graph) {
    // Try Context Graph: brand.positioning (canonical) > identity.marketPosition > brand.differentiators
    const brandPositioning = unwrap((graph.brand as any)?.positioning);
    const marketPosition = unwrap(graph.identity?.marketPosition);
    const brandDifferentiators = unwrap((graph.brand as any)?.differentiators);
    const differentiators = unwrap(graph.productOffer?.keyDifferentiators);

    // Helper to format value (handles both string and array)
    const formatDiff = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0) return val.join('; ');
      return null;
    };

    if (brandPositioning && typeof brandPositioning === 'string') {
      // Canonical field from Brand Lab (highest priority)
      hydrated.positioning = createContextHydratedField(
        brandPositioning,
        'Positioning (Brand Lab)',
        'brand.positioning'
      );
    } else if (marketPosition && typeof marketPosition === 'string') {
      hydrated.positioning = createContextHydratedField(
        marketPosition,
        'Market Position',
        'identity.marketPosition'
      );
    } else {
      // Try brand.differentiators (canonical) then productOffer.keyDifferentiators
      const brandDiffStr = formatDiff(brandDifferentiators);
      const diffStr = formatDiff(differentiators);

      if (brandDiffStr) {
        hydrated.positioning = createContextHydratedField(
          brandDiffStr,
          'Differentiators (Brand Lab)',
          'brand.differentiators'
        );
      } else if (diffStr) {
        hydrated.positioning = createContextHydratedField(
          diffStr,
          'Key Differentiators',
          'productOffer.keyDifferentiators'
        );
      }
    }
  }

  // --- Constraints ---
  // Helper to safely convert to string (defined early for reuse)
  const toStr = (val: unknown): string | null => {
    if (!val) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Array.isArray(val)) {
      const filtered = val.filter(v => v && String(v).trim());
      return filtered.length > 0 ? filtered.join(', ') : null;
    }
    return String(val);
  };

  // Check if user has non-empty constraints (treat empty/whitespace as missing)
  const userConstraints = frame?.constraints?.trim();
  if (userConstraints && userConstraints.length > 0) {
    hydrated.constraints = createUserHydratedField(userConstraints);
    if (process.env.NODE_ENV === 'development') {
      console.log('[strategyHydration] Constraints source=user, length=', userConstraints.length);
    }
  } else if (graph) {
    // Combine multiple constraint sources from Context
    const constraintsList: string[] = [];

    // Budget constraints
    const minBudget = unwrap(graph.operationalConstraints?.minBudget);
    const maxBudget = unwrap(graph.operationalConstraints?.maxBudget);
    if (minBudget || maxBudget) {
      const budgetParts: string[] = [];
      if (minBudget) budgetParts.push(`min $${minBudget.toLocaleString()}`);
      if (maxBudget) budgetParts.push(`max $${maxBudget.toLocaleString()}`);
      constraintsList.push(`Budget: ${budgetParts.join(', ')}`);
    }

    // Brand vs Performance rules
    const brandRules = toStr(unwrap(graph.operationalConstraints?.brandVsPerformanceRules));
    if (brandRules) {
      constraintsList.push(`Brand/Perf: ${brandRules}`);
    }

    // Legal restrictions
    const legalRestrictions = toStr(unwrap(graph.operationalConstraints?.legalRestrictions));
    if (legalRestrictions) {
      constraintsList.push(`Legal: ${legalRestrictions}`);
    }

    // Industry regulations
    const regulations = toStr(unwrap(graph.operationalConstraints?.industryRegulations));
    if (regulations) {
      constraintsList.push(`Regulatory: ${regulations}`);
    }

    // Compliance requirements
    const compliance = toStr(unwrap(graph.operationalConstraints?.complianceRequirements));
    if (compliance) {
      constraintsList.push(`Compliance: ${compliance}`);
    }

    // Geographic footprint (from identity domain)
    const geography = toStr(unwrap(graph.identity?.geographicFootprint));
    if (geography) {
      constraintsList.push(`Geography: ${geography}`);
    }

    // Pacing/timing constraints
    const pacing = toStr(unwrap(graph.operationalConstraints?.pacingRequirements));
    if (pacing) {
      constraintsList.push(`Pacing: ${pacing}`);
    }

    // Blackout periods
    const blackouts = toStr(unwrap(graph.operationalConstraints?.blackoutPeriods));
    if (blackouts) {
      constraintsList.push(`Blackouts: ${blackouts}`);
    }

    // Resource/talent constraints
    const talent = toStr(unwrap(graph.operationalConstraints?.talentConstraints));
    if (talent) {
      constraintsList.push(`Resources: ${talent}`);
    }

    // Platform limitations
    const platform = toStr(unwrap(graph.operationalConstraints?.platformLimitations));
    if (platform) {
      constraintsList.push(`Platform: ${platform}`);
    }

    if (constraintsList.length > 0) {
      hydrated.constraints = createContextHydratedField(
        constraintsList.join('; '),
        'Constraints (Combined)',
        'operationalConstraints'
      );
      if (process.env.NODE_ENV === 'development') {
        console.log('[strategyHydration] Constraints source=context, sources=', constraintsList.length);
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[strategyHydration] Constraints source=empty, no context constraints found');
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[strategyHydration] Constraints source=empty, no graph available');
  }

  // --- Success Metrics ---
  if (hasValue(frame?.successMetrics)) {
    hydrated.successMetrics = frame!.successMetrics!;
  } else if (graph) {
    // Try Context Graph: objectives.primaryObjective
    const primaryObjective = unwrap(graph.objectives?.primaryObjective);
    if (primaryObjective) {
      hydrated.successMetrics = [primaryObjective];
    }
  }

  // --- Non-Goals ---
  if (hasValue(frame?.nonGoals)) {
    hydrated.nonGoals = frame!.nonGoals!;
  }

  return hydrated;
}

/**
 * Get summary of hydrated frame sources for display
 */
export function getFrameSourceSummary(hydrated: HydratedStrategyFrame): {
  fromUser: string[];
  fromContext: string[];
  missing: string[];
} {
  const fromUser: string[] = [];
  const fromContext: string[] = [];
  const missing: string[] = [];

  const fields: Array<{ name: string; field: HydratedFrameField }> = [
    { name: 'Audience', field: hydrated.audience },
    { name: 'Offering', field: hydrated.offering },
    { name: 'Value Proposition', field: hydrated.valueProp },
    { name: 'Positioning', field: hydrated.positioning },
    { name: 'Constraints', field: hydrated.constraints },
  ];

  for (const { name, field } of fields) {
    if (field.source === 'user') {
      fromUser.push(name);
    } else if (field.source === 'context') {
      fromContext.push(name);
    } else {
      missing.push(name);
    }
  }

  return { fromUser, fromContext, missing };
}

/**
 * Convert hydrated frame back to StrategyFrame (for saving)
 * Only saves user-confirmed values (not auto-derived)
 */
export function dehydrateStrategyFrame(
  hydrated: HydratedStrategyFrame,
  saveContextDerived: boolean = false
): StrategyFrame {
  const shouldSave = (field: HydratedFrameField) =>
    field.source === 'user' || (saveContextDerived && field.source === 'context');

  return {
    audience: shouldSave(hydrated.audience) ? hydrated.audience.value : undefined,
    offering: shouldSave(hydrated.offering) ? hydrated.offering.value : undefined,
    valueProp: shouldSave(hydrated.valueProp) ? hydrated.valueProp.value : undefined,
    positioning: shouldSave(hydrated.positioning) ? hydrated.positioning.value : undefined,
    constraints: shouldSave(hydrated.constraints) ? hydrated.constraints.value : undefined,
    successMetrics: hydrated.successMetrics.length > 0 ? hydrated.successMetrics : undefined,
    nonGoals: hydrated.nonGoals.length > 0 ? hydrated.nonGoals : undefined,
    isLocked: hydrated.isLocked,
  };
}
