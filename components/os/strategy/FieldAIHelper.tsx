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

export function FieldAIHelper({
  fieldType,
  currentValue,
  hasHumanEdits = false,
  onApply,
  onFetch,
  availableActions,
  size = 'sm',
  className = '',
  isListField = false,
  disabled = false,
}: FieldAIHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    value: string | string[] | { variants: string[] };
    inputsUsed?: Record<string, boolean>;
  } | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [guidance, setGuidance] = useState('');
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

  // Default apply mode based on human edits
  const defaultApplyMode: ApplyMode = hasHumanEdits ? 'variant' : 'replace';

  const buttonSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

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
              {/* Inputs Used Badge */}
              {result.inputsUsed && (
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

              {/* Value Display */}
              {isVariantsResult(result.value) ? (
                // Variants display
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Select a variant:</p>
                  {result.value.variants.map((variant, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVariant(idx)}
                      className={`w-full text-left p-2 text-xs rounded border transition-colors ${
                        selectedVariant === idx
                          ? 'bg-purple-500/10 border-purple-500/50 text-slate-200'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
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
