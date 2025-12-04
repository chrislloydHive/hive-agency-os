// components/os/CompanyBrainPage.tsx
// ============================================================================
// Company Brain Page - AI-Generated Company Intelligence Narrative
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  Brain,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  Lightbulb,
  Target,
  HelpCircle,
  Building2,
  Globe,
  Users,
  TrendingUp,
  FileText,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
  ExternalLink,
  FileBarChart,
} from 'lucide-react';
import type { CompanyBrainData } from '@/lib/brain/getCompanyBrainData';
import type { CompanyBrainNarrative } from '@/lib/brain/generateCompanyBrainNarrative';

// ============================================================================
// Types
// ============================================================================

interface CompanyBrainPageProps {
  companyId: string;
  data: CompanyBrainData;
  narrative: CompanyBrainNarrative;
}

// ============================================================================
// Confidence Badge Component (matches ToolReportLayout style)
// ============================================================================

function ConfidenceBadge({
  level,
  score,
}: {
  level: 'low' | 'medium' | 'high';
  score?: number;
}) {
  const colors = {
    low: 'bg-red-500/10 text-red-300 border-red-500/30',
    medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    high: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  };

  // Use provided score or default based on level
  const displayScore = score ?? (level === 'high' ? 85 : level === 'medium' ? 60 : 35);

  const labels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[level]}`}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Data:</span>
      {labels[level]} ({displayScore}%)
    </span>
  );
}

// ============================================================================
// Lab Status Badge Component
// ============================================================================

function LabStatusBadge({
  status,
  score,
}: {
  status: 'pending' | 'running' | 'complete' | 'failed' | null;
  score?: number | null;
}) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <XCircle className="w-3 h-3" />
        Not run
      </span>
    );
  }

  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle className="w-3 h-3" />
        {score !== null && score !== undefined ? `${score}/100` : 'Complete'}
      </span>
    );
  }

  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
        <Clock className="w-3 h-3 animate-spin" />
        Running
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <XCircle className="w-3 h-3" />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Clock className="w-3 h-3" />
      Pending
    </span>
  );
}

// ============================================================================
// Section Card Component
// ============================================================================

function SectionCard({
  title,
  icon: Icon,
  content,
  className = '',
}: {
  title: string;
  icon: React.ElementType;
  content: string;
  className?: string;
}) {
  if (!content || content.trim() === '') {
    return null;
  }

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
        {content}
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyBrainPage({
  companyId,
  data,
  narrative,
}: CompanyBrainPageProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentNarrative, setCurrentNarrative] = useState(narrative);
  const [error, setError] = useState<string | null>(null);

  // Handle regenerate
  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/brain/regenerate`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate narrative');
      }

      const result = await response.json();
      setCurrentNarrative(result.narrative);
    } catch (err) {
      console.error('Failed to regenerate:', err);
      setError('Failed to regenerate narrative. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }, [companyId]);

  // Format generated date
  const generatedDate = currentNarrative.generatedAt
    ? new Date(currentNarrative.generatedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href={`/c/${companyId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {data.company.name}
      </Link>

      {/* Page Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl">
              <Brain className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Company Brain</h1>
              <p className="mt-1 text-sm text-slate-400">
                AI-generated summary of everything Hive OS knows about{' '}
                {data.company.name}
              </p>
            </div>
          </div>

          <ConfidenceBadge
            level={currentNarrative.dataConfidence.level}
            score={currentNarrative.dataConfidence.score}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-400/70 hover:text-red-400 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left Column - Main Narrative */}
        <div className="space-y-6">
          {/* Narrative Card */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <h2 className="font-semibold text-slate-100">
                  Company Intelligence Narrative
                </h2>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}
                />
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>

            {/* Narrative Content */}
            <div className="p-6">
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-strong:text-slate-200 prose-ul:text-slate-300 prose-li:text-slate-300">
                <ReactMarkdown>{currentNarrative.narrativeMarkdown}</ReactMarkdown>
              </div>
            </div>

            {/* Card Footer */}
            {generatedDate && (
              <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/30">
                <p className="text-xs text-slate-500">
                  Last generated: {generatedDate}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Key Signals & Meta */}
        <div className="space-y-6">
          {/* Company Quick Facts */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Company Snapshot
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Name</span>
                <span className="text-sm text-slate-200">{data.company.name}</span>
              </div>
              {data.company.domain && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Domain</span>
                  <a
                    href={`https://${data.company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    {data.company.domain}
                  </a>
                </div>
              )}
              {data.company.type && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Type</span>
                  <span className="text-sm text-slate-200">{data.company.type}</span>
                </div>
              )}
              {data.company.stage && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Stage</span>
                  <span className="text-sm text-slate-200">{data.company.stage}</span>
                </div>
              )}
              {data.company.industry && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Industry</span>
                  <span className="text-sm text-slate-200">
                    {data.company.industry}
                  </span>
                </div>
              )}
              {data.company.icp && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">ICP</span>
                  <span className="text-sm text-slate-200 text-right max-w-[200px] truncate">
                    {data.company.icp}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Diagnostic Labs Status */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Diagnostic Labs
              </h3>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Brand Lab', data: data.brandLab },
                { name: 'Website Lab', data: data.websiteLab },
                { name: 'SEO Lab', data: data.seoLab },
                { name: 'Content Lab', data: data.contentLab },
                { name: 'Ops Lab', data: data.opsLab },
                { name: 'Demand Lab', data: data.demandLab },
              ].map(({ name, data: labData }) => (
                <div
                  key={name}
                  className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0"
                >
                  <span className="text-xs text-slate-400">{name}</span>
                  <LabStatusBadge
                    status={labData?.status || null}
                    score={labData?.score}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Library - Links to Reports & Documents */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Library
              </h3>
            </div>
            <div className="space-y-2">
              {/* GAP Plan Runs from GAP-Plan Run table */}
              {data.gapPlanRuns && data.gapPlanRuns
                .filter(run => run.status === 'completed' || run.status === 'complete')
                .slice(0, 3)
                .map((run, index) => (
                  <Link
                    key={run.id}
                    href={`/c/${companyId}/gap/${run.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <FileBarChart className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-slate-300">
                        GAP Plan{data.gapPlanRuns.filter(r => r.status === 'completed' || r.status === 'complete').length > 1 ? ` #${index + 1}` : ''}
                      </span>
                      {run.overallScore !== undefined && (
                        <span className="text-[10px] text-slate-500">{run.overallScore}/100</span>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </Link>
                ))}

              {/* GAP IA Runs from GAP-IA Run table */}
              {data.gapIaRuns && data.gapIaRuns
                .filter(run => run.status === 'completed' || run.status === 'complete')
                .slice(0, 3)
                .map((run, index) => (
                  <Link
                    key={run.id}
                    href={`/c/${companyId}/gap/${run.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <FileBarChart className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-300">
                        GAP Snapshot{data.gapIaRuns.filter(r => r.status === 'completed' || r.status === 'complete').length > 1 ? ` #${index + 1}` : ''}
                      </span>
                      {(run as any).overallScore !== undefined && (
                        <span className="text-[10px] text-slate-500">{(run as any).overallScore}/100</span>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </Link>
                ))}

              {/* Legacy: GAP Reports from Diagnostic Runs table (for backward compat) */}
              {data.gapPlan?.id && data.gapPlan?.status === 'complete' && (
                <Link
                  href={`/c/${companyId}/reports/${data.gapPlan.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <FileBarChart className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-300">GAP Plan Report</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </Link>
              )}
              {data.gapSnapshot?.id && data.gapSnapshot?.status === 'complete' && (
                <Link
                  href={`/c/${companyId}/reports/${data.gapSnapshot.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <FileBarChart className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-300">GAP Snapshot</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </Link>
              )}

              {/* Diagnostic Lab Reports */}
              {data.allDiagnosticRuns
                .filter(run => run.status === 'complete')
                .slice(0, 5)
                .map(run => {
                  const labNames: Record<string, string> = {
                    brandLab: 'Brand Lab',
                    websiteLab: 'Website Lab',
                    seoLab: 'SEO Lab',
                    contentLab: 'Content Lab',
                    opsLab: 'Ops Lab',
                    demandLab: 'Demand Lab',
                  };
                  const labName = labNames[run.toolId] || run.toolId;
                  return (
                    <Link
                      key={run.id}
                      href={`/c/${companyId}/reports/${run.id}`}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-300">{labName}</span>
                        {run.score !== null && (
                          <span className="text-[10px] text-slate-500">{run.score}/100</span>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </Link>
                  );
                })}

              {/* Documents */}
              {data.documents.length > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Documents</p>
                  {data.documents.slice(0, 3).map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 py-1.5 text-xs text-slate-400"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate">{doc.name || 'Untitled'}</span>
                    </div>
                  ))}
                  {data.documents.length > 3 && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      +{data.documents.length - 3} more documents
                    </p>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!data.gapPlan?.id &&
               !data.gapSnapshot?.id &&
               (!data.gapPlanRuns || data.gapPlanRuns.filter(r => r.status === 'completed' || r.status === 'complete').length === 0) &&
               (!data.gapIaRuns || data.gapIaRuns.filter(r => r.status === 'completed' || r.status === 'complete').length === 0) &&
               data.allDiagnosticRuns.filter(r => r.status === 'complete').length === 0 &&
               data.documents.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">
                  No reports or documents yet. Run diagnostics to generate reports.
                </p>
              )}
            </div>
          </div>

          {/* Top Risks */}
          {currentNarrative.sections.risks && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-red-300">Top Risks</h3>
              </div>
              <div className="prose prose-invert prose-sm max-w-none prose-p:text-red-200/80 prose-ul:text-red-200/80 prose-li:text-red-200/80 prose-li:marker:text-red-400">
                <ReactMarkdown>{currentNarrative.sections.risks}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Opportunities */}
          {currentNarrative.sections.opportunities && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-300">
                  Opportunities
                </h3>
              </div>
              <div className="prose prose-invert prose-sm max-w-none prose-p:text-emerald-200/80 prose-ul:text-emerald-200/80 prose-li:text-emerald-200/80 prose-li:marker:text-emerald-400">
                <ReactMarkdown>
                  {currentNarrative.sections.opportunities}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Missing Info / Data Confidence */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Data Confidence
              </h3>
            </div>

            {/* Confidence Reasons */}
            {currentNarrative.dataConfidence.reasons.length > 0 && (
              <ul className="space-y-1 mb-4">
                {currentNarrative.dataConfidence.reasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-400 flex items-start gap-2"
                  >
                    <span className="text-slate-600 mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Missing Info */}
            {currentNarrative.sections.missingInfo && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Missing Data
                </p>
                <p className="text-xs text-slate-400">
                  {currentNarrative.sections.missingInfo}
                </p>
              </div>
            )}
          </div>

          {/* Section Highlights */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Section Highlights
              </h3>
            </div>
            <div className="space-y-3">
              <SectionCard
                title="Brand"
                icon={Building2}
                content={currentNarrative.sections.brandSummary}
              />
              <SectionCard
                title="Website"
                icon={Globe}
                content={currentNarrative.sections.websiteSummary}
              />
              <SectionCard
                title="SEO"
                icon={TrendingUp}
                content={currentNarrative.sections.seoSummary}
              />
              <SectionCard
                title="Content"
                icon={FileText}
                content={currentNarrative.sections.contentSummary}
              />
              <SectionCard
                title="Demand"
                icon={Users}
                content={currentNarrative.sections.demandSummary}
              />
            </div>
          </div>

          {/* Insights & Documents Count */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {data.insights.length}
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
                Insights
              </p>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {data.documents.length}
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
                Documents
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyBrainPage;
