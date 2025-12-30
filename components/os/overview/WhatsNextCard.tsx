'use client';

// components/os/overview/WhatsNextCard.tsx
// What's Next Card - Contextual guidance based on current phase
//
// V11+: Labs are NEVER blocking. Manual context entry is always primary.
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
  Upload,
  Sparkles,
  Eye,
  FileText,
  PlusCircle,
} from 'lucide-react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { Artifact } from '@/lib/types/artifact';
import type { CompanyStrategy } from '@/lib/types/strategy';
import { ImportStrategyModal } from '@/components/os/strategy/ImportStrategyModal';

// ============================================================================
// Types
// ============================================================================

interface WhatsNextCardProps {
  companyId: string;
  companyName?: string;
  recentDiagnostics?: { type: string; status: string }[];
}

type Phase = 'get_started' | 'add_context' | 'create_strategy' | 'deliver' | 'iterate';

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
  get_started: {
    title: 'Get started',
    explanation:
      'Add key facts about your business or run a lab to extract context automatically.',
    actionLabel: 'Add Context',
    actionHref: '/context',
    icon: <PlusCircle className="w-5 h-5" />,
  },
  add_context: {
    title: 'Add more context',
    explanation:
      'The more context you add, the better AI-generated content will be.',
    actionLabel: 'Add Context',
    actionHref: '/context',
    icon: <FileText className="w-5 h-5" />,
  },
  create_strategy: {
    title: 'Create your strategy',
    explanation:
      'You have context. Now create a strategy to guide execution.',
    actionLabel: 'Create Strategy',
    actionHref: '/strategy',
    icon: <Sparkles className="w-5 h-5" />,
  },
  deliver: {
    title: 'Start executing',
    explanation:
      'Your strategy is ready. Activate tactics and start delivering.',
    actionLabel: 'Go to Deliver',
    actionHref: '/deliver',
    icon: <FileOutput className="w-5 h-5" />,
  },
  iterate: {
    title: 'Keep deliverables current',
    explanation:
      'Context has evolved since your last deliverables. Update to stay aligned.',
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
  companyName = 'Company',
  recentDiagnostics = EMPTY_DIAGNOSTICS,
}: WhatsNextCardProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('get_started');
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedStrategy, setImportedStrategy] = useState<CompanyStrategy | null>(null);
  const [hasAnyStrategy, setHasAnyStrategy] = useState(false);
  const [hasContext, setHasContext] = useState(false);

  // Use ref for diagnostics to avoid re-creating callback
  const diagnosticsRef = useRef(recentDiagnostics);
  diagnosticsRef.current = recentDiagnostics;

  const fetchPhase = useCallback(async () => {
    try {
      const [healthRes, artifactsRes, strategyRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/health`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/artifacts`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/strategy/list`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);

      let contextHealth: V4HealthResponse | null = null;
      let artifacts: Artifact[] = [];
      let strategies: CompanyStrategy[] = [];

      if (healthRes?.ok) {
        contextHealth = await healthRes.json();
      }

      if (artifactsRes?.ok) {
        const data = await artifactsRes.json();
        artifacts = data.artifacts || [];
      }

      if (strategyRes?.ok) {
        const data = await strategyRes.json();
        strategies = data.strategies || [];
      }

      // Check for imported strategy
      const imported = strategies.find(s => s.origin === 'imported');
      if (imported) {
        setImportedStrategy(imported);
      }

      // Track if any strategy exists
      setHasAnyStrategy(strategies.length > 0);

      // Track if any context exists
      const confirmedCount = contextHealth?.store?.confirmed ?? 0;
      const proposedCount = contextHealth?.store?.proposed ?? 0;
      setHasContext(confirmedCount > 0 || proposedCount > 0);

      // Detect phase
      const detectedPhase = detectPhase({
        contextHealth,
        artifacts,
        strategies,
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

  const handleViewStrategy = useCallback(() => {
    if (importedStrategy) {
      router.push(`/c/${companyId}/decide?strategyId=${importedStrategy.id}`);
    } else {
      router.push(`/c/${companyId}/strategy`);
    }
  }, [companyId, importedStrategy, router]);

  const handleImportSuccess = useCallback((strategyId: string) => {
    router.push(`/c/${companyId}/decide?strategyId=${strategyId}`);
  }, [companyId, router]);

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

  // ============================================================================
  // Strategy Exists - Show View Strategy CTA
  // ============================================================================
  if (hasAnyStrategy && phase === 'deliver') {
    return (
      <div className="bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider mb-1">
                Strategy Ready
              </p>
              <h3 className="text-base font-semibold text-white mb-1">
                {importedStrategy?.title || 'Your strategy is ready'}
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                {importedStrategy
                  ? 'Strategy imported. Enrich context anytime with labs or manual entry.'
                  : 'Proceed to Deliver to start executing your strategy.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push(`/c/${companyId}/context`)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Context
            </button>
            <button
              onClick={() => router.push(`/c/${companyId}/deliver`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Go to Deliver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Get Started Phase - Show Three-Path UX (Manual context primary)
  // ============================================================================
  if (phase === 'get_started') {
    return (
      <>
        <div className="bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-5">
          <p className="text-xs font-medium text-purple-400/80 uppercase tracking-wider mb-4">
            Get Started
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option 1: Add context manually (PRIMARY) */}
            <div className="p-4 bg-slate-800/30 border border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-colors group">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Add context manually
                  </h3>
                  <p className="text-xs text-slate-400">
                    Enter what you know. AI quality improves with context.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/c/${companyId}/context`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
              >
                Add Key Facts
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Option 2: Run a lab (secondary) */}
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors group">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400 group-hover:bg-slate-700 transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Run a lab
                  </h3>
                  <p className="text-xs text-slate-400">
                    Auto-extract context from your website.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/c/${companyId}/diagnostics`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Run Lab
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Option 3: Import strategy */}
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-cyan-500/30 transition-colors group">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Import a strategy
                  </h3>
                  <p className="text-xs text-slate-400">
                    Already have an approved strategy? Start there.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Import Strategy
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Import Strategy Modal */}
        {showImportModal && (
          <ImportStrategyModal
            companyId={companyId}
            companyName={companyName}
            onClose={() => setShowImportModal(false)}
            onSuccess={handleImportSuccess}
          />
        )}
      </>
    );
  }

  // ============================================================================
  // Other Phases - Show standard single-CTA guidance
  // ============================================================================
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
// Phase Detection
// V11+: Labs never block. Phase is based on strategy existence and artifacts.
// ============================================================================

interface DetectPhaseInput {
  contextHealth: V4HealthResponse | null;
  artifacts: Artifact[];
  strategies: CompanyStrategy[];
}

function detectPhase(input: DetectPhaseInput): Phase {
  const { contextHealth, artifacts, strategies } = input;

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

  // Check if strategy exists
  const hasStrategy = strategies.length > 0;

  if (hasStrategy) {
    // Strategy exists, proceed to deliver
    return 'deliver';
  }

  // Check context status
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const proposedCount = contextHealth?.store?.proposed ?? 0;
  const hasContext = confirmedCount > 0 || proposedCount > 0;

  if (hasContext) {
    // Has context but no strategy
    return 'create_strategy';
  }

  // No context, no strategy - get started
  return 'get_started';
}

export default WhatsNextCard;
