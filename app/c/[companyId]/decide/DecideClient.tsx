'use client';

// app/c/[companyId]/decide/DecideClient.tsx
// Decide Phase Dashboard - Overview of Context & Strategy State
//
// This is the landing page for Phase 2. It shows:
// 1. Labs summary - which labs have run, findings count
// 2. Context summary - confirmed/pending fields
// 3. Strategy summary - current state
//
// Users can click into Context or Strategy from here based on where they need to go.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  ArrowRight,
  Beaker,
  Globe,
  Swords,
  Clock,
  AlertTriangle,
  ChevronRight,
  Lock,
  PlusCircle,
  Users,
} from 'lucide-react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { StrategyOrigin } from '@/lib/types/strategy';
import type { LabCoverageSummaryResponse, LabRunSummary, LabKey } from '@/lib/types/labSummary';

// ============================================================================
// Types
// ============================================================================

interface DecideClientProps {
  companyId: string;
  companyName: string;
}

// ============================================================================
// Lab Icons
// ============================================================================

const LAB_ICONS: Record<LabKey, React.ReactNode> = {
  websiteLab: <Globe className="w-4 h-4" />,
  competitionLab: <Swords className="w-4 h-4" />,
  brandLab: <Sparkles className="w-4 h-4" />,
  gapPlan: <Beaker className="w-4 h-4" />,
  audienceLab: <Users className="w-4 h-4" />,
};

const LAB_ROUTES: Record<LabKey, string> = {
  websiteLab: 'diagnostics/website',
  competitionLab: 'diagnostics/competition',
  brandLab: 'diagnostics/brand',
  gapPlan: 'diagnostics/gap',
  audienceLab: 'diagnostics/audience',
};

// ============================================================================
// Summary Card Components
// ============================================================================

