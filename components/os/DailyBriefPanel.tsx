'use client';

// components/os/DailyBriefPanel.tsx
// Daily Brief Panel - Collapsible AI-generated brief at top of Overview
//
// Shows:
// - Headline (1 sentence)
// - What Changed (2-3 bullets)
// - What Matters (2 bullets)
// - Watchouts (1-2 items)
// - Today's Focus (optional)

import { useState, useEffect } from 'react';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { CompanyDailyBrief } from '@/lib/os/briefing/daily';

// ============================================================================
// Types
// ============================================================================

interface DailyBriefPanelProps {
  companyId: string;
  companyName?: string;
  /** Pre-loaded brief (optional - will fetch if not provided) */
  initialBrief?: CompanyDailyBrief;
}

// ============================================================================
// Component
// ============================================================================

export function DailyBriefPanel({
  companyId,
  companyName,
  initialBrief,
}: DailyBriefPanelProps) {
  // Feature gate: Daily briefing must be explicitly enabled
  if (!FEATURE_FLAGS.DAILY_BRIEFING_ENABLED) {
    return null;
  }

  const [brief, setBrief] = useState<CompanyDailyBrief | null>(initialBrief || null);
  const [loading, setLoading] = useState(!initialBrief);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Fetch brief if not provided
  useEffect(() => {
    if (!initialBrief && companyId) {
      fetchBrief();
    }
  }, [companyId, initialBrief]);

  async function fetchBrief() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/os/companies/' + companyId + '/brief');
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load brief');
      }

      setBrief(data.brief);
    } catch (err) {
      console.error('[DailyBriefPanel] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load brief');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/os/companies/' + companyId + '/brief', {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to regenerate brief');
      }

      setBrief(data.brief);
    } catch (err) {
      console.error('[DailyBriefPanel] Refresh error:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh brief');
    } finally {
      setLoading(false);
    }
  }

  // Format timestamp
  function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    return 'As of ' + date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Loading state
  if (loading && !brief) {
    return (
      <div className="bg-gradient-to-r from-slate-800/60 to-slate-800/40 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Generating brief...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !brief) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button
            onClick={fetchBrief}
            className="ml-auto text-xs text-slate-400 hover:text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  // Confidence color
  const confidenceColor = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-red-400',
  }[brief.confidence];

  return (
    <div className="bg-gradient-to-r from-slate-800/60 to-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header - always visible */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {brief.headline}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-500">
            {formatTimestamp(brief.generatedAt)}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh brief"
          >
            <RefreshCw className={'w-3.5 h-3.5' + (loading ? ' animate-spin' : '')} />
          </button>

          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {/* What Changed */}
          {brief.whatChanged.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                What Changed
              </h4>
              <ul className="space-y-1.5">
                {brief.whatChanged.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <SourceIcon source={item.source} />
                    <span className="text-slate-300">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nothing changed notice */}
          {brief.nothingChanged && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle className="w-4 h-4 text-slate-500" />
              <span>Nothing meaningful changed since the last check.</span>
            </div>
          )}

          {/* What Matters */}
          {brief.whatMatters.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                What Matters Right Now
              </h4>
              <ul className="space-y-1.5">
                {brief.whatMatters.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={
                      'flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ' +
                      (item.level === 'strategic'
                        ? 'bg-violet-500/10 text-violet-400'
                        : 'bg-blue-500/10 text-blue-400')
                    }>
                      {item.level}
                    </span>
                    <span className="text-slate-300">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Watchouts */}
          {brief.watchouts.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                Watchouts
              </h4>
              <ul className="space-y-1.5">
                {brief.watchouts.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className={
                      'w-4 h-4 flex-shrink-0 mt-0.5 ' +
                      (item.severity === 'high'
                        ? 'text-red-400'
                        : item.severity === 'medium'
                        ? 'text-amber-400'
                        : 'text-slate-400')
                    } />
                    <span className="text-slate-300">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Today's Focus */}
          {brief.todaysFocus && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
              <h4 className="text-[10px] uppercase tracking-wide text-violet-400 mb-1.5 flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3" />
                Today&apos;s Focus
              </h4>
              <p className="text-sm text-white">{brief.todaysFocus}</p>
            </div>
          )}

          {/* Confidence indicator */}
          {brief.confidence !== 'high' && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
              <span className={'text-[10px] uppercase tracking-wide ' + confidenceColor}>
                {brief.confidence} confidence
              </span>
              {brief.confidenceReason && (
                <span className="text-[10px] text-slate-500">
                  — {brief.confidenceReason}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SourceIcon({ source }: { source: string }) {
  const iconClass = 'w-3.5 h-3.5 flex-shrink-0 mt-0.5';
  
  switch (source) {
    case 'work':
      return <CheckCircle className={iconClass + ' text-blue-400'} />;
    case 'context':
      return <Clock className={iconClass + ' text-violet-400'} />;
    case 'competition':
      return <AlertTriangle className={iconClass + ' text-amber-400'} />;
    case 'automation':
      return <RefreshCw className={iconClass + ' text-cyan-400'} />;
    case 'signal':
      return <AlertCircle className={iconClass + ' text-emerald-400'} />;
    default:
      return <ArrowRight className={iconClass + ' text-slate-400'} />;
  }
}

export default DailyBriefPanel;
