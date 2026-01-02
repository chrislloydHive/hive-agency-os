'use client';

// components/os/programs/IntensityChangeModal.tsx
// Intensity Change Modal - Confirmation modal for changing program intensity
//
// Displays:
// - Current intensity → New intensity
// - Warning about only affecting future deliverables
// - Optional reason textarea
// - Multiplier change indicator

import { useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  Gauge,
  ArrowRight,
  X,
} from 'lucide-react';
import type { IntensityLevel } from '@/lib/types/programTemplate';

// ============================================================================
// Types
// ============================================================================

interface IntensityChangeModalProps {
  programId: string;
  programTitle: string;
  currentIntensity: IntensityLevel;
  newIntensity: IntensityLevel;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (program: unknown) => void;
}

// ============================================================================
// Intensity Configuration
// ============================================================================

const INTENSITY_CONFIG: Record<IntensityLevel, {
  label: string;
  multiplier: number;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  Core: {
    label: 'Core',
    multiplier: 0.6,
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/30',
    description: 'Quarterly cadence, basic analysis',
  },
  Standard: {
    label: 'Standard',
    multiplier: 1.0,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    description: 'Monthly/quarterly cadence, regular analysis',
  },
  Aggressive: {
    label: 'Aggressive',
    multiplier: 1.5,
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    description: 'Weekly/monthly cadence, deep analysis',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function IntensityChangeModal({
  programId,
  programTitle,
  currentIntensity,
  newIntensity,
  isOpen,
  onClose,
  onSuccess,
}: IntensityChangeModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentConfig = INTENSITY_CONFIG[currentIntensity];
  const newConfig = INTENSITY_CONFIG[newIntensity];

  // Calculate multiplier change
  const multiplierChange = Math.round(
    ((newConfig.multiplier - currentConfig.multiplier) / currentConfig.multiplier) * 100
  );
  const isIncrease = multiplierChange > 0;

  // Handle submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/programs/${programId}/intensity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intensity: newIntensity,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change intensity');
      }

      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change intensity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Gauge className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Change Intensity</h3>
              <p className="text-sm text-slate-400 mt-0.5">{programTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Intensity Change Visualization */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <span className={`inline-block px-3 py-1.5 text-sm font-medium rounded-lg ${currentConfig.bg} ${currentConfig.color} border ${currentConfig.border}`}>
              {currentConfig.label}
            </span>
            <p className="text-xs text-slate-500 mt-1">{currentConfig.multiplier}x</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500" />
          <div className="text-center">
            <span className={`inline-block px-3 py-1.5 text-sm font-medium rounded-lg ${newConfig.bg} ${newConfig.color} border ${newConfig.border}`}>
              {newConfig.label}
            </span>
            <p className="text-xs text-slate-500 mt-1">{newConfig.multiplier}x</p>
          </div>
        </div>

        {/* Multiplier Change */}
        <div className="flex items-center justify-center mb-6">
          <span className={`text-sm font-medium ${
            isIncrease ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {isIncrease ? '+' : ''}{multiplierChange}% output multiplier
          </span>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-800/30 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-200">
              This affects future deliverables only.
            </p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Past work and existing deliverables remain unchanged.
            </p>
          </div>
        </div>

        {/* New Intensity Description */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-slate-400 mb-1">New intensity:</p>
          <p className="text-sm text-white">{newConfig.description}</p>
        </div>

        {/* Reason Input */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Reason for change (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
            placeholder="Why are you changing the intensity?"
            rows={2}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Changing...
              </>
            ) : (
              <>
                <Gauge className="w-4 h-4" />
                Confirm Change
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IntensityChangeModal;
