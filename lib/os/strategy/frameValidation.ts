// lib/os/strategy/frameValidation.ts
// Frame Validation - Separate Frame Completeness from Context Readiness
//
// Two independent validation systems:
// 1. Frame Completeness (Hard Requirement) - Blocks AI generation
// 2. Context Readiness (Soft Signal) - Affects confidence, never blocks
//
// Strategic Frame (Strategy-scoped assumptions):
// - Audience/ICP: Who we serve
// - Value Proposition: Why us
// - Positioning: How we're different
// - Constraints: Legal, resource, etc.
//
// Context Readiness (Company-scoped facts - from Context page):
// - Competitors: Market landscape
// - Budget: Resource availability
// - Channels: Distribution capability
// - Historical performance: What we know works

import type { StrategyFrame } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

/**
 * Frame field definition
 */
export interface FrameFieldDefinition {
  key: keyof StrategyFrame;
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
}

/**
 * Frame Completeness result (Hard - blocks AI)
 */
export interface FrameCompleteness {
  isComplete: boolean;
  percent: number;
  filledFields: string[];
  missingFields: string[];
  missingLabels: string[];
}

/**
 * Context readiness field
 */
export interface ContextField {
  key: string;
  label: string;
  section: 'competition' | 'constraints' | 'channels' | 'performance';
  isFilled: boolean;
}

/**
 * Context Readiness result (Soft - affects confidence)
 */
export interface ContextReadiness {
  isReady: boolean;
  percent: number;
  filledFields: string[];
  missingFields: string[];
  missingLabels: string[];
  // Context never blocks, but we show how it affects AI confidence
  confidenceImpact: 'high' | 'medium' | 'low';
}

/**
 * Combined validation result for UI
 */
export interface StrategyValidation {
  frame: FrameCompleteness;
  context: ContextReadiness;
  // Derived helpers
  canGenerateBets: boolean;
  canGenerateTactics: boolean;
  blockedReason: string | null;
}

// ============================================================================
// Strategic Frame Fields (Strategy-scoped assumptions)
// ============================================================================

/**
 * Core frame fields - these are required for AI generation
 * ORDER matters for display
 */
export const FRAME_FIELDS: FrameFieldDefinition[] = [
  {
    key: 'audience',
    label: 'Target Audience',
    shortLabel: 'Audience',
    description: 'Who we serve - the ideal customer profile',
    placeholder: 'e.g., B2B SaaS companies with 50-200 employees...',
  },
  {
    key: 'valueProp',
    label: 'Value Proposition',
    shortLabel: 'Value Prop',
    description: 'Why us - the unique value we deliver',
    placeholder: 'e.g., We help teams ship 2x faster by...',
  },
  {
    key: 'positioning',
    label: 'Positioning',
    shortLabel: 'Positioning',
    description: 'How we are different from alternatives',
    placeholder: 'e.g., Unlike [competitor], we focus on...',
  },
  {
    key: 'constraints',
    label: 'Constraints',
    shortLabel: 'Constraints',
    description: 'What limits us - legal, resource, or other restrictions',
    placeholder: 'e.g., Must comply with HIPAA, limited engineering capacity...',
  },
];

/**
 * Get frame field definition by key
 */
export function getFrameFieldDef(key: string): FrameFieldDefinition | undefined {
  return FRAME_FIELDS.find(f => f.key === key);
}

// ============================================================================
// Frame Completeness (Hard Requirement)
// ============================================================================

/**
 * Check if a frame field has content
 */
function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/**
 * Compute Frame Completeness
 * This is a HARD requirement - blocks AI generation if incomplete
 *
 * Rules:
 * - All 4 core fields must have content
 * - Returns percent, filled fields, and missing fields
 */
export function computeFrameCompleteness(frame?: StrategyFrame): FrameCompleteness {
  if (!frame) {
    return {
      isComplete: false,
      percent: 0,
      filledFields: [],
      missingFields: FRAME_FIELDS.map(f => f.key),
      missingLabels: FRAME_FIELDS.map(f => f.shortLabel),
    };
  }

  const filledFields: string[] = [];
  const missingFields: string[] = [];
  const missingLabels: string[] = [];

  for (const field of FRAME_FIELDS) {
    const value = frame[field.key];
    // Handle legacy field names
    const legacyValue =
      field.key === 'audience' ? frame.targetAudience :
      field.key === 'valueProp' ? frame.valueProposition :
      undefined;

    if (hasContent(value) || hasContent(legacyValue)) {
      filledFields.push(field.key);
    } else {
      missingFields.push(field.key);
      missingLabels.push(field.shortLabel);
    }
  }

  const percent = Math.round((filledFields.length / FRAME_FIELDS.length) * 100);

  return {
    isComplete: missingFields.length === 0,
    percent,
    filledFields,
    missingFields,
    missingLabels,
  };
}

// ============================================================================
// Context Readiness (Soft Signal)
// ============================================================================

/**
 * Context fields we check for readiness
 * These live in Company Context, not Strategy
 */
export const CONTEXT_FIELDS = [
  { key: 'competitors', label: 'Competitors', section: 'competition' as const },
  { key: 'budget', label: 'Budget', section: 'constraints' as const },
  { key: 'channels', label: 'Channels', section: 'channels' as const },
  { key: 'historicalPerformance', label: 'Historical Data', section: 'performance' as const },
];

/**
 * Compute Context Readiness from context data
 * This is a SOFT signal - never blocks, just affects AI confidence
 *
 * @param contextData - Raw context data from Context page
 */
