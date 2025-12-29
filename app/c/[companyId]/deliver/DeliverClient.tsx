'use client';

// app/c/[companyId]/deliver/DeliverClient.tsx
// Deliver Phase Client Component
//
// Execution-focused surface for approved tactics.
// Three-section IA:
// 1. Execution (Primary) - Active programs and committed work
// 2. Supporting Assets (Secondary) - Plans that support execution
// 3. Reference & Admin (Tertiary) - Strategy docs, historical artifacts
//
// Sales-stage artifacts (RFPs, proposals, pricing) are NOT shown here.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Rocket,
  Target,
  Plus,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { ArtifactsList } from '@/components/os/overview/ArtifactsList';
import { PlansSection } from '@/components/os/plans';
import { ProgramsSection } from '@/components/os/programs';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { Artifact } from '@/lib/types/artifact';
import type { PlanningProgram } from '@/lib/types/program';
import type { StrategyPlay } from '@/lib/types/strategy';
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
  const searchParams = useSearchParams();
  const focusedProgramId = searchParams.get('programId');

  const [contextHealth, setContextHealth] = useState<V4HealthResponse | null>(null);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [strategyGoal, setStrategyGoal] = useState<string | null>(null);
  const [strategyDocUrl, setStrategyDocUrl] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [programs, setPrograms] = useState<PlanningProgram[]>([]);
  const [acceptedTactics, setAcceptedTactics] = useState<StrategyPlay[]>([]);
  const [loading, setLoading] = useState(true);

  // Toast state for program creation feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [creatingProgramFromTactic, setCreatingProgramFromTactic] = useState<string | null>(null);
  const [autoCreatedProgram, setAutoCreatedProgram] = useState(false);

  // Collapsed accordion states for sections
  const [tacticsAccordionOpen, setTacticsAccordionOpen] = useState(false);
  const [supportingAssetsOpen, setSupportingAssetsOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);

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

      let fetchedStrategyId: string | null = null;
      if (strategyRes?.ok) {
        const data = await strategyRes.json();
        // Use activeStrategyId (top-level) or strategy.id as fallback
        fetchedStrategyId = data.activeStrategyId ?? data.strategy?.id ?? null;
        setStrategyId(fetchedStrategyId);
        // Extract strategy goal for header
        setStrategyGoal(data.strategy?.goal ?? data.strategy?.goalStatement ?? null);
        // Extract accepted tactics (active status) for program creation affordance
        const plays = (data.strategy?.plays || []) as StrategyPlay[];
        const accepted = plays.filter(p => p.status === 'active' || p.status === 'proven');
        setAcceptedTactics(accepted);
        // Get strategy doc URL if available
        setStrategyDocUrl(data.strategy?.strategyDocUrl ?? null);
      }

      if (artifactsRes?.ok) {
        const data = await artifactsRes.json();
        setArtifacts(data.artifacts || []);
      }

      // Fetch programs for this strategy (use same endpoint as ProgramsSection)
      if (fetchedStrategyId) {
        try {
          const programsRes = await fetch(
            `/api/os/companies/${companyId}/strategy/${fetchedStrategyId}/programs`,
            { cache: 'no-store' }
          );
          if (programsRes.ok) {
            const programsData = await programsRes.json();
            setPrograms(programsData.programs || []);
          }
        } catch (err) {
          console.error('[DeliverClient] Error fetching programs:', err);
        }
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

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handler to create program from tactic
  const handleCreateProgramFromTactic = useCallback(async (tactic: StrategyPlay, scrollToPrograms = false) => {
    if (!strategyId || creatingProgramFromTactic) return;

    setCreatingProgramFromTactic(tactic.id);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/programs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tacticId: tactic.id,
            tacticTitle: tactic.title,
            tacticDescription: tactic.description || '',
            workstreams: tactic.channels || [],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create program');
      }

      // Show success toast with tactic title
      setToast({
        message: data.created
          ? `Program created from "${tactic.title}". You can edit or add more.`
          : `Program already exists for "${tactic.title}"`,
        type: 'success',
      });

      // Refresh programs (use same endpoint as ProgramsSection)
      const programsRes = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/programs`,
        { cache: 'no-store' }
      );
      if (programsRes.ok) {
        const programsData = await programsRes.json();
        setPrograms(programsData.programs || []);
      }

      // Scroll to programs section after creation
      if (scrollToPrograms) {
        setTimeout(() => {
          document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to create program',
        type: 'error',
      });
    } finally {
      setCreatingProgramFromTactic(null);
    }
  }, [companyId, strategyId, creatingProgramFromTactic]);

  // Auto-create first program when conditions are met
  useEffect(() => {
    const autoCreateKey = `hive-auto-program-${companyId}-${strategyId}`;
    const hasDeclinedAutoCreate = localStorage.getItem(autoCreateKey) === 'declined';

    if (
      !loading &&
      strategyId &&
      programs.length === 0 &&
      acceptedTactics.length > 0 &&
      !autoCreatedProgram &&
      !hasDeclinedAutoCreate &&
      !creatingProgramFromTactic
    ) {
      // Auto-create from first accepted tactic
      const firstTactic = acceptedTactics[0];
      setAutoCreatedProgram(true);
      handleCreateProgramFromTactic(firstTactic);
    }
  }, [loading, strategyId, programs.length, acceptedTactics, autoCreatedProgram, creatingProgramFromTactic, handleCreateProgramFromTactic, companyId]);

  // Programs gate: artifacts only available after at least one program exists
  const hasPrograms = programs.length > 0;
  const showArtifacts = hasPrograms && uiState.showPrimaryDeliverables;

  // Planning progress stats
  const programStats = useMemo(() => {
    const draft = programs.filter(p => p.status === 'draft').length;
    const ready = programs.filter(p => p.status === 'ready').length;
    const committed = programs.filter(p => p.status === 'committed').length;
    return { total: programs.length, draft, ready, committed };
  }, [programs]);

  // Tactics that don't yet have programs
  const tacticsWithoutPrograms = useMemo(() => {
    const programTacticIds = new Set(programs.map(p => p.origin.tacticId));
    return acceptedTactics.filter(t => !programTacticIds.has(t.id));
  }, [acceptedTactics, programs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs text-cyan-400/80 uppercase tracking-wider">Deliver</p>
          <h1 className="text-2xl font-bold text-white mt-1">Loading...</h1>
          <p className="text-sm text-slate-400 mt-2">
            Preparing your execution workspace.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all animate-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-white/70 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Header - execution focused */}
      <div>
        {strategyGoal ? (
          <>
            <p className="text-xs text-cyan-400/80 uppercase tracking-wider">Delivering</p>
            <h1 className="text-2xl font-bold text-white mt-1">{strategyGoal}</h1>
            <p className="text-sm text-slate-400 mt-2">
              You&apos;re executing approved tactics. Track delivery and progress.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-cyan-400/80 uppercase tracking-wider">Deliver</p>
            <h1 className="text-2xl font-bold text-white mt-1">Execution Workspace</h1>
            <p className="text-sm text-slate-400 mt-2">
              You&apos;re executing approved tactics. Track delivery and progress.
            </p>
          </>
        )}
      </div>

      {/* Dev-only UI state debug indicator */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded px-2 py-1">
          <span className="text-cyan-400">{uiState.state}</span>
          <span className="mx-2">|</span>
          programs: {programs.length} (committed: {programStats.committed})
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 1: EXECUTION (Primary) */}
      {/* ================================================================== */}

      {/* First Program Affordance - when no programs exist */}
      {!hasPrograms && strategyId && acceptedTactics.length > 0 && (
        <div id="create-program" className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border-2 border-cyan-500/40 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-500/30 rounded-lg shrink-0">
              <Rocket className="w-6 h-6 text-cyan-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Start your first Program
              </h3>
              <p className="text-sm text-slate-300 mb-2">
                Programs turn approved tactics into executable work.
              </p>
              <p className="text-xs text-slate-400 mb-4">
                You&apos;ll define deliverables and milestones next.
              </p>

              {/* Tactic Buttons - show up to 3 */}
              <div className="flex flex-wrap gap-2">
                {tacticsWithoutPrograms.slice(0, 3).map((tactic) => (
                  <button
                    key={tactic.id}
                    onClick={() => handleCreateProgramFromTactic(tactic)}
                    disabled={!!creatingProgramFromTactic}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {creatingProgramFromTactic === tactic.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        {tactic.title}
                      </>
                    )}
                  </button>
                ))}
              </div>
              {tacticsWithoutPrograms.length > 3 && (
                <p className="text-xs text-slate-500 mt-3">
                  +{tacticsWithoutPrograms.length - 3} more tactics available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Execution Status Banner - only show when programs exist */}
      {hasPrograms && (
        <ExecutionBanner
          programStats={programStats}
          companyId={companyId}
        />
      )}

      {/* Execution Progress - shows when programs exist */}
      {hasPrograms && strategyId && (
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Execution status:</span>
          <span>{programStats.total} Program{programStats.total !== 1 ? 's' : ''}</span>
          {programStats.ready > 0 && (
            <span className="text-emerald-400">{programStats.ready} Ready to start</span>
          )}
          {programStats.committed > 0 && (
            <span className="text-cyan-400">{programStats.committed} In execution</span>
          )}
          {programStats.draft > 0 && (
            <span className="text-slate-500">{programStats.draft} Planning</span>
          )}
        </div>
      )}

      {/* Programs Section - the hero of Deliver */}
      {strategyId && (
        <div id="programs" className="space-y-3">
          <ProgramsSection
            companyId={companyId}
            strategyId={strategyId}
            focusedProgramId={focusedProgramId}
            onProgramsChange={setPrograms}
          />

          {/* Collapsed Accordion: Add another program from remaining tactics */}
          {hasPrograms && tacticsWithoutPrograms.length > 0 && (
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setTacticsAccordionOpen(!tacticsAccordionOpen)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-400">
                    Add a Program
                  </span>
                  <span className="text-xs text-slate-500">
                    ({tacticsWithoutPrograms.length} tactic{tacticsWithoutPrograms.length !== 1 ? 's' : ''} available)
                  </span>
                </div>
                {tacticsAccordionOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {tacticsAccordionOpen && (
                <div className="px-4 pb-4 space-y-2">
                  <p className="text-xs text-slate-500 mb-3">
                    You&apos;ll define deliverables and milestones next.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tacticsWithoutPrograms.map((tactic) => (
                      <button
                        key={tactic.id}
                        onClick={() => handleCreateProgramFromTactic(tactic, true)}
                        disabled={!!creatingProgramFromTactic}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
                      >
                        {creatingProgramFromTactic === tactic.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            {tactic.title}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state: No accepted tactics */}
      {!hasPrograms && strategyId && acceptedTactics.length === 0 && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-slate-700/50 rounded-lg shrink-0">
              <Target className="w-6 h-6 text-slate-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                No approved tactics yet
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                Programs are created from approved tactics.
                Activate at least one tactic in Strategy to continue.
              </p>
              <Link
                href={`/c/${companyId}/strategy?focus=tactics`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Go to Strategy
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 2: SUPPORTING EXECUTION ASSETS (Secondary, collapsed) */}
      {/* ================================================================== */}
      {showArtifacts && (
        <div className="bg-slate-900/30 border border-slate-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setSupportingAssetsOpen(!supportingAssetsOpen)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">
                Supporting Execution Assets
              </span>
              <span className="text-xs text-slate-500">
                (Optional)
              </span>
            </div>
            {supportingAssetsOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {supportingAssetsOpen && (
            <div className="px-4 pb-4 space-y-4">
              <p className="text-xs text-slate-500">
                Optional assets that support execution of approved programs.
              </p>

              {/* Plans Section (Media Plan + Content Plan) */}
              <div id="plans">
                <PlansSection
                  companyId={companyId}
                  strategyId={strategyId}
                  showHeader={false}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 3: REFERENCE & ADMIN (Tertiary, collapsed by default) */}
      {/* ================================================================== */}
      {uiState.showPrimaryDeliverables && (
        <div className="bg-slate-900/20 border border-slate-800/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setReferenceOpen(!referenceOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-sm text-slate-500">
                Reference &amp; Admin
              </span>
              <span className="text-xs text-slate-600">
                (Read-only)
              </span>
            </div>
            {referenceOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-600" />
            )}
          </button>
          {referenceOpen && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-slate-600">
                Read-only reference and historical artifacts. No actions available here.
              </p>

              {/* Strategy Document - READ ONLY reference */}
              {strategyDocUrl && (
                <div className="bg-slate-800/20 border border-slate-700/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-slate-800/50 rounded">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Strategy Document</p>
                        <p className="text-xs text-slate-600">View only</p>
                      </div>
                    </div>
                    <a
                      href={strategyDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-400 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  </div>
                </div>
              )}

              {/* Link to Documents page */}
              <Link
                href={`/c/${companyId}/documents`}
                className="flex items-center justify-between bg-slate-800/20 border border-slate-700/20 rounded-lg p-3 hover:border-slate-600/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-slate-800/50 rounded">
                    <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 group-hover:text-slate-300">All Documents</p>
                    <p className="text-xs text-slate-600">Browse all artifacts</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-500" />
              </Link>

              {/* Historical Artifacts */}
              {uiState.showArtifactsList && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">Historical Artifacts</p>
                  <ArtifactsList
                    companyId={companyId}
                    showStaleBanner={false}
                    maxItems={5}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Execution Status Banner
// ============================================================================

interface ExecutionBannerProps {
  programStats: {
    total: number;
    draft: number;
    ready: number;
    committed: number;
  };
  companyId: string;
}

function ExecutionBanner({ programStats, companyId }: ExecutionBannerProps) {
  // Determine banner state based on program stats
  const hasCommitted = programStats.committed > 0;
  const hasReady = programStats.ready > 0;

  if (hasCommitted) {
    // Active execution state
    return (
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-cyan-300">
              {programStats.committed} program{programStats.committed !== 1 ? 's' : ''} in execution
            </p>
            <p className="text-xs mt-1 text-cyan-400/80">
              Track progress and manage work items for active programs.
            </p>
            <Link
              href={`/c/${companyId}/work`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 mt-2"
            >
              View Work
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (hasReady) {
    // Ready to start execution
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-300">
              {programStats.ready} program{programStats.ready !== 1 ? 's' : ''} ready to start
            </p>
            <p className="text-xs mt-1 text-emerald-400/80">
              Start execution to create work items and begin tracking progress.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Still in planning
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-slate-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-300">
            Programs in planning
          </p>
          <p className="text-xs mt-1 text-slate-400">
            Complete program planning to start execution.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DeliverClient;
