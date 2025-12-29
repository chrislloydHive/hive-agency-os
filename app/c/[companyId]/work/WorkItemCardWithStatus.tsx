'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, ExternalLink, Clock, User, Wrench, Target, Bot, Layers, Package } from 'lucide-react';
import type { WorkItemRecord, WorkItemStatus } from '@/lib/airtable/workItems';
import type { WorkSource, StrategyLink } from '@/lib/types/work';

export interface WorkItemCardWithStatusProps {
  item: WorkItemRecord;
  companyId: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const STATUS_OPTIONS: WorkItemStatus[] = ['Backlog', 'Planned', 'In Progress', 'Done'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a short, display-friendly source label
 */
function getSourceDisplayLabel(source?: WorkSource): { label: string; type: 'ai' | 'user' | 'diagnostic' | 'manual' | 'artifact' } {
  if (!source) return { label: 'Manual', type: 'manual' };

  switch (source.sourceType) {
    case 'user_prescribed':
      return { label: 'User Prescribed', type: 'user' };
    case 'analytics_metric':
    case 'gap_insight':
    case 'client_brain_insight':
    case 'funnel_insight':
    case 'dma_funnel':
      return { label: 'AI Recommendation', type: 'ai' };
    case 'diagnostics':
    case 'tool_run':
      return { label: 'Diagnostic', type: 'diagnostic' };
    case 'priority':
    case 'plan_initiative':
      return { label: 'AI Recommendation', type: 'ai' };
    case 'strategy_play':
    case 'strategy_handoff':
      return { label: 'Strategy', type: 'ai' };
    case 'creative_brief':
      return { label: 'Brief', type: 'user' };
    case 'program':
      return { label: 'Program', type: 'ai' };
    case 'artifact':
    case 'heavy_plan':
      return { label: 'From Artifact', type: 'artifact' };
    default:
      return { label: 'Manual', type: 'manual' };
  }
}

/**
 * Get project/context label from source
 */
function getProjectLabel(source?: WorkSource): string | null {
  if (!source) return null;

  switch (source.sourceType) {
    case 'user_prescribed': {
      // Convert project context to friendly name
      const contextLabels: Record<string, string> = {
        website_optimization: 'Website Optimization',
        seo_fix: 'SEO Fix',
        content_update: 'Content Update',
      };
      return contextLabels[source.projectContext] || source.projectContext.replace(/_/g, ' ');
    }
    case 'strategy_handoff':
      return source.initiativeTitle || source.strategyTitle;
    case 'strategy_play':
      return source.pillarTitle || null;
    case 'creative_brief':
      return source.projectType.replace(/_/g, ' ');
    case 'tool_run': {
      const toolLabels: Record<string, string> = {
        'gap-snapshot': 'GAP IA',
        'website-lab': 'Website Lab',
        'brand-lab': 'Brand Lab',
        'content-lab': 'Content Lab',
        'seo-lab': 'SEO Lab',
      };
      return toolLabels[source.toolSlug] || source.toolSlug;
    }
    default:
      return null;
  }
}

/**
 * Get brief ID from source if available
 */
function getBriefId(source?: WorkSource): string | null {
  if (!source) return null;

  if (source.sourceType === 'creative_brief') {
    return source.briefId;
  }
  if (source.sourceType === 'user_prescribed' && source.briefId) {
    return source.briefId;
  }
  return null;
}

/**
 * Format relative time from date string
 */
function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Get source icon component
 */
function SourceIcon({ type }: { type: 'ai' | 'user' | 'diagnostic' | 'manual' | 'artifact' }) {
  switch (type) {
    case 'ai':
      return <Bot className="w-3 h-3" />;
    case 'user':
      return <User className="w-3 h-3" />;
    case 'diagnostic':
      return <Wrench className="w-3 h-3" />;
    case 'artifact':
      return <FileText className="w-3 h-3" />;
    default:
      return <Target className="w-3 h-3" />;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function WorkItemCardWithStatus({ item, companyId, isSelected, onClick }: WorkItemCardWithStatusProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive metadata
  const sourceInfo = getSourceDisplayLabel(item.source);
  const projectLabel = getProjectLabel(item.source);
  const briefId = getBriefId(item.source);
  const relativeTime = formatRelativeTime(item.createdAt);

  const handleStatusChange = async (newStatus: WorkItemStatus) => {
    if (newStatus === item.status || isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch('/api/work-items/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workItemId: item.id,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      console.log('[WorkItemCard] Status updated:', data.workItem);

      // Refresh the page to show the updated status
      router.refresh();
    } catch (err) {
      console.error('[WorkItemCard] Error updating status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
      setIsUpdating(false);
    }
  };

  return (
    <div
      className={`rounded-lg border bg-[#050509]/80 px-4 py-3.5 transition-colors cursor-pointer ${
        isSelected
          ? 'border-amber-500/50 bg-amber-500/5'
          : 'border-slate-800 hover:border-slate-700'
      }`}
      onClick={onClick}
    >
      {/* Title + Severity */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h4 className="font-medium text-slate-100 text-sm leading-snug flex-1">
          {item.title}
        </h4>
        {item.severity && <SeverityPill severity={item.severity} />}
      </div>

      {/* Description (notes) - 1 line max */}
      {item.notes && (
        <p className="text-xs text-slate-400 mb-2.5 line-clamp-1">
          {item.notes}
        </p>
      )}

      {/* Metadata Row - Type, Source, Project, Brief, Created */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {/* Task Type Chip */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50">
          Task
        </span>

        {/* Source Chip */}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
          sourceInfo.type === 'ai'
            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
            : sourceInfo.type === 'user'
            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
            : sourceInfo.type === 'diagnostic'
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            : sourceInfo.type === 'artifact'
            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
        }`}>
          <SourceIcon type={sourceInfo.type} />
          {sourceInfo.label}
        </span>

        {/* Project/Context Chip */}
        {projectLabel && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-400 border border-slate-600/50 capitalize">
            {projectLabel}
          </span>
        )}

        {/* Area Chip */}
        {item.area && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-400 border border-slate-600/50">
            {item.area}
          </span>
        )}

        {/* Strategy Link Badge */}
        {item.strategyLink && (
          <Link
            href={`/c/${companyId}/strategy?id=${item.strategyLink.strategyId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
            title={item.strategyLink.tacticTitle || 'From Strategy'}
          >
            <Layers className="w-3 h-3" />
            From Strategy
          </Link>
        )}

        {/* Outputs Badge - Produced Artifacts */}
        {item.artifacts && item.artifacts.filter(a => a.relation === 'produces' || !a.relation).length > 0 && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
            title={`Produces ${item.artifacts.filter(a => a.relation === 'produces' || !a.relation).length} artifact(s)`}
          >
            <Package className="w-3 h-3" />
            {item.artifacts.filter(a => a.relation === 'produces' || !a.relation).length} Output{item.artifacts.filter(a => a.relation === 'produces' || !a.relation).length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Brief Indicator */}
        {briefId ? (
          <Link
            href={`/c/${companyId}/briefs/${briefId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
          >
            <FileText className="w-3 h-3" />
            Brief
            <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800/50 text-slate-500 border border-slate-700/50">
            <FileText className="w-3 h-3" />
            No brief
          </span>
        )}

        {/* Created Time */}
        {relativeTime && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            {relativeTime}
          </span>
        )}
      </div>

      {/* Owner + Due Date Row */}
      {(item.ownerName || item.dueDate) && (
        <div className="flex items-center gap-3 mb-3 text-xs text-slate-400">
          {item.ownerName && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {item.ownerName}
            </span>
          )}
          {item.dueDate && (
            <span>
              Due {formatDate(item.dueDate)}
            </span>
          )}
        </div>
      )}

      {/* Status Control */}
      <div className="pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(status);
                }}
                disabled={isUpdating}
                className={`
                  px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                  ${
                    item.status === status
                      ? status === 'In Progress'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 ring-1 ring-blue-500/30'
                        : status === 'Done'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : status === 'Planned'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 ring-1 ring-purple-500/30'
                        : 'bg-slate-600/30 text-slate-200 border border-slate-500/50 ring-1 ring-slate-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-300'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Primary Action CTA */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex-shrink-0"
          >
            View Details
          </button>
        </div>

        {isUpdating && (
          <p className="text-[10px] text-slate-500 mt-2">
            Updating status...
          </p>
        )}

        {error && (
          <p className="text-[10px] text-red-400 mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Severity Pill Component
 */
function SeverityPill({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();

  const classes =
    normalized === 'critical'
      ? 'bg-red-500/20 text-red-300 border-red-500/50'
      : normalized === 'high'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
      : normalized === 'medium'
      ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
      : normalized === 'low'
      ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
      : normalized === 'info'
      ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
      : 'bg-slate-700/50 text-slate-200 border-slate-600';

  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

/**
 * Format date helper
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
