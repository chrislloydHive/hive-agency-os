'use client';

// components/os/programs/RunbookPanel.tsx
// Runbook Panel - Weekly operator checklist for enterprise accounts
//
// Displays runbook items grouped by Domain:
// - Media, Creative, LocalVisibility, Analytics, Operations, Strategy
// - Completion tracking with weekly reset
// - Links to relevant Programs when programId present

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ClipboardList,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { ProgramDomain } from '@/lib/types/programTemplate';

// ============================================================================
// Types
// ============================================================================

interface RunbookChecklistItem {
  id: string;
  title: string;
  domain: ProgramDomain;
  cadence: 'weekly' | 'monthly' | 'quarterly';
  description?: string;
  programId?: string;
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

interface RunbookSummary {
  totalItems: number;
  completedItems: number;
  skippedItems: number;
  pendingItems: number;
  completionPercentage: number;
  byDomain: Record<ProgramDomain, { total: number; completed: number }>;
}

interface RunbookPanelProps {
  companyId: string;
  weekKey?: string;
}

// ============================================================================
// Domain Display Configuration
// ============================================================================

const DOMAIN_CONFIG: Record<ProgramDomain, { label: string; color: string; bg: string; border: string }> = {
  Strategy: { label: 'Strategy', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  Media: { label: 'Media', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  Creative: { label: 'Creative', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  LocalVisibility: { label: 'Local Visibility', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  Analytics: { label: 'Analytics', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  Operations: { label: 'Operations', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

const DOMAIN_ORDER: ProgramDomain[] = ['Media', 'Creative', 'LocalVisibility', 'Analytics', 'Operations', 'Strategy'];

// ============================================================================
// Main Component
// ============================================================================

export function RunbookPanel({ companyId, weekKey }: RunbookPanelProps) {
  const [checklist, setChecklist] = useState<RunbookChecklistItem[]>([]);
  const [summary, setSummary] = useState<RunbookSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [expandedDomains, setExpandedDomains] = useState<Set<ProgramDomain>>(new Set(DOMAIN_ORDER));

  // Fetch runbook data
  const fetchRunbook = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (weekKey) params.set('weekKey', weekKey);

      const response = await fetch(`/api/os/companies/${companyId}/runbook?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch runbook');
      }

      const data = await response.json();
      setChecklist(data.checklist || []);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runbook');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, weekKey]);

  useEffect(() => {
    fetchRunbook();
  }, [fetchRunbook]);

  // Toggle item completion
  const handleToggleItem = useCallback(async (itemId: string, currentStatus: string) => {
    setUpdatingItems(prev => new Set(prev).add(itemId));

    try {
      const action = currentStatus === 'completed' ? 'reset' : 'complete';

      const response = await fetch(`/api/os/companies/${companyId}/runbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          action,
          weekKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update item');
      }

      // Refresh the data
      await fetchRunbook();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [companyId, weekKey, fetchRunbook]);

  // Toggle domain expansion
  const toggleDomain = (domain: ProgramDomain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Group items by domain
  const groupedItems = DOMAIN_ORDER.reduce((acc, domain) => {
    acc[domain] = checklist.filter(item => item.domain === domain);
    return acc;
  }, {} as Record<ProgramDomain, RunbookChecklistItem[]>);

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading runbook...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-800/50 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (checklist.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 text-center">
        <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No runbook items configured</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <ClipboardList className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Weekly Runbook</h3>
            <p className="text-xs text-slate-500">Operator checklist</p>
          </div>
        </div>

        {/* Completion Summary */}
        {summary && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-white">{summary.completionPercentage}%</p>
              <p className="text-xs text-slate-500">
                {summary.completedItems}/{summary.totalItems} complete
              </p>
            </div>
            <div className="w-16 h-16">
              <CircularProgress percentage={summary.completionPercentage} />
            </div>
          </div>
        )}
      </div>

      {/* Domain Groups */}
      <div className="divide-y divide-slate-700/50">
        {DOMAIN_ORDER.map(domain => {
          const items = groupedItems[domain];
          if (items.length === 0) return null;

          const config = DOMAIN_CONFIG[domain];
          const completedCount = items.filter(i => i.status === 'completed').length;
          const isExpanded = expandedDomains.has(domain);

          return (
            <div key={domain}>
              {/* Domain Header */}
              <button
                onClick={() => toggleDomain(domain)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.bg} ${config.color} border ${config.border}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {completedCount}/{items.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-1">
                  {items.map(item => (
                    <RunbookItemRow
                      key={item.id}
                      item={item}
                      companyId={companyId}
                      isUpdating={updatingItems.has(item.id)}
                      onToggle={() => handleToggleItem(item.id, item.status)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Runbook Item Row
// ============================================================================

interface RunbookItemRowProps {
  item: RunbookChecklistItem;
  companyId: string;
  isUpdating: boolean;
  onToggle: () => void;
}

function RunbookItemRow({ item, companyId, isUpdating, onToggle }: RunbookItemRowProps) {
  const isCompleted = item.status === 'completed';

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      isCompleted ? 'bg-emerald-500/5' : 'hover:bg-slate-800/50'
    }`}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={isUpdating}
        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-600 hover:border-slate-500'
        } ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {isUpdating ? (
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="w-3 h-3 text-white" />
        ) : null}
      </button>

      {/* Title */}
      <span className={`flex-1 text-sm ${
        isCompleted ? 'text-slate-500 line-through' : 'text-slate-300'
      }`}>
        {item.title}
      </span>

      {/* Program Link */}
      {item.programId && (
        <Link
          href={`/c/${companyId}/deliver?programId=${item.programId}`}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          title="View Program"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      )}

      {/* Completion indicator */}
      {isCompleted && item.completedAt && (
        <span className="text-[10px] text-emerald-500">
          Done
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Circular Progress Component
// ============================================================================

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
      {/* Background circle */}
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-slate-700"
      />
      {/* Progress circle */}
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={percentage >= 80 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-slate-500'}
        style={{ transition: 'stroke-dashoffset 0.3s ease-in-out' }}
      />
    </svg>
  );
}

export default RunbookPanel;
