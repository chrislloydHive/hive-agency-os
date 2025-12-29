'use client';

// app/c/[companyId]/decide/DecideClient.tsx
// Decide Phase Client Component - Confirmation Gate
//
// Landing page for Phase 2: Decide - "Confirm" subview
// This is a confirmation gate that:
// 1) Confirms decisions are locked
// 2) Communicates consequence
// 3) Provides one dominant forward CTA to Deliver
// 4) Shows readiness checks as informational status (not tasks)
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
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  MoreHorizontal,
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
  const [showReadyPrompt, setShowReadyPrompt] = useState(false);
  const [showDetailsMenu, setShowDetailsMenu] = useState(false);

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
  const allChecksPassed = hasLabsRun && confirmedCount >= 3 && strategyExists;

  // Show "Ready when you are" prompt after 2 seconds if all checks pass
  useEffect(() => {
    if (allChecksPassed && !loading) {
      const timer = setTimeout(() => setShowReadyPrompt(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowReadyPrompt(false);
    }
  }, [allChecksPassed, loading]);

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
      {/* Confirmation Banner - The dominant element */}
      <div className={`rounded-xl p-6 ${
        allChecksPassed
          ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-2 border-emerald-500/40'
          : 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-2 border-amber-500/30'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${
            allChecksPassed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}>
            {allChecksPassed ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className={`text-xl font-bold ${
              allChecksPassed ? 'text-emerald-300' : 'text-amber-300'
            }`}>
              {allChecksPassed ? 'Decisions confirmed' : 'Decisions pending'}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              {allChecksPassed
                ? 'Everything downstream will be generated from these decisions.'
                : 'Complete the checks below to confirm your decisions.'}
            </p>
            {allChecksPassed && (
              <p className="text-xs text-slate-500 mt-2">
                Changing strategy later may invalidate plans and work in progress.
              </p>
            )}

            {/* Primary CTA - Proceed to Deliver */}
            <div className="flex items-center gap-4 mt-5">
              {allChecksPassed ? (
                <Link
                  href={`/c/${companyId}/deliver`}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-500/20"
                >
                  Proceed to Deliver
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-slate-700 text-slate-400 rounded-lg cursor-not-allowed"
                >
                  Proceed to Deliver
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Secondary: Back to Strategy */}
              <button
                onClick={navigateToStrategy}
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Back to Strategy
              </button>
            </div>

            {/* What happens next - clarity for first-time users */}
            {allChecksPassed && (
              <p className="text-xs text-slate-500 mt-3">
                Next, activate which tactics you want to execute. Activated tactics become Programs in Deliver.
              </p>
            )}

            {/* Ready when you are prompt - appears after 2s if all checks pass */}
            {showReadyPrompt && allChecksPassed && (
              <p className="text-xs text-purple-400/80 mt-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                Ready when you are → Proceed to Deliver
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Readiness Checks - Informational, not actionable */}
      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Confirmation Checks
          </h4>
          {/* De-emphasized details menu */}
          <div className="relative">
            <button
              onClick={() => setShowDetailsMenu(!showDetailsMenu)}
              className="p-1.5 text-slate-500 hover:text-slate-400 hover:bg-slate-700/50 rounded transition-colors"
              title="Review details"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showDetailsMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDetailsMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={() => {
                      setShowDetailsMenu(false);
                      navigateToContext();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Open Context
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsMenu(false);
                      navigateToStrategy();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                    Open Strategy
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <ul className="space-y-2">
          {/* Labs discovered */}
          <li className="flex items-center gap-2.5 text-xs">
            <span className={hasLabsRun ? 'text-emerald-400' : 'text-slate-600'}>
              {hasLabsRun ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            </span>
            <span className={hasLabsRun ? 'text-slate-400' : 'text-slate-500'}>
              Labs discovered (context extracted)
            </span>
          </li>

          {/* Context confirmed */}
          <li className="flex items-center gap-2.5 text-xs">
            <span className={confirmedCount >= 3 ? 'text-emerald-400' : 'text-slate-600'}>
              {confirmedCount >= 3 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            </span>
            <span className={confirmedCount >= 3 ? 'text-slate-400' : 'text-slate-500'}>
              Strategy inputs confirmed ({confirmedCount}/3 minimum)
            </span>
          </li>

          {/* Strategy generated */}
          <li className="flex items-center gap-2.5 text-xs">
            <span className={strategyExists ? 'text-emerald-400' : 'text-slate-600'}>
              {strategyExists ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </span>
            <span className={strategyExists ? 'text-slate-400' : 'text-slate-500'}>
              Strategy framing saved
            </span>
          </li>
        </ul>

        {/* Status line */}
        <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-700/30">
          {allChecksPassed
            ? 'All required inputs are confirmed.'
            : 'Complete the missing items to proceed.'}
        </p>
      </div>

      {/* AI Quality Link - tertiary */}
      <Link
        href={`/c/${companyId}/readiness`}
        className="block bg-slate-900/30 border border-slate-800/30 rounded-lg p-3 transition-all hover:border-slate-700/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800/50 text-slate-500">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">AI Quality</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Advanced checks—most users won&apos;t need this.
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </div>
      </Link>
    </DecideShell>
  );
}

export default DecideClient;
