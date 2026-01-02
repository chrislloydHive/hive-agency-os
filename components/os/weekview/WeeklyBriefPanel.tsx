'use client';

// components/os/weekview/WeeklyBriefPanel.tsx
// Weekly Brief Panel - Monday morning summary for Week View
//
// Displays:
// - Latest brief markdown with collapsible sections
// - Last generated time + debugId (collapsed)
// - Regenerate button (internal-only)
// - Empty state with "Generate now" if no brief exists

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ListTodo,
  Inbox,
  GitBranch,
  History,
  Target,
} from 'lucide-react';
import type { WeeklyBrief, WeeklyBriefContent } from '@/lib/types/weeklyBrief';

// ============================================================================
// Types
// ============================================================================

interface WeeklyBriefPanelProps {
  companyId: string;
  weekKey?: string;
}

interface ApiResponse {
  brief: WeeklyBrief | null;
  weekKey: string;
  hasHistory: boolean;
}

// ============================================================================
// Section Components
// ============================================================================

function SectionHeader({
  icon: Icon,
  title,
  badge,
  isExpanded,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string | number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-white">{title}</span>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-300 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {isExpanded ? (
        <ChevronUp className="w-4 h-4 text-slate-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-slate-500" />
      )}
    </button>
  );
}

function DeliverablesList({
  items,
  isOverdue = false,
}: {
  items: WeeklyBriefContent['thisWeek'];
  isOverdue?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">
        {isOverdue ? 'No overdue deliverables' : 'No deliverables due this week'}
      </p>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {items.map((domain) => (
        <div key={domain.domain}>
          <p className="text-xs font-medium text-slate-400 mb-1">
            {domain.domain} ({domain.count})
          </p>
          <ul className="space-y-1">
            {domain.items.slice(0, 3).map((item) => (
              <li key={item.id} className="text-sm text-slate-300 flex items-start gap-2">
                <span className={isOverdue ? 'text-amber-400' : 'text-slate-500'}>
                  {isOverdue ? '!' : '-'}
                </span>
                <span className="flex-1">
                  {item.title}
                  <span className="text-slate-500"> - {item.programTitle}</span>
                </span>
              </li>
            ))}
            {domain.items.length > 3 && (
              <li className="text-xs text-slate-500 pl-4">
                +{domain.items.length - 3} more
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function HealthSummary({ content }: { content: WeeklyBriefContent }) {
  const { summary, atRiskPrograms } = content.programHealth;

  return (
    <div className="py-2 space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400">{summary.healthy} Healthy</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400">{summary.attention} Attention</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400">{summary.atRisk} At Risk</span>
        </div>
      </div>

      {atRiskPrograms.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">At-Risk Programs:</p>
          {atRiskPrograms.map((program) => (
            <div key={program.programId} className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              <p className="text-sm font-medium text-red-300">{program.programTitle}</p>
              <ul className="mt-1 space-y-0.5">
                {program.topIssues.map((issue, i) => (
                  <li key={i} className="text-xs text-red-200/70">- {issue}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunbookSummary({ content }: { content: WeeklyBriefContent }) {
  const { runbook } = content;

  if (!runbook) {
    return <p className="text-sm text-slate-500 py-2">No runbook data for last week</p>;
  }

  const completionColor =
    runbook.completionPercentage >= 80
      ? 'text-emerald-400'
      : runbook.completionPercentage >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">Last week completion:</span>
        <span className={`text-sm font-semibold ${completionColor}`}>
          {runbook.completionPercentage}%
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {runbook.completedItems}/{runbook.totalItems} items completed
      </p>
      {runbook.incompleteByDomain.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Top incomplete:</p>
          <div className="flex flex-wrap gap-1">
            {runbook.incompleteByDomain.map((d) => (
              <span
                key={d.domain}
                className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded"
              >
                {d.domain}: {d.pendingCount}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalsSummary({ content }: { content: WeeklyBriefContent }) {
  const { approvalsPending } = content;

  if (approvalsPending.count === 0) {
    return <p className="text-sm text-slate-500 py-2">No pending approvals</p>;
  }

  return (
    <div className="py-2 space-y-2">
      <p className="text-sm text-slate-300">
        <span className="font-semibold text-white">{approvalsPending.count}</span> items awaiting review
      </p>
      <ul className="space-y-1">
        {approvalsPending.items.slice(0, 5).map((item) => (
          <li key={item.id} className="text-sm text-slate-400 flex items-center gap-2">
            <span className="text-slate-500">-</span>
            {item.title}
            <span className="text-xs text-slate-600">({item.type})</span>
          </li>
        ))}
        {approvalsPending.items.length > 5 && (
          <li className="text-xs text-slate-500 pl-4">
            +{approvalsPending.count - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}

function RecentChangesSummary({ content }: { content: WeeklyBriefContent }) {
  const { recentChanges } = content;

  if (recentChanges.length === 0) {
    return <p className="text-sm text-slate-500 py-2">No governance changes in the last 7 days</p>;
  }

  return (
    <div className="py-2 space-y-2">
      {recentChanges.slice(0, 5).map((change, i) => (
        <div key={i} className="text-sm">
          <span className="text-white font-medium">{change.programTitle}:</span>{' '}
          <span className="text-slate-400">{change.description}</span>
        </div>
      ))}
    </div>
  );
}

function RecommendedActions({ content }: { content: WeeklyBriefContent }) {
  const { recommendedActions } = content;

  if (recommendedActions.length === 0) {
    return <p className="text-sm text-slate-500 py-2">No recommended actions at this time</p>;
  }

  return (
    <div className="py-2 space-y-2">
      {recommendedActions.map((action, i) => (
        <div
          key={action.id}
          className="flex items-start gap-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg"
        >
          <span className="text-purple-400 font-semibold text-sm">{i + 1}.</span>
          <div className="flex-1">
            <p className="text-sm text-purple-300">{action.action}</p>
            {action.context && (
              <p className="text-xs text-purple-400/70 mt-0.5">{action.context}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WeeklyBriefPanel({ companyId, weekKey = 'current' }: WeeklyBriefPanelProps) {
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);
  const [currentWeekKey, setCurrentWeekKey] = useState<string>('');
  const [hasHistory, setHasHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedDebugId, setCopiedDebugId] = useState(false);

  // Section expansion states
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['thisWeek', 'overdue', 'health', 'actions'])
  );

  // Fetch brief data
  const fetchBrief = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/weekly-brief?weekKey=${weekKey}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch weekly brief');
      }
      const data: ApiResponse = await response.json();
      setBrief(data.brief);
      setCurrentWeekKey(data.weekKey);
      setHasHistory(data.hasHistory);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, weekKey]);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  // Regenerate brief
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/weekly-brief/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekKey: currentWeekKey }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger regeneration');
      }

      // Poll for the new brief after a short delay
      setTimeout(async () => {
        await fetchBrief();
        setIsRegenerating(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
      setIsRegenerating(false);
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Copy debug ID
  const copyDebugId = async () => {
    if (!brief?.debugId) return;
    try {
      await navigator.clipboard.writeText(brief.debugId);
      setCopiedDebugId(true);
      setTimeout(() => setCopiedDebugId(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  // Format relative time
  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays}d ago`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading weekly brief...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-800/50 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!brief) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="text-center py-4">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">No Brief Available</h3>
          <p className="text-sm text-slate-400 mb-4">
            {hasHistory
              ? `No brief generated for week ${currentWeekKey}`
              : 'Weekly briefs are generated every Monday at 7am PT'}
          </p>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate Now
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const content = brief.content;
  const totalOverdue = content.overdue.reduce((sum, d) => sum + d.count, 0);
  const totalThisWeek = content.thisWeek.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Weekly Brief</h3>
            <p className="text-xs text-slate-500">{brief.weekKey}</p>
          </div>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {isRegenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Regenerate
        </button>
      </div>

      {/* Content Sections */}
      <div className="p-4 space-y-3">
        {/* This Week */}
        <div>
          <SectionHeader
            icon={ListTodo}
            title="This Week"
            badge={totalThisWeek > 0 ? totalThisWeek : undefined}
            isExpanded={expandedSections.has('thisWeek')}
            onToggle={() => toggleSection('thisWeek')}
          />
          {expandedSections.has('thisWeek') && (
            <div className="mt-2 pl-2">
              <DeliverablesList items={content.thisWeek} />
            </div>
          )}
        </div>

        {/* Overdue */}
        <div>
          <SectionHeader
            icon={AlertTriangle}
            title="Overdue"
            badge={totalOverdue > 0 ? totalOverdue : undefined}
            isExpanded={expandedSections.has('overdue')}
            onToggle={() => toggleSection('overdue')}
          />
          {expandedSections.has('overdue') && (
            <div className="mt-2 pl-2">
              <DeliverablesList items={content.overdue} isOverdue />
            </div>
          )}
        </div>

        {/* Program Health */}
        <div>
          <SectionHeader
            icon={Activity}
            title="Program Health"
            isExpanded={expandedSections.has('health')}
            onToggle={() => toggleSection('health')}
          />
          {expandedSections.has('health') && (
            <div className="mt-2 pl-2">
              <HealthSummary content={content} />
            </div>
          )}
        </div>

        {/* Runbook */}
        <div>
          <SectionHeader
            icon={CheckCircle2}
            title="Runbook"
            badge={content.runbook ? `${content.runbook.completionPercentage}%` : undefined}
            isExpanded={expandedSections.has('runbook')}
            onToggle={() => toggleSection('runbook')}
          />
          {expandedSections.has('runbook') && (
            <div className="mt-2 pl-2">
              <RunbookSummary content={content} />
            </div>
          )}
        </div>

        {/* Approvals Pending */}
        <div>
          <SectionHeader
            icon={Inbox}
            title="Approvals Pending"
            badge={content.approvalsPending.count > 0 ? content.approvalsPending.count : undefined}
            isExpanded={expandedSections.has('approvals')}
            onToggle={() => toggleSection('approvals')}
          />
          {expandedSections.has('approvals') && (
            <div className="mt-2 pl-2">
              <ApprovalsSummary content={content} />
            </div>
          )}
        </div>

        {/* Scope Drift */}
        {content.scopeDrift.totalBlocked > 0 && (
          <div>
            <SectionHeader
              icon={GitBranch}
              title="Scope Drift"
              badge={content.scopeDrift.totalBlocked}
              isExpanded={expandedSections.has('drift')}
              onToggle={() => toggleSection('drift')}
            />
            {expandedSections.has('drift') && (
              <div className="mt-2 pl-2 py-2">
                <p className="text-sm text-slate-300">
                  {content.scopeDrift.totalBlocked} blocked actions in the last 30 days
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recent Changes */}
        <div>
          <SectionHeader
            icon={History}
            title="Recent Changes"
            badge={content.recentChanges.length > 0 ? content.recentChanges.length : undefined}
            isExpanded={expandedSections.has('changes')}
            onToggle={() => toggleSection('changes')}
          />
          {expandedSections.has('changes') && (
            <div className="mt-2 pl-2">
              <RecentChangesSummary content={content} />
            </div>
          )}
        </div>

        {/* Recommended Actions */}
        <div>
          <SectionHeader
            icon={Target}
            title="Recommended Actions"
            badge={content.recommendedActions.length > 0 ? content.recommendedActions.length : undefined}
            isExpanded={expandedSections.has('actions')}
            onToggle={() => toggleSection('actions')}
          />
          {expandedSections.has('actions') && (
            <div className="mt-2 pl-2">
              <RecommendedActions content={content} />
            </div>
          )}
        </div>
      </div>

      {/* Footer - Generated info */}
      <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Generated {formatTimeAgo(brief.createdAt)}</span>
          </div>
          <button
            onClick={copyDebugId}
            className="flex items-center gap-1 hover:text-slate-400 transition-colors"
          >
            <Copy className="w-3 h-3" />
            <span className="font-mono">{brief.debugId}</span>
            {copiedDebugId && <span className="text-emerald-400 ml-1">Copied!</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeeklyBriefPanel;
