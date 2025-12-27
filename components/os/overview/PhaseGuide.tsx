'use client';

// components/os/overview/PhaseGuide.tsx
// Phase Guide - Shows users where they are in the company workflow
//
// Phases:
// 1. Discover - Run Labs / GAPs
// 2. Decide - Confirm Context & Strategy
// 3. Deliver - Create Docs, Slides, Pricing
// 4. Iterate - Insert Updates as Context changes

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CheckCircle2,
  FileOutput,
  RefreshCw,
  ChevronRight,
  Loader2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import type { Artifact } from '@/lib/types/artifact';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

export type WorkflowPhase = 'discover' | 'decide' | 'deliver' | 'iterate';

interface PhaseGuideProps {
  companyId: string;
  /** Whether labs/GAPs have been run */
  hasLabsRun?: boolean;
  /** Recent diagnostics for detecting lab coverage */
  recentDiagnostics?: { type: string; status: string }[];
}

interface PhaseConfig {
  id: WorkflowPhase;
  label: string;
  /** Dynamic objective shown when this phase is active */
  objective: string;
  description: string;
  icon: React.ReactNode;
  /** Requirements to complete this phase */
  requirements: string[];
  cta: {
    label: string;
    href?: string;
    action?: 'run-labs' | 'confirm-context' | 'create-deliverable' | 'insert-updates';
  };
}

interface PhaseState {
  currentPhase: WorkflowPhase;
  contextHealth: V4HealthResponse | null;
  artifacts: Artifact[];
  staleArtifacts: Artifact[];
  loading: boolean;
}

// ============================================================================
// Phase Configuration
// ============================================================================

const PHASES: PhaseConfig[] = [
  {
    id: 'discover',
    label: 'Discover',
    objective: 'Extract and validate business facts.',
    description: 'Run labs to understand the business before forming strategy.',
    icon: <Search className="w-4 h-4" />,
    requirements: [
      'Run Website Lab to extract business context',
      'Run Brand Lab for positioning insights (optional)',
      'Run Competition Lab for market analysis (optional)',
    ],
    cta: {
      label: 'Go to Discover',
      href: '/diagnostics',
      action: 'run-labs',
    },
  },
  {
    id: 'decide',
    label: 'Decide',
    objective: 'Confirm what\'s true and commit to a strategy.',
    description: 'Review and confirm context fields to enable strategy generation.',
    icon: <CheckCircle2 className="w-4 h-4" />,
    requirements: [
      'Review proposed context values',
      'Confirm or edit key fields (brand, audience, offer)',
      'At least 3 confirmed fields required',
    ],
    cta: {
      label: 'Confirm Context',
      action: 'confirm-context',
    },
  },
  {
    id: 'deliver',
    label: 'Deliver',
    objective: 'Create deliverables from confirmed decisions.',
    description: 'Create strategy documents, proposals, and pricing sheets.',
    icon: <FileOutput className="w-4 h-4" />,
    requirements: [
      'Create Strategy Document',
      'Create RFP Response (if needed)',
      'Create Proposal Slides (if needed)',
    ],
    cta: {
      label: 'Create Deliverables',
      action: 'create-deliverable',
    },
  },
  {
    id: 'iterate',
    label: 'Current',
    objective: 'Keep deliverables aligned with your latest decisions.',
    description: 'Context has changed. Update your deliverables to stay current.',
    icon: <RefreshCw className="w-4 h-4" />,
    requirements: [
      'Review stale deliverables',
      'Insert context updates into documents',
      'Re-run labs if business has changed significantly',
    ],
    cta: {
      label: 'Insert Updates',
      action: 'insert-updates',
    },
  },
];

// ============================================================================
// Component
// ============================================================================

const EMPTY_DIAGNOSTICS: { type: string; status: string }[] = [];

