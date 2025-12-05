'use client';

// app/c/[companyId]/brain/insights/InsightCardClient.tsx
// Client component for insight cards with Create Work and Status functionality

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Globe,
  Palette,
  FileText,
  Search,
  BarChart2,
  Settings,
  Users,
  Tv,
  Lightbulb,
  Radar,
  Loader2,
  CheckCircle,
  Plus,
  MoreHorizontal,
  Play,
  XCircle,
  Clock,
} from 'lucide-react';
import type { ClientInsight, InsightSeverity, InsightCategory, InsightStatus } from '@/lib/types/clientBrain';

interface InsightCardClientProps {
  insight: ClientInsight;
  companyId: string;
}

export function InsightCardClient({ insight, companyId }: InsightCardClientProps) {
  const router = useRouter();
  const [isCreatingWork, setIsCreatingWork] = useState(false);
  const [workCreated, setWorkCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<InsightStatus>(insight.status || 'open');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const severityStyles = getSeverityStyles(insight.severity);
  const categoryInfo = getCategoryInfo(insight.category);
  const statusStyles = getStatusStyles(currentStatus);

  const handleStatusChange = async (newStatus: InsightStatus) => {
    if (newStatus === currentStatus) {
      setShowStatusMenu(false);
      return;
    }

    setIsUpdatingStatus(true);
    setError(null);
    setShowStatusMenu(false);

    try {
      const response = await fetch(
        `/api/os/client-brain/${companyId}/insights/${insight.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      setCurrentStatus(newStatus);
      router.refresh(); // Refresh to update stats
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateWork = async () => {
    setIsCreatingWork(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/client-brain/${companyId}/insights/${insight.id}/generate-work`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create work items');
      }

      const data = await response.json();
      console.log('Work items created:', data);
      setWorkCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work items');
    } finally {
      setIsCreatingWork(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${categoryInfo.bgColor} flex items-center justify-center flex-shrink-0`}>
            <categoryInfo.Icon className={`w-4 h-4 ${categoryInfo.iconColor}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{insight.title}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-500">{categoryInfo.label}</span>
              {insight.source.type === 'tool_run' && insight.source.toolSlug && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-500">
                    from {formatToolSlug(insight.source.toolSlug)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={isUpdatingStatus}
              className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${statusStyles.badge} hover:opacity-80 transition-opacity cursor-pointer`}
            >
              {isUpdatingStatus ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <StatusIcon status={currentStatus} />
              )}
              <span>{formatStatus(currentStatus)}</span>
            </button>

            {/* Dropdown */}
            {showStatusMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1">
                <StatusMenuItem
                  status="open"
                  currentStatus={currentStatus}
                  onClick={() => handleStatusChange('open')}
                />
                <StatusMenuItem
                  status="in_progress"
                  currentStatus={currentStatus}
                  onClick={() => handleStatusChange('in_progress')}
                />
                <StatusMenuItem
                  status="resolved"
                  currentStatus={currentStatus}
                  onClick={() => handleStatusChange('resolved')}
                />
                <StatusMenuItem
                  status="dismissed"
                  currentStatus={currentStatus}
                  onClick={() => handleStatusChange('dismissed')}
                />
              </div>
            )}
          </div>

          <div className={`px-2 py-0.5 rounded text-xs font-medium ${severityStyles.badge}`}>
            {insight.severity || 'medium'}
          </div>
        </div>
      </div>

      {/* Summary (from body, truncated) */}
      <div className="text-sm text-slate-300 leading-relaxed mb-3 line-clamp-3">
        {extractSummary(insight.body)}
      </div>

      {/* Recommendation (if present) */}
      {insight.recommendation && (
        <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-amber-400 mb-1">Recommendation</div>
              <div className="text-sm text-slate-300 leading-relaxed">
                {insight.recommendation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {formatDate(insight.createdAt)}
        </span>
        <div className="flex items-center gap-3">
          {workCreated ? (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3 h-3" />
              <span>Work Created</span>
            </div>
          ) : (
            <button
              onClick={handleCreateWork}
              disabled={isCreatingWork}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingWork ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>Create Work</span>
                </>
              )}
            </button>
          )}
          <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <span>View Details</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers (copied from page.tsx for client component)
// ============================================================================

function getSeverityStyles(severity?: InsightSeverity) {
  switch (severity) {
    case 'critical':
      return { badge: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    case 'high':
      return { badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' };
    case 'medium':
      return { badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    case 'low':
      return { badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    default:
      return { badge: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
  }
}

function getStatusStyles(status?: InsightStatus) {
  switch (status) {
    case 'open':
      return { badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
    case 'in_progress':
      return { badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    case 'resolved':
      return { badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    case 'dismissed':
      return { badge: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
    default:
      return { badge: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
  }
}

function getCategoryInfo(category?: InsightCategory) {
  const categories: Record<string, { label: string; Icon: typeof TrendingUp; bgColor: string; iconColor: string }> = {
    growth_opportunity: { label: 'Growth', Icon: TrendingUp, bgColor: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
    conversion: { label: 'Conversion', Icon: Target, bgColor: 'bg-blue-500/20', iconColor: 'text-blue-400' },
    audience: { label: 'Audience', Icon: Users, bgColor: 'bg-violet-500/20', iconColor: 'text-violet-400' },
    brand: { label: 'Brand', Icon: Palette, bgColor: 'bg-purple-500/20', iconColor: 'text-purple-400' },
    creative: { label: 'Creative', Icon: Sparkles, bgColor: 'bg-pink-500/20', iconColor: 'text-pink-400' },
    media: { label: 'Media', Icon: Tv, bgColor: 'bg-sky-500/20', iconColor: 'text-sky-400' },
    website: { label: 'Website', Icon: Globe, bgColor: 'bg-blue-500/20', iconColor: 'text-blue-400' },
    content: { label: 'Content', Icon: FileText, bgColor: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
    seo: { label: 'SEO', Icon: Search, bgColor: 'bg-cyan-500/20', iconColor: 'text-cyan-400' },
    seo_content: { label: 'SEO & Content', Icon: Search, bgColor: 'bg-cyan-500/20', iconColor: 'text-cyan-400' },
    demand: { label: 'Demand Gen', Icon: TrendingUp, bgColor: 'bg-orange-500/20', iconColor: 'text-orange-400' },
    ops: { label: 'Operations', Icon: Settings, bgColor: 'bg-slate-500/20', iconColor: 'text-slate-400' },
    analytics: { label: 'Analytics', Icon: BarChart2, bgColor: 'bg-indigo-500/20', iconColor: 'text-indigo-400' },
    competitive: { label: 'Competitive', Icon: Radar, bgColor: 'bg-red-500/20', iconColor: 'text-red-400' },
    kpi_risk: { label: 'KPI Risk', Icon: AlertTriangle, bgColor: 'bg-red-500/20', iconColor: 'text-red-400' },
    structural: { label: 'Structural', Icon: Target, bgColor: 'bg-slate-500/20', iconColor: 'text-slate-400' },
    product: { label: 'Product', Icon: Target, bgColor: 'bg-amber-500/20', iconColor: 'text-amber-400' },
    other: { label: 'Strategy', Icon: Target, bgColor: 'bg-amber-500/20', iconColor: 'text-amber-400' },
  };

  return categories[category || 'other'] || categories.other;
}

function formatToolSlug(slug: string): string {
  const formatted = slug
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatStatus(status: InsightStatus): string {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'resolved':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    default:
      return status;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function extractSummary(body: string): string {
  const lines = body.split('\n');
  const summaryLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('**') || line.trim() === '') {
      if (summaryLines.length > 0) break;
      continue;
    }
    summaryLines.push(line);
  }

  return summaryLines.join(' ').trim() || body.slice(0, 200);
}

// ============================================================================
// Status Components
// ============================================================================

function StatusIcon({ status }: { status: InsightStatus }) {
  switch (status) {
    case 'open':
      return <Clock className="w-3 h-3" />;
    case 'in_progress':
      return <Play className="w-3 h-3" />;
    case 'resolved':
      return <CheckCircle className="w-3 h-3" />;
    case 'dismissed':
      return <XCircle className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

function StatusMenuItem({
  status,
  currentStatus,
  onClick,
}: {
  status: InsightStatus;
  currentStatus: InsightStatus;
  onClick: () => void;
}) {
  const isActive = status === currentStatus;
  const styles = getStatusStyles(status);

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-700/50 transition-colors ${
        isActive ? 'bg-slate-700/30' : ''
      }`}
    >
      <StatusIcon status={status} />
      <span className={isActive ? 'font-medium text-slate-200' : 'text-slate-400'}>
        {formatStatus(status)}
      </span>
      {isActive && <CheckCircle className="w-3 h-3 ml-auto text-emerald-400" />}
    </button>
  );
}
