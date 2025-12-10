'use client';

// components/plan/FindingCard.tsx
// Compact card component for displaying a single finding
//
// Used across all Plan views: Themes, Priority, Lab, All Findings

import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, ExternalLink, Check } from 'lucide-react';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

export interface FindingCardProps {
  finding: DiagnosticDetailFinding;
  onConvert?: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelect?: (finding: DiagnosticDetailFinding) => void;
  isSelected?: boolean;
  selectable?: boolean;
  compact?: boolean;
}

// ============================================================================
// Severity Badge
// ============================================================================

const severityConfig: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20 ring-1 ring-red-500/30', text: 'text-red-400', label: 'Critical' },
  high: { bg: 'bg-orange-500/20 ring-1 ring-orange-500/30', text: 'text-orange-400', label: 'High' },
  medium: { bg: 'bg-yellow-500/20 ring-1 ring-yellow-500/30', text: 'text-yellow-400', label: 'Medium' },
  low: { bg: 'bg-slate-500/20 ring-1 ring-slate-500/30', text: 'text-slate-400', label: 'Low' },
};

function SeverityBadge({ severity }: { severity?: string }) {
  const config = severityConfig[severity || 'medium'] || severityConfig.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// ============================================================================
// Lab Badge
// ============================================================================

const labColors: Record<string, string> = {
  website: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  brand: 'bg-pink-500/20 text-pink-400 ring-pink-500/30',
  seo: 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30',
  content: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  demand: 'bg-orange-500/20 text-orange-400 ring-orange-500/30',
  ops: 'bg-slate-500/20 text-slate-400 ring-slate-500/30',
  gap: 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
};

function LabBadge({ lab }: { lab?: string }) {
  if (!lab) return null;
  const colorClass = labColors[lab.toLowerCase()] || 'bg-slate-500/20 text-slate-400 ring-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ${colorClass} capitalize`}>
      {lab}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FindingCard({
  finding,
  onConvert,
  onSelect,
  isSelected = false,
  selectable = false,
  compact = false,
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleConvert = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onConvert || finding.isConvertedToWorkItem) return;

    setConverting(true);
    try {
      await onConvert(finding);
    } finally {
      setConverting(false);
    }
  };

  const handleCardClick = () => {
    if (selectable && onSelect) {
      onSelect(finding);
    } else {
      setExpanded(!expanded);
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        group rounded-lg border transition-all cursor-pointer
        ${isSelected
          ? 'bg-cyan-500/10 border-cyan-500/40'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
        }
        ${compact ? 'p-3' : 'p-4'}
      `}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <SeverityBadge severity={finding.severity} />
          <LabBadge lab={finding.labSlug} />
          {finding.category && (
            <span className="text-xs text-slate-500">{finding.category}</span>
          )}
        </div>

        {/* Converted indicator or checkbox */}
        {finding.isConvertedToWorkItem ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400 flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
            In Work
          </span>
        ) : selectable ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
          />
        ) : null}
      </div>

      {/* Description */}
      <p className={`mt-2 text-sm text-slate-300 ${compact && !expanded ? 'line-clamp-2' : ''}`}>
        {finding.description || 'No description available.'}
      </p>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
          {/* Location */}
          {finding.location && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Location</span>
              <p className="mt-0.5 text-sm font-mono text-cyan-400">{finding.location}</p>
            </div>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recommendation</span>
              <p className="mt-0.5 text-sm text-slate-400 bg-slate-800/50 rounded p-2 border border-slate-700">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Estimated Impact */}
          {finding.estimatedImpact && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Estimated Impact</span>
              <p className="mt-0.5 text-sm text-slate-300">{finding.estimatedImpact}</p>
            </div>
          )}
        </div>
      )}

      {/* Action Row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {/* Expand/Collapse Button */}
        <button
          onClick={handleExpandClick}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              More
            </>
          )}
        </button>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!finding.isConvertedToWorkItem && onConvert && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
            >
              <ClipboardList className="w-3 h-3" />
              {converting ? 'Adding...' : 'Add to Work'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FindingCard;
