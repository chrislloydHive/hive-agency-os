// components/tools/ToolReportLayout.tsx
// Shared layout component for tool report views
//
// Provides a consistent structure for displaying diagnostic results
// with score badges, sections, findings, and work generation CTA.

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ExtendedNextBestAction } from '@/lib/os/companies/nextBestAction.types';
import ReactMarkdown from 'react-markdown';
import type { DiagnosticToolConfig, DiagnosticToolCategory } from '@/lib/os/diagnostics/tools';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { ScoreItem, ReportSection, DiagnosticIssue } from '@/lib/types/toolReport';
import { DiagnosticIssuesPanel } from '@/components/diagnostics/DiagnosticIssuesPanel';
import * as LucideIcons from 'lucide-react';

// Re-export types for consumers
export type { ScoreItem, ReportSection, DiagnosticIssue } from '@/lib/types/toolReport';

export interface ToolReportLayoutProps {
  tool: DiagnosticToolConfig;
  company: CompanyRecord;
  run: DiagnosticRun;
  scores?: ScoreItem[];
  keyFindings?: string[];
  opportunities?: string[];
  sections?: ReportSection[];
  issues?: DiagnosticIssue[];
  workItemCount?: number;
}

// ============================================================================
// Score Helpers
// ============================================================================

function getScoreColor(score: number, maxValue: number = 100): string {
  const percentage = (score / maxValue) * 100;
  if (percentage >= 80) return 'text-emerald-400';
  if (percentage >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number, maxValue: number = 100): string {
  const percentage = (score / maxValue) * 100;
  if (percentage >= 80) return 'bg-emerald-400/10 border-emerald-400/30';
  if (percentage >= 60) return 'bg-amber-400/10 border-amber-400/30';
  return 'bg-red-400/10 border-red-400/30';
}

function getScoreLabel(score: number, maxValue: number = 100): string {
  const percentage = (score / maxValue) * 100;
  if (percentage >= 80) return 'Strong';
  if (percentage >= 60) return 'Emerging';
  if (percentage >= 40) return 'At Risk';
  return 'Critical';
}

function getCategoryColor(category: DiagnosticToolCategory): string {
  const colors: Record<DiagnosticToolCategory, string> = {
    strategy: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    website: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    brand: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    content: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    seo: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    demand: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
    ops: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  };
  return colors[category] || 'text-slate-400 bg-slate-400/10 border-slate-400/30';
}

// ============================================================================
// Component
// ============================================================================

export function ToolReportLayout({
  tool,
  company,
  run,
  scores = [],
  keyFindings = [],
  opportunities = [],
  sections = [],
  issues = [],
  workItemCount,
}: ToolReportLayoutProps) {
  const router = useRouter();
  const [isGeneratingWork, setIsGeneratingWork] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);

  // Recommended Next Fix state
  const [recommendedAction, setRecommendedAction] = useState<ExtendedNextBestAction | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState(true);
  const [isAddingToWork, setIsAddingToWork] = useState(false);

  // Compute labSlug from tool ID
  const labSlug = tool.id.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

  // Fetch recommended action for this lab
  useEffect(() => {
    const fetchRecommendedAction = async () => {
      try {
        const params = new URLSearchParams({
          limit: '1',
          labSlug,
        });
        const response = await fetch(
          `/api/os/companies/${company.id}/next-best-actions?${params}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.actions && data.actions.length > 0) {
            setRecommendedAction(data.actions[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch recommended action:', error);
      } finally {
        setIsLoadingAction(false);
      }
    };

    if (run.status === 'complete') {
      fetchRecommendedAction();
    } else {
      setIsLoadingAction(false);
    }
  }, [company.id, labSlug, run.status]);

  // Handle adding recommended action to work
  const handleAddRecommendedToWork = async () => {
    if (!recommendedAction || isAddingToWork) return;
    setIsAddingToWork(true);
    try {
      const response = await fetch(`/api/os/companies/${company.id}/work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: recommendedAction.action,
          description: `${recommendedAction.reason}\n\n**Expected Impact:** ${recommendedAction.expectedImpact || 'Not specified'}\n\n_Source: AI Recommendation_`,
          area: recommendedAction.category || tool.category,
          priority: recommendedAction.priority,
          status: 'Backlog',
          sourceType: 'AI Recommendation',
          sourceId: recommendedAction.id,
        }),
      });

      if (response.ok) {
        showToast('Added to Work', 'success');
        setRecommendedAction(null); // Hide the banner after adding
      } else {
        throw new Error('Failed to add to work');
      }
    } catch (error) {
      console.error('Failed to add recommended action to work:', error);
      showToast('Failed to add to Work', 'error');
    } finally {
      setIsAddingToWork(false);
    }
  };

  // Get icon component
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[tool.icon] || LucideIcons.HelpCircle;

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleGenerateWork = async () => {
    if (isGeneratingWork) return;
    setIsGeneratingWork(true);

    try {
      const toolSlug = tool.id.replace(/([A-Z])/g, '-$1').toLowerCase();
      const response = await fetch(`/api/tools/${toolSlug}/${run.id}/generate-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate work items');
      }

      const count = result.workItemsCreated || 0;
      showToast(`Created ${count} work item${count !== 1 ? 's' : ''} from this report`, 'success');

      if (count > 0) {
        // Optionally navigate to work page
        setTimeout(() => {
          router.push(`/c/${company.id}/work`);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to generate work items:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate work items', 'error');
    } finally {
      setIsGeneratingWork(false);
    }
  };

  const formattedDate = new Date(run.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Extract score, maturity stage, and data confidence from rawJson if not on run
  // Check multiple locations based on tool format:
  // - Direct: rawJson.overallScore, rawJson.maturityStage (most tools)
  // - Full GAP V3 (OS): rawJson.fullGap.overallScore, rawJson.fullGap.maturityStage
  // - Full GAP V4 (DMA): rawJson.scorecard.overall, rawJson.executiveSummary.maturityStage
  // - GAP IA: rawJson.initialAssessment.summary.overallScore, rawJson.initialAssessment.summary.maturityStage
  const rawData = run.rawJson as Record<string, unknown> | null | undefined;
  const fullGap = rawData?.fullGap as Record<string, unknown> | undefined;
  const initialAssessment = rawData?.initialAssessment as Record<string, unknown> | undefined;
  const iaSummary = initialAssessment?.summary as Record<string, unknown> | undefined;
  // DMA Full GAP V4 format
  const scorecard = rawData?.scorecard as Record<string, unknown> | undefined;
  const execSummary = rawData?.executiveSummary as Record<string, unknown> | undefined;
  const businessContext = rawData?.businessContext as Record<string, unknown> | undefined;
  const dataConfidenceScore = rawData?.dataConfidenceScore as Record<string, unknown> | undefined;

  // Extract score - fallback to rawJson if run.score is null
  const displayScore = run.score ?? (
    rawData?.overallScore ||
    fullGap?.overallScore ||
    scorecard?.overall ||  // DMA V4 format
    iaSummary?.overallScore ||
    initialAssessment?.overallScore
  ) as number | null | undefined;

  const maturityStage = (
    rawData?.maturityStage ||
    fullGap?.maturityStage ||
    execSummary?.maturityStage ||  // DMA V4 format
    businessContext?.maturityStage ||  // DMA V4 format
    iaSummary?.maturityStage ||
    initialAssessment?.maturityStage
  ) as string | null | undefined;

  // Data confidence can be in multiple formats:
  // - Object format: { level: string, score: number, reason?: string }
  // - String format (Full GAP V3): 'low' | 'medium' | 'high'
  // - DMA V4 format: dataConfidenceScore: { level: string, score: number, summary: string }
  const rawConfidence =
    rawData?.dataConfidence ||
    fullGap?.dataConfidence ||
    fullGap?.confidence ||
    dataConfidenceScore ||  // DMA V4 format
    rawData?.assessmentConfidence ||  // DMA V4 alternative
    initialAssessment?.dataConfidence ||
    iaSummary?.dataConfidence;

  // Normalize to object format
  const dataConfidence: { level: string; score: number; reason?: string } | null | undefined =
    rawConfidence == null ? null :
    typeof rawConfidence === 'string'
      ? { level: rawConfidence, score: rawConfidence === 'high' ? 85 : rawConfidence === 'medium' ? 60 : 35 }
      : {
          level: (rawConfidence as any).level || 'medium',
          score: (rawConfidence as any).score || 50,
          reason: (rawConfidence as any).reason || (rawConfidence as any).summary,
        };

  // Extract full report markdown if available
  // - Full GAP V4 multi-pass: rawData.growthPlan.refinedMarkdown or rawData.refinedMarkdown
  // - GAP IA: rawData.iaReportMarkdown (stored on the run record)
  const growthPlan = rawData?.growthPlan as Record<string, unknown> | undefined;
  const fullReportMarkdown: string | null =
    (growthPlan?.refinedMarkdown as string) ||
    (rawData?.refinedMarkdown as string) ||
    (rawData?.iaReportMarkdown as string) ||
    (fullGap?.refinedMarkdown as string) ||
    null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href={`/c/${company.id}`} className="hover:text-slate-300 transition-colors">
          {company.name}
        </Link>
        <span>/</span>
        <Link href={`/c/${company.id}/blueprint`} className="hover:text-slate-300 transition-colors">
          Diagnostics
        </Link>
        <span>/</span>
        <span className="text-slate-300">{tool.label}</span>
      </nav>

      {/* Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Left: Tool info */}
          <div className="flex items-start gap-4 flex-1">
            <div className={`p-3 rounded-xl border ${getCategoryColor(tool.category)}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-100">{tool.label}</h1>
              <p className="mt-1 text-sm text-slate-400">{tool.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>Run: {run.id.substring(0, 8)}...</span>
                <span>{formattedDate}</span>
                {workItemCount !== undefined && workItemCount > 0 && (
                  <span className="text-emerald-400">
                    {workItemCount} work item{workItemCount !== 1 ? 's' : ''} generated
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Score & Actions */}
          <div className="flex flex-col items-end gap-4">
            {/* Score Badge */}
            {displayScore != null && (
              <div className={`rounded-xl border px-4 py-3 ${getScoreBgColor(displayScore)}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold tabular-nums ${getScoreColor(displayScore)}`}>
                    {displayScore}
                  </span>
                  <span className="text-sm text-slate-400">/100</span>
                </div>
                <p className={`text-xs uppercase tracking-wide mt-1 ${getScoreColor(displayScore)}`}>
                  {getScoreLabel(displayScore)}
                </p>
              </div>
            )}

            {/* Maturity & Data Confidence Badges */}
            {(maturityStage || dataConfidence) && (
              <div className="flex flex-wrap gap-2 justify-end">
                {maturityStage && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    maturityStage === 'established' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                    maturityStage === 'scaling' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                    maturityStage === 'emerging' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                    'bg-red-500/10 text-red-300 border-red-500/30'
                  }`}>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Maturity:</span>
                    {maturityStage.charAt(0).toUpperCase() + maturityStage.slice(1)}
                  </span>
                )}
                {dataConfidence && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      dataConfidence.level === 'high' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                      dataConfidence.level === 'medium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                      'bg-red-500/10 text-red-300 border-red-500/30'
                    }`}
                    title={dataConfidence.reason || ''}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Data:</span>
                    {dataConfidence.level} ({dataConfidence.score}%)
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleGenerateWork}
                  disabled={isGeneratingWork || run.status !== 'complete'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                >
                  {isGeneratingWork ? (
                    <>
                      <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <LucideIcons.Sparkles className="w-4 h-4" />
                      Generate Work Plan
                    </>
                  )}
                </button>
                <Link
                  href={`/c/${company.id}/diagnostics/${tool.id.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all text-sm font-medium"
                >
                  <LucideIcons.History className="w-4 h-4" />
                  Run History
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/c/${company.id}/findings`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all text-sm font-medium"
                >
                  <LucideIcons.ClipboardList className="w-4 h-4" />
                  View in Plan
                </Link>
                <Link
                  href={`/c/${company.id}/blueprint`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all text-sm font-medium"
                >
                  <LucideIcons.ArrowLeft className="w-4 h-4" />
                  Back to Diagnostics
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Next Fix Banner */}
      {recommendedAction && !isLoadingAction && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <LucideIcons.Lightbulb className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-amber-300">Recommended Next Fix</h3>
                  {recommendedAction.isQuickWin && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <LucideIcons.Zap className="w-3 h-3" />
                      Quick win
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-200 leading-tight">{recommendedAction.action}</p>
                {recommendedAction.reason && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{recommendedAction.reason}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/c/${company.id}/findings`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
              >
                <LucideIcons.ArrowRight className="w-3 h-3" />
                View in Plan
              </Link>
              <button
                onClick={handleAddRecommendedToWork}
                disabled={isAddingToWork}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-50"
              >
                {isAddingToWork ? (
                  <LucideIcons.Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LucideIcons.Plus className="w-3 h-3" />
                )}
                Add to Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issues Panel - Prominent placement for actionable findings */}
      {issues.length > 0 ? (
        <DiagnosticIssuesPanel
          companyId={company.id}
          labSlug={labSlug}
          runId={run.id}
          issues={issues}
          title="Issues & Findings"
          showSelectAll={true}
        />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
              <LucideIcons.ClipboardList className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-300">No Structured Issues</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This diagnostic did not output structured issues. Use the summary below to manually create findings if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {(() => {
        // Generate a better summary if the stored one is broken (contains "undefined")
        const rawSummary = run.summary || '';
        let displaySummary = rawSummary;

        // If summary contains "undefined", try to build a better one from scores
        if (rawSummary.includes('undefined') && scores.length > 0) {
          const overallScore = scores.find(s => s.label === 'Overall')?.value ?? displayScore;

          if (overallScore != null) {
            displaySummary = `Overall Score: ${overallScore}/100`;
          }
        }

        // Try to extract narrative from rawJson if available
        let narrative: string | null = null;
        if (run.rawJson && typeof run.rawJson === 'object') {
          const raw = run.rawJson as any;
          const ia = raw.initialAssessment || raw;
          // Check multiple possible locations for the executive summary / narrative:
          // - GAP IA V2: summary.narrative
          // - GAP IA legacy: insights.overallSummary
          // - Full GAP V3: fullGap.executiveSummary
          // - Full GAP mapped: executiveSummary directly on plan
          const fullGap = raw.fullGap || raw;
          narrative =
            ia?.summary?.narrative ||
            ia?.insights?.overallSummary ||
            fullGap?.executiveSummary ||
            null;
        }

        // Skip this section if we found the narrative - it will be shown in the sections
        // Also skip if summary is just "Overall Score: X/100" (redundant with score display)
        const isRedundantScoreSummary = displaySummary.match(/^Overall Score: \d+\/100$/);

        // Fallback: if we have no valid summary and no narrative, skip the section
        if ((!displaySummary || displaySummary.includes('undefined') || isRedundantScoreSummary) && !narrative) {
          return null;
        }

        // If narrative exists and will be shown in sections, skip this duplicate
        if (narrative && sections.some(s => s.id === 'executive-summary')) {
          return null;
        }

        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <LucideIcons.FileText className="w-4 h-4" />
              Executive Summary
            </h2>
            {narrative ? (
              <p className="text-slate-400 whitespace-pre-wrap leading-relaxed">{narrative}</p>
            ) : !displaySummary.includes('undefined') && !isRedundantScoreSummary ? (
              <p className="text-slate-400 whitespace-pre-wrap leading-relaxed">{displaySummary}</p>
            ) : null}
          </div>
        );
      })()}

      {scores.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <LucideIcons.BarChart3 className="w-4 h-4" />
            Dimension Scores
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {scores.map((score, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-3 ${getScoreBgColor(score.value, score.maxValue || 100)}`}
              >
                <div className={`text-2xl font-bold tabular-nums ${getScoreColor(score.value, score.maxValue || 100)}`}>
                  {score.value}
                </div>
                <div className="text-xs text-slate-400 mt-1">{score.label}</div>
                {score.group && (
                  <div className="text-xs text-slate-500 mt-0.5">{score.group}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Findings & Opportunities - Side by Side */}
      {(keyFindings.length > 0 || opportunities.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key Findings */}
          {keyFindings.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <LucideIcons.AlertCircle className="w-4 h-4 text-amber-400" />
                Key Findings
              </h2>
              <ul className="space-y-2">
                {keyFindings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-amber-400 mt-1">•</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunities */}
          {opportunities.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <LucideIcons.Lightbulb className="w-4 h-4 text-emerald-400" />
                Top Opportunities
              </h2>
              <ul className="space-y-2">
                {opportunities.map((opp, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-emerald-400 mt-1">•</span>
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Custom Sections */}
      {sections.map((section) => {
        const SectionIcon = section.icon
          ? (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[section.icon] || LucideIcons.ChevronRight
          : LucideIcons.ChevronRight;

        return (
          <div key={section.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <SectionIcon className="w-4 h-4" />
              {section.title}
            </h2>
            <div className="text-slate-400">{section.body as React.ReactNode}</div>
          </div>
        );
      })}

      {/* View Full Report (Collapsible) - Shows formatted markdown report */}
      {fullReportMarkdown && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <button
            onClick={() => setShowFullReport(!showFullReport)}
            className="w-full px-5 py-4 text-left text-sm font-medium text-slate-300 hover:bg-slate-800/50 transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <LucideIcons.FileText className="w-4 h-4" />
              View Full Report
            </span>
            <LucideIcons.ChevronDown className={`w-4 h-4 transition-transform ${showFullReport ? 'rotate-180' : ''}`} />
          </button>
          {showFullReport && (
            <div className="px-5 pb-5">
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-h1:text-2xl prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-700 prose-h2:pb-2 prose-h2:mt-8 prose-h3:text-lg prose-p:text-slate-300 prose-strong:text-slate-200 prose-ul:text-slate-300 prose-ol:text-slate-300 prose-li:text-slate-300 prose-table:text-sm prose-th:text-slate-300 prose-th:bg-slate-800/50 prose-th:px-3 prose-th:py-2 prose-td:text-slate-400 prose-td:px-3 prose-td:py-2 prose-td:border-slate-700 prose-hr:border-slate-700">
                <ReactMarkdown>{fullReportMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw JSON (Collapsible) */}
      {run.rawJson !== undefined && run.rawJson !== null ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="w-full px-5 py-4 text-left text-sm font-medium text-slate-300 hover:bg-slate-800/50 transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <LucideIcons.Code className="w-4 h-4" />
              Raw JSON Data
            </span>
            <LucideIcons.ChevronDown className={`w-4 h-4 transition-transform ${showRawJson ? 'rotate-180' : ''}`} />
          </button>
          {showRawJson && (
            <div className="px-5 pb-5">
              <pre className="text-xs text-slate-500 bg-slate-950 rounded-lg p-4 overflow-auto max-h-96">
                {JSON.stringify(run.rawJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-100'
              : toast.type === 'info'
                ? 'bg-blue-900/90 border border-blue-700 text-blue-100'
                : 'bg-red-900/90 border border-red-700 text-red-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <LucideIcons.CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : toast.type === 'info' ? (
              <LucideIcons.Info className="h-5 w-5 text-blue-400" />
            ) : (
              <LucideIcons.XCircle className="h-5 w-5 text-red-400" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolReportLayout;
