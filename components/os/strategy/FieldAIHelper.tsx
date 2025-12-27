'use client';

// components/os/strategy/FieldAIHelper.tsx
// Field-Level AI Helper - reusable AI assistance for any editable field
//
// Provides contextual AI actions:
// - Suggest: Generate a new value
// - Refine: Improve current value
// - Shorten: Make more concise
// - Expand: Add more detail
// - Variants: Generate 2-4 alternatives
// - For lists: Add pros, Add cons, Add tradeoffs
// - Fix: Repair variants with warnings (deterministic or AI-powered)

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  X,
  Loader2,
  ChevronDown,
  Plus,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Wrench,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type FieldAIAction =
  | 'suggest'
  | 'refine'
  | 'shorten'
  | 'expand'
  | 'variants'
  | 'addPros'
  | 'addCons'
  | 'addTradeoffs';

export type ApplyMode = 'replace' | 'insert' | 'variant';

/**
 * Warning action types for repair operations
 */
export type VariantWarningAction =
  | 'remove_phrase'
  | 'rewrite_defensible'
  | 'rewrite_with_constraints'
  | 'regenerate_stricter';

/**
 * Warning types for categorization
 */
export type VariantWarningType =
  | 'banned_phrase'
  | 'invented_claim'
  | 'generic_fluff'
  | 'constraint_violation'
  | 'category_drift'
  | 'domain_mismatch'
  | 'quality_too_short'
  | 'quality_too_long'
  | 'quality_placeholder';

/**
 * Generated using metadata from contract-driven API
 */
export interface GeneratedUsingMeta {
  /** Labels of primary inputs used */
  primary: string[];
  /** Labels of constraints applied */
  constraints: string[];
  /** Keys of missing primary inputs (for warning) */
  missingPrimary: string[];
  /** Whether category safety mode is active (missing strategic anchors) */
  categorySafetyMode?: boolean;
  /** Whether goal alignment is active (goalStatement provided + field requires it) */
  goalAlignmentActive?: boolean;
  /** Whether business definition is missing (neutral mode active) */
  businessDefinitionMissing?: boolean;
  /** Labels of fallback inputs used (e.g., GAP summary) */
  usedFallback?: string[];
  /** Raw missing business definition keys (debug) */
  missingBusinessDefinitionKeys?: string[];
}

/**
 * Variant validation warning from constraint detector
 */
export interface VariantWarning {
  /** Index of the variant with the warning */
  variantIndex: number;
  /** Type of warning for programmatic handling */
  type: VariantWarningType;
  /** Human-readable reason for the warning */
  reason: string;
  /** Severity: 'error' for must-fix, 'warning' for review */
  severity: 'error' | 'warning';
  /** Recommended action to fix this warning */
  action: VariantWarningAction;
  /** The matched phrase if applicable */
  matchedPhrase?: string;
  /** Additional metadata for repairs */
  meta?: {
    phrases?: string[];
    pattern?: string;
    constraint?: string;
  };
}

/**
 * Human-readable labels for fix actions
 */
const ACTION_LABELS: Record<VariantWarningAction, string> = {
  remove_phrase: 'Remove phrase',
  rewrite_defensible: 'Rewrite to be defensible',
  rewrite_with_constraints: 'Rewrite to fit constraints',
  regenerate_stricter: 'Regenerate this variant',
};

/**
 * Repair request for targeted variant regeneration
 */
export interface RepairRequest {
  /** The variant text to repair */
  variantToRepair: string;
  /** Mode for rewriting */
  rewriteMode: 'defensible' | 'constraints';
  /** Warning types to avoid */
  avoidWarnings?: VariantWarningType[];
  /** Phrases to avoid */
  avoidPhrases?: string[];
}

