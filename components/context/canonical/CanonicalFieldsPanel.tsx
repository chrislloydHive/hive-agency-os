// components/context/canonical/CanonicalFieldsPanel.tsx
// Canonical Fields Panel Component
//
// Main panel that displays all canonical fields grouped by dimension.
// Includes a coverage summary header and per-dimension sections.

'use client';

import { useMemo, useCallback, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  CANONICAL_FIELD_DEFINITIONS,
  getFieldsByDimension,
  REQUIRED_STRATEGY_FRAME_KEYS,
  type ContextDimension,
  type ContextFieldRecord,
  type CanonicalFieldKey,
} from '@/lib/os/context/schema';
import { CanonicalFieldsSection } from './CanonicalFieldsSection';

// ============================================================================
// Types
// ============================================================================

export interface CanonicalFieldsPanelProps {
  companyId: string;
  records: ContextFieldRecord[];
  onRefresh?: () => Promise<void>;
  /** Called after a field is saved, with the canonical key and new value */
  onFieldSaved?: (canonicalKey: string, value: string) => void;
}

// ============================================================================
// Dimension Display Names
// ============================================================================

const DIMENSION_LABELS: Record<ContextDimension, string> = {
  BusinessReality: 'Business Reality',
  AudienceICP: 'Audience & ICP',
  Offer: 'Offer',
  Brand: 'Brand',
  GoToMarket: 'Go-to-Market',
  CompetitiveLandscape: 'Competitive Landscape',
  Constraints: 'Constraints',
  ExecutionCapabilities: 'Execution Capabilities',
};

// Dimension display order
const DIMENSION_ORDER: ContextDimension[] = [
  'AudienceICP',
  'Offer',
  'Brand',
  'CompetitiveLandscape',
  'Constraints',
  'GoToMarket',
  'BusinessReality',
  'ExecutionCapabilities',
];

// ============================================================================
// Main Component
// ============================================================================

export function CanonicalFieldsPanel({
  companyId,
  records,
  onRefresh,
  onFieldSaved,
}: CanonicalFieldsPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Build records map by key
  const recordsByKey = useMemo(() => {
    const map: Record<string, ContextFieldRecord | undefined> = {};
    for (const record of records) {
      map[record.key] = record;
    }
    return map;
  }, [records]);

  // Calculate coverage stats
  const stats = useMemo(() => {
    const allDefs = Object.values(CANONICAL_FIELD_DEFINITIONS);
    const requiredDefs = allDefs.filter((d) => d.requiredForStrategyFrame);

    let totalPresent = 0;
    let requiredPresent = 0;
    let confirmed = 0;
    let proposed = 0;

    for (const def of allDefs) {
      const record = recordsByKey[def.key];
      if (record?.status === 'confirmed' || record?.status === 'proposed') {
        totalPresent++;
        if (def.requiredForStrategyFrame) {
          requiredPresent++;
        }
        if (record.status === 'confirmed') {
          confirmed++;
        } else {
          proposed++;
        }
      }
    }

    const missingRequired = REQUIRED_STRATEGY_FRAME_KEYS.filter(
      (key) => !recordsByKey[key] || recordsByKey[key]?.status === 'missing'
    );

    return {
      total: allDefs.length,
      totalPresent,
      requiredTotal: requiredDefs.length,
      requiredPresent,
      confirmed,
      proposed,
      missingRequired,
    };
  }, [recordsByKey]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSave = useCallback(
    async (key: CanonicalFieldKey, value: string) => {
      setUpdateError(null);

      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/fields/${key}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value, status: 'proposed' }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save field');
        }

        // Notify parent that a field was saved (for syncing Map view)
        if (onFieldSaved) {
          onFieldSaved(key, value);
        }

        // Refresh data
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setUpdateError(message);
        throw err;
      }
    },
    [companyId, onRefresh, onFieldSaved]
  );

  const handleConfirm = useCallback(
    async (key: CanonicalFieldKey) => {
      setUpdateError(null);

      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/fields/${key}/confirm`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to confirm field');
        }

        // Refresh data
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setUpdateError(message);
        throw err;
      }
    },
    [companyId, onRefresh]
  );

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    setUpdateError(null);

    try {
      await onRefresh();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // ============================================================================
  // Render
  // ============================================================================

  // Coverage status
  const coverageStatus =
    stats.missingRequired.length === 0
      ? 'complete'
      : stats.requiredPresent > 0
        ? 'partial'
        : 'missing';

  return (
    <div className="space-y-6">
      {/* Header: Coverage Summary */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            Context Coverage
            {coverageStatus === 'complete' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            {coverageStatus === 'partial' && (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            {coverageStatus === 'missing' && (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {stats.requiredPresent}/{stats.requiredTotal} required fields •{' '}
            {stats.totalPresent}/{stats.total} total
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 border border-slate-700 rounded-lg hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Strategy Blocking Banner - Missing Required Fields */}
      {stats.missingRequired.length > 0 && (
        <div className="p-4 bg-red-900/30 border border-red-500/40 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-300 mb-1">
                Strategy Blocked — Missing Required Context
              </h3>
              <p className="text-xs text-red-400/80 mb-3">
                These fields must be filled to generate a Strategy Frame. Fix them below or add manually.
              </p>
              <ul className="space-y-1.5">
                {stats.missingRequired.map((key) => {
                  const def = CANONICAL_FIELD_DEFINITIONS[key];
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="text-red-200 font-medium">{def?.label || key}</span>
                      <span className="text-red-400/60 text-xs">({def?.dimension})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {updateError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{updateError}</p>
          <button
            onClick={() => setUpdateError(null)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dimension Sections */}
      <div className="space-y-4">
        {DIMENSION_ORDER.map((dimension) => {
          const fieldDefs = getFieldsByDimension(dimension);
          if (fieldDefs.length === 0) return null;

          return (
            <CanonicalFieldsSection
              key={dimension}
              dimension={dimension}
              dimensionLabel={DIMENSION_LABELS[dimension]}
              fieldDefs={fieldDefs}
              recordsByKey={recordsByKey}
              onSave={handleSave}
              onConfirm={handleConfirm}
              defaultExpanded={
                // Expand dimensions with missing required fields
                fieldDefs.some(
                  (d) =>
                    d.requiredForStrategyFrame &&
                    (!recordsByKey[d.key] || recordsByKey[d.key]?.status === 'missing')
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export default CanonicalFieldsPanel;
