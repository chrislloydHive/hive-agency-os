'use client';

// app/c/[companyId]/gap/full/FullGAPOrchestratorClient.tsx
// Full GAP OS Orchestrator - Client Component
//
// Interactive dashboard for running and viewing orchestrator results

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Beaker,
  Target,
  Lightbulb,
  FileText,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface FullGAPOrchestratorClientProps {
  companyId: string;
  companyName: string;
}

interface LabOutputSummary {
  labId: string;
  labName: string;
  success: boolean;
  error?: string;
  refinedFieldCount: number;
  diagnostics: {
    score: number | null;
    summary: string | null;
    issues: string[];
    recommendations: string[];
  };
  insightCount: number;
  durationMs: number;
}

interface HealthAssessment {
  completeness: number;
  freshness: number;
  missingCriticalFields: string[];
  staleFields: string[];
  staleSections: string[];
  recommendations: string[];
}

interface GAPScores {
  overall: number;
  brand: number;
  content: number;
  seo: number;
  website: number;
  authority: number;
  digitalFootprint: number;
}

interface GAPStructured {
  scores: GAPScores;
  maturityStage: string;
  dimensionDiagnostics: Array<{
    dimension: string;
    score: number;
    summary: string;
    strengths: string[];
    gaps: string[];
    opportunities: string[];
  }>;
  keyFindings: Array<{
    type: string;
    title: string;
    description: string;
    dimensions: string[];
    severity: string;
  }>;
  recommendedNextSteps: Array<{
    title: string;
    description: string;
    priority: number;
    effort: string;
    impact: string;
    dimension: string;
  }>;
}

interface OrchestratorInsight {
  id: string;
  title: string;
  body: string;
  category: string;
  severity: string;
  recommendation?: string;
}

interface OrchestratorRunData {
  hasRun: boolean;
  runId?: string;
  status?: 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  error?: string;
  healthBefore?: HealthAssessment;
  healthAfter?: HealthAssessment;
  labsRun?: string[];
  labOutputs?: LabOutputSummary[];
  gapStructured?: GAPStructured;
  insights?: OrchestratorInsight[];
  snapshotId?: string;
  durationMs?: number;
}

// ============================================================================
// Component
// ============================================================================

export function FullGAPOrchestratorClient({
  companyId,
  companyName,
}: FullGAPOrchestratorClientProps) {
  const [runData, setRunData] = useState<OrchestratorRunData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest run on mount
  const fetchLatestRun = useCallback(async () => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/gap/full`);
      if (!response.ok) {
        throw new Error('Failed to fetch run data');
      }
      const data = await response.json();
      setRunData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchLatestRun();
  }, [fetchLatestRun]);

  // Run orchestrator
  const runOrchestrator = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/gap/full`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run orchestrator');
      }

      // Refresh data
      await fetchLatestRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // No runs yet
  if (!runData?.hasRun) {
    return (
      <EmptyState
        companyName={companyName}
        onRun={runOrchestrator}
        isRunning={isRunning}
        error={error}
      />
    );
  }

  // Show run results
  return (
    <div className="space-y-6">
      {/* Run Header */}
      <RunHeader
        runData={runData}
        onRun={runOrchestrator}
        isRunning={isRunning}
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content - only show if completed */}
      {runData.status === 'completed' && runData.gapStructured && (
        <>
          {/* Context Delta */}
          {runData.healthBefore && runData.healthAfter && (
            <ContextDeltaCard
              healthBefore={runData.healthBefore}
              healthAfter={runData.healthAfter}
            />
          )}

          {/* Labs Run */}
          {runData.labOutputs && runData.labOutputs.length > 0 && (
            <LabsRunCard labOutputs={runData.labOutputs} />
          )}

          {/* GAP Scores */}
          <GAPScoresCard gapStructured={runData.gapStructured} />

          {/* Top Insights */}
          {runData.insights && runData.insights.length > 0 && (
            <TopInsightsCard
              insights={runData.insights.slice(0, 5)}
              companyId={companyId}
            />
          )}

          {/* Snapshot Link */}
          {runData.snapshotId && (
            <SnapshotLinkCard
              snapshotId={runData.snapshotId}
              companyId={companyId}
            />
          )}
        </>
      )}

      {/* Failed state */}
      {runData.status === 'failed' && (
        <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-300">Orchestrator Failed</h3>
              <p className="text-sm text-red-400 mt-1">
                {runData.error || 'An unknown error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState({
  companyName,
  onRun,
  isRunning,
  error,
}: {
  companyName: string;
  onRun: () => void;
  isRunning: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center mb-6">
          <Target className="w-8 h-8 text-blue-400" />
        </div>

        <h2 className="text-xl font-semibold text-slate-100 mb-3">
          Run Full GAP Orchestrator
        </h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          The orchestrator analyzes {companyName}'s context, runs Labs to fill gaps,
          and extracts strategic insights—all in one comprehensive analysis.
        </p>

        {error && (
          <div className="w-full p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Orchestrator...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Full GAP Orchestrator
            </>
          )}
        </button>

        <p className="text-xs text-slate-500 mt-4">
          This may take 2-5 minutes depending on how many Labs need to run.
        </p>
      </div>
    </div>
  );
}

function RunHeader({
  runData,
  onRun,
  isRunning,
}: {
  runData: OrchestratorRunData;
  onRun: () => void;
  isRunning: boolean;
}) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50">
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        {runData.status === 'completed' && (
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        )}
        {runData.status === 'failed' && (
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
        )}
        {runData.status === 'running' && (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        )}

        {/* Run Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">
              {runData.status === 'completed' && 'Last Run Completed'}
              {runData.status === 'failed' && 'Last Run Failed'}
              {runData.status === 'running' && 'Running...'}
            </span>
            {runData.durationMs && (
              <span className="text-xs text-slate-500">
                ({formatDuration(runData.durationMs)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(runData.completedAt || runData.startedAt)}
            </span>
            {runData.summary && (
              <span className="text-slate-500">{runData.summary}</span>
            )}
          </div>
        </div>
      </div>

      {/* Run Again Button */}
      <button
        onClick={onRun}
        disabled={isRunning || runData.status === 'running'}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Run Again
          </>
        )}
      </button>
    </div>
  );
}

