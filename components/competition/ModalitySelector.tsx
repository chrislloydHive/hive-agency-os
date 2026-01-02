// components/competition/ModalitySelector.tsx
// Pre-run modality selector for Competition Lab V4
//
// UX Philosophy:
// - Default: "Auto (Recommended)" - system infers modality from context
// - If confidence low: Show ONE simple Yes/No clarifying question
// - Advanced: Manual selection hidden behind toggle for power users

'use client';

import { useState } from 'react';
import type { CustomerComparisonMode, CompetitiveModalityType } from '@/lib/competition-v4/types';
import type { ClarifyingQuestion, ModalityInferenceResult } from '@/lib/competition-v4/modalityInference';

// ============================================================================
// Props & Types
// ============================================================================

export interface ModalitySelectorProps {
  /** Called when user selects/confirms modality */
  onSelect: (modality: CompetitiveModalityType, modes: CustomerComparisonMode[]) => void;
  /** Called when user skips selection (uses Auto) */
  onSkip?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Pre-computed inference result from backend (optional) */
  inferenceResult?: ModalityInferenceResult | null;
}

type SelectionMode = 'auto' | 'manual';

interface ComparisonOption {
  id: CustomerComparisonMode;
  label: string;
  description: string;
  icon: string;
}

// ============================================================================
// Constants
// ============================================================================

