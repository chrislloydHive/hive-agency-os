'use client';

// components/competitive/PositioningMapSection.tsx
// Positioning Map Section for Brain → Context → Competitive
//
// Includes:
// - The positioning map visualization
// - Inline editing for axes and coordinates
// - Empty state handling

import { useState, useCallback, useEffect, useMemo } from 'react';
import { PositioningMapCore, PositioningMapEmptyState } from './PositioningMapCore';
import {
  extractPositioningMapData,
  hasPositioningData,
  shouldShowPositioningPlaceholder,
  type PositioningMapData,
} from './positioningMapUtils';
import type { CompetitiveDomain } from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

interface PositioningMapSectionProps {
  companyId: string;
  companyName: string;
  /** Competitive domain data from Context Graph */
  competitiveDomain: CompetitiveDomain | null;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Callback when a field is saved - accepts string values (JSON stringified for objects) */
  onSaveField?: (path: string, value: string) => Promise<{ success: boolean; error?: string }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Inline Editor Component
// ============================================================================

interface InlineNumberEditorProps {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  onSave: (value: number) => Promise<void>;
  disabled?: boolean;
}

function InlineNumberEditor({
  label,
  value,
  min = 0,
  max = 100,
  onSave,
  disabled = false,
}: InlineNumberEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const numValue = parseInt(editValue, 10);
    if (isNaN(numValue) || numValue < min || numValue > max) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(numValue);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, min, max, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditValue(value?.toString() ?? '');
      }
    },
    [handleSave, value]
  );

  useEffect(() => {
    setEditValue(value?.toString() ?? '');
  }, [value]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{label}:</span>
        <input
          type="number"
          min={min}
          max={max}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          autoFocus
          className="w-16 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white focus:border-yellow-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">/ {max}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && setIsEditing(true)}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
        disabled
          ? 'cursor-not-allowed text-gray-500'
          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      )}
    >
      <span className="text-gray-400">{label}:</span>
      <span className="font-mono">{value ?? '—'}</span>
      <span className="text-gray-500">/ {max}</span>
      {!disabled && (
        <svg
          className="h-3 w-3 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// Inline Text Editor Component
// ============================================================================

interface InlineTextEditorProps {
  label: string;
  value: string | null;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}

function InlineTextEditor({
  label,
  value,
  placeholder = 'Click to edit...',
  onSave,
  disabled = false,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditValue(value ?? '');
      }
    },
    [handleSave, value]
  );

  useEffect(() => {
    setEditValue(value ?? '');
  }, [value]);

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">{label}</label>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          autoFocus
          placeholder={placeholder}
          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-yellow-500 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && setIsEditing(true)}
      disabled={disabled}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded px-2 py-1 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed'
          : 'hover:bg-gray-800'
      )}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span className={cn('text-sm', value ? 'text-gray-200' : 'text-gray-500')}>
        {value || placeholder}
      </span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PositioningMapSection({
  companyId,
  companyName,
  competitiveDomain,
  canEdit = true,
  onSaveField,
}: PositioningMapSectionProps) {
  // Extract positioning data - by default only includes verified (non-autoSeeded) competitors
  const mapData = useMemo<PositioningMapData>(() => {
    if (!competitiveDomain) {
      return {
        primaryAxisLabel: 'Primary Axis',
        secondaryAxisLabel: 'Secondary Axis',
        brandPosition: null,
        competitors: [],
        isAiSeededOnly: false,
        verifiedCount: 0,
        autoSeededCount: 0,
      };
    }

    return extractPositioningMapData(
      competitiveDomain.positioningAxes?.value,
      competitiveDomain.ownPositionPrimary?.value,
      competitiveDomain.ownPositionSecondary?.value,
      competitiveDomain.primaryCompetitors?.value,
      competitiveDomain.positioningSummary?.value,
      { includeAutoSeeded: false } // Only show verified competitors
    );
  }, [competitiveDomain]);

  const hasData = hasPositioningData(mapData);
  const placeholder = shouldShowPositioningPlaceholder(mapData);

  // Save handlers
  const handleSavePrimaryAxisLabel = useCallback(
    async (value: string) => {
      if (!onSaveField) return;
      const axesValue = {
        primaryAxis: {
          label: value,
          lowLabel: mapData.primaryAxisLow || '',
          highLabel: mapData.primaryAxisHigh || '',
          description: null,
        },
        secondaryAxis: competitiveDomain?.positioningAxes?.value?.secondaryAxis || null,
      };
      await onSaveField('competitive.positioningAxes', JSON.stringify(axesValue));
    },
    [onSaveField, mapData, competitiveDomain]
  );

  const handleSaveSecondaryAxisLabel = useCallback(
    async (value: string) => {
      if (!onSaveField) return;
      const axesValue = {
        primaryAxis: competitiveDomain?.positioningAxes?.value?.primaryAxis || null,
        secondaryAxis: {
          label: value,
          lowLabel: mapData.secondaryAxisLow || '',
          highLabel: mapData.secondaryAxisHigh || '',
          description: null,
        },
      };
      await onSaveField('competitive.positioningAxes', JSON.stringify(axesValue));
    },
    [onSaveField, mapData, competitiveDomain]
  );

  const handleSavePrimaryPosition = useCallback(
    async (value: number) => {
      if (!onSaveField) return;
      await onSaveField('competitive.ownPositionPrimary', String(value));
    },
    [onSaveField]
  );

  const handleSaveSecondaryPosition = useCallback(
    async (value: number) => {
      if (!onSaveField) return;
      await onSaveField('competitive.ownPositionSecondary', String(value));
    },
    [onSaveField]
  );

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3">
        <h3 className="text-sm font-medium text-white">Positioning Map</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Shows where we sit relative to the market along the selected axes.
        </p>
      </div>

      {/* Content */}
      <div className="p-4">
        {placeholder.show ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-6 py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20">
              <svg
                className="h-6 w-6 text-violet-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <p className="text-sm text-violet-300">{placeholder.message}</p>
            {mapData.autoSeededCount > 0 && (
              <p className="mt-2 text-xs text-violet-400/70">
                Review competitors in the table below to verify their positioning.
              </p>
            )}
          </div>
        ) : !hasData ? (
          <PositioningMapEmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Map */}
            <div className="flex justify-center">
              <PositioningMapCore
                primaryAxisLabel={mapData.primaryAxisLabel}
                secondaryAxisLabel={mapData.secondaryAxisLabel}
                primaryAxisLow={mapData.primaryAxisLow}
                primaryAxisHigh={mapData.primaryAxisHigh}
                secondaryAxisLow={mapData.secondaryAxisLow}
                secondaryAxisHigh={mapData.secondaryAxisHigh}
                brandPosition={mapData.brandPosition}
                competitors={mapData.competitors}
                companyName={companyName}
                width={380}
                height={380}
              />
            </div>

            {/* Coordinates display */}
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-md bg-gray-800/50 px-4 py-2">
              <InlineNumberEditor
                label="Primary"
                value={mapData.brandPosition?.x ?? null}
                onSave={handleSavePrimaryPosition}
                disabled={!canEdit || !onSaveField}
              />
              <InlineNumberEditor
                label="Secondary"
                value={mapData.brandPosition?.y ?? null}
                onSave={handleSaveSecondaryPosition}
                disabled={!canEdit || !onSaveField}
              />
            </div>
          </div>
        )}
      </div>

      {/* Axis Configuration (collapsible) */}
      {canEdit && onSaveField && (
        <div className="border-t border-gray-800 px-4 py-3">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-300">
              <svg
                className="h-4 w-4 transition-transform group-open:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Configure Axes
            </summary>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <InlineTextEditor
                label="Primary Axis (Horizontal)"
                value={mapData.primaryAxisLabel !== 'Primary Axis' ? mapData.primaryAxisLabel : null}
                placeholder="e.g., Premium ↔ Affordable"
                onSave={handleSavePrimaryAxisLabel}
                disabled={!canEdit}
              />
              <InlineTextEditor
                label="Secondary Axis (Vertical)"
                value={mapData.secondaryAxisLabel !== 'Secondary Axis' ? mapData.secondaryAxisLabel : null}
                placeholder="e.g., Simple ↔ Complex"
                onSave={handleSaveSecondaryAxisLabel}
                disabled={!canEdit}
              />
            </div>
          </details>
        </div>
      )}

      {/* Positioning Summary */}
      {mapData.positioningSummary && (
        <div className="border-t border-gray-800 px-4 py-3">
          <h4 className="mb-1 text-xs font-medium text-gray-400">Positioning Summary</h4>
          <p className="text-sm text-gray-300">{mapData.positioningSummary}</p>
        </div>
      )}

      {/* Competitor count */}
      {(mapData.competitors.length > 0 || mapData.autoSeededCount > 0) && (
        <div className="border-t border-gray-800 px-4 py-2">
          <p className="text-xs text-gray-500">
            {mapData.competitors.length > 0 && (
              <span>
                {mapData.competitors.length} verified competitor{mapData.competitors.length !== 1 ? 's' : ''} plotted
              </span>
            )}
            {mapData.competitors.length > 0 && mapData.autoSeededCount > 0 && ' · '}
            {mapData.autoSeededCount > 0 && (
              <span className="text-violet-400">
                {mapData.autoSeededCount} AI-suggested pending review
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
