'use client';

// components/media/dashboard/MediaProgramSetup.tsx
// Setup flow for creating a new Media Program
//
// Allows users to:
// - Select channels (Search, Maps, LSAs, Social, Radio)
// - Set budget per channel
// - Optionally attach an existing Media Plan

import { useState, useCallback } from 'react';
import { CHANNEL_LABELS, CHANNEL_COLORS, type MediaChannel } from '@/lib/media/types';
import { MEDIA_PROVIDER_OPTIONS, type MediaProvider } from '@/lib/types/media';
import type { MediaProgramChannel } from '@/lib/media/programs';

// ============================================================================
// Types
// ============================================================================

interface MediaProgramSetupProps {
  companyId: string;
  companyName: string;
  existingPlans?: { id: string; name: string }[];
  onComplete: (program: any) => void;
  onCancel?: () => void;
}

interface ChannelConfig {
  channel: MediaChannel;
  provider: MediaProvider;
  isActive: boolean;
  monthlyBudget: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHANNELS: ChannelConfig[] = [
  { channel: 'search', provider: 'google_ads', isActive: true, monthlyBudget: 5000 },
  { channel: 'maps', provider: 'gbp', isActive: true, monthlyBudget: 0 },
  { channel: 'lsa', provider: 'lsa', isActive: true, monthlyBudget: 2000 },
  { channel: 'social', provider: 'meta_ads', isActive: false, monthlyBudget: 0 },
  { channel: 'radio', provider: 'radio_vendor', isActive: false, monthlyBudget: 0 },
  { channel: 'display', provider: 'google_ads', isActive: false, monthlyBudget: 0 },
  { channel: 'youtube', provider: 'youtube_ads', isActive: false, monthlyBudget: 0 },
];

// ============================================================================
// Helper Components
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface ChannelToggleProps {
  config: ChannelConfig;
  onChange: (config: ChannelConfig) => void;
}

function ChannelToggle({ config, onChange }: ChannelToggleProps) {
  const colors = CHANNEL_COLORS[config.channel];
  const label = CHANNEL_LABELS[config.channel];

  const providerOptions = MEDIA_PROVIDER_OPTIONS.filter(p => {
    // Filter providers relevant to the channel
    if (config.channel === 'search') return ['google_ads', 'microsoft_ads'].includes(p.value);
    if (config.channel === 'social') return ['meta_ads', 'tiktok_ads'].includes(p.value);
    if (config.channel === 'maps') return p.value === 'gbp';
    if (config.channel === 'lsa') return p.value === 'lsa';
    if (config.channel === 'radio') return p.value === 'radio_vendor';
    if (config.channel === 'display') return ['google_ads', 'dv360'].includes(p.value);
    if (config.channel === 'youtube') return ['youtube_ads', 'google_ads'].includes(p.value);
    return true;
  });

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      config.isActive
        ? `${colors.bg} ${colors.border}`
        : 'bg-slate-900/30 border-slate-800'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.isActive}
            onChange={(e) => onChange({ ...config, isActive: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
          />
          <span className={`text-sm font-medium ${config.isActive ? colors.text : 'text-slate-400'}`}>
            {label}
          </span>
        </label>
      </div>

      {config.isActive && (
        <div className="space-y-3 ml-7">
          {/* Provider select */}
          {providerOptions.length > 1 && (
            <div>
              <label className="text-[10px] text-slate-500 uppercase">Provider</label>
              <select
                value={config.provider}
                onChange={(e) => onChange({ ...config, provider: e.target.value as MediaProvider })}
                className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              >
                {providerOptions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Budget input */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase">Monthly Budget</label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={config.monthlyBudget}
                onChange={(e) => onChange({ ...config, monthlyBudget: parseInt(e.target.value) || 0 })}
                className="w-full pl-6 pr-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/30 tabular-nums"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaProgramSetup({
  companyId,
  companyName,
  existingPlans = [],
  onComplete,
  onCancel,
}: MediaProgramSetupProps) {
  const [step, setStep] = useState<'channels' | 'review'>('channels');
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [programName, setProgramName] = useState(`${new Date().getFullYear()} Media Program`);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeChannels = channels.filter(c => c.isActive);
  const totalBudget = activeChannels.reduce((sum, c) => sum + c.monthlyBudget, 0);

  const handleChannelChange = useCallback((updatedChannel: ChannelConfig) => {
    setChannels(prev =>
      prev.map(c => c.channel === updatedChannel.channel ? updatedChannel : c)
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (activeChannels.length === 0) {
      setError('Please select at least one channel');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const programChannels: MediaProgramChannel[] = channels.map(c => ({
        channel: c.channel,
        provider: c.provider,
        isActive: c.isActive,
        monthlyBudget: c.monthlyBudget,
      }));

      const res = await fetch(`/api/media/programs/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: programName,
          channels: programChannels,
          totalMonthlyBudget: totalBudget,
          planId: selectedPlanId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create program');
      }

      const data = await res.json();
      onComplete(data.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create program');
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, programName, channels, activeChannels, totalBudget, selectedPlanId, onComplete]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Set Up Media Program</h2>
        <p className="text-sm text-slate-400 mt-1">
          Configure media channels and budget for {companyName}
        </p>
      </div>

      {step === 'channels' && (
        <>
          {/* Program Name */}
          <div className="mb-6">
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">
              Program Name
            </label>
            <input
              type="text"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              placeholder="e.g., 2025 Media Program"
            />
          </div>

          {/* Channel Selection */}
          <div className="mb-6">
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-3">
              Select Channels
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {channels.map((config) => (
                <ChannelToggle
                  key={config.channel}
                  config={config}
                  onChange={handleChannelChange}
                />
              ))}
            </div>
          </div>

          {/* Link to Plan (optional) */}
          {existingPlans.length > 0 && (
            <div className="mb-6">
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">
                Link to Media Plan (Optional)
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              >
                <option value="">No plan linked</option>
                {existingPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Summary */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Active Channels</div>
                <div className="text-lg font-bold text-slate-100">{activeChannels.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Total Monthly Budget</div>
                <div className="text-lg font-bold text-amber-400">{formatCurrency(totalBudget)}</div>
              </div>
            </div>
            {activeChannels.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="flex flex-wrap gap-1">
                  {activeChannels.map((c) => {
                    const colors = CHANNEL_COLORS[c.channel];
                    return (
                      <span
                        key={c.channel}
                        className={`px-2 py-0.5 text-xs rounded ${colors.bg} ${colors.text} ${colors.border} border`}
                      >
                        {CHANNEL_LABELS[c.channel]}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || activeChannels.length === 0}
              className="ml-auto px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Media Program'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default MediaProgramSetup;
