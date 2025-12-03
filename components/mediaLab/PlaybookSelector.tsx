'use client';

// components/mediaLab/PlaybookSelector.tsx
// Media Playbook Selection Component - choose from prebuilt strategies

import { useState } from 'react';
import {
  type MediaPlaybook,
  type MediaPrimaryGoal,
  MEDIA_PLAYBOOKS,
  MEDIA_PRIMARY_GOAL_CONFIG,
  MEDIA_CHANNEL_LABELS,
} from '@/lib/types/mediaLab';

// ============================================================================
// Types
// ============================================================================

interface PlaybookSelectorProps {
  onSelect: (playbook: MediaPlaybook) => void;
  onCustom: () => void;
  selectedId?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PlaybookSelector({
  onSelect,
  onCustom,
  selectedId,
}: PlaybookSelectorProps) {
  const [filterGoal, setFilterGoal] = useState<MediaPrimaryGoal | 'all'>('all');

  const filteredPlaybooks =
    filterGoal === 'all'
      ? MEDIA_PLAYBOOKS
      : MEDIA_PLAYBOOKS.filter((p) => p.targetGoal === filterGoal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">
          Choose a Playbook
        </h3>
        <p className="text-xs text-slate-500">
          Start with a proven strategy or build a custom plan
        </p>
      </div>

      {/* Goal Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterGoal('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterGoal === 'all'
              ? 'bg-slate-700 text-slate-100'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
          }`}
        >
          All
        </button>
        {(Object.keys(MEDIA_PRIMARY_GOAL_CONFIG) as MediaPrimaryGoal[]).map((goal) => (
          <button
            key={goal}
            type="button"
            onClick={() => setFilterGoal(goal)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterGoal === goal
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {MEDIA_PRIMARY_GOAL_CONFIG[goal].label}
          </button>
        ))}
      </div>

      {/* Playbook Cards */}
      <div className="grid gap-4">
        {filteredPlaybooks.map((playbook) => (
          <PlaybookCard
            key={playbook.id}
            playbook={playbook}
            isSelected={selectedId === playbook.id}
            onSelect={() => onSelect(playbook)}
          />
        ))}
      </div>

      {/* Custom Option */}
      <button
        type="button"
        onClick={onCustom}
        className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-600 bg-slate-800/20 hover:bg-slate-800/40 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center group-hover:bg-slate-700">
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-300 group-hover:text-slate-200">
              Build Custom Plan
            </p>
            <p className="text-xs text-slate-500">
              Define your own objectives and channel mix
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

// ============================================================================
// Playbook Card
// ============================================================================

function PlaybookCard({
  playbook,
  isSelected,
  onSelect,
}: {
  playbook: MediaPlaybook;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const goalConfig = MEDIA_PRIMARY_GOAL_CONFIG[playbook.targetGoal];

  const coreChannels = playbook.channelMix.filter((c) => c.priority === 'core');

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSelected
          ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30'
          : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
      }`}
    >
      {/* Main Content */}
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-slate-200">
                {playbook.name}
              </h4>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${goalConfig.color} bg-current/10`}
              >
                {goalConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">{playbook.description}</p>

            {/* Core Channels */}
            <div className="flex flex-wrap gap-1.5">
              {coreChannels.map((ch) => (
                <span
                  key={ch.channel}
                  className="inline-flex items-center px-2 py-0.5 rounded bg-slate-700/50 text-[10px] text-slate-300"
                >
                  {MEDIA_CHANNEL_LABELS[ch.channel]} ({ch.percentOfBudget}%)
                </span>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div className="text-right ml-4 flex-shrink-0">
            <p className="text-xs text-slate-500">Suggested Budget</p>
            <p className="text-sm font-medium text-slate-300">
              ${playbook.suggestedBudgetRange.min.toLocaleString()} -{' '}
              ${playbook.suggestedBudgetRange.max.toLocaleString()}
            </p>
          </div>
        </div>
      </button>

      {/* Expand/Collapse Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 border-t border-slate-700/50 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        {isExpanded ? 'Hide Details' : 'Show Details'}
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-4">
          {/* Channel Mix */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
              Channel Mix
            </p>
            <div className="space-y-1.5">
              {playbook.channelMix.map((ch) => (
                <div key={ch.channel} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-300">
                        {MEDIA_CHANNEL_LABELS[ch.channel]}
                      </span>
                      <span className="text-xs text-slate-400">{ch.percentOfBudget}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ch.priority === 'core'
                            ? 'bg-amber-500'
                            : ch.priority === 'supporting'
                            ? 'bg-blue-500'
                            : 'bg-slate-500'
                        }`}
                        style={{ width: `${ch.percentOfBudget}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{ch.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expected Outcomes */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
              Expected Outcomes
            </p>
            <ul className="space-y-1">
              {playbook.expectedOutcomes.map((outcome, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-emerald-400 mt-0.5">+</span>
                  {outcome}
                </li>
              ))}
            </ul>
          </div>

          {/* Requirements */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
              Requirements
            </p>
            <ul className="space-y-1">
              {playbook.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-500">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Seasonal Bursts */}
          {playbook.seasonalBursts.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                Seasonal Bursts
              </p>
              <div className="flex flex-wrap gap-2">
                {playbook.seasonalBursts.map((burst) => (
                  <span
                    key={burst.key}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-300"
                  >
                    {burst.label}
                    <span className="text-purple-400">+{burst.spendLiftPercent}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Best For */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
              Best For
            </p>
            <div className="flex flex-wrap gap-1.5">
              {playbook.bestFor.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex px-2 py-0.5 rounded bg-slate-700/50 text-[10px] text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
