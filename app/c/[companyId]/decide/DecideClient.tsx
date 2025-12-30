'use client';

// app/c/[companyId]/decide/DecideClient.tsx
// Decide Phase Client Component - Review & Confirm
//
// V11+: Labs are NEVER blocking. Context editing always available.
// Only strategy existence gates proceeding to Deliver.
//
// This component shows:
// 1) Status banner (informational, not blocking)
// 2) Readiness indicators (informational)
// 3) Primary CTA to proceed

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
  Info,
  MoreHorizontal,
  PlusCircle,
} from 'lucide-react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { StrategyOrigin } from '@/lib/types/strategy';
import {
  getDecideUIState,
  type DecideUIState,
  type DecideDataInput,
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
  const [strategyOrigin, setStrategyOrigin] = useState<StrategyOrigin | undefined>(undefined);
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
        setStrategyOrigin(data.strategy?.origin);
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
    strategyOrigin,
  };
  const uiState: DecideUIState = getDecideUIState(dataInput, companyId);

  // Handle URL hash-based redirects on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'context') {
        router.replace(`/c/${companyId}/context`);
      } else if (hash === 'strategy') {
        router.replace(`/c/${companyId}/strategy`);
      }
    }
  }, [companyId, router]);

  // Navigate to context or strategy pages
  const navigateToContext = useCallback(() => {
    router.push(`/c/${companyId}/context`);
  }, [companyId, router]);

  const navigateToStrategy = useCallback(() => {
    router.push(`/c/${companyId}/strategy`);
  }, [companyId, router]);

  // Derived values for UI (informational only)
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const proposedCount = contextHealth?.store?.proposed ?? 0;
  const hasLabsRun = contextHealth?.websiteLab?.hasRun ?? false;
  const isImported = strategyOrigin === 'imported';

  // V11+: Ready to proceed when strategy exists (labs don't block)
  const canProceed = strategyExists;

  // Show "Ready when you are" prompt after 2 seconds if strategy locked
  useEffect(() => {
    if (strategyLocked && !loading) {
      const timer = setTimeout(() => setShowReadyPrompt(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowReadyPrompt(false);
    }
  }, [strategyLocked, loading]);

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
      {/* Status Banner */}
      <div className={`rounded-xl p-6 ${
        strategyLocked
          ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-2 border-emerald-500/40'
          : canProceed
            ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30'
            : 'bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-2 border-slate-500/30'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${
            strategyLocked
              ? 'bg-emerald-500/20'
              : canProceed
                ? 'bg-purple-500/20'
                : 'bg-slate-500/20'
          }`}>
            {strategyLocked ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : canProceed ? (
              <Sparkles className="w-6 h-6 text-purple-400" />
            ) : (
              <Info className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className={`text-xl font-bold ${
              strategyLocked
                ? 'text-emerald-300'
                : canProceed
                  ? 'text-purple-300'
                  : 'text-slate-300'
            }`}>
              {strategyLocked
                ? 'Strategy finalized'
                : canProceed
                  ? isImported
                    ? 'Strategy anchored'
                    : 'Strategy ready for review'
                  : 'No strategy yet'}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              {strategyLocked
                ? 'Everything downstream will be generated from these decisions.'
                : canProceed
                  ? isImported
                    ? 'Your imported strategy is ready. Enrich context anytime.'
                    : 'Review your strategy and proceed when ready.'
                  : 'Create a strategy to proceed to Deliver.'}
            </p>
            {strategyLocked && (
              <p className="text-xs text-slate-500 mt-2">
                Changing strategy later may invalidate plans and work in progress.
              </p>
            )}

            {/* Primary CTA */}
            <div className="flex items-center gap-4 mt-5">
              {strategyLocked ? (
                <Link
                  href={`/c/${companyId}/deliver`}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-500/20"
                >
                  Proceed to Deliver
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : canProceed ? (
                <>
                  <Link
                    href={`/c/${companyId}/deliver`}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-lg shadow-purple-500/20"
                  >
                    Proceed to Deliver
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={navigateToStrategy}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    Review Strategy
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/c/${companyId}/strategy`}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    Create Strategy
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={navigateToContext}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    Add Context First
                  </button>
                </>
              )}
            </div>

            {/* What happens next */}
            {strategyLocked && (
              <p className="text-xs text-slate-500 mt-3">
                Next, activate which tactics you want to execute. Activated tactics become Programs in Deliver.
              </p>
            )}

            {/* Ready prompt */}
            {showReadyPrompt && strategyLocked && (
              <p className="text-xs text-purple-400/80 mt-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                Ready when you are → Proceed to Deliver
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Context Status (Informational) */}
      <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Context Status
          </h4>
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
          {/* Labs enrichment (optional) */}
          <li className="flex items-center gap-2.5 text-xs">
            <span className={hasLabsRun ? 'text-emerald-400' : 'text-slate-500'}>
              {hasLabsRun ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            </span>
            <span className={hasLabsRun ? 'text-slate-400' : 'text-slate-500'}>
              Labs enrichment
              {!hasLabsRun && (
                <span className="ml-1.5 text-slate-500">— optional</span>
              )}
            </span>
          </li>

          {/* Context fields */}
          <li className="flex items-center gap-2.5 text-xs">
            <span className={confirmedCount > 0 ? 'text-emerald-400' : 'text-slate-500'}>
              {confirmedCount > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            </span>
            <span className={confirmedCount > 0 ? 'text-slate-400' : 'text-slate-500'}>
              {confirmedCount > 0
                ? `${confirmedCount} context field${confirmedCount !== 1 ? 's' : ''} confirmed`
                : 'No context fields confirmed yet'}
              {proposedCount > 0 && (
                <span className="ml-1.5 text-amber-400/70">
                  ({proposedCount} pending review)
                </span>
              )}
            </span>
          </li>

          {/* Strategy status */}
          <li className="flex items-center gap-2.5 text-xs">
            <span className={strategyExists ? 'text-emerald-400' : 'text-slate-500'}>
              {strategyExists ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </span>
            <span className={strategyExists ? 'text-slate-400' : 'text-slate-500'}>
              {strategyLocked
                ? 'Strategy finalized'
                : strategyExists
                  ? isImported
                    ? 'Strategy imported'
                    : 'Strategy draft created'
                  : 'No strategy created'}
            </span>
          </li>
        </ul>

        {/* Informational status */}
        <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-700/30">
          {!hasLabsRun && confirmedCount === 0
            ? 'Add key facts manually or run a lab to enrich context.'
            : confirmedCount > 0
              ? 'Context enriches AI-generated content quality.'
              : 'Review proposed context to improve AI quality.'}
        </p>

        {/* Add context CTA */}
        <Link
          href={`/c/${companyId}/context?view=fields`}
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-cyan-400/80 hover:text-cyan-400 transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add key facts
        </Link>
      </div>

      {/* AI Quality Link */}
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
