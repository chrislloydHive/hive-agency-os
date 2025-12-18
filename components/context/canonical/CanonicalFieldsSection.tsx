// components/context/canonical/CanonicalFieldsSection.tsx
// Canonical Fields Section Component
//
// Groups canonical fields by dimension with summary header.
// Renders all fields from schema, showing missing ones with placeholder.

'use client';

import { useMemo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import type {
  ContextDimension,
  CanonicalFieldDefinition,
  ContextFieldRecord,
  CanonicalFieldKey,
} from '@/lib/os/context/schema';
import { CanonicalFieldRow } from './CanonicalFieldRow';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface CanonicalFieldsSectionProps {
  dimension: ContextDimension;
  dimensionLabel: string;
  fieldDefs: CanonicalFieldDefinition[];
  recordsByKey: Record<string, ContextFieldRecord | undefined>;
  onSave: (key: CanonicalFieldKey, value: string) => Promise<void>;
  onConfirm: (key: CanonicalFieldKey) => Promise<void>;
  defaultExpanded?: boolean;
}

// ============================================================================
// Dimension Colors
// ============================================================================

const DIMENSION_COLORS: Record<ContextDimension, { bg: string; border: string; text: string }> = {
  BusinessReality: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
  },
  AudienceICP: {
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
  },
  Offer: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
  },
  Brand: {
    bg: 'bg-pink-500/5',
    border: 'border-pink-500/20',
    text: 'text-pink-400',
  },
  GoToMarket: {
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
  },
  CompetitiveLandscape: {
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    text: 'text-red-400',
  },
  Constraints: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
  },
  ExecutionCapabilities: {
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function CanonicalFieldsSection({
  dimension,
  dimensionLabel,
  fieldDefs,
  recordsByKey,
  onSave,
  onConfirm,
  defaultExpanded = true,
}: CanonicalFieldsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate stats
  const stats = useMemo(() => {
    let total = fieldDefs.length;
    let confirmed = 0;
    let proposed = 0;
    let missing = 0;
    let requiredMissing = 0;

    for (const def of fieldDefs) {
      const record = recordsByKey[def.key];
      if (record?.status === 'confirmed') {
        confirmed++;
      } else if (record?.status === 'proposed') {
        proposed++;
      } else {
        missing++;
        if (def.requiredForStrategyFrame) {
          requiredMissing++;
        }
      }
    }

    return { total, confirmed, proposed, missing, requiredMissing };
  }, [fieldDefs, recordsByKey]);

  const colors = DIMENSION_COLORS[dimension];
  const isComplete = stats.missing === 0;

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className={`w-4 h-4 ${colors.text}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${colors.text}`} />
          )}
          <h3 className={`text-sm font-semibold ${colors.text}`}>
            {dimensionLabel}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          {isComplete ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete
            </span>
          ) : stats.requiredMissing > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {stats.requiredMissing} required missing
            </span>
          ) : stats.missing > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              {stats.missing} missing
            </span>
          ) : null}

          {/* Progress count */}
          <span className="text-xs text-slate-500">
            {stats.confirmed + stats.proposed}/{stats.total}
          </span>
        </div>
      </button>

      {/* Fields */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-2">
          {fieldDefs.map((def) => (
            <CanonicalFieldRow
              key={def.key}
              fieldDef={def}
              fieldRecord={recordsByKey[def.key]}
              onSave={onSave}
              onConfirm={onConfirm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CanonicalFieldsSection;
