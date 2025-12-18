'use client';

// components/os/overview/BusinessNeedSelector.tsx
// Business Need Selector - Primary Entry Point for Overview
//
// "What are you trying to accomplish right now?"
//
// This is the most important element on the Overview page.
// It drives AI recommendations and highlights relevant strategy/plays.
// The selection is transient (session-scoped), not permanent company data.

import { useState, useCallback } from 'react';
import {
  TrendingUp,
  Target,
  Rocket,
  Search,
  Scale,
  Stethoscope,
  MessageSquare,
  Check,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface BusinessNeed {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export interface ActiveBusinessNeed {
  key: string;
  label: string;
  createdAt: string;
}

export interface BusinessNeedSelectorProps {
  companyId: string;
  activeNeed: ActiveBusinessNeed | null;
  onSelectNeed: (need: BusinessNeed | null) => void;
  /** Optional: Custom needs passed in */
  customNeeds?: BusinessNeed[];
  /** Compact mode for when a need is already selected */
  compact?: boolean;
  /** AI-recommended business need (from diagnostics analysis) */
  aiRecommendedNeed?: BusinessNeed | null;
  /** Reason for AI recommendation */
  aiRecommendationReason?: string;
  /** Whether AI recommendation is loading */
  aiRecommendationLoading?: boolean;
  /** Callback to request AI recommendation */
  onRequestAiRecommendation?: () => void;
}

// ============================================================================
// Default Business Needs
// ============================================================================

export const DEFAULT_BUSINESS_NEEDS: BusinessNeed[] = [
  {
    key: 'increase_leads',
    label: 'Increase Leads',
    description: 'Get more qualified prospects into your pipeline',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    key: 'improve_conversion',
    label: 'Improve Conversion',
    description: 'Turn more visitors into customers',
    icon: <Target className="w-5 h-5" />,
  },
  {
    key: 'launch_offering',
    label: 'Launch or Reposition',
    description: 'Introduce or reframe a product or service',
    icon: <Rocket className="w-5 h-5" />,
  },
  {
    key: 'fix_seo',
    label: 'Fix SEO / Traffic',
    description: 'Address declining search visibility',
    icon: <Search className="w-5 h-5" />,
  },
  {
    key: 'prepare_growth',
    label: 'Prepare for Growth',
    description: 'Scale operations and marketing capacity',
    icon: <Scale className="w-5 h-5" />,
  },
  {
    key: 'diagnose_issues',
    label: 'Diagnose Issues',
    description: 'Understand what\'s not working',
    icon: <Stethoscope className="w-5 h-5" />,
  },
];

// ============================================================================
// Component
// ============================================================================

export function BusinessNeedSelector({
  companyId,
  activeNeed,
  onSelectNeed,
  customNeeds,
  compact = false,
  aiRecommendedNeed,
  aiRecommendationReason,
  aiRecommendationLoading = false,
  onRequestAiRecommendation,
}: BusinessNeedSelectorProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const needs = customNeeds ?? DEFAULT_BUSINESS_NEEDS;

  const handleSelectNeed = useCallback((need: BusinessNeed) => {
    onSelectNeed(need);
    setShowCustomInput(false);
    setCustomInput('');
  }, [onSelectNeed]);

  const handleClearNeed = useCallback(() => {
    onSelectNeed(null);
  }, [onSelectNeed]);

  const handleCustomSubmit = useCallback(() => {
    if (customInput.trim()) {
      const customNeed: BusinessNeed = {
        key: 'custom',
        label: customInput.trim(),
        description: 'Custom business need',
        icon: <MessageSquare className="w-5 h-5" />,
      };
      onSelectNeed(customNeed);
      setShowCustomInput(false);
      setCustomInput('');
    }
  }, [customInput, onSelectNeed]);

  // Compact mode: show active need with change button
  if (compact && activeNeed) {
    const matchedNeed = needs.find(n => n.key === activeNeed.key);
    const icon = matchedNeed?.icon ?? <MessageSquare className="w-5 h-5" />;

    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              {icon}
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Working on</p>
              <p className="text-sm font-medium text-white">{activeNeed.label}</p>
            </div>
          </div>
          <button
            onClick={handleClearNeed}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Change focus
          </button>
        </div>
      </div>
    );
  }

  // Full selector mode
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-2">
        What are you trying to accomplish right now?
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Select a focus to get tailored recommendations and surface relevant strategy.
      </p>

      {/* AI Recommendation Card (if available) */}
      {(aiRecommendedNeed || onRequestAiRecommendation) && (
        <div className="mb-4">
          {aiRecommendedNeed ? (
            <button
              onClick={() => handleSelectNeed(aiRecommendedNeed)}
              className={`
                w-full p-4 rounded-xl border text-left transition-all
                ${activeNeed?.key === aiRecommendedNeed.key
                  ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/30'
                  : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:border-purple-500/50'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                      AI Recommended
                    </span>
                    {activeNeed?.key === aiRecommendedNeed.key && (
                      <Check className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-white mb-1">
                    {aiRecommendedNeed.label}
                  </p>
                  {aiRecommendationReason && (
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {aiRecommendationReason}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ) : onRequestAiRecommendation ? (
            <button
              onClick={onRequestAiRecommendation}
              disabled={aiRecommendationLoading}
              className="w-full p-4 rounded-xl border border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  {aiRecommendationLoading ? (
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-300">
                    {aiRecommendationLoading ? 'Analyzing...' : 'Let AI suggest a focus'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Based on your diagnostics and context
                  </p>
                </div>
              </div>
            </button>
          ) : null}
        </div>
      )}

      {/* Need Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {needs.map((need) => {
          const isActive = activeNeed?.key === need.key;
          const isAiRecommended = aiRecommendedNeed?.key === need.key;

          return (
            <button
              key={need.key}
              onClick={() => handleSelectNeed(need)}
              className={`
                relative p-4 rounded-xl border text-left transition-all
                ${isActive
                  ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/30'
                  : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }
              `}
            >
              {isActive && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-blue-400" />
                </div>
              )}
              {isAiRecommended && !isActive && (
                <div className="absolute top-2 right-2">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                </div>
              )}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center mb-3
                ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400'}
              `}>
                {need.icon}
              </div>
              <p className={`text-sm font-medium mb-1 ${isActive ? 'text-blue-300' : 'text-white'}`}>
                {need.label}
              </p>
              <p className="text-xs text-slate-400 line-clamp-2">
                {need.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Custom Input */}
      {showCustomInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Describe what you're working on..."
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomSubmit();
              if (e.key === 'Escape') setShowCustomInput(false);
            }}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Set Focus
          </button>
          <button
            onClick={() => {
              setShowCustomInput(false);
              setCustomInput('');
            }}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCustomInput(true)}
          className="w-full px-4 py-3 bg-slate-800/50 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 text-sm transition-colors"
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Something else...
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Hook for Managing Business Need State
// ============================================================================

const STORAGE_KEY = 'hive-active-business-need';

export function useBusinessNeed(companyId: string) {
  const [activeNeed, setActiveNeedState] = useState<ActiveBusinessNeed | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEY}-${companyId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setActiveNeed = useCallback((need: BusinessNeed | null) => {
    if (need) {
      const activeNeed: ActiveBusinessNeed = {
        key: need.key,
        label: need.label,
        createdAt: new Date().toISOString(),
      };
      setActiveNeedState(activeNeed);
      try {
        sessionStorage.setItem(`${STORAGE_KEY}-${companyId}`, JSON.stringify(activeNeed));
      } catch {
        // sessionStorage not available
      }
    } else {
      setActiveNeedState(null);
      try {
        sessionStorage.removeItem(`${STORAGE_KEY}-${companyId}`);
      } catch {
        // sessionStorage not available
      }
    }
  }, [companyId]);

  return { activeNeed, setActiveNeed };
}
