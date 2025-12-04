'use client';

// components/media/scenarios/MediaScenarioEditor.tsx
// Main editor component for editing scenario details
//
// Sections:
// 1. Scenario header (name, time horizon, period label, total budget)
// 2. Channel allocation grid
// 3. Goals section

import { useState, useCallback } from 'react';
import type {
  MediaScenario,
  MediaScenarioChannelAllocation,
  MediaScenarioGoal,
  MediaScenarioGoalType,
  MediaScenarioTimeHorizon,
  MediaChannel,
} from '@/lib/media/types';
import {
  TIME_HORIZON_OPTIONS,
  GOAL_TYPE_OPTIONS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  SCENARIO_PROVIDER_OPTIONS,
  generateAllocationId,
  formatCurrency,
} from '@/lib/media/types';

interface MediaScenarioEditorProps {
  scenario: MediaScenario;
  onChange: (scenario: MediaScenario) => void;
  onSave: () => void;
  onRunForecast: () => void;
  isSaving?: boolean;
  isForecasting?: boolean;
}

// ============================================================================
// Header Section
// ============================================================================

interface HeaderSectionProps {
  scenario: MediaScenario;
  onChange: (updates: Partial<MediaScenario>) => void;
}

function HeaderSection({ scenario, onChange }: HeaderSectionProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Scenario Details</h3>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Scenario Name</label>
          <input
            type="text"
            value={scenario.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            placeholder="e.g., Base 2025, Q1 CarPlay Push"
          />
        </div>

        {/* Time Horizon & Period */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Time Horizon</label>
            <select
              value={scenario.timeHorizon}
              onChange={(e) => onChange({ timeHorizon: e.target.value as MediaScenarioTimeHorizon })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
            >
              {TIME_HORIZON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Period Label</label>
            <input
              type="text"
              value={scenario.periodLabel || ''}
              onChange={(e) => onChange({ periodLabel: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g., Q1 2026"
            />
          </div>
        </div>

        {/* Total Budget */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Total Budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <input
              type="number"
              min={0}
              step={100}
              value={scenario.totalBudget}
              onChange={(e) => onChange({ totalBudget: parseFloat(e.target.value) || 0 })}
              className="w-full pl-7 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 tabular-nums focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
          <textarea
            value={scenario.description || ''}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-amber-500/50"
            placeholder="Brief description of this scenario..."
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Channel Allocation Section
// ============================================================================

interface AllocationRowProps {
  allocation: MediaScenarioChannelAllocation;
  totalBudget: number;
  onChange: (allocation: MediaScenarioChannelAllocation) => void;
  onRemove: () => void;
}

function AllocationRow({ allocation, totalBudget, onChange, onRemove }: AllocationRowProps) {
  const colors = CHANNEL_COLORS[allocation.channel] || { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
  const percentage = totalBudget > 0 ? (allocation.plannedSpend / totalBudget) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800/50 last:border-0">
      {/* Channel label */}
      <div className="flex-1 min-w-0">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${colors.bg} border ${colors.border}`}>
          <span className={`text-xs font-medium ${colors.text}`}>{allocation.label}</span>
        </div>
        {allocation.provider && (
          <span className="text-[10px] text-slate-500 ml-2">{allocation.provider}</span>
        )}
      </div>

      {/* Spend input */}
      <div className="relative w-28">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
        <input
          type="number"
          min={0}
          step={100}
          value={allocation.plannedSpend}
          onChange={(e) =>
            onChange({ ...allocation, plannedSpend: parseFloat(e.target.value) || 0 })
          }
          className="w-full pl-5 pr-2 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-xs text-slate-200 tabular-nums focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Percentage */}
      <div className="w-14 text-right">
        <span className="text-xs text-slate-500 tabular-nums">{percentage.toFixed(1)}%</span>
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface ChannelAllocationSectionProps {
  allocations: MediaScenarioChannelAllocation[];
  totalBudget: number;
  onChange: (allocations: MediaScenarioChannelAllocation[]) => void;
}

function ChannelAllocationSection({ allocations, totalBudget, onChange }: ChannelAllocationSectionProps) {
  const [showAddChannel, setShowAddChannel] = useState(false);

  const allocatedTotal = allocations.reduce((sum, a) => sum + a.plannedSpend, 0);
  const difference = allocatedTotal - totalBudget;
  const isBalanced = Math.abs(difference) < 1;

  const handleAddChannel = (channel: MediaChannel, provider: string, label: string) => {
    const newAllocation: MediaScenarioChannelAllocation = {
      id: generateAllocationId(),
      channel,
      provider,
      label,
      plannedSpend: 0,
      isLocked: false,
    };
    onChange([...allocations, newAllocation]);
    setShowAddChannel(false);
  };

  const handleUpdateAllocation = (index: number, updated: MediaScenarioChannelAllocation) => {
    const newAllocations = [...allocations];
    newAllocations[index] = updated;
    onChange(newAllocations);
  };

  const handleRemoveAllocation = (index: number) => {
    onChange(allocations.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Channel & Provider Mix</h3>
        <button
          onClick={() => setShowAddChannel(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Channel
        </button>
      </div>

      {/* Allocations list */}
      {allocations.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-500">
          No channels added. Click "Add Channel" to start allocating budget.
        </div>
      ) : (
        <div className="space-y-0">
          {allocations.map((allocation, index) => (
            <AllocationRow
              key={allocation.id}
              allocation={allocation}
              totalBudget={totalBudget}
              onChange={(updated) => handleUpdateAllocation(index, updated)}
              onRemove={() => handleRemoveAllocation(index)}
            />
          ))}
        </div>
      )}

      {/* Budget summary */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Allocated</span>
          <span className="text-slate-300 tabular-nums">{formatCurrency(allocatedTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-slate-500">Total Budget</span>
          <span className="text-slate-300 tabular-nums">{formatCurrency(totalBudget)}</span>
        </div>
        {!isBalanced && (
          <div className={`flex items-center gap-1.5 mt-2 text-xs ${difference > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>
              {difference > 0 ? 'Over-allocated' : 'Under-allocated'} by {formatCurrency(Math.abs(difference))}
            </span>
          </div>
        )}
      </div>

      {/* Add channel modal */}
      {showAddChannel && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowAddChannel(false)} />
          <div className="fixed inset-x-4 top-1/4 z-50 max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-4">Add Channel</h4>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {SCENARIO_PROVIDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAddChannel(opt.defaultChannel, opt.value, opt.label)}
                  className="px-3 py-2 text-left text-xs bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <span className="text-slate-200">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    {CHANNEL_LABELS[opt.defaultChannel]}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddChannel(false)}
              className="w-full mt-4 px-3 py-2 text-xs text-slate-400 hover:text-slate-300 border border-slate-700 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Goals Section
// ============================================================================

interface GoalsSectionProps {
  goal: MediaScenarioGoal | undefined;
  onChange: (goal: MediaScenarioGoal | undefined) => void;
}

function GoalsSection({ goal, onChange }: GoalsSectionProps) {
  const currentType = goal?.type || 'none';

  const handleTypeChange = (type: MediaScenarioGoalType) => {
    if (type === 'none') {
      onChange(undefined);
    } else {
      onChange({ ...goal, type });
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Goal</h3>

      {/* Goal type selector */}
      <div className="mb-4">
        <label className="block text-xs text-slate-500 mb-1">Goal Type</label>
        <select
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as MediaScenarioGoalType)}
          className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
        >
          {GOAL_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {currentType !== 'none' && (
          <p className="text-[10px] text-slate-500 mt-1">
            {GOAL_TYPE_OPTIONS.find((o) => o.value === currentType)?.description}
          </p>
        )}
      </div>

      {/* Target value input (for target-based goals) */}
      {(currentType === 'hit_target_cpa' || currentType === 'hit_target_volume') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Target Value</label>
            <div className="relative">
              {currentType === 'hit_target_cpa' && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              )}
              <input
                type="number"
                min={0}
                value={goal?.targetValue || ''}
                onChange={(e) =>
                  onChange({ ...goal!, targetValue: parseFloat(e.target.value) || undefined })
                }
                className={`w-full ${currentType === 'hit_target_cpa' ? 'pl-5' : 'pl-3'} pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 tabular-nums focus:outline-none focus:border-amber-500/50`}
                placeholder={currentType === 'hit_target_cpa' ? '150' : '100'}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Metric</label>
            <select
              value={goal?.metric || 'installs'}
              onChange={(e) =>
                onChange({ ...goal!, metric: e.target.value as 'installs' | 'leads' | 'cpa' | 'revenue' })
              }
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="installs">Installs</option>
              <option value="leads">Leads</option>
              <option value="cpa">CPA</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>
        </div>
      )}

      {/* Notes */}
      {currentType !== 'none' && (
        <div className="mt-4">
          <label className="block text-xs text-slate-500 mb-1">Goal Notes (optional)</label>
          <textarea
            value={goal?.notes || ''}
            onChange={(e) => onChange({ ...goal!, notes: e.target.value || undefined })}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-amber-500/50"
            placeholder="Additional context about this goal..."
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Editor Component
// ============================================================================

export function MediaScenarioEditor({
  scenario,
  onChange,
  onSave,
  onRunForecast,
  isSaving,
  isForecasting,
}: MediaScenarioEditorProps) {
  const handleUpdate = useCallback(
    (updates: Partial<MediaScenario>) => {
      onChange({ ...scenario, ...updates });
    },
    [scenario, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Header section */}
      <HeaderSection scenario={scenario} onChange={handleUpdate} />

      {/* Channel allocation section */}
      <ChannelAllocationSection
        allocations={scenario.allocations}
        totalBudget={scenario.totalBudget}
        onChange={(allocations) => handleUpdate({ allocations })}
      />

      {/* Goals section */}
      <GoalsSection goal={scenario.goal} onChange={(goal) => handleUpdate({ goal })} />

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </>
          )}
        </button>
        <button
          onClick={onRunForecast}
          disabled={isForecasting || scenario.totalBudget === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isForecasting ? (
            <>
              <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Run Forecast
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default MediaScenarioEditor;
