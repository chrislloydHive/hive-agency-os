'use client';

// components/os/overview/CompanyOverviewV4.tsx
// Company Overview V4 - Phase-Guided Overview
//
// Simplified overview that shows:
// 1. Company context (header)
// 2. Current phase progress
// 3. Single "What's Next" CTA
//
// All deep actions (labs, context, deliverables) live on their respective phase pages.

import { useMemo } from 'react';
import { CompanySnapshotHeader, deriveCompanyLifecycle, type SituationMetrics } from './CompanySnapshotHeader';
import { PhaseGuide } from './PhaseGuide';
import { WhatsNextCard } from './WhatsNextCard';
import type { CompanyStrategy } from '@/lib/types/strategy';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { RecentDiagnostic } from '@/components/os/blueprint/types';
import type { CompanyAlert } from '@/lib/os/companies/alerts';

// ============================================================================
// Types
// ============================================================================

export interface CompanyOverviewV4Props {
  companyId: string;
  companyName: string;

  // Strategy data (for lifecycle badge)
  strategy: CompanyStrategy | null;

  // Supporting data (for header lifecycle calculation)
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  alerts: CompanyAlert[];

  // Company metadata for header
  industry?: string | null;
  stage?: string | null;

  // AI-generated snapshot (from server)
  aiSnapshot?: string | null;

  // Situation metrics for header
  metrics?: SituationMetrics | null;
}

// ============================================================================
// Component
// ============================================================================

export function CompanyOverviewV4({
  companyId,
  companyName,
  strategy,
  recentDiagnostics,
  alerts,
  industry,
  stage,
  aiSnapshot,
  metrics,
}: CompanyOverviewV4Props) {
  // Memoize diagnostics transformation to prevent infinite re-renders in PhaseGuide
  const phaseGuideDiagnostics = useMemo(
    () => recentDiagnostics.map((d) => ({ type: d.toolId, status: d.status })),
    [recentDiagnostics]
  );

  // Calculate lifecycle for header
  const hasDiagnostics = recentDiagnostics.some(d => d.status === 'complete');
  const latestDiagnostic = recentDiagnostics.find(d => d.status === 'complete');
  const latestScore = latestDiagnostic?.score ?? null;
  const hasStrategy = strategy !== null && (strategy.objectives?.length > 0 || strategy.pillars?.length > 0);

  const lifecycle = deriveCompanyLifecycle({
    hasStrategy,
    hasDiagnostics,
    latestScore,
    alertCount: alerts.length,
    criticalAlertCount: alerts.filter(a => a.severity === 'critical').length,
  });

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* 1. SITUATION BRIEFING HEADER */}
      {/* ================================================================== */}
      <section id="situation-briefing">
        <CompanySnapshotHeader
          companyId={companyId}
          companyName={companyName}
          aiSnapshot={aiSnapshot}
          lifecycle={lifecycle}
          industry={industry}
          stage={stage}
          metrics={metrics}
        />
      </section>

      {/* ================================================================== */}
      {/* 2. PHASE GUIDE - Where am I in the workflow? */}
      {/* ================================================================== */}
      <section id="phase-guide">
        <PhaseGuide
          companyId={companyId}
          recentDiagnostics={phaseGuideDiagnostics}
        />
      </section>

      {/* ================================================================== */}
      {/* 3. WHAT'S NEXT - Single contextual CTA */}
      {/* ================================================================== */}
      <section id="whats-next">
        <WhatsNextCard
          companyId={companyId}
          companyName={companyName}
          recentDiagnostics={phaseGuideDiagnostics}
        />
      </section>
    </div>
  );
}

export default CompanyOverviewV4;
