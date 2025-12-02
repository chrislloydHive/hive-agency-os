// components/tools/ToolReportLayout.tsx
// Shared layout component for tool report views
//
// Provides a consistent structure for displaying diagnostic results
// with score badges, sections, findings, and work generation CTA.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DiagnosticToolConfig, DiagnosticToolCategory } from '@/lib/os/diagnostics/tools';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { ScoreItem, ReportSection } from '@/lib/types/toolReport';
import * as LucideIcons from 'lucide-react';

// Re-export types for consumers
export type { ScoreItem, ReportSection } from '@/lib/types/toolReport';

export interface ToolReportLayoutProps {
  tool: DiagnosticToolConfig;
  company: CompanyRecord;
  run: DiagnosticRun;
  scores?: ScoreItem[];
  keyFindings?: string[];
  opportunities?: string[];
  sections?: ReportSection[];
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
  workItemCount,
}: ToolReportLayoutProps) {
  const router = useRouter();
  const [isGeneratingWork, setIsGeneratingWork] = useState(false);
  const [isExtractingInsights, setIsExtractingInsights] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

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

  const handleExtractInsights = async () => {
    if (isExtractingInsights) return;
    setIsExtractingInsights(true);

    try {
      const toolSlug = tool.id.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      const response = await fetch('/api/client-brain/insights/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: run.id,
          companyId: company.id,
          toolSlug,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract insights');
      }

      if (result.alreadyExtracted) {
        showToast(`Already extracted ${result.insights?.length || 0} insights from this run`, 'info');
      } else {
        const count = result.insights?.length || 0;
        showToast(`Extracted ${count} insight${count !== 1 ? 's' : ''} to Brain`, 'success');
      }
    } catch (error) {
      console.error('Failed to extract insights:', error);
      showToast(error instanceof Error ? error.message : 'Failed to extract insights', 'error');
    } finally {
      setIsExtractingInsights(false);
    }
  };

  const formattedDate = new Date(run.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href={`/c/${company.id}`} className="hover:text-slate-300 transition-colors">
          {company.name}
        </Link>
        <span>/</span>
        <Link href={`/c/${company.id}/blueprint`} className="hover:text-slate-300 transition-colors">
          Blueprint
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
            {run.score != null && (
              <div className={`rounded-xl border px-4 py-3 ${getScoreBgColor(run.score)}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold tabular-nums ${getScoreColor(run.score)}`}>
                    {run.score}
                  </span>
                  <span className="text-sm text-slate-400">/100</span>
                </div>
                <p className={`text-xs uppercase tracking-wide mt-1 ${getScoreColor(run.score)}`}>
                  {getScoreLabel(run.score)}
                </p>
              </div>
            )}

            {/* Action Buttons */}
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
              <button
                onClick={handleExtractInsights}
                disabled={isExtractingInsights || run.status !== 'complete'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
              >
                {isExtractingInsights ? (
                  <>
                    <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <LucideIcons.Lightbulb className="w-4 h-4" />
                    Extract Insights
                  </>
                )}
              </button>
              <Link
                href={`/c/${company.id}/blueprint`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all text-sm font-medium"
              >
                <LucideIcons.ArrowLeft className="w-4 h-4" />
                Back to Blueprint
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {(() => {
        // Generate a better summary if the stored one is broken (contains "undefined")
        const rawSummary = run.summary || '';
        let displaySummary = rawSummary;

        // If summary contains "undefined", try to build a better one from scores
        if (rawSummary.includes('undefined') && scores.length > 0) {
          const overallScore = scores.find(s => s.label === 'Overall')?.value ?? run.score;

          if (overallScore != null) {
            displaySummary = `Overall Score: ${overallScore}/100`;
          }
        }

        // Try to extract narrative from rawJson if available
        let narrative: string | null = null;
        if (run.rawJson && typeof run.rawJson === 'object') {
          const raw = run.rawJson as any;
          const ia = raw.initialAssessment || raw;
          narrative = ia?.summary?.narrative || ia?.insights?.overallSummary || null;
        }

        // Fallback: if we have no valid summary and no narrative, skip the section
        if ((!displaySummary || displaySummary.includes('undefined')) && !narrative) {
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
            ) : !displaySummary.includes('undefined') ? (
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
