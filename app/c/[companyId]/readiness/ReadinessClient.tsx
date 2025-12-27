'use client';

// app/c/[companyId]/readiness/ReadinessClient.tsx
// Company Flow Readiness Client
//
// Canonical "what should I do next?" view.
// Shows overall readiness + signals + ranked reasons + recommended action.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useContextV4Health } from '@/hooks/useContextV4Health';
import {
  FlowReadinessBanner,
} from '@/components/context-v4/FlowReadinessBanner';
import {
  resolveFlowReadiness,
  contextV4HealthToSignal,
  strategyPresenceToSignal,
  SEVERITY_COLORS,
  STATUS_COLORS,
} from '@/lib/flowReadiness';
import type {
  FlowReadinessResolved,
  FlowReadinessSignal,
} from '@/lib/types/flowReadiness';

// ============================================================================
// Types
// ============================================================================

interface ReadinessClientProps {
  companyId: string;
  companyName: string;
}

interface StrategyPresence {
  hasStrategy: boolean;
  hasObjectives: boolean;
  hasBets: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ReadinessClient({ companyId, companyName }: ReadinessClientProps) {
  const router = useRouter();

  // Context V4 Health (using unified hook)
  const {
    health: v4Health,
    loading: healthLoading,
    error: healthError,
    refresh: refreshHealth,
  } = useContextV4Health(companyId);

  // Strategy presence state
  const [strategyPresence, setStrategyPresence] = useState<StrategyPresence | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(true);

  // Retrigger proposal state
  const [retriggerLoading, setRetriggerLoading] = useState(false);

  // Debug details expansion
  const [showDebug, setShowDebug] = useState(false);

  // Fetch strategy presence
  useEffect(() => {
    let cancelled = false;

    async function fetchStrategyPresence() {
      try {
        setStrategyLoading(true);
        const res = await fetch(`/api/os/companies/${companyId}/strategy/view-model`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          // Strategy API not available, default to no strategy
          setStrategyPresence({ hasStrategy: false, hasObjectives: false, hasBets: false });
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setStrategyPresence({
            hasStrategy: !!data.strategy?.id,
            hasObjectives: Array.isArray(data.strategy?.objectives) && data.strategy.objectives.length > 0,
            hasBets: Array.isArray(data.strategy?.pillars) && data.strategy.pillars.length > 0,
          });
        }
      } catch {
        if (!cancelled) {
          setStrategyPresence({ hasStrategy: false, hasObjectives: false, hasBets: false });
        }
      } finally {
        if (!cancelled) {
          setStrategyLoading(false);
        }
      }
    }

    fetchStrategyPresence();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Compose resolved readiness
  const composedReadiness: FlowReadinessResolved | null = useMemo(() => {
    if (!v4Health) return null;

    const signals: FlowReadinessSignal[] = [];

    // Signal 1: Context V4 Health
    signals.push(contextV4HealthToSignal(v4Health));

    // Signal 2: Strategy Presence (if loaded)
    if (strategyPresence) {
      signals.push(strategyPresenceToSignal({
        ...strategyPresence,
        companyId,
      }));
    }

    return resolveFlowReadiness(signals);
  }, [v4Health, strategyPresence, companyId]);

  // Handle retrigger proposal
  const handleRetriggerProposal = useCallback(async () => {
    setRetriggerLoading(true);
    try {
      await fetch(`/api/os/companies/${companyId}/context/v4/propose-website-lab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await refreshHealth();
      router.refresh();
    } catch (err) {
      console.error('Failed to retrigger proposal:', err);
    } finally {
      setRetriggerLoading(false);
    }
  }, [companyId, refreshHealth, router]);

  // Handle CTA action
  const handleAction = useCallback(async (action: { onClickId?: string; href?: string }) => {
    if (action.href) {
      router.push(action.href);
    } else if (action.onClickId === 'retrigger-proposal') {
      await handleRetriggerProposal();
    }
  }, [router, handleRetriggerProposal]);

  // Loading state
  const loading = healthLoading || strategyLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" />
          <p className="text-slate-400">Loading readiness...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (healthError) {
    return (
      <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-red-300 mb-2">
              Failed to Load Readiness
            </h2>
            <p className="text-red-200/80 mb-4">{healthError}</p>
            <button
              onClick={() => refreshHealth()}
              className="px-4 py-2 bg-red-800/50 hover:bg-red-700/50 text-red-200 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!composedReadiness) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Unable to compute readiness. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-100">AI Quality</h1>
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-400 rounded">
            Advanced
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Quality signals that influence AI-generated content.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          This is an advanced view. Quality issues are surfaced inline in Decide and Deliver phases.
        </p>
      </div>

      {/* Overall Status Block */}
      <FlowReadinessBanner
        readiness={composedReadiness}
        variant="full"
        onRetriggerProposal={handleRetriggerProposal}
        retriggerLoading={retriggerLoading}
      />

      {/* Signals List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Signals</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {composedReadiness.signals.map((signal) => (
            <SignalRow
              key={signal.id}
              signal={signal}
              onAction={handleAction}
            />
          ))}
        </div>
      </div>

      {/* Debug Details (Collapsible) */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <span className="text-xs font-medium text-slate-500">Debug Details</span>
          {showDebug ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {showDebug && (
          <div className="px-4 pb-4 space-y-4">
            {composedReadiness.signals.map((signal) => (
              <SignalDebugPanel key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Signal Row Component
// ============================================================================

interface SignalRowProps {
  signal: FlowReadinessSignal;
  onAction: (action: { onClickId?: string; href?: string }) => void;
}

function SignalRow({ signal, onAction }: SignalRowProps) {
  const colors = SEVERITY_COLORS[signal.severity];
  const primaryCta = signal.ctas?.find(cta => cta.priority === 'primary');

  // Truncate reasons to 2
  const displayReasons = signal.reasons.slice(0, 2);
  const hasMoreReasons = signal.reasons.length > 2;

  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          {/* Signal Label */}
          <span className="text-sm font-medium text-slate-200">{signal.label}</span>

          {/* Severity Badge */}
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text} ${colors.border} border`}
          >
            {signal.severity}
          </span>
        </div>

        {/* Reasons (truncated to 2) */}
        {displayReasons.length > 0 && (
          <div className="mt-1 text-xs text-slate-400">
            {displayReasons.map((r, i) => (
              <span key={r.code}>
                {i > 0 && ' • '}
                {r.label}
              </span>
            ))}
            {hasMoreReasons && (
              <span className="text-slate-500"> (+{signal.reasons.length - 2} more)</span>
            )}
          </div>
        )}
      </div>

      {/* Fix Button (if signal has primary CTA and is not PASS) */}
      {primaryCta && signal.severity !== 'PASS' && (
        <button
          onClick={() => onAction({ href: primaryCta.href, onClickId: primaryCta.onClickId })}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
        >
          {primaryCta.label}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Signal Debug Panel
// ============================================================================

interface SignalDebugPanelProps {
  signal: FlowReadinessSignal;
}

function SignalDebugPanel({ signal }: SignalDebugPanelProps) {
  if (!signal.meta) return null;

  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <h4 className="text-xs font-medium text-slate-400 mb-2">{signal.label} Meta</h4>
      <pre className="text-xs text-slate-500 overflow-x-auto">
        {JSON.stringify(signal.meta, null, 2)}
      </pre>
    </div>
  );
}

export default ReadinessClient;
