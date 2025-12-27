'use client';

// components/os/overview/WhatsNextCard.tsx
// What's Next Card - Contextual guidance based on current phase
//
// Shows phase-appropriate next steps with explanation and action button.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Search,
  CheckCircle2,
  FileOutput,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

interface WhatsNextCardProps {
  companyId: string;
  recentDiagnostics?: { type: string; status: string }[];
}

type Phase = 'discover' | 'decide' | 'deliver' | 'iterate';

interface PhaseGuidance {
  phase: Phase;
  title: string;
  explanation: string;
  actionLabel: string;
  actionHref: string;
  icon: React.ReactNode;
}

// ============================================================================
// Phase Guidance Configuration
// ============================================================================

const PHASE_GUIDANCE: Record<Phase, Omit<PhaseGuidance, 'phase'>> = {
  discover: {
    title: 'Run your first lab',
    explanation:
      'Start with the Website Lab to extract key business context. This forms the foundation for strategy generation.',
    actionLabel: 'Go to Discover',
    actionHref: '/diagnostics',
    icon: <Search className="w-5 h-5" />,
  },
  decide: {
    title: 'Confirm your context',
    explanation:
      'Review the proposals extracted from labs and confirm the ones that are accurate. This unlocks strategy generation.',
    actionLabel: 'Review Context',
    actionHref: '/context',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  deliver: {
    title: 'Create your first deliverable',
    explanation:
      'Your context is confirmed. Generate a Strategy Document or RFP Response to share with stakeholders.',
    actionLabel: 'Create Deliverable',
    actionHref: '#deliverables',
    icon: <FileOutput className="w-5 h-5" />,
  },
  iterate: {
    title: 'Keep deliverables current',
    explanation:
      'Context has evolved since your last deliverables. Insert updates to keep documents aligned with current strategy.',
    actionLabel: 'Review Updates',
    actionHref: '#deliverables',
    icon: <RefreshCw className="w-5 h-5" />,
  },
};

// ============================================================================
// Component
// ============================================================================

const EMPTY_DIAGNOSTICS: { type: string; status: string }[] = [];

export function WhatsNextCard({
  companyId,
  recentDiagnostics = EMPTY_DIAGNOSTICS,
}: WhatsNextCardProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('discover');
  const [loading, setLoading] = useState(true);

  // Use ref for diagnostics to avoid re-creating callback
  const diagnosticsRef = useRef(recentDiagnostics);
  diagnosticsRef.current = recentDiagnostics;

  const fetchPhase = useCallback(async () => {
    try {
      const [healthRes, artifactsRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/health`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/artifacts`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);

      let contextHealth: V4HealthResponse | null = null;
      let artifacts: Artifact[] = [];

      if (healthRes?.ok) {
        contextHealth = await healthRes.json();
      }

      if (artifactsRes?.ok) {
        const data = await artifactsRes.json();
        artifacts = data.artifacts || [];
      }

      // Detect phase
      const detectedPhase = detectPhase({
        contextHealth,
        artifacts,
        recentDiagnostics: diagnosticsRef.current,
      });

      setPhase(detectedPhase);
    } catch (err) {
      console.error('[WhatsNextCard] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchPhase();
  }, [fetchPhase]);

  const handleAction = useCallback(() => {
    const guidance = PHASE_GUIDANCE[phase];
    if (guidance.actionHref.startsWith('#')) {
      // Scroll to section
      const el = document.getElementById(guidance.actionHref.slice(1));
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push(`/c/${companyId}${guidance.actionHref}`);
    }
  }, [phase, companyId, router]);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-5">
        <div className="flex items-center justify-center gap-2 text-purple-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  const guidance = PHASE_GUIDANCE[phase];

  return (
    <div className="bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-purple-500/10 rounded-lg text-purple-400">
            {guidance.icon}
          </div>
          <div>
            <p className="text-xs font-medium text-purple-400/80 uppercase tracking-wider mb-1">
              What&apos;s Next
            </p>
            <h3 className="text-base font-semibold text-white mb-1">
              {guidance.title}
            </h3>
            <p className="text-sm text-slate-400 max-w-md">
              {guidance.explanation}
            </p>
          </div>
        </div>

        <button
          onClick={handleAction}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors flex-shrink-0"
        >
          {guidance.actionLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Phase Detection (duplicated from PhaseGuide for independence)
// ============================================================================

interface DetectPhaseInput {
  contextHealth: V4HealthResponse | null;
  artifacts: Artifact[];
  recentDiagnostics: { type: string; status: string }[];
}

function detectPhase(input: DetectPhaseInput): Phase {
  const { contextHealth, artifacts, recentDiagnostics } = input;

  // Check for stale artifacts first (Iterate phase)
  const activeArtifacts = artifacts.filter((a) => a.status !== 'archived');
  const staleArtifacts = activeArtifacts.filter((a) => a.isStale);

  if (activeArtifacts.length > 0 && staleArtifacts.length > 0) {
    return 'iterate';
  }

  // Check if any deliverables exist and are up to date
  const hasDeliverables = activeArtifacts.some((a) =>
    ['strategy_doc', 'rfp_response_doc', 'proposal_slides', 'pricing_sheet'].includes(a.type)
  );

  if (hasDeliverables && staleArtifacts.length === 0) {
    return 'iterate';
  }

  // Check if labs have been run
  const hasCompletedLabs = recentDiagnostics.some((d) => d.status === 'complete');
  const hasWebsiteLab = contextHealth?.websiteLab?.hasRun ?? false;

  if (!hasCompletedLabs && !hasWebsiteLab) {
    return 'discover';
  }

  // Check if context is confirmed
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;

  if (confirmedCount === 0) {
    return 'decide';
  }

  // Context confirmed but no deliverables
  if (!hasDeliverables) {
    return 'deliver';
  }

  return 'iterate';
}

export default WhatsNextCard;
