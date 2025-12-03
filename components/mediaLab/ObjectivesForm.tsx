'use client';

// components/mediaLab/ObjectivesForm.tsx
// Media Objectives Input Form - captures goals, targets, and constraints

import { useState } from 'react';
import {
  type MediaPrimaryGoal,
  type MediaSeasonality,
  type GeographicFocus,
  type MediaChannelKey,
  type MediaObjectivesInput,
  MEDIA_PRIMARY_GOAL_CONFIG,
  MEDIA_SEASONALITY_CONFIG,
  GEOGRAPHIC_FOCUS_CONFIG,
  MEDIA_CHANNEL_LABELS,
} from '@/lib/types/mediaLab';

// ============================================================================
// Types
// ============================================================================

interface ObjectivesFormProps {
  companyId: string;
  initialValues?: Partial<MediaObjectivesInput>;
  onSubmit: (objectives: MediaObjectivesInput) => void;
  onCancel?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_OPTIONS = [
  'Remote Start',
  'CarPlay/Android Auto',
  'Audio Systems',
  'Dash Cams',
  'Radar Detectors',
  'Window Tint',
  'Paint Protection',
  'Marine Audio',
  'Motorcycle Audio',
  'Lighting',
  'Custom Fabrication',
];

const ALL_CHANNELS: MediaChannelKey[] = [
  'google_search',
  'google_lsas',
  'google_maps_gbp',
  'paid_social_meta',
  'display_retarg',
  'radio',
  'other',
];

// ============================================================================
// Component
// ============================================================================

export function ObjectivesForm({
  companyId,
  initialValues,
  onSubmit,
  onCancel,
}: ObjectivesFormProps) {
  const [primaryGoal, setPrimaryGoal] = useState<MediaPrimaryGoal>(
    initialValues?.primaryGoal || 'installs'
  );
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>(
    initialValues?.secondaryGoals || []
  );
  const [targetCPL, setTargetCPL] = useState<string>(
    initialValues?.targetCPL?.toString() || ''
  );
  const [targetCPA, setTargetCPA] = useState<string>(
    initialValues?.targetCPA?.toString() || ''
  );
  const [geographicFocus, setGeographicFocus] = useState<GeographicFocus>(
    initialValues?.geographicFocus || 'market'
  );
  const [categoryFocus, setCategoryFocus] = useState<string[]>(
    initialValues?.categoryFocus || []
  );
  const [seasonality, setSeasonality] = useState<MediaSeasonality>(
    initialValues?.seasonality || 'mixed'
  );
  const [requiredChannels, setRequiredChannels] = useState<MediaChannelKey[]>(
    initialValues?.requiredChannels || []
  );
  const [excludedChannels, setExcludedChannels] = useState<MediaChannelKey[]>(
    initialValues?.excludedChannels || []
  );
  const [notes, setNotes] = useState<string>(initialValues?.notes || '');

  const handleSubmit = () => {
    const objectives: MediaObjectivesInput = {
      companyId,
      primaryGoal,
      secondaryGoals,
      targetCPL: targetCPL ? parseFloat(targetCPL) : undefined,
      targetCPA: targetCPA ? parseFloat(targetCPA) : undefined,
      geographicFocus,
      categoryFocus,
      seasonality,
      requiredChannels,
      excludedChannels,
      notes: notes || undefined,
    };
    onSubmit(objectives);
  };

  const toggleCategory = (category: string) => {
    setCategoryFocus((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleChannel = (
    channel: MediaChannelKey,
    list: 'required' | 'excluded'
  ) => {
    if (list === 'required') {
      setRequiredChannels((prev) =>
        prev.includes(channel)
          ? prev.filter((c) => c !== channel)
          : [...prev, channel]
      );
      // Remove from excluded if adding to required
      setExcludedChannels((prev) => prev.filter((c) => c !== channel));
    } else {
      setExcludedChannels((prev) =>
        prev.includes(channel)
          ? prev.filter((c) => c !== channel)
          : [...prev, channel]
      );
      // Remove from required if adding to excluded
      setRequiredChannels((prev) => prev.filter((c) => c !== channel));
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Goal */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Primary Goal
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {(Object.keys(MEDIA_PRIMARY_GOAL_CONFIG) as MediaPrimaryGoal[]).map((goal) => {
            const config = MEDIA_PRIMARY_GOAL_CONFIG[goal];
            const isSelected = primaryGoal === goal;
            return (
              <button
                key={goal}
                type="button"
                onClick={() => setPrimaryGoal(goal)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <p className={`text-sm font-medium ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                  {config.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{config.kpi}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Target CPL ($)
          </label>
          <input
            type="number"
            value={targetCPL}
            onChange={(e) => setTargetCPL(e.target.value)}
            placeholder="e.g., 75"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Target CPA / Cost Per Install ($)
          </label>
          <input
            type="number"
            value={targetCPA}
            onChange={(e) => setTargetCPA(e.target.value)}
            placeholder="e.g., 125"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-slate-600"
          />
        </div>
      </div>

      {/* Geographic Focus */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Geographic Focus
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(GEOGRAPHIC_FOCUS_CONFIG) as GeographicFocus[]).map((focus) => {
            const config = GEOGRAPHIC_FOCUS_CONFIG[focus];
            const isSelected = geographicFocus === focus;
            return (
              <button
                key={focus}
                type="button"
                onClick={() => setGeographicFocus(focus)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <p className={`text-sm font-medium ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                  {config.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{config.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Focus */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Category Focus
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((category) => {
            const isSelected = categoryFocus.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seasonality */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Seasonality Strategy
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MEDIA_SEASONALITY_CONFIG) as MediaSeasonality[]).map((s) => {
            const config = MEDIA_SEASONALITY_CONFIG[s];
            const isSelected = seasonality === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeasonality(s)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <p className={`text-sm font-medium ${isSelected ? 'text-purple-300' : 'text-slate-200'}`}>
                  {config.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{config.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel Preferences */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Channel Preferences
        </label>
        <div className="grid grid-cols-2 gap-4">
          {/* Required Channels */}
          <div className="bg-slate-800/30 rounded-lg p-3">
            <p className="text-xs text-emerald-400 font-medium mb-2">Must Include</p>
            <div className="space-y-1.5">
              {ALL_CHANNELS.map((channel) => {
                const isSelected = requiredChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel, 'required')}
                    className={`w-full px-2 py-1.5 rounded text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {MEDIA_CHANNEL_LABELS[channel]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Excluded Channels */}
          <div className="bg-slate-800/30 rounded-lg p-3">
            <p className="text-xs text-red-400 font-medium mb-2">Exclude</p>
            <div className="space-y-1.5">
              {ALL_CHANNELS.map((channel) => {
                const isSelected = excludedChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel, 'excluded')}
                    className={`w-full px-2 py-1.5 rounded text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {MEDIA_CHANNEL_LABELS[channel]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Additional Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any specific requirements, constraints, or context..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-slate-600 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium transition-colors"
        >
          Generate Recommendations
        </button>
      </div>
    </div>
  );
}