function ContextDeltaCard({
  healthBefore,
  healthAfter,
}: {
  healthBefore: HealthAssessment;
  healthAfter: HealthAssessment;
}) {
  const completeDelta = healthAfter.completeness - healthBefore.completeness;
  const freshDelta = healthAfter.freshness - healthBefore.freshness;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h3 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        Context Delta
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Completeness */}
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-xs text-slate-400 mb-1">Completeness</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-100">
              {healthAfter.completeness}%
            </span>
            {completeDelta !== 0 && (
              <span
                className={`flex items-center text-xs ${
                  completeDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {completeDelta > 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(completeDelta)}%
              </span>
            )}
          </div>
        </div>

        {/* Freshness */}
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-xs text-slate-400 mb-1">Freshness</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-100">
              {healthAfter.freshness}%
            </span>
            {freshDelta !== 0 && (
              <span
                className={`flex items-center text-xs ${
                  freshDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {freshDelta > 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(freshDelta)}%
              </span>
            )}
          </div>
        </div>

        {/* Missing Critical */}
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-xs text-slate-400 mb-1">Missing Critical</div>
          <div className="text-lg font-semibold text-slate-100">
            {healthAfter.missingCriticalFields.length}
            <span className="text-xs text-slate-500 ml-1">fields</span>
          </div>
        </div>

        {/* Stale Sections */}
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-xs text-slate-400 mb-1">Stale Sections</div>
          <div className="text-lg font-semibold text-slate-100">
            {healthAfter.staleSections.length}
            <span className="text-xs text-slate-500 ml-1">sections</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabsRunCard({ labOutputs }: { labOutputs: LabOutputSummary[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h3 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
        <Beaker className="w-4 h-4 text-purple-400" />
        Labs Run ({labOutputs.length})
      </h3>

      <div className="space-y-3">
        {labOutputs.map((lab) => (
          <div
            key={lab.labId}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
          >
            <div className="flex items-center gap-3">
              {lab.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <div>
                <div className="text-sm font-medium text-slate-200">
                  {lab.labName}
                </div>
                {lab.diagnostics.summary && (
                  <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {lab.diagnostics.summary}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              {lab.diagnostics.score !== null && (
                <span className="text-slate-300">
                  Score: <strong>{lab.diagnostics.score}</strong>
                </span>
              )}
              <span className="text-slate-500">
                {lab.refinedFieldCount} fields refined
              </span>
              <span className="text-slate-500">
                {lab.insightCount} insights
              </span>
              <span className="text-slate-600">
                {Math.round(lab.durationMs / 1000)}s
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GAPScoresCard({ gapStructured }: { gapStructured: GAPStructured }) {
  const { scores, maturityStage } = gapStructured;

  const scoreItems = [
    { label: 'Brand', value: scores.brand, color: 'text-purple-400' },
    { label: 'Website', value: scores.website, color: 'text-blue-400' },
    { label: 'Content', value: scores.content, color: 'text-emerald-400' },
    { label: 'SEO', value: scores.seo, color: 'text-amber-400' },
    { label: 'Authority', value: scores.authority, color: 'text-pink-400' },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          GAP Scores
        </h3>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
          {maturityStage}
        </span>
      </div>

      {/* Overall Score */}
      <div className="mb-6 p-4 rounded-lg bg-slate-800/50">
        <div className="text-xs text-slate-400 mb-1">Overall Score</div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-100">
            {scores.overall}
          </span>
          <span className="text-slate-500 text-sm mb-1">/100</span>
        </div>
        <div className="mt-2 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
            style={{ width: `${scores.overall}%` }}
          />
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {scoreItems.map((item) => (
          <div key={item.label} className="text-center p-3 rounded-lg bg-slate-800/30">
            <div className={`text-2xl font-semibold ${item.color}`}>
              {item.value || '-'}
            </div>
            <div className="text-xs text-slate-400 mt-1">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopInsightsCard({
  insights,
  companyId,
}: {
  insights: OrchestratorInsight[];
  companyId: string;
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Top Insights ({insights.length})
        </h3>
        <Link
          href={`/c/${companyId}/brain/insights`}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          View all in Brain
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(
                      insight.severity
                    )}`}
                  >
                    {insight.severity}
                  </span>
                  <span className="text-xs text-slate-500">{insight.category}</span>
                </div>
                <div className="text-sm font-medium text-slate-200">
                  {insight.title}
                </div>
                {insight.recommendation && (
                  <div className="text-xs text-slate-400 mt-1">
                    → {insight.recommendation}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotLinkCard({
  snapshotId,
  companyId,
}: {
  snapshotId: string;
  companyId: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200">
              Snapshot Created
            </div>
            <div className="text-xs text-slate-400">
              ID: {snapshotId.slice(0, 16)}...
            </div>
          </div>
        </div>

        <Link
          href={`/c/${companyId}/qbr`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
        >
          View in QBR
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
