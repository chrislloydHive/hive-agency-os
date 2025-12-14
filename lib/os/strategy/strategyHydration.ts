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