interface FieldAIHelperProps {
  /** Field identifier (e.g., "frame.audience", "objective.title", "bet.tradeoffs") */
  fieldType: string;
  /** Current value of the field */
  currentValue: string | string[];
  /** Whether the field has been manually edited */
  hasHumanEdits?: boolean;
  /** Callback when user applies AI suggestion */
  onApply: (value: string | string[], mode: ApplyMode) => void;
  /** Callback to fetch AI suggestion */
  onFetch: (action: FieldAIAction, guidance?: string) => Promise<{
    value: string | string[] | { variants: string[] };
    inputsUsed?: Record<string, boolean>;
    /** Contract-driven metadata for trust chips */
    generatedUsing?: GeneratedUsingMeta;
    /** Validation warnings for individual variants */
    warnings?: VariantWarning[];
    /** Whether this was a repair operation */
    isRepair?: boolean;
    /** Debug info (dev only) */
    debug?: {
      contractId?: string;
      confirmedCount?: number;
      parseMethod?: string;
      repairMode?: string;
      /** Whether automatic drift repair was attempted */
      repairAttempted?: boolean;
      /** Whether the repair succeeded */
      repairSucceeded?: boolean;
      /** Reason for repair */
      repairReason?: string;
      /** Whether returned variants are from repair */
      wasRepaired?: boolean;
    };
  }>;
  /** Callback to repair a specific variant (optional - enables fix button) */
  onRepair?: (request: RepairRequest) => Promise<{
    value: string;
    warnings?: VariantWarning[];
    isRepair: true;
  }>;
  /** Available actions for this field type */
  availableActions?: FieldAIAction[];
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
  /** Whether to show list-specific actions (addPros, addCons, addTradeoffs) */
  isListField?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// Action Config
// ============================================================================

const ACTION_CONFIG: Record<FieldAIAction, {
  icon: React.ElementType;
  label: string;
  description: string;
}> = {
  suggest: {
    icon: Sparkles,
    label: 'Suggest',
    description: 'Generate a new value',
  },
  refine: {
    icon: Wand2,
    label: 'Refine',
    description: 'Improve current value',
  },
  shorten: {
    icon: Minimize2,
    label: 'Shorten',
    description: 'Make more concise',
  },
  expand: {
    icon: Maximize2,
    label: 'Expand',
    description: 'Add more detail',
  },
  variants: {
    icon: Copy,
    label: 'Variants',
    description: 'Generate 2-4 alternatives',
  },
  addPros: {
    icon: ThumbsUp,
    label: 'Add Pros',
    description: 'Suggest advantages',
  },
  addCons: {
    icon: ThumbsDown,
    label: 'Add Cons',
    description: 'Suggest disadvantages',
  },
  addTradeoffs: {
    icon: AlertTriangle,
    label: 'Add Tradeoffs',
    description: 'Suggest tradeoffs',
  },
};

const DEFAULT_ACTIONS: FieldAIAction[] = ['suggest', 'refine', 'shorten', 'expand', 'variants'];
const LIST_ACTIONS: FieldAIAction[] = ['addPros', 'addCons', 'addTradeoffs'];

// Type guard for variants result
function isVariantsResult(value: string | string[] | { variants: string[] }): value is { variants: string[] } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'variants' in value;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Helper: Remove phrases from text (deterministic fix)
 */
function removePhrasesFromText(text: string, phrases: string[]): { text: string; success: boolean } {
  let result = text;
  let changed = false;

  for (const phrase of phrases) {
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`\\s*,\\s*${escapedPhrase}`, 'gi'),
      new RegExp(`${escapedPhrase}\\s*,\\s*`, 'gi'),
      new RegExp(`\\b${escapedPhrase}\\b`, 'gi'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, '');
        changed = true;
        break;
      }
    }
  }

  // Clean up
  result = result
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/([.,!?])\s*([.,!?])/g, '$1')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .trim();

  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return { text: result, success: changed };
}

/**
 * Get primary fix action for a set of warnings
 */
function getPrimaryAction(warnings: VariantWarning[]): { action: VariantWarningAction; warnings: VariantWarning[] } | null {
  if (warnings.length === 0) return null;

  const actionPriority: VariantWarningAction[] = [
    'remove_phrase',
    'rewrite_with_constraints',
    'rewrite_defensible',
    'regenerate_stricter',
  ];

  const sorted = [...warnings].sort((a, b) => {
    if (a.severity === 'error' && b.severity !== 'error') return -1;
    if (b.severity === 'error' && a.severity !== 'error') return 1;
    return actionPriority.indexOf(a.action) - actionPriority.indexOf(b.action);
  });

  const primaryAction = sorted[0].action;
  return {
    action: primaryAction,
    warnings: warnings.filter(w => w.action === primaryAction),
  };
}