export function PhaseGuide({ companyId, recentDiagnostics = EMPTY_DIAGNOSTICS }: PhaseGuideProps) {
  const router = useRouter();
  const [state, setState] = useState<PhaseState>({
    currentPhase: 'discover',
    contextHealth: null,
    artifacts: [],
    staleArtifacts: [],
    loading: true,
  });

  // Use ref to avoid re-creating callback when diagnostics change
  const diagnosticsRef = useRef(recentDiagnostics);
  diagnosticsRef.current = recentDiagnostics;

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  // Fetch phase detection signals
  const fetchPhaseSignals = useCallback(async () => {
    try {
      // Fetch in parallel: context health and artifacts
      const [healthRes, artifactsRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/context/v4/health`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/os/companies/${companyId}/artifacts`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);

      // Check if still mounted before updating state
      if (!mountedRef.current) return;

      let contextHealth: V4HealthResponse | null = null;
      let artifacts: Artifact[] = [];

      if (healthRes?.ok) {
        contextHealth = await healthRes.json();
      }

      if (artifactsRes?.ok) {
        const data = await artifactsRes.json();
        artifacts = data.artifacts || [];
      }

      // Determine current phase (use ref to get latest diagnostics)
      const currentPhase = detectPhase({
        contextHealth,
        artifacts,
        recentDiagnostics: diagnosticsRef.current,
      });

      // Find stale artifacts
      const staleArtifacts = artifacts.filter(
        (a) => a.isStale && a.status !== 'archived'
      );

      setState({
        currentPhase,
        contextHealth,
        artifacts,
        staleArtifacts,
        loading: false,
      });
    } catch (err) {
      console.error('[PhaseGuide] Error fetching signals:', err);
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, [companyId]); // Only depend on companyId, use ref for diagnostics

  useEffect(() => {
    mountedRef.current = true;
    fetchPhaseSignals();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPhaseSignals]);

  // Handle CTA click
  const handleCtaClick = useCallback(
    (phase: PhaseConfig) => {
      if (phase.cta.href) {
        router.push(`/c/${companyId}${phase.cta.href}`);
        return;
      }

      switch (phase.cta.action) {
        case 'run-labs':
          router.push(`/c/${companyId}/diagnostics`);
          break;
        case 'confirm-context':
          router.push(`/c/${companyId}/context`);
          break;
        case 'create-deliverable':
          // Scroll to deliverables section
          document.getElementById('deliverables')?.scrollIntoView({
            behavior: 'smooth',
          });
          break;
        case 'insert-updates':
          // Scroll to deliverables section
          document.getElementById('deliverables')?.scrollIntoView({
            behavior: 'smooth',
          });
          break;
      }
    },
    [companyId, router]
  );

  if (state.loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="text-sm text-slate-400">Detecting workflow phase...</span>
        </div>
      </div>
    );
  }

  const activePhase = PHASES.find((p) => p.id === state.currentPhase) || PHASES[0];
  const activeIndex = PHASES.findIndex((p) => p.id === state.currentPhase);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
      {/* Phase Steps */}
      <div className="flex border-b border-slate-800/50">
        {PHASES.map((phase, index) => {
          const isActive = phase.id === state.currentPhase;
          const isCompleted = index < activeIndex;
          const isFuture = index > activeIndex;

          return (
            <div
              key={phase.id}
              className={`flex-1 relative ${
                index < PHASES.length - 1 ? 'border-r border-slate-800/50' : ''
              }`}
            >
              <div
                className={`px-4 py-3 flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-purple-500/10'
                    : isCompleted
                      ? 'bg-emerald-500/5'
                      : 'bg-transparent'
                }`}
              >
                {/* Step indicator */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? 'bg-purple-500 text-white'
                      : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Phase label */}
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      isActive
                        ? 'text-purple-300'
                        : isCompleted
                          ? 'text-emerald-400/80'
                          : 'text-slate-500'
                    }`}
                  >
                    {phase.label}
                  </p>
                </div>
              </div>

              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Active Phase Content */}
      <div className="p-4">
        {/* Objective line */}
        <p className="text-sm text-purple-300/90 mb-3">{activePhase.objective}</p>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-purple-500/10 rounded-lg flex-shrink-0">
              {activePhase.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-300">{activePhase.description}</p>

              {/* What's required? popover trigger */}
              <RequirementsPopover requirements={activePhase.requirements} />

              {/* Stale warning for iterate phase */}
              {state.currentPhase === 'iterate' && state.staleArtifacts.length > 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-400/80">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {state.staleArtifacts.length} deliverable
                    {state.staleArtifacts.length > 1 ? 's' : ''} may be outdated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => handleCtaClick(activePhase)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors flex-shrink-0"
          >
            {activePhase.cta.label}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Requirements Expandable
// ============================================================================

interface RequirementsExpandableProps {
  requirements: string[];
}

function RequirementsPopover({ requirements }: RequirementsExpandableProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        <HelpCircle className="w-3 h-3" />
        <span>What&apos;s required?</span>
        <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <ul className="mt-2 ml-4 space-y-1">
          {requirements.map((req, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-xs text-slate-400"
            >
              <span className="text-purple-400 mt-0.5">•</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Phase Detection
// ============================================================================

interface DetectPhaseInput {
  contextHealth: V4HealthResponse | null;
  artifacts: Artifact[];
  recentDiagnostics: { type: string; status: string }[];
}

/**
 * Detect current workflow phase based on signals
 */
function detectPhase(input: DetectPhaseInput): WorkflowPhase {
  const { contextHealth, artifacts, recentDiagnostics } = input;

  // Check for stale artifacts first (Iterate phase)
  const activeArtifacts = artifacts.filter((a) => a.status !== 'archived');
  const staleArtifacts = activeArtifacts.filter((a) => a.isStale);

  if (activeArtifacts.length > 0 && staleArtifacts.length > 0) {
    return 'iterate';
  }

  // Check if any deliverables exist and are up to date (past Deliver)
  const hasDeliverables = activeArtifacts.some((a) =>
    ['strategy_doc', 'rfp_response_doc', 'proposal_slides', 'pricing_sheet'].includes(a.type)
  );

  if (hasDeliverables && staleArtifacts.length === 0) {
    // All deliverables are current - could be in Iterate waiting for changes
    // or in a "complete" state. Show Iterate as next action.
    return 'iterate';
  }

  // Check if labs have been run (Discover -> Decide transition)
  const hasCompletedLabs = recentDiagnostics.some((d) => d.status === 'complete');
  const hasWebsiteLab = contextHealth?.websiteLab?.hasRun ?? false;

  if (!hasCompletedLabs && !hasWebsiteLab) {
    return 'discover';
  }

  // Check if context is confirmed (Decide -> Deliver transition)
  // Context is "confirmed" if we have confirmed values in the V4 store
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;

  if (confirmedCount === 0) {
    return 'decide';
  }

  // Context confirmed but no deliverables
  if (!hasDeliverables) {
    return 'deliver';
  }

  // Default to iterate (should rarely reach here)
  return 'iterate';
}

export default PhaseGuide;
