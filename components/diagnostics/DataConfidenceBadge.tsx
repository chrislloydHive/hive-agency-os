'use client';

// components/diagnostics/DataConfidenceBadge.tsx
// Compact data confidence indicator with drawer
//
// Features:
// - Color-coded badge showing overall data freshness
// - Click to open drawer with detailed source breakdown
// - Shows each data source with last updated time
// - Links to refresh or update data sources

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Database,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DataSource {
  id: string;
  name: string;
  type: 'brain' | 'analytics' | 'diagnostic' | 'integration' | 'manual' | 'detection';
  lastUpdated: string | null;
  status: 'fresh' | 'stale' | 'missing' | 'error';
  /** Link to refresh or update this source */
  refreshHref?: string;
  /** Additional context */
  description?: string;
  /** Confidence score (0-100) for detection sources */
  confidence?: number;
}

interface DataConfidenceBadgeProps {
  companyId: string;
  sources: DataSource[];
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getOverallStatus(sources: DataSource[]): 'fresh' | 'stale' | 'missing' {
  if (sources.length === 0) return 'missing';

  const freshCount = sources.filter(s => s.status === 'fresh').length;
  const missingCount = sources.filter(s => s.status === 'missing').length;

  if (missingCount > sources.length / 2) return 'missing';
  if (freshCount >= sources.length * 0.7) return 'fresh';
  return 'stale';
}

function getStatusConfig(status: 'fresh' | 'stale' | 'missing' | 'error') {
  switch (status) {
    case 'fresh':
      return {
        icon: CheckCircle,
        label: 'Fresh',
        badgeBg: 'bg-emerald-500/20',
        badgeText: 'text-emerald-400',
        badgeBorder: 'border-emerald-500/30',
        dotColor: 'bg-emerald-400',
      };
    case 'stale':
      return {
        icon: AlertTriangle,
        label: 'Stale',
        badgeBg: 'bg-amber-500/20',
        badgeText: 'text-amber-400',
        badgeBorder: 'border-amber-500/30',
        dotColor: 'bg-amber-400',
      };
    case 'missing':
      return {
        icon: AlertCircle,
        label: 'Missing',
        badgeBg: 'bg-red-500/20',
        badgeText: 'text-red-400',
        badgeBorder: 'border-red-500/30',
        dotColor: 'bg-red-400',
      };
    case 'error':
      return {
        icon: AlertCircle,
        label: 'Error',
        badgeBg: 'bg-red-500/20',
        badgeText: 'text-red-400',
        badgeBorder: 'border-red-500/30',
        dotColor: 'bg-red-400',
      };
  }
}

function getSourceTypeLabel(type: DataSource['type']): string {
  switch (type) {
    case 'brain':
      return 'Brain Context';
    case 'analytics':
      return 'Analytics';
    case 'diagnostic':
      return 'Diagnostic';
    case 'integration':
      return 'Integration';
    case 'manual':
      return 'Manual Entry';
    case 'detection':
      return 'Auto-Detected';
  }
}

// ============================================================================
// Source Row
// ============================================================================

function SourceRow({
  source,
  companyId,
}: {
  source: DataSource;
  companyId: string;
}) {
  const config = getStatusConfig(source.status);
  const StatusIcon = config.icon;

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-emerald-400';
    if (confidence >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${config.dotColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200 truncate">
              {source.name}
            </span>
            <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
              {getSourceTypeLabel(source.type)}
            </span>
            {source.confidence !== undefined && (
              <span className={`text-xs font-medium ${getConfidenceColor(source.confidence)}`}>
                {source.confidence}%
              </span>
            )}
          </div>
          {source.lastUpdated ? (
            <p className="text-xs text-slate-400 mt-0.5">
              Updated {formatDistanceToNow(new Date(source.lastUpdated), { addSuffix: true })}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Never updated</p>
          )}
          {source.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{source.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <span className={`text-xs font-medium ${config.badgeText}`}>
          {config.label}
        </span>
        {source.refreshHref && (
          <Link
            href={source.refreshHref.replace('{companyId}', companyId)}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Drawer
// ============================================================================

function DataConfidenceDrawer({
  isOpen,
  onClose,
  sources,
  companyId,
}: {
  isOpen: boolean;
  onClose: () => void;
  sources: DataSource[];
  companyId: string;
}) {
  if (!isOpen) return null;

  const freshCount = sources.filter(s => s.status === 'fresh').length;
  const staleCount = sources.filter(s => s.status === 'stale').length;
  const missingCount = sources.filter(s => s.status === 'missing').length;

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-slate-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">Data Confidence</h2>
              <p className="text-xs text-slate-400">Sources powering this view</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/30">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-lg font-semibold text-emerald-400">{freshCount}</p>
              <p className="text-xs text-emerald-300/70">Fresh</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-lg font-semibold text-amber-400">{staleCount}</p>
              <p className="text-xs text-amber-300/70">Stale</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-lg font-semibold text-red-400">{missingCount}</p>
              <p className="text-xs text-red-300/70">Missing</p>
            </div>
          </div>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Data Sources ({sources.length})
          </h3>
          <div className="space-y-0">
            {sources.map(source => (
              <SourceRow
                key={source.id}
                source={source}
                companyId={companyId}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30">
          <Link
            href={`/c/${companyId}/brain`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm font-medium"
          >
            Update Brain Context
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </Fragment>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DataConfidenceBadge({
  companyId,
  sources,
  className = '',
}: DataConfidenceBadgeProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const overallStatus = getOverallStatus(sources);
  const config = getStatusConfig(overallStatus);
  const StatusIcon = config.icon;

  const freshCount = sources.filter(s => s.status === 'fresh').length;

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
          border transition-colors cursor-pointer
          ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}
          hover:opacity-80
          ${className}
        `}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        <span>
          {freshCount}/{sources.length} sources fresh
        </span>
      </button>

      <DataConfidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sources={sources}
        companyId={companyId}
      />
    </>
  );
}

export default DataConfidenceBadge;
