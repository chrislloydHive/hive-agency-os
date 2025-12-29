'use client';

// components/os/strategy/ColumnAIGenerateButton.tsx
// Column-Level AI Generate Button with modal for configuration
//
// Provides column-level AI generation with modes:
// - Create: Append new drafts
// - Replace: Replace drafts only (preserve accepted)
// - Improve: Rewrite selected items

import React, { useState, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  X,
  Plus,
  RefreshCw,
  Wand2,
  Check,
  Target,
  Layers,
  Zap,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types & Constants
// ============================================================================

export type GenerateType = 'objectives' | 'bets' | 'tactics';
export type GenerateMode = 'create' | 'replace' | 'improve';

/**
 * Minimum confirmed context fields required for AI generation.
 * Must match INPUTS_CONFIRMED_THRESHOLD in strategy/fields/suggest/route.ts
 */
export const CONFIRMED_CONTEXT_THRESHOLD = 3;

interface ColumnAIGenerateButtonProps {
  /** Column type */
  type: GenerateType;
  /** Callback to trigger generation */
  onGenerate: (mode: GenerateMode, guidance?: string) => Promise<void>;
  /** Whether generation is in progress */
  isGenerating?: boolean;
  /** Available inputs summary */
  inputsAvailable?: {
    frame: boolean;
    objectives: boolean;
    bets: boolean;
  };
  /** Number of confirmed context fields (from Context V4 store) */
  confirmedContextCount?: number;
  /** Number of existing items */
  existingCount?: number;
  /** Number of accepted items (for bets) */
  acceptedCount?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

// ============================================================================
// Type Config
// ============================================================================

const TYPE_CONFIG: Record<GenerateType, {
  icon: React.ElementType;
  label: string;
  singular: string;
  requiredInputs: string[];
}> = {
  objectives: {
    icon: Target,
    label: 'Objectives',
    singular: 'objective',
    requiredInputs: ['Frame'],
  },
  bets: {
    icon: Layers,
    label: 'Strategic Bets',
    singular: 'bet',
    requiredInputs: ['Frame', 'Objectives'],
  },
  tactics: {
    icon: Zap,
    label: 'Tactics',
    singular: 'tactic',
    requiredInputs: ['Frame', 'Objectives', 'Accepted Bets'],
  },
};

const MODE_CONFIG: Record<GenerateMode, {
  icon: React.ElementType;
  label: string;
  description: string;
}> = {
  create: {
    icon: Plus,
    label: 'Create New',
    description: 'Add new drafts to existing items',
  },
  replace: {
    icon: RefreshCw,
    label: 'Replace Drafts',
    description: 'Replace draft items only (preserves accepted)',
  },
  improve: {
    icon: Wand2,
    label: 'Improve',
    description: 'Rewrite and enhance existing items',
  },
};

// ============================================================================
// Modal Component
// ============================================================================

interface GenerateModalProps {
  type: GenerateType;
  inputsAvailable?: {
    frame: boolean;
    objectives: boolean;
    bets: boolean;
  };
  confirmedContextCount?: number;
  existingCount?: number;
  acceptedCount?: number;
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: (mode: GenerateMode, guidance?: string) => void;
}

function GenerateModal({
  type,
  inputsAvailable,
  confirmedContextCount,
  existingCount = 0,
  acceptedCount = 0,
  isGenerating,
  onClose,
  onGenerate,
}: GenerateModalProps) {
  const [selectedMode, setSelectedMode] = useState<GenerateMode>('create');
  const [guidance, setGuidance] = useState('');

  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  // Check confirmed context threshold
  const hasEnoughContext = (confirmedContextCount ?? 0) >= CONFIRMED_CONTEXT_THRESHOLD;
  const contextNeeded = CONFIRMED_CONTEXT_THRESHOLD - (confirmedContextCount ?? 0);

  // Determine which inputs are needed and available
  const inputStatus = {
    Frame: inputsAvailable?.frame ?? false,
    Objectives: inputsAvailable?.objectives ?? false,
    'Accepted Bets': inputsAvailable?.bets ?? false,
  };

  // Check if all required inputs are available
  const missingInputs = config.requiredInputs.filter(
    (input) => !inputStatus[input as keyof typeof inputStatus]
  );

  // Must have enough confirmed context AND all required strategy inputs
  const canGenerate = hasEnoughContext && missingInputs.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                Generate {config.label}
              </h3>
              <p className="text-xs text-slate-500">AI-powered generation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Context Status */}
          <div>
            <p className="text-xs text-slate-400 mb-2">Context readiness:</p>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                  hasEnoughContext
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {hasEnoughContext ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {confirmedContextCount ?? 0}/{CONFIRMED_CONTEXT_THRESHOLD} confirmed
              </span>
            </div>
          </div>

          {/* Inputs Status */}
          <div>
            <p className="text-xs text-slate-400 mb-2">Strategy inputs:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(inputStatus).map(([key, available]) => (
                <span
                  key={key}
                  className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                    available
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  {available ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  {key}
                </span>
              ))}
            </div>
          </div>

          {/* Insufficient Context Warning */}
          {!hasEnoughContext && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-400 font-medium">
                    Insufficient confirmed context
                  </p>
                  <p className="text-xs text-amber-300/70 mt-0.5">
                    Confirm {contextNeeded} more context field{contextNeeded > 1 ? 's' : ''} to enable AI generation.
                    Go to the Context page to review and confirm proposed values.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Missing Strategy Inputs Warning */}
          {hasEnoughContext && missingInputs.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-400 font-medium">
                    Missing required inputs
                  </p>
                  <p className="text-xs text-amber-300/70 mt-0.5">
                    {missingInputs.join(', ')} required for generating {config.label.toLowerCase()}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div>
            <p className="text-xs text-slate-400 mb-2">Generation mode:</p>
            <div className="space-y-2">
              {(Object.entries(MODE_CONFIG) as [GenerateMode, typeof MODE_CONFIG[GenerateMode]][]).map(
                ([mode, modeConfig]) => {
                  const ModeIcon = modeConfig.icon;
                  const isSelected = selectedMode === mode;

                  // Disable "replace" if there are accepted items for bets
                  const isDisabled =
                    mode === 'replace' && type === 'bets' && acceptedCount > 0;

                  return (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'bg-purple-500/10 border-purple-500/50'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`p-1.5 rounded ${
                          isSelected ? 'bg-purple-500/20' : 'bg-slate-700'
                        }`}
                      >
                        <ModeIcon
                          className={`w-4 h-4 ${
                            isSelected ? 'text-purple-400' : 'text-slate-400'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            isSelected ? 'text-purple-300' : 'text-slate-200'
                          }`}
                        >
                          {modeConfig.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {modeConfig.description}
                          {isDisabled && ' (has accepted bets)'}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Guidance Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Optional guidance:
            </label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder={`E.g., "Focus on growth objectives" or "Include channel-specific tactics"`}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
              rows={2}
            />
          </div>

          {/* Summary */}
          {existingCount > 0 && (
            <div className="p-2 bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-400">
                Current: {existingCount} {config.singular}
                {existingCount !== 1 ? 's' : ''}
                {type === 'bets' && acceptedCount > 0 && (
                  <span className="text-emerald-400 ml-1">
                    ({acceptedCount} accepted)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(selectedMode, guidance || undefined)}
            disabled={!canGenerate || isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ColumnAIGenerateButton({
  type,
  onGenerate,
  isGenerating = false,
  inputsAvailable,
  confirmedContextCount,
  existingCount,
  acceptedCount,
  disabled = false,
  size = 'sm',
}: ColumnAIGenerateButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const handleGenerate = useCallback(
    async (mode: GenerateMode, guidance?: string) => {
      await onGenerate(mode, guidance);
      setShowModal(false);
    },
    [onGenerate]
  );

  const buttonClass =
    size === 'sm'
      ? 'px-2 py-1 text-xs'
      : 'px-3 py-1.5 text-sm';

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled || isGenerating}
        className={`
          flex items-center gap-1.5 ${buttonClass}
          text-purple-400 hover:bg-purple-500/10 rounded
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title={`AI Generate ${TYPE_CONFIG[type].label}`}
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        AI Generate
      </button>

      {showModal && (
        <GenerateModal
          type={type}
          inputsAvailable={inputsAvailable}
          confirmedContextCount={confirmedContextCount}
          existingCount={existingCount}
          acceptedCount={acceptedCount}
          isGenerating={isGenerating}
          onClose={() => setShowModal(false)}
          onGenerate={handleGenerate}
        />
      )}
    </>
  );
}

export default ColumnAIGenerateButton;
