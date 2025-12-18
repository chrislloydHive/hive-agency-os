'use client';

// components/reports/renderers/GapReportRenderer.tsx
// Renderer for GAP (Initial Assessment and Full Plan) reports

import { type ReportDetail } from '@/lib/reports/diagnosticReports';
import {
  Target,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Zap,
  FileText,
  HelpCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GapReportRendererProps {
  report: ReportDetail;
}

// ============================================================================
// Executive Summary Component
// ============================================================================

function ExecutiveSummary({ summary }: { summary: string | null | undefined }) {
  if (!summary) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Executive Summary</h3>
      </div>
      <p className="text-slate-300 leading-relaxed whitespace-pre-line">{summary}</p>
    </div>
  );
}

// ============================================================================
// Maturity Stage Component
// ============================================================================

function MaturityStage({ stage, score }: { stage: string | null | undefined; score: number | null | undefined }) {
  if (!stage) return null;

  const stageConfig: Record<string, { color: string; description: string }> = {
    unproven: {
      color: 'bg-red-600/20 text-red-400 border-red-600/30',
      description: 'Early stage with significant gaps to address',
    },
    emerging: {
      color: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
      description: 'Building foundations with room for improvement',
    },
    scaling: {
      color: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
      description: 'Solid foundation ready for growth',
    },
    established: {
      color: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
      description: 'Mature and well-optimized',
    },
  };

  const config = stageConfig[stage.toLowerCase()] || stageConfig.emerging;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Maturity Assessment</h3>
      </div>

      <div className="flex items-center gap-4">
        <div className={`px-4 py-2 rounded-lg border ${config.color} font-medium capitalize`}>
          {stage}
        </div>
        {score !== null && score !== undefined && (
          <div className="text-2xl font-bold text-white">
            {Math.round(score)}<span className="text-sm text-slate-500">/100</span>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-400">{config.description}</p>
    </div>
  );
}

// ============================================================================
// Dimensions Section Component
// ============================================================================

function DimensionsSection({ dimensions }: { dimensions: unknown[] }) {
  if (!dimensions || dimensions.length === 0) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Dimension Scores</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {dimensions.map((dim: any, idx) => (
          <div key={dim.key || idx} className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white">
                {dim.label || dim.name || dim.key || `Dimension ${idx + 1}`}
              </span>
              {dim.score !== undefined && (
                <span className={`font-bold ${getScoreColor(dim.score)}`}>
                  {Math.round(dim.score)}
                </span>
              )}
            </div>
            {dim.summary && (
              <p className="text-sm text-slate-400 line-clamp-2">{dim.summary}</p>
            )}
            {dim.status && (
              <span
                className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  dim.status === 'strong' || dim.status === 'good'
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : dim.status === 'moderate' || dim.status === 'average'
                    ? 'bg-amber-600/20 text-amber-400'
                    : 'bg-red-600/20 text-red-400'
                }`}
              >
                {dim.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Priorities Section Component
// ============================================================================

function PrioritiesSection({ priorities }: { priorities: unknown[] }) {
  if (!priorities || priorities.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Top Priorities</h3>
      </div>

      <div className="space-y-3">
        {priorities.slice(0, 10).map((priority: any, idx) => (
          <div
            key={priority.id || idx}
            className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-4"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center text-sm font-medium">
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="font-medium text-white">
                {priority.title || priority.name}
              </div>
              {priority.description && (
                <p className="text-sm text-slate-400 mt-1">{priority.description}</p>
              )}
              {priority.rationale && (
                <p className="text-sm text-slate-500 mt-1 italic">{priority.rationale}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {priority.impact && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-600/20 text-blue-400">
                    Impact: {priority.impact}
                  </span>
                )}
                {priority.effort && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-600/20 text-slate-400">
                    Effort: {priority.effort}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Wins Section Component
// ============================================================================

function QuickWinsSection({ quickWins }: { quickWins: unknown[] }) {
  if (!quickWins || quickWins.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Quick Wins</h3>
      </div>

      <div className="space-y-2">
        {quickWins.slice(0, 8).map((win: any, idx) => (
          <div
            key={win.id || idx}
            className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-white">
                {typeof win === 'string' ? win : win.title || win.action}
              </div>
              {win.description && (
                <p className="text-xs text-slate-500 mt-1">{win.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Blockers/Risks Section Component
// ============================================================================

function BlockersSection({ blockers }: { blockers: unknown[] }) {
  if (!blockers || blockers.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-white">Blockers & Risks</h3>
      </div>

      <div className="space-y-3">
        {blockers.slice(0, 10).map((blocker: any, idx) => (
          <div
            key={blocker.id || idx}
            className="flex items-start gap-3 bg-red-950/20 border border-red-800/30 rounded-lg p-4"
          >
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-red-300">
                {typeof blocker === 'string' ? blocker : blocker.title || blocker.description}
              </div>
              {blocker.domain && (
                <span className="text-xs text-red-400/60 mt-1 block">
                  Domain: {blocker.domain}
                </span>
              )}
              {blocker.severity && (
                <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded ${
                  blocker.severity === 'critical' || blocker.severity === 'high'
                    ? 'bg-red-600/20 text-red-400'
                    : 'bg-amber-600/20 text-amber-400'
                }`}>
                  {blocker.severity}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Unknowns Section Component
// ============================================================================

function UnknownsSection({ unknowns }: { unknowns: unknown[] }) {
  if (!unknowns || unknowns.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-white">Open Questions</h3>
      </div>

      <div className="space-y-2">
        {unknowns.slice(0, 10).map((unknown: any, idx) => (
          <div
            key={unknown.id || idx}
            className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3"
          >
            <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-slate-300">
                {typeof unknown === 'string' ? unknown : unknown.question || unknown.title}
              </div>
              {unknown.domain && (
                <span className="text-xs text-slate-500 mt-1 block">
                  Domain: {unknown.domain}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Insights Section Component
// ============================================================================

function InsightsSection({ insights }: { insights: Record<string, unknown> }) {
  if (!insights || Object.keys(insights).length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Key Insights</h3>
      </div>

      <div className="space-y-4">
        {Object.entries(insights).map(([key, value]) => {
          if (!value || (typeof value === 'object' && Object.keys(value as object).length === 0)) {
            return null;
          }

          return (
            <div key={key} className="bg-slate-800/50 rounded-lg p-4">
              <div className="font-medium text-slate-300 mb-2 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              {typeof value === 'string' ? (
                <p className="text-sm text-slate-400">{value}</p>
              ) : Array.isArray(value) ? (
                <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                  {value.slice(0, 5).map((item, idx) => (
                    <li key={idx}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                  ))}
                </ul>
              ) : (
                <pre className="text-xs text-slate-400 overflow-x-auto">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main GAP Renderer Component
// ============================================================================

export function GapReportRenderer({ report }: GapReportRendererProps) {
  const data = report.data as Record<string, unknown>;

  // GAP-IA structure
  const initialAssessment = data.initialAssessment as Record<string, unknown> | undefined;
  const iaData = initialAssessment || data;

  // Extract common fields
  const summary = (iaData.summary as any)?.narrative ||
    (iaData.summary as any)?.executive ||
    (data.executiveSummary as string) ||
    (data.narrative as string) ||
    null;

  const maturityStage = (iaData.summary as any)?.maturityStage ||
    (iaData.maturityStage as string) ||
    (data.maturityStage as string) ||
    null;

  const overallScore = (iaData.summary as any)?.overallScore ||
    (iaData.overallScore as number) ||
    (data.overallScore as number) ||
    report.score;

  const dimensions = (iaData.dimensions as unknown[]) || (data.dimensions as unknown[]) || [];
  const priorities = (iaData.priorities as unknown[]) || (data.priorities as unknown[]) || [];
  const quickWins = (iaData.plan as any)?.quickWins ||
    (iaData.quickWins as unknown[]) ||
    (data.quickWins as unknown[]) ||
    [];
  const blockers = (iaData.blockers as unknown[]) || (data.blockers as unknown[]) || [];
  const unknowns = (iaData.unknowns as unknown[]) || (data.unknowns as unknown[]) || [];
  const insights = (iaData.insights as Record<string, unknown>) || (data.insights as Record<string, unknown>) || {};

  return (
    <div>
      {/* Maturity Stage */}
      <MaturityStage stage={maturityStage} score={overallScore} />

      {/* Executive Summary */}
      <ExecutiveSummary summary={summary} />

      {/* Dimensions */}
      {dimensions.length > 0 && <DimensionsSection dimensions={dimensions} />}

      {/* Top Priorities */}
      {priorities.length > 0 && <PrioritiesSection priorities={priorities} />}

      {/* Quick Wins */}
      {quickWins.length > 0 && <QuickWinsSection quickWins={quickWins} />}

      {/* Blockers */}
      {blockers.length > 0 && <BlockersSection blockers={blockers} />}

      {/* Open Questions */}
      {unknowns.length > 0 && <UnknownsSection unknowns={unknowns} />}

      {/* Key Insights */}
      {Object.keys(insights).length > 0 && <InsightsSection insights={insights} />}

      {/* Fallback if no structured data */}
      {!summary &&
        !maturityStage &&
        dimensions.length === 0 &&
        priorities.length === 0 &&
        quickWins.length === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-slate-400">
              No structured GAP report data available. Check the raw JSON below for details.
            </p>
          </div>
        )}
    </div>
  );
}