export function computeContextReadiness(contextData?: {
  competitors?: unknown[];
  budget?: { min?: number; max?: number };
  channels?: unknown[];
  historicalPerformance?: unknown;
}): ContextReadiness {
  if (!contextData) {
    return {
      isReady: false,
      percent: 0,
      filledFields: [],
      missingFields: CONTEXT_FIELDS.map(f => f.key),
      missingLabels: CONTEXT_FIELDS.map(f => f.label),
      confidenceImpact: 'low',
    };
  }

  const filledFields: string[] = [];
  const missingFields: string[] = [];
  const missingLabels: string[] = [];

  // Check competitors
  if (Array.isArray(contextData.competitors) && contextData.competitors.length > 0) {
    filledFields.push('competitors');
  } else {
    missingFields.push('competitors');
    missingLabels.push('Competitors');
  }

  // Check budget
  if (contextData.budget && (contextData.budget.min || contextData.budget.max)) {
    filledFields.push('budget');
  } else {
    missingFields.push('budget');
    missingLabels.push('Budget');
  }

  // Check channels
  if (Array.isArray(contextData.channels) && contextData.channels.length > 0) {
    filledFields.push('channels');
  } else {
    missingFields.push('channels');
    missingLabels.push('Channels');
  }

  // Check historical performance
  if (contextData.historicalPerformance) {
    filledFields.push('historicalPerformance');
  } else {
    missingFields.push('historicalPerformance');
    missingLabels.push('Historical Data');
  }

  const percent = Math.round((filledFields.length / CONTEXT_FIELDS.length) * 100);

  // Determine confidence impact
  let confidenceImpact: 'high' | 'medium' | 'low';
  if (percent >= 75) {
    confidenceImpact = 'high';
  } else if (percent >= 50) {
    confidenceImpact = 'medium';
  } else {
    confidenceImpact = 'low';
  }

  return {
    isReady: missingFields.length === 0,
    percent,
    filledFields,
    missingFields,
    missingLabels,
    confidenceImpact,
  };
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Compute combined strategy validation
 *
 * AI Gating Rules:
 * - Bets generation: Requires Frame Completeness
 * - Tactics generation: Requires Frame Completeness + at least 1 accepted bet
 *
 * Context Readiness never blocks - it only affects confidence messaging
 */
export function computeStrategyValidation(
  frame?: StrategyFrame,
  contextData?: Parameters<typeof computeContextReadiness>[0],
  hasAcceptedBets?: boolean
): StrategyValidation {
  const frameResult = computeFrameCompleteness(frame);
  const contextResult = computeContextReadiness(contextData);

  // AI Gating
  const canGenerateBets = frameResult.isComplete;
  const canGenerateTactics = frameResult.isComplete && hasAcceptedBets === true;

  // Blocked reason (for tooltips)
  let blockedReason: string | null = null;
  if (!frameResult.isComplete) {
    blockedReason = `Frame incomplete: missing ${frameResult.missingLabels.join(', ')}`;
  }

  return {
    frame: frameResult,
    context: contextResult,
    canGenerateBets,
    canGenerateTactics,
    blockedReason,
  };
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Get the frame status chip color and label
 */
export function getFrameStatusChip(frame: FrameCompleteness): {
  color: 'red' | 'amber' | 'emerald';
  label: string;
  tooltip: string;
} {
  if (frame.isComplete) {
    return {
      color: 'emerald',
      label: 'Frame complete',
      tooltip: 'All strategic frame fields are filled',
    };
  }

  const count = frame.missingFields.length;
  return {
    color: 'red',
    label: `${count} frame field${count > 1 ? 's' : ''} missing`,
    tooltip: `Missing: ${frame.missingLabels.join(', ')}`,
  };
}

/**
 * Get the context status chip color and label
 */
export function getContextStatusChip(context: ContextReadiness): {
  color: 'amber' | 'emerald' | 'slate';
  label: string;
  tooltip: string;
} {
  if (context.isReady) {
    return {
      color: 'emerald',
      label: 'Inputs confirmed',
      tooltip: 'All context fields available - AI will have high confidence',
    };
  }

  if (context.percent >= 50) {
    return {
      color: 'amber',
      label: 'Context gaps',
      tooltip: `Missing: ${context.missingLabels.join(', ')}. AI will proceed with lower confidence.`,
    };
  }

  return {
    color: 'slate',
    label: 'Limited context',
    tooltip: `Missing: ${context.missingLabels.join(', ')}. Add context for better AI recommendations.`,
  };
}

/**
 * Get frame field status for display
 */
export function getFrameFieldStatus(
  frame: StrategyFrame | undefined,
  fieldKey: keyof StrategyFrame
): {
  isEmpty: boolean;
  value: string | undefined;
  label: string;
  placeholder: string;
} {
  const fieldDef = getFrameFieldDef(fieldKey);
  const value = frame?.[fieldKey] as string | undefined;

  // Check legacy fields
  let effectiveValue = value;
  if (!effectiveValue && fieldKey === 'audience') {
    effectiveValue = frame?.targetAudience;
  }
  if (!effectiveValue && fieldKey === 'valueProp') {
    effectiveValue = frame?.valueProposition;
  }

  return {
    isEmpty: !hasContent(effectiveValue),
    value: effectiveValue,
    label: fieldDef?.label || fieldKey,
    placeholder: fieldDef?.placeholder || `Add ${fieldKey}...`,
  };
}
