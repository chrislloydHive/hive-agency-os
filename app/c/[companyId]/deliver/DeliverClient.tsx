'use client';

// app/c/[companyId]/deliver/DeliverClient.tsx
// Deliver Phase Client Component
//
// Landing page for Phase 3: Deliver
// Shows deliverables with creation/update actions
//
// UI state is derived from a single selector: getDeliverUIState()

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileOutput,
} from 'lucide-react';
import { StrategyDocCard } from '@/components/os/overview/StrategyDocCard';
import { RfpDeliverablesCard } from '@/components/os/overview/RfpDeliverablesCard';
import { ArtifactsList } from '@/components/os/overview/ArtifactsList';
import { PlansSection } from '@/components/os/plans';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { Artifact } from '@/lib/types/artifact';
import {
  getDeliverUIState,
  type DeliverUIState,
  type DeliverDataInput,
} from '@/lib/os/ui/deliverUiState';

// ============================================================================
// Types
// ============================================================================

interface DeliverClientProps {
  companyId: string;
  companyName: string;
}

// ============================================================================
// Component
// ============================================================================

// Minimum confirmed fields threshold (must match deliverUiState.ts)
const INPUTS_CONFIRMED_THRESHOLD = 3;

export function DeliverClient({ companyId, companyName }: DeliverClientProps) {
  const [contextHealth, setContextHealth] = useState<V4HealthResponse | null>(null);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpdatesInfo, setShowUpdatesInfo] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, strategyRes, artifactsRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/health`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/strategy/view-model`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/artifacts`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);

      if (healthRes?.ok) {
        const health = await healthRes.json();
        setContextHealth(health);
      }

      if (strategyRes?.ok) {
        const data = await strategyRes.json();
        // Use activeStrategyId (top-level) or strategy.id as fallback
        setStrategyId(data.activeStrategyId ?? data.strategy?.id ?? null);
      }

      if (artifactsRes?.ok) {
        const data = await artifactsRes.json();
        setArtifacts(data.artifacts || []);
      }
    } catch (err) {
      console.error('[DeliverClient] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive UI state from selector
  const dataInput: DeliverDataInput = {
    contextHealth,
    strategyId,
    artifacts,
  };
  const uiState: DeliverUIState = getDeliverUIState(dataInput, companyId);

  // Controlled props for StrategyDocCard - single source of truth from uiState
  const confirmedCount = contextHealth?.store.confirmed ?? 0;
  const canCreateStrategyDoc = uiState.debug.inputsConfirmed && !!strategyId;
  const strategyDocBlockedReason = !uiState.debug.inputsConfirmed
    ? `Need ${INPUTS_CONFIRMED_THRESHOLD - confirmedCount} more confirmed Context V4 fields`
    : !strategyId
    ? 'Strategy required to create document'
    : undefined;

  // Handler for creating strategy doc
  const handleCreateStrategyDoc = useCallback(async () => {
    if (!strategyId) {
      throw new Error('Strategy ID required');
    }
    setCreateError(null);

    const response = await fetch(
      `/api/os/companies/${companyId}/artifacts/create-strategy-doc`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      }
    );
    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMessage = data.error || 'Failed to create Strategy Document';
      setCreateError(errorMessage);
      throw new Error(errorMessage);
    }

    // Refresh data to update UI
    await fetchData();
  }, [companyId, strategyId, fetchData]);

  // Sync showUpdatesInfo with selector's recommendation
  useEffect(() => {
    if (uiState.showUpdatesHelp === 'expanded') {
      setShowUpdatesInfo(true);
    }
  }, [uiState.showUpdatesHelp]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Deliver</h1>
          <p className="text-xs text-purple-400/80 mt-0.5">Phase 3</p>
          <p className="text-sm text-slate-400 mt-1">
            Create deliverables from confirmed decisions.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Deliver</h1>
        <p className="text-xs text-purple-400/80 mt-0.5">Phase 3</p>
        <p className="text-sm text-slate-400 mt-1">
          Create deliverables from confirmed decisions.
        </p>
      </div>

      {/* Dev-only UI state debug indicator */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded px-2 py-1">
          <span className="text-cyan-400">{uiState.state}</span>
          <span className="mx-2">|</span>
          primary: {uiState.preferredPrimary ?? 'none'}
          <span className="mx-2">|</span>
          stale: {uiState.staleSummary.staleCount}
          <span className="mx-2">|</span>
          CTA: &quot;{uiState.primaryCTA.label}&quot;
        </div>
      )}

      {/* Banner (always shown) */}
      <DeliverBanner
        tone={uiState.banner.tone}
        title={uiState.banner.title}
        body={uiState.banner.body}
        primaryCTA={uiState.primaryCTA}
        secondaryCTA={uiState.secondaryCTA}
      />

      {/* Plans Section */}
      {uiState.showPrimaryDeliverables && (
        <div id="plans">
          <PlansSection
            companyId={companyId}
            strategyId={strategyId}
          />
        </div>
      )}

      {/* Primary Deliverables Section */}
      {uiState.showPrimaryDeliverables && (
        <>
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-slate-400">Strategy Document</h2>
            <StrategyDocCard
              companyId={companyId}
              strategyId={strategyId ?? undefined}
              controlled={{
                canCreate: canCreateStrategyDoc,
                blockedReason: strategyDocBlockedReason,
                confirmedCount,
                requiredCount: INPUTS_CONFIRMED_THRESHOLD,
                onCreate: handleCreateStrategyDoc,
              }}
            />
            {createError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {createError}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-slate-400">RFP Responses</h2>
            <Link
              href={`/c/${companyId}/deliver/rfp`}
              className="block bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 rounded-xl p-4 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <FileOutput className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                      RFP Response Builder
                    </p>
                    <p className="text-xs text-slate-500">
                      Create structured proposal responses with AI assistance
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
            </Link>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-slate-400">Quick Artifacts</h2>
            <RfpDeliverablesCard companyId={companyId} />
          </div>
        </>
      )}

      {/* Other Artifacts */}
      {uiState.showArtifactsList && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-slate-400">Other Artifacts</h2>
          <ArtifactsList
            companyId={companyId}
            showStaleBanner={true}
            maxItems={10}
          />
        </div>
      )}

      {/* Keeping deliverables current - collapsible */}
      {uiState.showUpdatesHelp !== 'hidden' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowUpdatesInfo(!showUpdatesInfo)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
          >
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              How Updates Work
            </span>
            {showUpdatesInfo ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {showUpdatesInfo && (
            <div className="px-4 pb-4">
              <p className="text-sm text-slate-300">
                When context or strategy changes, deliverables will show an &quot;Out of Date&quot; indicator.
                Use &quot;Insert Updates&quot; to keep documents aligned with your latest decisions.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Updates happen naturally as your business evolves—no separate phase needed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Banner Component
// ============================================================================

interface DeliverBannerProps {
  tone: 'blocked' | 'ready' | 'warning' | 'status';
  title: string;
  body: string;
  primaryCTA: {
    label: string;
    href: string;
    variant: 'primary' | 'secondary';
  };
  secondaryCTA?: {
    label: string;
    href: string;
    variant: 'primary' | 'secondary';
  } | null;
}

function DeliverBanner({ tone, title, body, primaryCTA, secondaryCTA }: DeliverBannerProps) {
  const toneStyles = {
    blocked: {
      container: 'bg-amber-500/10 border-amber-500/30',
      icon: <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
      title: 'text-amber-300',
      body: 'text-amber-400/80',
      link: 'text-amber-400 hover:text-amber-300',
    },
    ready: {
      container: 'bg-emerald-500/10 border-emerald-500/30',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
      title: 'text-emerald-300',
      body: 'text-emerald-400/80',
      link: 'text-emerald-400 hover:text-emerald-300',
    },
    warning: {
      container: 'bg-amber-500/10 border-amber-500/30',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
      title: 'text-amber-300',
      body: 'text-amber-400/80',
      link: 'text-amber-400 hover:text-amber-300',
    },
    status: {
      container: 'bg-purple-500/5 border-purple-500/20',
      icon: <FileOutput className="w-5 h-5 text-purple-400 flex-shrink-0" />,
      title: 'text-purple-300',
      body: 'text-purple-300/80',
      link: 'text-purple-400 hover:text-purple-300',
    },
  };

  const styles = toneStyles[tone];
  const isExternal = primaryCTA.href.startsWith('http');
  const isAnchor = primaryCTA.href.startsWith('#');

  // Handle anchor link click with smooth scroll
  const handleAnchorClick = (e: React.MouseEvent, anchor: string) => {
    e.preventDefault();
    const elementId = anchor.replace('#', '');
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`border rounded-xl p-4 ${styles.container}`}>
      <div className="flex items-start gap-3">
        {styles.icon}
        <div className="flex-1">
          <p className={`text-sm font-medium ${styles.title}`}>{title}</p>
          <p className={`text-xs mt-1 ${styles.body}`}>{body}</p>
          <div className="flex items-center gap-3 mt-2">
            {isExternal ? (
              <a
                href={primaryCTA.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${styles.link}`}
              >
                {primaryCTA.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            ) : isAnchor ? (
              <button
                onClick={(e) => handleAnchorClick(e, primaryCTA.href)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${styles.link}`}
              >
                {primaryCTA.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href={primaryCTA.href}
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${styles.link}`}
              >
                {primaryCTA.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {secondaryCTA && (
              secondaryCTA.href.startsWith('#') ? (
                <button
                  onClick={(e) => handleAnchorClick(e, secondaryCTA.href)}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                >
                  {secondaryCTA.label}
                </button>
              ) : (
                <Link
                  href={secondaryCTA.href}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                >
                  {secondaryCTA.label}
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeliverClient;