function SectionCard({
  title,
  icon,
  children,
  href,
  actionLabel,
  status,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  href: string;
  actionLabel: string;
  status?: 'complete' | 'in-progress' | 'not-started';
}) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${
              status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' :
              status === 'in-progress' ? 'bg-amber-500/20 text-amber-400' :
              'bg-slate-700/50 text-slate-400'
            }`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              {status === 'complete' && (
                <span className="text-xs text-emerald-400">Complete</span>
              )}
              {status === 'in-progress' && (
                <span className="text-xs text-amber-400">In Progress</span>
              )}
              {status === 'not-started' && (
                <span className="text-xs text-slate-500">Not Started</span>
              )}
            </div>
          </div>
        </div>
        {children}
      </div>
      <Link
        href={href}
        className="flex items-center justify-between px-5 py-3 bg-slate-900/50 border-t border-slate-700/30 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span>{actionLabel}</span>
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function LabStatusRow({ lab, companyId }: { lab: LabRunSummary; companyId: string }) {
  const route = LAB_ROUTES[lab.labKey];

  return (
    <Link
      href={`/c/${companyId}/${route}`}
      className="flex items-center justify-between py-2 px-3 -mx-3 rounded-lg hover:bg-slate-700/30 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <span className={
          lab.status === 'completed' ? 'text-emerald-400' :
          lab.status === 'running' ? 'text-amber-400' :
          lab.status === 'failed' ? 'text-red-400' :
          'text-slate-500'
        }>
          {lab.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
           lab.status === 'running' ? <Clock className="w-4 h-4 animate-pulse" /> :
           lab.status === 'failed' ? <AlertTriangle className="w-4 h-4" /> :
           LAB_ICONS[lab.labKey]}
        </span>
        <span className={lab.status === 'not_run' ? 'text-slate-500' : 'text-slate-300'}>
          {lab.displayName}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {lab.status === 'completed' && lab.findingsCount > 0 && (
          <span className="text-xs text-slate-500">
            {lab.findingsCount} findings
          </span>
        )}
        {lab.status === 'not_run' && (
          <span className="text-xs text-slate-600">Not run</span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </Link>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DecideClient({ companyId, companyName }: DecideClientProps) {
  const [contextHealth, setContextHealth] = useState<V4HealthResponse | null>(null);
  const [labSummary, setLabSummary] = useState<LabCoverageSummaryResponse | null>(null);
  const [strategyExists, setStrategyExists] = useState(false);
  const [strategyLocked, setStrategyLocked] = useState(false);
  const [strategyOrigin, setStrategyOrigin] = useState<StrategyOrigin | undefined>(undefined);
  const [strategyName, setStrategyName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, strategyRes, labsRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/health`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/strategy/view-model`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/labs/summary`, {
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
        setStrategyName(data.strategy?.name);
      }

      if (labsRes?.ok) {
        const labs = await labsRes.json();
        setLabSummary(labs);
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

  // Derived values
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const proposedCount = contextHealth?.store?.proposed ?? 0;
  const labsRun = labSummary?.labs.filter(l => l.status === 'completed').length ?? 0;
  const totalFindings = labSummary?.totalFindings ?? 0;

  // Status derivation
  const contextStatus: 'complete' | 'in-progress' | 'not-started' =
    confirmedCount > 0 ? 'complete' :
    proposedCount > 0 ? 'in-progress' :
    'not-started';

  const strategyStatus: 'complete' | 'in-progress' | 'not-started' =
    strategyLocked ? 'complete' :
    strategyExists ? 'in-progress' :
    'not-started';

  const labsStatus: 'complete' | 'in-progress' | 'not-started' =
    labsRun > 0 ? 'complete' : 'not-started';

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Decide</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review discoveries and commit to a strategy
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Ready to proceed?
  const canProceed = strategyExists;
  const isFullyReady = strategyLocked;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Decide</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review discoveries and commit to a strategy for {companyName}
          </p>
        </div>

        {/* Proceed CTA when ready */}
        {canProceed && (
          <Link
            href={`/c/${companyId}/deliver`}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              isFullyReady
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {isFullyReady ? 'Go to Deliver' : 'Continue to Deliver'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Status Summary Banner */}
      <div className={`rounded-xl p-5 border-2 ${
        isFullyReady
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : canProceed
            ? 'bg-purple-500/10 border-purple-500/30'
            : 'bg-slate-800/30 border-slate-700/30'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${
            isFullyReady
              ? 'bg-emerald-500/20'
              : canProceed
                ? 'bg-purple-500/20'
                : 'bg-slate-700/50'
          }`}>
            {isFullyReady ? (
              <Lock className="w-6 h-6 text-emerald-400" />
            ) : canProceed ? (
              <Sparkles className="w-6 h-6 text-purple-400" />
            ) : (
              <FileText className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${
              isFullyReady ? 'text-emerald-300' :
              canProceed ? 'text-purple-300' :
              'text-slate-300'
            }`}>
              {isFullyReady
                ? 'Strategy finalized — ready for Deliver'
                : canProceed
                  ? 'Strategy created — review and finalize'
                  : 'Build context and create strategy'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {isFullyReady
                ? 'Your decisions are locked. Activated tactics will become Programs.'
                : canProceed
                  ? 'Review your strategy, then proceed to Deliver when ready.'
                  : 'Enrich context with labs or manual entry, then create a strategy.'}
            </p>
          </div>
        </div>
      </div>

      {/* Three-column grid of sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Labs Section */}
        <SectionCard
          title="Labs"
          icon={<Beaker className="w-5 h-5" />}
          status={labsStatus}
          href={`/c/${companyId}/blueprint`}
          actionLabel="Run Labs"
        >
          <div className="space-y-1">
            {labSummary?.labs.map(lab => (
              <LabStatusRow key={lab.labKey} lab={lab} companyId={companyId} />
            )) ?? (
              <p className="text-sm text-slate-500">Loading labs...</p>
            )}
          </div>
          {labsRun > 0 && totalFindings > 0 && (
            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/30">
              {totalFindings} total findings from {labsRun} lab{labsRun !== 1 ? 's' : ''}
            </p>
          )}
        </SectionCard>

        {/* Context Section */}
        <SectionCard
          title="Context"
          icon={<FileText className="w-5 h-5" />}
          status={contextStatus}
          href={`/c/${companyId}/context`}
          actionLabel={confirmedCount > 0 ? 'Review Context' : 'Add Context'}
        >
          <div className="space-y-3">
            {/* Confirmed */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Confirmed fields</span>
              <span className={`text-sm font-medium ${confirmedCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {confirmedCount}
              </span>
            </div>

            {/* Pending */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Pending review</span>
              <span className={`text-sm font-medium ${proposedCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {proposedCount}
              </span>
            </div>

            {/* Empty state hint */}
            {confirmedCount === 0 && proposedCount === 0 && (
              <p className="text-xs text-slate-500 pt-2">
                Run labs to auto-generate context, or add key facts manually.
              </p>
            )}
          </div>

          {/* Quick add link */}
          {confirmedCount === 0 && (
            <Link
              href={`/c/${companyId}/context?view=fields`}
              className="inline-flex items-center gap-1.5 mt-4 text-xs text-cyan-400/80 hover:text-cyan-400 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add key facts manually
            </Link>
          )}
        </SectionCard>

        {/* Strategy Section */}
        <SectionCard
          title="Strategy"
          icon={<Sparkles className="w-5 h-5" />}
          status={strategyStatus}
          href={`/c/${companyId}/strategy`}
          actionLabel={strategyExists ? 'Review Strategy' : 'Create Strategy'}
        >
          <div className="space-y-3">
            {strategyExists ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Status</span>
                  <span className={`text-sm font-medium ${
                    strategyLocked ? 'text-emerald-400' : 'text-purple-400'
                  }`}>
                    {strategyLocked ? 'Finalized' : 'Draft'}
                  </span>
                </div>
                {strategyOrigin && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Source</span>
                    <span className="text-sm text-slate-300 capitalize">
                      {strategyOrigin === 'imported' ? 'Imported' : 'AI Generated'}
                    </span>
                  </div>
                )}
                {strategyName && (
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-700/30">
                    "{strategyName}"
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">No strategy created yet</p>
                <p className="text-xs text-slate-600">
                  Strategy uses your context to generate positioning, messaging, and tactics.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* What happens next */}
      {!canProceed && (
        <div className="bg-slate-900/30 border border-slate-800/30 rounded-lg p-4">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            What happens next?
          </h4>
          <ol className="text-sm text-slate-400 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-slate-600">1.</span>
              <span>Run labs or add context manually to capture key facts about your business</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600">2.</span>
              <span>Review proposed context and confirm what's accurate</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600">3.</span>
              <span>Generate a strategy from your confirmed context</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-600">4.</span>
              <span>Proceed to Deliver to activate tactics and create programs</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

export default DecideClient;
