'use client';

// components/os/IntentSelector.tsx
// Decision Entry Point for Company Overview
//
// Shows "What do you need help with?" cards to help new users
// understand what to do first and capture their primary intent.
// For diagnostic intents, shows a confirmation drawer with recommended labs.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  TrendingDown,
  HelpCircle,
  Map,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import {
  DiagnosticConfirmationDrawer,
  type RecommendedDiagnostic,
} from './DiagnosticConfirmationDrawer';

// ============================================================================
// Types
// ============================================================================

export type PrimaryIntent =
  | 'website_underperforming'
  | 'leads_are_low'
  | 'not_sure'
  | 'planning_roadmap';

interface IntentOption {
  id: PrimaryIntent;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  hoverBorderColor: string;
  destination: string; // Path to navigate to (relative to company)
  /** If true, shows confirmation drawer with recommended diagnostics */
  usesDiagnostics?: boolean;
}

// ============================================================================
// Intent to Diagnostic Mapping (AI-First: One recommendation per intent)
// ============================================================================

const INTENT_RECOMMENDATIONS: Record<PrimaryIntent, RecommendedDiagnostic> = {
  website_underperforming: {
    toolId: 'websiteLab',
    label: 'Website Lab',
    shortLabel: 'Website',
    description: 'Multi-page UX & conversion diagnostic. Evaluates page structure, CTAs, messaging clarity, and conversion optimization.',
    estimatedMinutes: 4,
    runApiPath: '/api/os/diagnostics/run/website-lab',
    urlSlug: 'website-lab',
    followUpHint: 'we may recommend SEO Lab or GAP IA as a next step.',
  },
  leads_are_low: {
    toolId: 'demandLab',
    label: 'Demand Lab',
    shortLabel: 'Demand',
    description: 'Company-type aware demand generation diagnostic across channel mix, targeting, creative, funnel, and measurement.',
    estimatedMinutes: 3,
    runApiPath: '/api/os/diagnostics/run/demand-lab',
    urlSlug: 'demand-lab',
    followUpHint: 'we may recommend Ops Lab or Website Lab as a next step.',
  },
  not_sure: {
    toolId: 'gapIa',
    label: 'GAP IA',
    shortLabel: 'Quick Assessment',
    description: 'Quick AI-powered assessment. Get a baseline of marketing health across brand, website, content, and SEO in under 2 minutes.',
    estimatedMinutes: 2,
    runApiPath: '/api/os/diagnostics/run/gap-snapshot',
    urlSlug: 'gap-ia',
    followUpHint: 'we may recommend a Full GAP or specific lab based on findings.',
  },
  planning_roadmap: {
    toolId: 'gapPlan',
    label: 'Full GAP',
    shortLabel: 'Full Plan',
    description: 'Comprehensive Growth Acceleration Plan with strategic initiatives, quick wins, and 90-day roadmap.',
    estimatedMinutes: 5,
    runApiPath: '/api/os/diagnostics/run/gap-plan',
    urlSlug: 'gap-plan',
    followUpHint: 'we may recommend specific labs to deep-dive on priority areas.',
  },
};

interface IntentSelectorProps {
  companyId: string;
  currentIntent?: PrimaryIntent | null;
  onDismiss?: () => void;
}

// ============================================================================
// Intent Options Configuration
// ============================================================================

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'website_underperforming',
    label: 'Website underperforming',
    description: 'Traffic, conversions, or engagement are below expectations',
    icon: <Globe className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    hoverBorderColor: 'hover:border-blue-500/50',
    destination: '/diagnostics',
    usesDiagnostics: true,
  },
  {
    id: 'leads_are_low',
    label: 'Leads are low',
    description: 'Not getting enough qualified leads or conversions',
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    hoverBorderColor: 'hover:border-amber-500/50',
    destination: '/diagnostics',
    usesDiagnostics: true,
  },
  {
    id: 'not_sure',
    label: 'Not sure where to start',
    description: 'Need a complete assessment of current state',
    icon: <HelpCircle className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    hoverBorderColor: 'hover:border-purple-500/50',
    destination: '/diagnostics',
    usesDiagnostics: true,
  },
  {
    id: 'planning_roadmap',
    label: 'Planning / roadmap',
    description: 'Ready to build a strategic plan for the quarter',
    icon: <Map className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    hoverBorderColor: 'hover:border-emerald-500/50',
    destination: '/diagnostics',
    usesDiagnostics: true,
  },
];

// ============================================================================
// Component
// ============================================================================

export function IntentSelector({
  companyId,
  currentIntent,
  onDismiss,
}: IntentSelectorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<PrimaryIntent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIntent, setDrawerIntent] = useState<IntentOption | null>(null);

  const saveIntent = async (intentId: PrimaryIntent) => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: intentId }),
      });

      if (!response.ok) {
        console.error('Failed to save intent');
      }
    } catch (error) {
      console.error('Error saving intent:', error);
    }
  };

  const handleSelectIntent = async (option: IntentOption) => {
    setSelectedIntent(option.id);
    setSaving(true);

    // Save intent in background
    saveIntent(option.id);

    // For diagnostic intents, show confirmation drawer
    if (option.usesDiagnostics) {
      setDrawerIntent(option);
      setDrawerOpen(true);
      setSaving(false);
      return;
    }

    // For non-diagnostic intents, navigate directly
    router.push(`/c/${companyId}${option.destination}`);
    setSaving(false);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setDrawerIntent(null);
    setSelectedIntent(null);
  };

  // If already has an intent and onDismiss provided, show dismissible version
  const showDismiss = currentIntent && onDismiss;

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              What do you need help with?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your primary goal to get personalized recommendations
            </p>
          </div>
          {showDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Intent Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {INTENT_OPTIONS.map((option) => {
            const isSelected = selectedIntent === option.id;
            const isCurrentIntent = currentIntent === option.id;

            return (
              <button
                key={option.id}
                onClick={() => handleSelectIntent(option)}
                disabled={saving}
                className={`
                  relative flex flex-col items-start p-4 rounded-lg border
                  transition-all duration-200 text-left
                  ${option.bgColor} ${option.borderColor} ${option.hoverBorderColor}
                  hover:bg-opacity-20 hover:-translate-y-0.5
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isCurrentIntent ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500' : ''}
                `}
              >
                {/* Icon */}
                <div className={`mb-2 ${option.color}`}>
                  {option.icon}
                </div>

                {/* Label */}
                <h3 className="text-sm font-medium text-white mb-1">
                  {option.label}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                  {option.description}
                </p>

                {/* Action indicator */}
                <div className={`flex items-center gap-1 text-xs ${option.color} mt-auto`}>
                  {isSelected && saving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>Get started</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </div>

                {/* Current intent badge */}
                {isCurrentIntent && (
                  <span className="absolute top-2 right-2 text-[10px] text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Diagnostic Confirmation Drawer */}
      {drawerIntent && (
        <DiagnosticConfirmationDrawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          companyId={companyId}
          intentLabel={drawerIntent.label}
          intentDescription={drawerIntent.description}
          recommendation={INTENT_RECOMMENDATIONS[drawerIntent.id]}
        />
      )}
    </>
  );
}

export default IntentSelector;
