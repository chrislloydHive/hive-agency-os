// REUSE REQUIRED
// - Must reuse existing Context Workspace section components if present
// - Must map to Context Graph domains (no parallel context model)
// - Must render existing Proposal type (no new diff format)

// components/context/ContextV2FieldMeta.tsx
// Context V2 Field Metadata Display
//
// Shows provenance and confidence information for context fields.
// Surfaces confidenceNotes via tooltip.

'use client';

import { useState } from 'react';
import type { ContextFieldMeta, ContextFieldSource, ContextConfidence } from '@/lib/types/contextV2';

interface FieldMetaBadgeProps {
  meta: ContextFieldMeta;
  showSource?: boolean;
  showConfidence?: boolean;
  className?: string;
}

const SOURCE_STYLES: Record<ContextFieldSource, { label: string; color: string }> = {
  AI: { label: 'AI', color: 'bg-purple-100 text-purple-700' },
  User: { label: 'User', color: 'bg-emerald-100 text-emerald-700' },
  Lab: { label: 'Lab', color: 'bg-blue-100 text-blue-700' },
  Imported: { label: 'Import', color: 'bg-slate-100 text-slate-700' },
};

const CONFIDENCE_STYLES: Record<ContextConfidence, { label: string; color: string }> = {
  High: { label: 'High', color: 'text-emerald-600' },
  Medium: { label: 'Medium', color: 'text-amber-600' },
  Low: { label: 'Low', color: 'text-red-500' },
};

export function FieldMetaBadge({
  meta,
  showSource = true,
  showConfidence = true,
  className = '',
}: FieldMetaBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const sourceStyle = SOURCE_STYLES[meta.source];
  const confidenceStyle = CONFIDENCE_STYLES[meta.confidence];
  const hasNotes = meta.confidenceNotes && meta.confidenceNotes.trim().length > 0;

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 ${className}`}
      onMouseEnter={() => hasNotes && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Source badge */}
      {showSource && (
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${sourceStyle.color}`}>
          {sourceStyle.label}
        </span>
      )}

      {/* Confidence indicator */}
      {showConfidence && (
        <span className={`text-[10px] font-medium ${confidenceStyle.color}`}>
          {confidenceStyle.label}
        </span>
      )}

      {/* Needs review indicator */}
      {meta.needsReview && (
        <span className="text-[10px] text-blue-600" title="Needs review">
          !
        </span>
      )}

      {/* Tooltip for confidence notes */}
      {showTooltip && hasNotes && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg">
          {meta.confidenceNotes}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// Inline confidence dot (minimal indicator)
export function ConfidenceDot({ confidence }: { confidence: ContextConfidence }) {
  const colors: Record<ContextConfidence, string> = {
    High: 'bg-emerald-400',
    Medium: 'bg-amber-400',
    Low: 'bg-red-400',
  };

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${colors[confidence]}`}
      title={`${confidence} confidence`}
    />
  );
}

// Source icon
export function SourceIcon({ source, size = 'sm' }: { source: ContextFieldSource; size?: 'sm' | 'md' }) {
  const icons: Record<ContextFieldSource, string> = {
    AI: 'sparkles',
    User: 'user',
    Lab: 'flask',
    Imported: 'download',
  };

  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const sourceStyle = SOURCE_STYLES[source];

  return (
    <span className={`${sizeClass} ${sourceStyle.color.split(' ')[1]}`} title={`Source: ${source}`}>
      [{source.charAt(0)}]
    </span>
  );
}

// Field status summary (for displaying in headers/summaries)
export function FieldStatusSummary({ meta }: { meta: ContextFieldMeta }) {
  const lastUpdated = new Date(meta.lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <ConfidenceDot confidence={meta.confidence} />
      <span>Updated {lastUpdated}</span>
      <span className="text-slate-300">|</span>
      <span>via {meta.source}</span>
      {meta.needsReview && (
        <>
          <span className="text-slate-300">|</span>
          <span className="text-blue-600">Needs review</span>
        </>
      )}
    </div>
  );
}
