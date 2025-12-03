'use client';

// components/media/BudgetControls.tsx
// Budget & Channel Allocation Controls for Media Lab Forecast Engine
//
// Features:
// - Total monthly budget input
// - Season selector dropdown
// - Channel allocation sliders with auto-normalization
// - "Reset to Recommended Mix" button

import { useState, useCallback, useEffect } from 'react';
import {
  type MediaChannel,
  type SeasonKey,
  type MediaBudgetInput,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  SEASON_OPTIONS,
  DEFAULT_CHANNEL_SPLITS,
  formatCurrency,
} from '@/lib/media/forecastEngine';

// ============================================================================
// Types
// ============================================================================

interface BudgetControlsProps {
  budget: MediaBudgetInput;
  onBudgetChange: (budget: MediaBudgetInput) => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ChannelSliderProps {
  channel: MediaChannel;
  value: number; // 0-1
  onChange: (value: number) => void;
  budget: number;
}

function ChannelSlider({ channel, value, onChange, budget }: ChannelSliderProps) {
  const colors = CHANNEL_COLORS[channel];
  const percent = Math.round(value * 100);
  const channelBudget = budget * value;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={`text-xs font-medium ${colors.text}`}>
          {CHANNEL_LABELS[channel]}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            {formatCurrency(channelBudget)}
          </span>
          <span className={`text-xs font-medium tabular-nums ${colors.text}`}>
            {percent}%
          </span>
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => onChange(parseInt(e.target.value) / 100)}
          className={`w-full h-1.5 rounded-full appearance-none cursor-pointer
            bg-slate-700
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
          `}
          style={{
            background: `linear-gradient(to right,
              ${channel === 'search' ? 'rgb(96, 165, 250)' :
                channel === 'social' ? 'rgb(244, 114, 182)' :
                channel === 'lsa' ? 'rgb(192, 132, 252)' :
                channel === 'display' ? 'rgb(34, 211, 238)' :
                'rgb(52, 211, 153)'} ${percent}%,
              rgb(51, 65, 85) ${percent}%)`,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetControls({
  budget,
  onBudgetChange,
  className = '',
}: BudgetControlsProps) {
  const [localBudget, setLocalBudget] = useState(budget.totalMonthlyBudget.toString());

  // Sync local budget with prop
  useEffect(() => {
    setLocalBudget(budget.totalMonthlyBudget.toString());
  }, [budget.totalMonthlyBudget]);

  const handleBudgetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalBudget(value);

    const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(numValue) && numValue >= 0) {
      onBudgetChange({ ...budget, totalMonthlyBudget: numValue });
    }
  }, [budget, onBudgetChange]);

  const handleSeasonChange = useCallback((season: SeasonKey) => {
    onBudgetChange({ ...budget, season });
  }, [budget, onBudgetChange]);

  const handleChannelChange = useCallback((channel: MediaChannel, value: number) => {
    // Update the channel split and normalize others proportionally
    const newSplits = { ...budget.channelSplits };
    const oldValue = newSplits[channel];
    const delta = value - oldValue;

    newSplits[channel] = value;

    // Distribute delta across other channels proportionally
    const otherChannels = Object.keys(newSplits).filter(c => c !== channel) as MediaChannel[];
    const otherTotal = otherChannels.reduce((sum, c) => sum + newSplits[c], 0);

    if (otherTotal > 0) {
      for (const c of otherChannels) {
        const proportion = newSplits[c] / otherTotal;
        newSplits[c] = Math.max(0, newSplits[c] - delta * proportion);
      }
    }

    // Normalize to ensure sum is exactly 1
    const total = Object.values(newSplits).reduce((sum, v) => sum + v, 0);
    if (total > 0) {
      for (const c of Object.keys(newSplits) as MediaChannel[]) {
        newSplits[c] = newSplits[c] / total;
      }
    }

    onBudgetChange({ ...budget, channelSplits: newSplits });
  }, [budget, onBudgetChange]);

  const handleResetToRecommended = useCallback(() => {
    onBudgetChange({
      ...budget,
      channelSplits: { ...DEFAULT_CHANNEL_SPLITS },
    });
  }, [budget, onBudgetChange]);

  const channels: MediaChannel[] = ['search', 'lsa', 'social', 'maps', 'display'];

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Budget & Channel Mix</h3>
        <button
          onClick={handleResetToRecommended}
          className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          Reset to Recommended
        </button>
      </div>

      {/* Budget Input */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1.5">Monthly Budget</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input
            type="text"
            value={localBudget}
            onChange={handleBudgetChange}
            className="w-full pl-7 pr-3 py-2 text-lg font-semibold bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            placeholder="10,000"
          />
        </div>
      </div>

      {/* Season Selector */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1.5">Season</label>
        <select
          value={budget.season}
          onChange={(e) => handleSeasonChange(e.target.value as SeasonKey)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
        >
          {SEASON_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.months})
            </option>
          ))}
        </select>
      </div>

      {/* Channel Allocation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Channel Allocation</label>
          <span className="text-[10px] text-slate-500">
            {Math.round(Object.values(budget.channelSplits).reduce((s, v) => s + v, 0) * 100)}%
          </span>
        </div>

        {channels.map((channel) => (
          <ChannelSlider
            key={channel}
            channel={channel}
            value={budget.channelSplits[channel]}
            onChange={(value) => handleChannelChange(channel, value)}
            budget={budget.totalMonthlyBudget}
          />
        ))}
      </div>

      {/* Visual allocation bar */}
      <div className="mt-4 h-2 rounded-full overflow-hidden flex">
        {channels.map((channel) => {
          const width = budget.channelSplits[channel] * 100;
          if (width === 0) return null;
          return (
            <div
              key={channel}
              className={`${CHANNEL_COLORS[channel].bg.replace('/10', '/50')} first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${width}%` }}
              title={`${CHANNEL_LABELS[channel]}: ${Math.round(width)}%`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default BudgetControls;