export function FieldAIHelper({
  fieldType,
  currentValue,
  hasHumanEdits = false,
  onApply,
  onFetch,
  onRepair,
  availableActions,
  size = 'sm',
  className = '',
  isListField = false,
  disabled = false,
}: FieldAIHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [result, setResult] = useState<{
    value: string | string[] | { variants: string[]; repaired?: boolean[] };
    inputsUsed?: Record<string, boolean>;
    generatedUsing?: GeneratedUsingMeta;
    warnings?: VariantWarning[];
    isRepair?: boolean;
    debug?: {
      contractId?: string;
      confirmedCount?: number;
      parseMethod?: string;
      repairMode?: string;
      repairAttempted?: boolean;
      repairSucceeded?: boolean;
      repairReason?: string;
      wasRepaired?: boolean;
    };
  } | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [guidance, setGuidance] = useState('');
  // Track which variants have been repaired
  const [repairedIndices, setRepairedIndices] = useState<Set<number>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Determine available actions
  const actions = availableActions || (isListField ? LIST_ACTIONS : DEFAULT_ACTIONS);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setResult(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle action click
  const handleAction = useCallback(async (action: FieldAIAction) => {
    setIsLoading(true);
    setResult(null);
    try {
      const response = await onFetch(action, guidance || undefined);
      setResult(response);
    } catch (error) {
      console.error('AI action failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onFetch, guidance]);

  // Handle apply
  const handleApply = useCallback((mode: ApplyMode) => {
    if (!result) return;

    let valueToApply: string | string[];
    if (isVariantsResult(result.value)) {
      valueToApply = result.value.variants[selectedVariant];
    } else {
      valueToApply = result.value;
    }

    onApply(valueToApply, mode);
    setIsOpen(false);
    setResult(null);
  }, [result, selectedVariant, onApply]);

  // Handle fix action for a specific variant
  const handleFix = useCallback(async (variantIdx: number, action: VariantWarningAction, warnings: VariantWarning[]) => {
    if (!result || !isVariantsResult(result.value)) return;

    const variantText = result.value.variants[variantIdx];

    // Deterministic fix: remove_phrase
    if (action === 'remove_phrase') {
      const phrasesToRemove: string[] = [];
      for (const w of warnings) {
        if (w.meta?.phrases) phrasesToRemove.push(...w.meta.phrases);
        if (w.matchedPhrase) phrasesToRemove.push(w.matchedPhrase);
      }

      if (phrasesToRemove.length > 0) {
        const repairResult = removePhrasesFromText(variantText, [...new Set(phrasesToRemove)]);

        if (repairResult.success) {
          // Update the variant in place
          const newVariants = [...result.value.variants];
          newVariants[variantIdx] = repairResult.text;

          // Remove warnings for this variant
          const remainingWarnings = result.warnings?.filter(
            w => w.variantIndex !== variantIdx || w.action !== 'remove_phrase'
          );

          setResult({
            ...result,
            value: { variants: newVariants },
            warnings: remainingWarnings,
          });

          // Mark as repaired
          setRepairedIndices(prev => new Set(prev).add(variantIdx));
          return;
        }
      }
    }

    // AI-powered fixes require onRepair callback
    if (!onRepair) {
      console.warn('onRepair callback not provided, cannot perform AI-powered fix');
      return;
    }

    // Determine rewrite mode from action
    const rewriteMode: 'defensible' | 'constraints' =
      action === 'rewrite_with_constraints' ? 'constraints' : 'defensible';

    // Collect avoid info from warnings
    const avoidWarnings = warnings.map(w => w.type);
    const avoidPhrases: string[] = [];
    for (const w of warnings) {
      if (w.matchedPhrase) avoidPhrases.push(w.matchedPhrase);
      if (w.meta?.phrases) avoidPhrases.push(...w.meta.phrases);
    }

    setIsRepairing(true);
    try {
      const repairResult = await onRepair({
        variantToRepair: variantText,
        rewriteMode,
        avoidWarnings: [...new Set(avoidWarnings)],
        avoidPhrases: [...new Set(avoidPhrases)],
      });

      // Update the variant with the repaired text
      const newVariants = [...result.value.variants];
      newVariants[variantIdx] = repairResult.value;

      // Update warnings - remove old ones for this variant, add any new ones
      const otherWarnings = result.warnings?.filter(w => w.variantIndex !== variantIdx) || [];
      const newWarnings = repairResult.warnings || [];

      setResult({
        ...result,
        value: { variants: newVariants },
        warnings: [...otherWarnings, ...newWarnings],
      });

      // Mark as repaired
      setRepairedIndices(prev => new Set(prev).add(variantIdx));
    } catch (error) {
      console.error('Repair failed:', error);
    } finally {
      setIsRepairing(false);
    }
  }, [result, onRepair]);

  // Default apply mode based on human edits
  const defaultApplyMode: ApplyMode = hasHumanEdits ? 'variant' : 'replace';

  const buttonSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  // Get warnings for a specific variant index
  const getVariantWarnings = (idx: number): VariantWarning[] => {
    if (!result?.warnings) return [];
    return result.warnings.filter((w) => w.variantIndex === idx);
  };

  // Check if a variant has been repaired
  const isRepaired = (idx: number): boolean => repairedIndices.has(idx);

  const gapFallbackUsed = result?.generatedUsing?.usedFallback && result.generatedUsing.usedFallback.length > 0;

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          ${buttonSize} flex items-center justify-center rounded
          text-purple-400 hover:text-purple-300 hover:bg-purple-500/10
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="AI Assistant"
      >
        <Sparkles className={iconSize} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full right-0 mt-1 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-slate-200">AI Assistant</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setResult(null);
              }}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin mb-2" />
              <p className="text-xs text-slate-400">Generating...</p>
            </div>
          )}

          {/* Action Buttons */}
          {!isLoading && !result && (
            <div className="p-2 space-y-1">
              {/* Optional guidance input */}
              <div className="mb-2">
                <input
                  type="text"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="Optional guidance..."
                  className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {actions.map((action) => {
                const config = ACTION_CONFIG[action];
                const Icon = config.icon;
                return (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{config.label}</span>
                    <span className="ml-auto text-[10px] text-slate-500">{config.description}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Result Display */}
          {!isLoading && result && (
            <div className="p-3 space-y-3">
              {/* Contract-driven Trust Chips (preferred) */}
              {result.generatedUsing && (
                <div className="space-y-1">
                  {/* Auto-corrected drift notice - shown when wasRepaired=true */}
                  {result.debug?.wasRepaired && (
                    <div className="text-[10px] text-emerald-400/80 bg-emerald-500/5 px-2 py-1 rounded flex items-center gap-1.5">
                      <Check className="w-3 h-3 flex-shrink-0" />
                      <span>Auto-corrected drift — suggestions adjusted to neutral format.</span>
                    </div>
                  )}
                  {/* Primary inputs used - filter out the field being generated */}
                  {result.generatedUsing.primary.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-500">Using:</span>
                      {result.generatedUsing.primary
                        // Filter out the field being generated (e.g., don't show "Value Proposition ✓" when generating valueProp)
                        .filter((label) => {
                          const labelLower = label.toLowerCase().replace(/\s+/g, '');
                          const fieldLower = fieldType.toLowerCase().replace(/\s+/g, '');
                          // Filter out if label matches field type or common variations
                          return !(
                            labelLower.includes(fieldLower) ||
                            fieldLower.includes(labelLower) ||
                            (fieldType === 'valueProp' && label.toLowerCase().includes('value proposition')) ||
                            (fieldType === 'positioning' && label.toLowerCase().includes('positioning'))
                          );
                        })
                        .map((label) => (
                        <span
                          key={label}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            label === 'Goal Statement'
                              ? 'bg-purple-500/10 text-purple-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {label === 'Goal Statement' ? 'Goal ✓' : `${label} ✓`}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* GAP fallback inputs (e.g., GAP summary) */}
                  {gapFallbackUsed && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-500">Using:</span>
                      {result.generatedUsing.usedFallback?.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded"
                        >
                          {label} ✓
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Goal alignment active badge (dev-only) - shows when output is aligned to goal */}
                  {process.env.NODE_ENV !== 'production' && result.generatedUsing.goalAlignmentActive && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/5 text-purple-400/60 rounded border border-purple-500/20">
                        Aligned to Goal
                      </span>
                    </div>
                  )}
                  {/* Constraints applied */}
                  {result.generatedUsing.constraints.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-500">Constraints:</span>
                      {result.generatedUsing.constraints.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Goal missing warning - show when goalStatement is in missingPrimary (always visible) */}
                  {result.generatedUsing.missingPrimary.includes('goalStatement') && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">
                        Goal missing
                      </span>
                    </div>
                  )}
                  {/* Missing primary inputs warning (dev only) */}
                  {process.env.NODE_ENV !== 'production' && result.generatedUsing.missingPrimary.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-500">Missing:</span>
                      {result.generatedUsing.missingPrimary
                        .filter((key) => key !== 'goalStatement') // Goal is shown separately above
                        .map((key) => (
                        <span
                          key={key}
                          className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Business definition missing notice (takes priority over category safety) */}
                  {result.generatedUsing.businessDefinitionMissing && (
                    <div className="text-[10px] text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {gapFallbackUsed
                          ? 'Business definition missing in Context — using GAP summary as fallback.'
                          : 'Missing business definition inputs — suggestions will be intentionally neutral until ICP + business model are confirmed.'}
                      </span>
                    </div>
                  )}
                  {/* Category safety mode notice (only show if not already showing business definition warning) */}
                  {!result.generatedUsing.businessDefinitionMissing && result.generatedUsing.categorySafetyMode && (
                    <div className="text-[10px] text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>Some strategic inputs are missing — suggestions will remain high-level.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Legacy Inputs Used Badge (fallback) */}
              {!result.generatedUsing && result.inputsUsed && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(result.inputsUsed).map(([key, used]) =>
                    used ? (
                      <span
                        key={key}
                        className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded"
                      >
                        {key} ✓
                      </span>
                    ) : null
                  )}
                </div>
              )}

              {/* Debug info (dev only) */}
              {process.env.NODE_ENV !== 'production' && result.debug && (
                <div className="text-[9px] font-mono text-slate-600 bg-slate-900 rounded px-1.5 py-0.5 space-y-0.5">
                  <div>
                    contract: {result.debug.contractId} | confirmed: {result.debug.confirmedCount}
                    {result.debug.parseMethod && ` | parsed: ${result.debug.parseMethod}`}
                  </div>
                  {result.generatedUsing?.missingBusinessDefinitionKeys && result.generatedUsing.missingBusinessDefinitionKeys.length > 0 && (
                    <div>missing business definition: {result.generatedUsing.missingBusinessDefinitionKeys.join(', ')}</div>
                  )}
                  {result.generatedUsing?.usedFallback && result.generatedUsing.usedFallback.length > 0 && (
                    <div>fallback used: {result.generatedUsing.usedFallback.join(', ')}</div>
                  )}
                </div>
              )}

              {/* Value Display */}
              {isVariantsResult(result.value) ? (
                // Variants display with warning badges and fix buttons
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Select a variant:</p>
                  {result.value.variants.map((variant, idx) => {
                    const warnings = getVariantWarnings(idx);
                    const hasErrors = warnings.some((w) => w.severity === 'error');
                    const hasWarnings = warnings.length > 0;
                    const variantRepaired = isRepaired(idx);
                    const primaryAction = getPrimaryAction(warnings);

                    return (
                      <div key={idx} className="space-y-1">
                        <button
                          onClick={() => setSelectedVariant(idx)}
                          className={`w-full text-left p-2 text-xs rounded border transition-colors ${
                            selectedVariant === idx
                              ? 'bg-purple-500/10 border-purple-500/50 text-slate-200'
                              : hasErrors
                              ? 'bg-red-500/5 border-red-500/30 text-slate-300 hover:border-red-500/50'
                              : hasWarnings
                              ? 'bg-amber-500/5 border-amber-500/30 text-slate-300 hover:border-amber-500/50'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {/* Repaired badge */}
                            {variantRepaired && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex-shrink-0">
                                Repaired
                              </span>
                            )}
                            {/* Warning icon */}
                            {!variantRepaired && hasErrors && (
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            {!variantRepaired && !hasErrors && hasWarnings && (
                              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                            )}
                            <span className="flex-1">{variant}</span>
                          </div>
                        </button>
                        {/* Show warnings and fix button for this variant if selected */}
                        {selectedVariant === idx && warnings.length > 0 && (
                          <div className="ml-2 space-y-1">
                            {warnings.map((warning, wIdx) => (
                              <div
                                key={wIdx}
                                className={`flex items-start gap-1.5 text-[10px] px-2 py-1 rounded ${
                                  warning.severity === 'error'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span>{warning.reason}</span>
                              </div>
                            ))}
                            {/* Fix This Variant button */}
                            {primaryAction && (
                              <button
                                onClick={() => handleFix(idx, primaryAction.action, primaryAction.warnings)}
                                disabled={isRepairing}
                                className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded transition-colors ${
                                  primaryAction.action === 'remove_phrase'
                                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {isRepairing ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Repairing...</span>
                                  </>
                                ) : primaryAction.action === 'remove_phrase' ? (
                                  <>
                                    <Wrench className="w-3 h-3" />
                                    <span>{ACTION_LABELS[primaryAction.action]}</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3" />
                                    <span>{ACTION_LABELS[primaryAction.action]}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : Array.isArray(result.value) ? (
                // Array display (for list additions)
                <div className="space-y-1">
                  {result.value.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 text-xs text-slate-300 bg-slate-800 rounded border border-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                // Single value display
                <div className="p-2 text-xs text-slate-300 bg-slate-800 rounded border border-slate-700 max-h-32 overflow-y-auto">
                  {result.value}
                </div>
              )}

              {/* Apply Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                <button
                  onClick={() => handleApply('replace')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Replace
                </button>
                {Array.isArray(currentValue) || (Array.isArray(result.value) && !isVariantsResult(result.value)) ? (
                  <button
                    onClick={() => handleApply('insert')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                ) : (
                  <button
                    onClick={() => handleApply('variant')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Save as Variant
                  </button>
                )}
              </div>

              {/* Human Edits Warning */}
              {hasHumanEdits && (
                <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This field has manual edits. &quot;Replace&quot; will overwrite them.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FieldAIHelper;