const COMPARISON_OPTIONS: ComparisonOption[] = [
  {
    id: 'national_retailers',
    label: 'National retailers',
    description: 'Large chains with wide reach',
    icon: '🏬',
  },
  {
    id: 'local_installers',
    label: 'Local installers',
    description: 'Local service shops and specialists',
    icon: '🔧',
  },
  {
    id: 'diy_online',
    label: 'DIY / Online',
    description: 'E-commerce and self-service options',
    icon: '🛒',
  },
  {
    id: 'direct_competitors',
    label: 'Direct competitors',
    description: 'Businesses exactly like yours',
    icon: '🎯',
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Infer CompetitiveModality from selected comparison modes (manual mode)
 */
function inferModalityFromModes(modes: CustomerComparisonMode[]): CompetitiveModalityType {
  const hasNational = modes.includes('national_retailers') || modes.includes('big_box_stores');
  const hasLocal = modes.includes('local_installers');
  const hasDiy = modes.includes('diy_online');
  const hasDirect = modes.includes('direct_competitors');

  // If comparing with both national retailers AND local installers, likely hybrid
  if ((hasNational || hasDirect) && hasLocal) {
    return 'Retail+Installation';
  }

  // If only local installers, likely installation-focused
  if (hasLocal && !hasNational && !hasDiy) {
    return 'InstallationOnly';
  }

  // If national retailers with DIY but no local, likely retail with optional install
  if (hasNational && hasDiy && !hasLocal) {
    return 'RetailWithInstallAddon';
  }

  // If only DIY/online, likely product-only
  if (hasDiy && !hasLocal && !hasNational) {
    return 'ProductOnly';
  }

  // Default based on most common selection
  if (hasNational || hasDirect) {
    return 'RetailWithInstallAddon';
  }

  return 'ProductOnly';
}

/**
 * Format modality for display
 */
function formatModality(modality: CompetitiveModalityType): string {
  const labels: Record<CompetitiveModalityType, string> = {
    'Retail+Installation': 'Retail + Installation',
    InstallationOnly: 'Service / Installation Only',
    RetailWithInstallAddon: 'Retail with Optional Install',
    ProductOnly: 'Product Only',
    InternalAlternative: 'Internal Alternative',
  };
  return labels[modality] || modality;
}

// ============================================================================
// Clarifying Question Component
// ============================================================================

interface ClarifyingQuestionProps {
  question: ClarifyingQuestion;
  onAnswer: (answer: 'yes' | 'no') => void;
  isLoading?: boolean;
}

function ClarifyingQuestionUI({ question, onAnswer, isLoading }: ClarifyingQuestionProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-white text-base mb-1">{question.question}</p>
        <p className="text-xs text-slate-500">{question.context}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onAnswer('yes')}
          disabled={isLoading}
          className="flex-1 px-4 py-3 text-sm font-medium rounded-lg border border-green-600 bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors disabled:opacity-50"
        >
          Yes
        </button>
        <button
          onClick={() => onAnswer('no')}
          disabled={isLoading}
          className="flex-1 px-4 py-3 text-sm font-medium rounded-lg border border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
        >
          No
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component: Auto Mode with Optional Manual
// ============================================================================

export function ModalitySelector({
  onSelect,
  onSkip,
  isLoading,
  inferenceResult,
}: ModalitySelectorProps) {
  const [mode, setMode] = useState<SelectionMode>('auto');
  const [selectedModes, setSelectedModes] = useState<CustomerComparisonMode[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Determine if we should show clarifying question
  const shouldShowClarification =
    mode === 'auto' &&
    inferenceResult?.clarifyingQuestion &&
    inferenceResult.confidence < 60;

  const toggleMode = (comparisonMode: CustomerComparisonMode) => {
    setSelectedModes((prev) =>
      prev.includes(comparisonMode)
        ? prev.filter((m) => m !== comparisonMode)
        : [...prev, comparisonMode]
    );
  };

  // Handle "Run with Auto" - use inferred modality
  const handleAutoRun = () => {
    const modality = inferenceResult?.modality || 'ProductOnly';
    onSelect(modality, []);
  };

  // Handle manual mode selection
  const handleManualRun = () => {
    const modality = inferModalityFromModes(selectedModes);
    onSelect(modality, selectedModes);
  };

  // Handle clarifying question answer
  const handleClarificationAnswer = (answer: 'yes' | 'no') => {
    if (!inferenceResult?.clarifyingQuestion) return;

    const modality =
      answer === 'yes'
        ? inferenceResult.clarifyingQuestion.yesImplies
        : inferenceResult.clarifyingQuestion.noImplies;

    onSelect(modality, []);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 max-w-lg mx-auto">
      {/* Header */}
      <h3 className="text-lg font-medium text-white mb-2">Competitor Analysis</h3>

      {/* Show clarifying question if needed */}
      {shouldShowClarification && inferenceResult?.clarifyingQuestion ? (
        <div className="mb-6">
          <p className="text-sm text-slate-400 mb-4">
            We need one quick clarification to find the right competitors:
          </p>
          <ClarifyingQuestionUI
            question={inferenceResult.clarifyingQuestion}
            onAnswer={handleClarificationAnswer}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <>
          {/* Auto Mode (Default) */}
          <p className="text-sm text-slate-400 mb-4">
            We&apos;ll automatically find competitors based on your business profile.
          </p>

          {/* Show inferred modality if available */}
          {inferenceResult && mode === 'auto' && (
            <div className="mb-4 px-3 py-2 bg-slate-800 rounded text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Analysis type:</span>
                <span className="text-white font-medium">
                  {formatModality(inferenceResult.modality)}
                </span>
              </div>
              {inferenceResult.confidence >= 60 && (
                <div className="mt-1 text-xs text-slate-500">
                  {inferenceResult.explanation}
                </div>
              )}
            </div>
          )}

          {/* Primary CTA: Run Auto */}
          <button
            onClick={handleAutoRun}
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 mb-3"
          >
            {isLoading ? 'Running Analysis...' : 'Run Analysis'}
          </button>

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors py-1"
          >
            {showAdvanced ? '▼ Hide advanced options' : '▶ Advanced options'}
          </button>

          {/* Manual Mode (Advanced) */}
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-400 mb-3">
                Or customize how we find competitors:
              </p>

              <div className="space-y-2 mb-4">
                {COMPARISON_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleMode(option.id)}
                    disabled={isLoading}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                      selectedModes.includes(option.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="text-lg">{option.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          selectedModes.includes(option.id) ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {option.label}
                      </div>
                      <div className="text-xs text-slate-500">{option.description}</div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedModes.includes(option.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-slate-600'
                      }`}
                    >
                      {selectedModes.includes(option.id) && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Manual mode preview */}
              {selectedModes.length > 0 && (
                <div className="mb-3 px-3 py-2 bg-slate-800 rounded text-xs text-slate-400">
                  <span className="text-slate-500">Competitive modality:</span>{' '}
                  <span className="text-slate-300">
                    {formatModality(inferModalityFromModes(selectedModes))}
                  </span>
                </div>
              )}

              {/* Manual Run Button */}
              <button
                onClick={handleManualRun}
                disabled={selectedModes.length === 0 || isLoading}
                className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedModes.length > 0 && !isLoading
                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? 'Running...' : 'Run with Custom Settings'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Compact Inline Version (for embedding in existing UI)
// ============================================================================

export function ModalitySelectorInline({
  selectedModes,
  onChange,
  disabled,
}: {
  selectedModes: CustomerComparisonMode[];
  onChange: (modes: CustomerComparisonMode[]) => void;
  disabled?: boolean;
}) {
  const toggleMode = (mode: CustomerComparisonMode) => {
    onChange(
      selectedModes.includes(mode)
        ? selectedModes.filter((m) => m !== mode)
        : [...selectedModes, mode]
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {COMPARISON_OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => toggleMode(option.id)}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
            selectedModes.includes(option.id)
              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
              : 'border-slate-700 text-slate-400 hover:border-slate-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title={option.description}
        >
          {option.icon} {option.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Standalone Clarifying Question (for post-run clarification)
// ============================================================================

export function ClarifyingQuestionStandalone({
  question,
  onAnswer,
  isLoading,
}: {
  question: ClarifyingQuestion;
  onAnswer: (modality: CompetitiveModalityType) => void;
  isLoading?: boolean;
}) {
  const handleAnswer = (answer: 'yes' | 'no') => {
    const modality = answer === 'yes' ? question.yesImplies : question.noImplies;
    onAnswer(modality);
  };

  return (
    <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
      <div className="flex gap-3 items-start">
        <span className="text-amber-400 text-lg">?</span>
        <div className="flex-1">
          <p className="text-white text-sm mb-1">{question.question}</p>
          <p className="text-xs text-slate-400 mb-3">{question.context}</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleAnswer('yes')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded border border-green-600 bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors disabled:opacity-50"
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer('no')}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Exports
export { inferModalityFromModes as inferModality };
export type { ClarifyingQuestion };
