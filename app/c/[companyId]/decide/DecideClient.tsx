'use client';

// app/c/[companyId]/decide/DecideClient.tsx
// Decide Phase Client Component
//
// Landing page for Phase 2: Decide
// Shows the Review sub-view with links to Context and Strategy pages.
//
// Now uses DecideShell for consistent sub-navigation across all Decide pages.
// The DecideShell handles navigation to /context and /strategy.
// This component focuses on the Review experience.
//
// UI state is derived from a single selector: getDecideUIState()

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  Settings2,
  Search,
  ChevronRight,
} from 'lucide-react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import {
  getDecideUIState,
  type DecideUIState,
  type DecideDataInput,
  type DecideSubView,
} from '@/lib/os/ui/decideUiState';
import { DecideShell } from '@/components/os/decide/DecideShell';

// ============================================================================
// Types
// ============================================================================

interface DecideClientProps {
  companyId: string;
  companyName: string;
}

// ============================================================================
// Component
// ============================================================================

export function DecideClient({ companyId, companyName }: DecideClientProps) {
  const router = useRouter();
  const [contextHealth, setContextHealth] = useState<V4HealthResponse | null>(null);
  const [strategyExists, setStrategyExists] = useState(false);
  const [strategyLocked, setStrategyLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, strategyRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/health`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/strategy/view-model`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);

      if (healthRes?.ok) {
        const health = await healthRes.json();
        setContextHealth(health);
      }

      if (strategyRes?.ok) {
        const data = await strategyRes.json();
        setStrategyExists(!!data.strategy?.id);
        setStrategyLocked(data.strategy?.locked ?? false);
      }
    } catch (err) {
      console.error('[DecideClient] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive UI state from selector
  const dataInput: DecideDataInput = {
    contextHealth,
    strategyExists,
    strategyLocked,
  };
  const uiState: DecideUIState = getDecideUIState(dataInput, companyId);

  // Handle URL hash-based redirects on mount
  // If user navigates to /decide#context, redirect to /context
  // If user navigates to /decide#strategy, redirect to /strategy
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'context') {
        router.replace(`/c/${companyId}/context`);
      } else if (hash === 'strategy') {
        router.replace(`/c/${companyId}/strategy`);
      }
      // #review stays on this page (or no hash)
    }
  }, [companyId, router]);

  // Navigate to context or strategy pages
  // NOTE: Must be before any early returns to satisfy Rules of Hooks
  const navigateToContext = useCallback(() => {
    router.push(`/c/${companyId}/context`);
  }, [companyId, router]);

  const navigateToStrategy = useCallback(() => {
    router.push(`/c/${companyId}/strategy`);
  }, [companyId, router]);

  // Derived values for UI
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const hasLabsRun = contextHealth?.websiteLab?.hasRun ?? false;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Decide</h1>
          <p className="text-xs text-purple-400/80 mt-0.5">Phase 2</p>
          <p className="text-sm text-slate-400 mt-1">
            Confirm what&apos;s true and commit to a strategy.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <DecideShell companyId={companyId} activeSubView="review" preloadedUIState={uiState}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Decide</h1>
        <p className="text-xs text-purple-400/80 mt-0.5">Phase 2</p>
        <p className="text-sm text-slate-400 mt-1">
          Confirm what&apos;s true and commit to a strategy.
        </p>
      </div>

      {/* Gate intro */}
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
        <p className="text-sm text-purple-300/90">
          Everything created after this point is based on the decisions made here.
        </p>
      </div>

      {/* Review Checklist */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
          Decide Phase Checklist
        </h4>
        <ul className="space-y-3">
          {/* Labs discovered */}
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 ${hasLabsRun ? 'text-emerald-400' : 'text-slate-500'}`}>
              {hasLabsRun ? <CheckCircle2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={hasLabsRun ? 'text-sm text-slate-300' : 'text-sm text-slate-500'}>
                  Labs discovered (context extracted)
                </span>
                {!hasLabsRun && (
                  <button
                    onClick={navigateToContext}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    Go to Context
                    <ChevronRight className="w-3 h-3 inline ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </li>

          {/* Context confirmed */}
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 ${confirmedCount >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {confirmedCount >= 3 ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={confirmedCount >= 3 ? 'text-sm text-slate-300' : 'text-sm text-slate-500'}>
                  Strategy inputs confirmed ({confirmedCount}/3 minimum)
                </span>
                <button
                  onClick={navigateToContext}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Open Context
                  <ChevronRight className="w-3 h-3 inline ml-0.5" />
                </button>
              </div>
            </div>
          </li>

          {/* Strategy generated */}
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 ${strategyExists ? 'text-emerald-400' : 'text-slate-500'}`}>
              {strategyExists ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={strategyExists ? 'text-sm text-slate-300' : 'text-sm text-slate-500'}>
                  Strategy framing saved
                </span>
                <button
                  onClick={navigateToStrategy}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Open Strategy
                  <ChevronRight className="w-3 h-3 inline ml-0.5" />
                </button>
              </div>
            </div>
          </li>
        </ul>
        <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-700/50">
          Complete all items to unlock the Deliver phase.
        </p>
      </div>

      {/* Review-specific CTA */}
      {uiState.primaryCTA && uiState.state === 'strategy_locked' && (
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ready</p>
              <p className="text-base font-medium text-white">{uiState.statusSummary}</p>
            </div>
            <Link
              href={uiState.primaryCTA.href}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                uiState.primaryCTA.variant === 'primary'
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              {uiState.primaryCTA.label}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* AI Quality Link (always visible in Review) */}
      <Link
        href={`/c/${companyId}/readiness`}
        className="block bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 transition-all hover:border-purple-500/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-medium text-white">AI Quality</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Quality signals for AI-generated content
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Advanced checks—most users won&apos;t need this.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">View details</span>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </Link>
    </DecideShell>
  );
}

export default DecideClient;
