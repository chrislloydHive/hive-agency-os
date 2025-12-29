'use client';

// components/os/outcomes/WorkOutcomeCaptureModal.tsx
// Modal for capturing outcomes when work items complete or artifacts ship
//
// Captures:
// - Primary conversion action (what was the goal)
// - Observed result (what actually happened)
// - Confidence level
// - Optional metric data

import { useState } from 'react';
import {
  X,
  Target,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { OutcomeSignalConfidence } from '@/lib/types/outcomeSignal';

// ============================================================================
// Types
// ============================================================================

export interface WorkOutcomeData {
  primaryConversionAction: string;
  observedResult: string;
  confidence: OutcomeSignalConfidence;
  metric?: {
    label: string;
    value: string;
    period?: string;
  };
}

interface WorkOutcomeCaptureModalProps {
  /** Title of the work item or artifact */
  title: string;
  /** Type of entity (work_item or artifact) */
  entityType: 'work_item' | 'artifact';
  /** Entity ID */
  entityId: string;
  /** Suggested primary conversion action (from program/strategy) */
  suggestedPrimaryAction?: string;
  /** Called when user saves outcome */
  onSave: (data: WorkOutcomeData) => Promise<void>;
  /** Called when user closes without saving */
  onClose: () => void;
}

// ============================================================================
// Confidence Button
// ============================================================================

function ConfidenceButton({
  level,
  selected,
  onClick,
}: {
  level: OutcomeSignalConfidence;
  selected: boolean;
  onClick: () => void;
}) {
  const config: Record<OutcomeSignalConfidence, { label: string; color: string }> = {
    low: { label: 'Low', color: selected ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : '' },
    medium: { label: 'Medium', color: selected ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : '' },
    high: { label: 'High', color: selected ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : '' },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm rounded-lg border transition-colors ${
        selected
          ? config[level].color
          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      {config[level].label}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkOutcomeCaptureModal({
  title,
  entityType,
  entityId,
  suggestedPrimaryAction,
  onSave,
  onClose,
}: WorkOutcomeCaptureModalProps) {
  const [primaryAction, setPrimaryAction] = useState(suggestedPrimaryAction || '');
  const [observedResult, setObservedResult] = useState('');
  const [confidence, setConfidence] = useState<OutcomeSignalConfidence>('medium');
  const [metricLabel, setMetricLabel] = useState('');
  const [metricValue, setMetricValue] = useState('');
  const [metricPeriod, setMetricPeriod] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = primaryAction.trim() && observedResult.trim();

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      const data: WorkOutcomeData = {
        primaryConversionAction: primaryAction.trim(),
        observedResult: observedResult.trim(),
        confidence,
        metric: metricLabel.trim() && metricValue.trim()
          ? {
              label: metricLabel.trim(),
              value: metricValue.trim(),
              period: metricPeriod.trim() || undefined,
            }
          : undefined,
      };

      await onSave(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outcome');
    } finally {
      setIsSaving(false);
    }
  };

  const entityLabel = entityType === 'work_item' ? 'work item' : 'artifact';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Capture Outcome</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {entityType === 'work_item' ? 'Work completed' : 'Artifact shipped'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Entity Info */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{entityLabel}</p>
            <p className="text-sm text-white font-medium truncate">{title}</p>
          </div>

          {/* Primary Conversion Action */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Target className="w-4 h-4" />
              Primary Conversion Action
              <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={primaryAction}
              onChange={(e) => setPrimaryAction(e.target.value)}
              placeholder="e.g., Generate qualified leads, Increase brand awareness"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">
              What was the main goal this work was trying to achieve?
            </p>
          </div>

          {/* Observed Result */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <TrendingUp className="w-4 h-4" />
              Observed Result
              <span className="text-red-400">*</span>
            </label>
            <textarea
              value={observedResult}
              onChange={(e) => setObservedResult(e.target.value)}
              placeholder="e.g., Campaign generated 45 MQLs in first 2 weeks..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              What actually happened? Include any evidence or observations.
            </p>
          </div>

          {/* Confidence */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              Confidence Level
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <ConfidenceButton
                  key={level}
                  level={level}
                  selected={confidence === level}
                  onClick={() => setConfidence(level)}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              How confident are you in the result attribution?
            </p>
          </div>

          {/* Optional Metric */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <BarChart3 className="w-4 h-4" />
              Metric (optional)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={metricLabel}
                onChange={(e) => setMetricLabel(e.target.value)}
                placeholder="Metric name"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <input
                type="text"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                placeholder="Value"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <input
                type="text"
                value={metricPeriod}
                onChange={(e) => setMetricPeriod(e.target.value)}
                placeholder="Period (e.g., Q1)"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Add a specific metric if available (e.g., MQLs: 45, Q1 2024)
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-slate-400 hover:text-slate-300 transition-colors text-sm disabled:opacity-50"
          >
            Skip for now
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={`flex items-center gap-2 px-6 py-2 font-medium rounded-lg transition-colors ${
              !canSave || isSaving
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Outcome'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
