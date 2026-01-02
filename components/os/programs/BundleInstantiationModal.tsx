'use client';

// components/os/programs/BundleInstantiationModal.tsx
// Modal to instantiate a bundle of Programs from a preset

import { useState, useMemo, useEffect } from 'react';
import { X, Loader2, Check, Package, Zap, AlertCircle } from 'lucide-react';
import {
  getEnabledBundlePresets,
  getBundlePresetById,
} from '@/lib/os/planning/domainTemplates';
import {
  PROGRAM_DOMAIN_LABELS,
  INTENSITY_LEVEL_LABELS,
  INTENSITY_LEVEL_DESCRIPTIONS,
  type ProgramDomain,
  type IntensityLevel,
  type BundleInstantiationResult,
} from '@/lib/types/programTemplate';

interface BundleInstantiationModalProps {
  companyId: string;
  strategyId: string;
  onClose: () => void;
  onSuccess: (result: BundleInstantiationResult) => void;
}

export function BundleInstantiationModal({
  companyId,
  strategyId,
  onClose,
  onSuccess,
}: BundleInstantiationModalProps) {
  const enabledPresets = useMemo(() => getEnabledBundlePresets(), []);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    enabledPresets[0]?.id || ''
  );
  const [intensity, setIntensity] = useState<IntensityLevel>('Standard');
  const [selectedDomains, setSelectedDomains] = useState<ProgramDomain[]>([]);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BundleInstantiationResult | null>(null);

  // Get preset details when selection changes
  const selectedPreset = useMemo(
    () => getBundlePresetById(selectedPresetId),
    [selectedPresetId]
  );

  // Sync domains with preset when preset changes
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = getBundlePresetById(presetId);
    if (preset) {
      setSelectedDomains(preset.domains);
      setIntensity(preset.defaultIntensity);
    }
  };

  // Initialize with first preset on mount
  useEffect(() => {
    if (enabledPresets[0] && selectedDomains.length === 0) {
      handlePresetChange(enabledPresets[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDomain = (domain: ProgramDomain) => {
    setSelectedDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPresetId || selectedDomains.length === 0) {
      setError('Please select a bundle and at least one domain');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/os/bundles/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: selectedPresetId,
          domains: selectedDomains,
          intensity,
          startDate,
          companyId,
          strategyId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to instantiate bundle');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to instantiate bundle');
    } finally {
      setLoading(false);
    }
  };

  const intensityLevels: IntensityLevel[] = ['Core', 'Standard', 'Aggressive'];
  const allDomains: ProgramDomain[] = [
    'Strategy',
    'Creative',
    'Media',
    'LocalVisibility',
    'Analytics',
    'Operations',
  ];

  // Success state
  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => onSuccess(result)}
        />

        <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-400 mb-4">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Bundle Instantiated
            </h2>
            <p className="text-slate-400 mb-4">
              Created {result.summary.created} programs
              {result.summary.skipped > 0 && `, skipped ${result.summary.skipped}`}
            </p>

            <div className="space-y-2 text-left mb-6">
              {result.programs.map((prog) => (
                <div
                  key={prog.programId}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                >
                  {prog.status === 'created' ? (
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : prog.status === 'already_exists' ? (
                    <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {prog.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {PROGRAM_DOMAIN_LABELS[prog.domain]} &middot;{' '}
                      {prog.status === 'created'
                        ? 'Created'
                        : prog.status === 'already_exists'
                        ? 'Already exists'
                        : 'Failed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => onSuccess(result)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Instantiate Bundle
              </h2>
              <p className="text-sm text-slate-400">
                Create programs from a bundle preset
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Bundle Preset */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bundle Preset
            </label>
            <div className="space-y-2">
              {enabledPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`w-full p-3 text-left rounded-lg border transition-all ${
                    selectedPresetId === preset.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{preset.name}</span>
                    {preset.targetClient && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {preset.targetClient}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Intensity Level */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Intensity Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {intensityLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setIntensity(level)}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    intensity === level
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-white font-medium text-sm">
                    {level === 'Aggressive' && <Zap className="w-3.5 h-3.5" />}
                    {INTENSITY_LEVEL_LABELS[level]}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {INTENSITY_LEVEL_DESCRIPTIONS[level]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Domain Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Domains to Include
            </label>
            <div className="grid grid-cols-2 gap-2">
              {allDomains.map((domain) => {
                const isSelected = selectedDomains.includes(domain);
                const isInPreset = selectedPreset?.domains.includes(domain);

                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleDomain(domain)}
                    className={`p-3 rounded-lg border transition-all text-left flex items-center gap-2 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span
                      className={`text-sm ${
                        isSelected ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {PROGRAM_DOMAIN_LABELS[domain]}
                    </span>
                    {isInPreset && !isSelected && (
                      <span className="text-xs text-slate-500">(default)</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedDomains.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">
                Select at least one domain
              </p>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Deliverable due dates will be calculated from this date
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              {selectedDomains.length} domain{selectedDomains.length !== 1 && 's'}{' '}
              selected
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedDomains.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create {selectedDomains.length} Program
                {selectedDomains.length !== 1 && 's'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BundleInstantiationModal;
