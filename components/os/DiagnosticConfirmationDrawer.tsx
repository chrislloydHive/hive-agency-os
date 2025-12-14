'use client';

// components/os/DiagnosticConfirmationDrawer.tsx
// AI-First Diagnostic Confirmation Drawer
//
// Shows a single, prescriptive recommendation based on user's intent.
// The OS behaves like an expert, not a menu - no choice overload.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  Play,
  Clock,
  Zap,
  Globe,
  TrendingUp,
  FileText,
  Layers,
  Sparkles,
  Search,
  Settings,
  FileEdit,
  Lightbulb,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface RecommendedDiagnostic {
  toolId: string;
  label: string;
  shortLabel?: string;
  description: string;
  estimatedMinutes?: number;
  runApiPath: string;
  urlSlug: string;
  /** What the AI might recommend after this diagnostic completes */
  followUpHint?: string;
}

interface DiagnosticConfirmationDrawerProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  intentLabel: string;
  intentDescription: string;
  /** Single recommended diagnostic - AI chooses, not the user */
  recommendation: RecommendedDiagnostic;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const toolIcons: Record<string, React.ReactNode> = {
  gapIa: <Zap className="w-5 h-5" />,
  gapPlan: <FileText className="w-5 h-5" />,
  gapHeavy: <Layers className="w-5 h-5" />,
  websiteLab: <Globe className="w-5 h-5" />,
  brandLab: <Sparkles className="w-5 h-5" />,
  contentLab: <FileEdit className="w-5 h-5" />,
  seoLab: <Search className="w-5 h-5" />,
  demandLab: <TrendingUp className="w-5 h-5" />,
  opsLab: <Settings className="w-5 h-5" />,
};

// ============================================================================
// Component
// ============================================================================

export function DiagnosticConfirmationDrawer({
  open,
  onClose,
  companyId,
  intentLabel,
  intentDescription,
  recommendation,
}: DiagnosticConfirmationDrawerProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunDiagnostic = async () => {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch(recommendation.runApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start diagnostic');
      }

      const data = await response.json();
      const runId = data.runId || data.id;

      if (runId) {
        // Navigate to the report page
        router.push(`/c/${companyId}/diagnostics/${recommendation.urlSlug}/${runId}`);
      } else {
        // Fallback to blueprint if no run ID
        router.push(`/c/${companyId}/blueprint`);
      }
    } catch (err) {
      console.error('Error running diagnostic:', err);
      setError(err instanceof Error ? err.message : 'Failed to start diagnostic');
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{intentLabel}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{intentDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* AI Recommendation Badge */}
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Lightbulb className="w-3.5 h-3.5" />
            <span className="font-medium">Recommended first step</span>
          </div>

          {/* Single Recommendation */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                {toolIcons[recommendation.toolId] || <Zap className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-white">
                  {recommendation.label}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {recommendation.description}
                </p>
                {recommendation.estimatedMinutes && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>~{recommendation.estimatedMinutes} min</span>
                  </div>
                )}
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunDiagnostic}
              disabled={running}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run {recommendation.shortLabel || recommendation.label}
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Follow-up Hint - What AI might recommend next */}
          {recommendation.followUpHint && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500">
                <span className="text-slate-400">If issues are found,</span>{' '}
                {recommendation.followUpHint}
              </p>
            </div>
          )}

          {/* Skip Option */}
          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-300 py-2 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default DiagnosticConfirmationDrawer;
