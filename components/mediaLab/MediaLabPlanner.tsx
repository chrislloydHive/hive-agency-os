'use client';

// components/mediaLab/MediaLabPlanner.tsx
// AI Media Planner - 4-Step Wizard
//
// Steps:
// 1. Goals - Business objectives, timeframe, budget, guardrails
// 2. AI Options - 3 plan options (Conservative, Balanced, Aggressive)
// 3. Refine - Adjust budgets, toggle channels, reforecast
// 4. Summary - Final review and promote to program

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  type MediaPlannerInput,
  type MediaPlanOption,
  type ChannelAllocation,
  type PlanObjective,
  type PlanTimeframe,
  type PlanExpectedOutcomes,
  type AIPlannerResultClient,
  type AIPlannerError,
  reforecastPlan,
  adjustChannelBudget,
  getTimeframeDates,
  PLAN_OBJECTIVES,
  PLAN_TIMEFRAMES,
} from '@/lib/media/aiPlanner.client';
import { CHANNEL_LABELS, type MediaChannel } from '@/lib/media/types';
import { promotePlanToProgramAction } from '@/app/c/[companyId]/diagnostics/media/actions';

// ============================================================================
// Types
// ============================================================================

type PlannerStep = 'goals' | 'ai-options' | 'refine' | 'summary';

interface MediaLabPlannerProps {
  companyId: string;
  companyName: string;
  onClose?: () => void;
}

interface GoalsFormData {
  objective: PlanObjective;
  timeframe: PlanTimeframe;
  customStartDate?: string;
  customEndDate?: string;
  monthlyBudget: number;
  maxCpa?: number;
  maxCpl?: number;
  requiredChannels: MediaChannel[];
}

// ============================================================================
// Step Indicator
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: PlannerStep }) {
  const steps: Array<{ key: PlannerStep; label: string }> = [
    { key: 'goals', label: 'Goals' },
    { key: 'ai-options', label: 'AI Plan Options' },
    { key: 'refine', label: 'Refinement' },
    { key: 'summary', label: 'Final Plan' },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              index === currentIndex
                ? 'bg-amber-500 text-slate-900'
                : index < currentIndex
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/50 text-slate-500 border border-slate-700'
            }`}
          >
            {index < currentIndex ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>{index + 1}</span>
            )}
            <span>{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-8 h-px mx-2 ${index < currentIndex ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Step 1: Goals Form
// ============================================================================

function GoalsStep({
  data,
  onChange,
  onNext,
}: {
  data: GoalsFormData;
  onChange: (data: GoalsFormData) => void;
  onNext: () => void;
}) {
  const isValid = data.monthlyBudget > 0;

  const availableChannels: MediaChannel[] = ['search', 'lsa', 'maps', 'social', 'radio'];

  const toggleRequiredChannel = (channel: MediaChannel) => {
    const current = data.requiredChannels;
    const updated = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel];
    onChange({ ...data, requiredChannels: updated });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Define Your Goals</h2>
        <p className="text-sm text-slate-400 mt-2">
          Tell us what you want to achieve and we'll generate AI-powered plan options.
        </p>
      </div>

      <div className="space-y-6">
        {/* Objective Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Primary Objective
          </label>
          <div className="grid grid-cols-2 gap-3">
            {PLAN_OBJECTIVES.map((obj) => (
              <button
                key={obj.value}
                onClick={() => onChange({ ...data, objective: obj.value })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  data.objective === obj.value
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <p className={`text-sm font-medium ${data.objective === obj.value ? 'text-amber-300' : 'text-slate-200'}`}>
                  {obj.label}
                </p>
                <p className="text-xs text-slate-500 mt-1">{obj.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Timeframe
          </label>
          <div className="flex flex-wrap gap-2">
            {PLAN_TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onChange({ ...data, timeframe: tf.value })}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  data.timeframe === tf.value
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {data.timeframe === 'custom' && (
            <div className="flex gap-3 mt-3">
              <input
                type="date"
                value={data.customStartDate || ''}
                onChange={(e) => onChange({ ...data, customStartDate: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <input
                type="date"
                value={data.customEndDate || ''}
                onChange={(e) => onChange({ ...data, customEndDate: e.target.value })}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          )}
        </div>

        {/* Budget Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Monthly Budget *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              value={data.monthlyBudget || ''}
              onChange={(e) => onChange({ ...data, monthlyBudget: parseInt(e.target.value) || 0 })}
              placeholder="5000"
              className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Total monthly media spend across all channels</p>
        </div>

        {/* Guardrails */}
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
          <p className="text-sm font-medium text-slate-300 mb-3">Guardrails (Optional)</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Max CPA Target</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  value={data.maxCpa || ''}
                  onChange={(e) => onChange({ ...data, maxCpa: parseInt(e.target.value) || undefined })}
                  placeholder="150"
                  className="w-full pl-7 pr-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Max CPL Target</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  value={data.maxCpl || ''}
                  onChange={(e) => onChange({ ...data, maxCpl: parseInt(e.target.value) || undefined })}
                  placeholder="50"
                  className="w-full pl-7 pr-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-2">Required Channels</label>
            <div className="flex flex-wrap gap-2">
              {availableChannels.map((channel) => (
                <button
                  key={channel}
                  onClick={() => toggleRequiredChannel(channel)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    data.requiredChannels.includes(channel)
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-600/50 bg-slate-700/30 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {CHANNEL_LABELS[channel] || channel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end mt-8">
        <button
          onClick={onNext}
          disabled={!isValid}
          className="px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate AI Plan Options
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: AI Options
// ============================================================================

function AIOptionsStep({
  options,
  isLoading,
  onSelect,
  onBack,
}: {
  options: MediaPlanOption[] | null;
  isLoading: boolean;
  onSelect: (option: MediaPlanOption) => void;
  onBack: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400">Generating AI-powered plan options...</p>
        <p className="text-xs text-slate-500 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  if (!options || options.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">No plan options generated. Please try again.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm text-slate-300 hover:text-slate-100"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Choose Your Plan</h2>
        <p className="text-sm text-slate-400 mt-2">
          We've generated 3 plan options based on your goals. Select one to refine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {options.map((option) => (
          <PlanOptionCard key={option.id} option={option} onSelect={() => onSelect(option)} />
        ))}
      </div>

      <div className="flex justify-start">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Back to Goals
        </button>
      </div>
    </div>
  );
}

function PlanOptionCard({
  option,
  onSelect,
}: {
  option: MediaPlanOption;
  onSelect: () => void;
}) {
  const riskColors = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  };

  const labelColors = {
    Conservative: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Balanced: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    Aggressive: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 hover:border-slate-600 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${labelColors[option.label]}`}>
          {option.label}
        </span>
        <span className={`text-xs font-medium ${riskColors[option.riskLevel]}`}>
          {option.confidenceScore}% confidence
        </span>
      </div>

      {/* Expected Outcomes */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Installs</p>
          <p className="text-lg font-semibold text-slate-200">{option.expected.installs.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Calls</p>
          <p className="text-lg font-semibold text-slate-200">{option.expected.calls.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">CPA</p>
          <p className="text-lg font-semibold text-slate-200">${option.expected.cpa}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">CPL</p>
          <p className="text-lg font-semibold text-slate-200">${option.expected.cpl}</p>
        </div>
      </div>

      {/* Channel Mix */}
      <div className="mb-4">
        <p className="text-[10px] text-slate-500 uppercase mb-2">Channel Mix</p>
        <div className="flex flex-wrap gap-1">
          {option.channels.map((ch) => (
            <span
              key={ch.channel}
              className="px-2 py-0.5 rounded bg-slate-700/50 text-[10px] text-slate-400"
            >
              {CHANNEL_LABELS[ch.channel] || ch.channel} {ch.percentage}%
            </span>
          ))}
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-xs text-slate-500 mb-4 line-clamp-2">{option.reasoning}</p>

      <button
        onClick={onSelect}
        className="w-full py-2.5 bg-slate-800 text-slate-200 rounded-lg font-medium text-sm hover:bg-slate-700 group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors"
      >
        Select & Refine
      </button>
    </div>
  );
}

// ============================================================================
// Step 3: Refinement
// ============================================================================

function RefineStep({
  selectedPlan,
  allocations,
  expected,
  totalBudget,
  onAllocationsChange,
  onReforecast,
  isReforecasting,
  onNext,
  onBack,
}: {
  selectedPlan: MediaPlanOption;
  allocations: ChannelAllocation[];
  expected: PlanExpectedOutcomes;
  totalBudget: number;
  onAllocationsChange: (allocations: ChannelAllocation[]) => void;
  onReforecast: () => void;
  isReforecasting: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const handleBudgetChange = (channel: MediaChannel, newBudget: number) => {
    const updated = adjustChannelBudget(allocations, channel, newBudget, totalBudget);
    onAllocationsChange(updated);
  };

  const handleToggleChannel = (channel: MediaChannel) => {
    const existing = allocations.find(a => a.channel === channel);
    if (existing) {
      // Remove channel
      const updated = allocations.filter(a => a.channel !== channel);
      // Redistribute budget
      const removedBudget = existing.budget;
      const remaining = updated.length;
      if (remaining > 0) {
        const perChannel = Math.floor(removedBudget / remaining);
        const final = updated.map(a => ({
          ...a,
          budget: a.budget + perChannel,
          percentage: Math.round(((a.budget + perChannel) / totalBudget) * 100),
        }));
        onAllocationsChange(final);
      }
    }
  };

  // Calculate delta from original
  const originalExpected = selectedPlan.expected;
  const getDelta = (current: number, original: number) => {
    const diff = current - original;
    const pct = original > 0 ? Math.round((diff / original) * 100) : 0;
    return { diff, pct };
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Refine Your Plan</h2>
        <p className="text-sm text-slate-400 mt-2">
          Adjust budgets and channels, then reforecast to see updated projections.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Adjustments */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Channel Budgets</p>
          {allocations.map((alloc) => (
            <div
              key={alloc.channel}
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/50"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-200">
                    {CHANNEL_LABELS[alloc.channel] || alloc.channel}
                  </span>
                  <span className="text-xs text-slate-400">{alloc.percentage}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={totalBudget}
                  step={100}
                  value={alloc.budget}
                  onChange={(e) => handleBudgetChange(alloc.channel, parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-500">$0</span>
                  <span className="text-sm font-medium text-amber-400">
                    ${alloc.budget.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500">${totalBudget.toLocaleString()}</span>
                </div>
              </div>
              {!alloc.isRequired && (
                <button
                  onClick={() => handleToggleChannel(alloc.channel)}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove channel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Forecast Panel */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Projected Results</p>
            <button
              onClick={onReforecast}
              disabled={isReforecasting}
              className="px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
            >
              {isReforecasting ? 'Updating...' : 'Reforecast'}
            </button>
          </div>

          <div className="space-y-4">
            <MetricWithDelta
              label="Installs"
              value={expected.installs}
              delta={getDelta(expected.installs, originalExpected.installs)}
            />
            <MetricWithDelta
              label="Calls"
              value={expected.calls}
              delta={getDelta(expected.calls, originalExpected.calls)}
            />
            <MetricWithDelta
              label="CPA"
              value={expected.cpa}
              prefix="$"
              delta={getDelta(expected.cpa, originalExpected.cpa)}
              invertDelta
            />
            <MetricWithDelta
              label="CPL"
              value={expected.cpl}
              prefix="$"
              delta={getDelta(expected.cpl, originalExpected.cpl)}
              invertDelta
            />
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Spend</span>
              <span className="font-semibold text-slate-200">${expected.spend.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Back to Options
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Review Final Plan
        </button>
      </div>
    </div>
  );
}

function MetricWithDelta({
  label,
  value,
  prefix = '',
  delta,
  invertDelta = false,
}: {
  label: string;
  value: number;
  prefix?: string;
  delta: { diff: number; pct: number };
  invertDelta?: boolean;
}) {
  const isPositive = invertDelta ? delta.diff < 0 : delta.diff > 0;
  const isNegative = invertDelta ? delta.diff > 0 : delta.diff < 0;

  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-slate-200">
          {prefix}{value.toLocaleString()}
        </span>
        {delta.pct !== 0 && (
          <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-400'}`}>
            {delta.pct > 0 ? '+' : ''}{delta.pct}%
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Summary
// ============================================================================

function SummaryStep({
  planName,
  allocations,
  expected,
  objective,
  timeframe,
  onPlanNameChange,
  onPromote,
  isPromoting,
  onBack,
}: {
  planName: string;
  allocations: ChannelAllocation[];
  expected: PlanExpectedOutcomes;
  objective: PlanObjective;
  timeframe: { start: string; end: string };
  onPlanNameChange: (name: string) => void;
  onPromote: () => void;
  isPromoting: boolean;
  onBack: () => void;
}) {
  const objectiveLabel = PLAN_OBJECTIVES.find(o => o.value === objective)?.label || objective;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Your Media Plan</h2>
        <p className="text-sm text-slate-400 mt-2">
          Review your plan and promote it to start tracking performance.
        </p>
      </div>

      {/* Plan Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Plan Name</label>
        <input
          type="text"
          value={planName}
          onChange={(e) => onPlanNameChange(e.target.value)}
          placeholder="Q1 2025 Media Plan"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Plan Summary Card */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase">Objective</p>
            <p className="text-sm font-medium text-slate-200">{objectiveLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Timeframe</p>
            <p className="text-sm font-medium text-slate-200">
              {new Date(timeframe.start).toLocaleDateString()} - {new Date(timeframe.end).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 py-4 border-y border-slate-700/50 mb-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-200">{expected.installs.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 uppercase">Installs</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-200">{expected.calls.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 uppercase">Calls</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-200">${expected.cpa}</p>
            <p className="text-[10px] text-slate-500 uppercase">CPA</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-200">${expected.spend.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 uppercase">Spend</p>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div>
          <p className="text-xs text-slate-500 uppercase mb-3">Channel Allocation</p>
          <div className="space-y-2">
            {allocations.map((alloc) => (
              <div key={alloc.channel} className="flex items-center justify-between">
                <span className="text-sm text-slate-300">{CHANNEL_LABELS[alloc.channel] || alloc.channel}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${alloc.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-200 w-20 text-right">
                    ${alloc.budget.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Back to Refine
        </button>
        <button
          onClick={onPromote}
          disabled={isPromoting || !planName.trim()}
          className="px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isPromoting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              Promoting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Promote to Active Program
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaLabPlanner({ companyId, companyName, onClose }: MediaLabPlannerProps) {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<PlannerStep>('goals');

  // Form data
  const [goalsData, setGoalsData] = useState<GoalsFormData>({
    objective: 'blended',
    timeframe: 'next_90_days',
    monthlyBudget: 5000,
    requiredChannels: [],
  });

  // AI Options state
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [planOptions, setPlanOptions] = useState<MediaPlanOption[] | null>(null);

  // Selected plan state
  const [selectedPlan, setSelectedPlan] = useState<MediaPlanOption | null>(null);
  const [allocations, setAllocations] = useState<ChannelAllocation[]>([]);
  const [expected, setExpected] = useState<PlanExpectedOutcomes | null>(null);
  const [isReforecasting, setIsReforecasting] = useState(false);

  // Summary state
  const [planName, setPlanName] = useState(`${companyName} Media Plan`);
  const [isPromoting, setIsPromoting] = useState(false);

  // Generate AI options
  const handleGenerateOptions = useCallback(async () => {
    setIsGeneratingOptions(true);
    setStep('ai-options');

    const timeframeDates = getTimeframeDates(
      goalsData.timeframe,
      goalsData.customStartDate,
      goalsData.customEndDate
    );

    const input: MediaPlannerInput = {
      companyId,
      objective: goalsData.objective,
      timeframe: {
        type: goalsData.timeframe,
        ...timeframeDates,
      },
      monthlyBudget: goalsData.monthlyBudget,
      guardrails: {
        maxCpa: goalsData.maxCpa,
        maxCpl: goalsData.maxCpl,
        requiredChannels: goalsData.requiredChannels.length > 0 ? goalsData.requiredChannels : undefined,
      },
    };

    try {
      // Call API route instead of direct function to avoid bundling server code
      const response = await fetch('/api/media/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const result: AIPlannerResultClient | AIPlannerError = await response.json();

      if (result.success) {
        setPlanOptions(result.options);
      } else {
        console.error('Failed to generate options:', result.error);
      }
    } catch (error) {
      console.error('Error generating options:', error);
    } finally {
      setIsGeneratingOptions(false);
    }
  }, [companyId, goalsData]);

  // Select a plan option
  const handleSelectPlan = useCallback((option: MediaPlanOption) => {
    setSelectedPlan(option);
    setAllocations([...option.channels]);
    setExpected({ ...option.expected });
    setStep('refine');
  }, []);

  // Reforecast with current allocations
  const handleReforecast = useCallback(() => {
    setIsReforecasting(true);
    try {
      const newExpected = reforecastPlan(allocations, goalsData.monthlyBudget);
      setExpected(newExpected);
    } catch (error) {
      console.error('Reforecast error:', error);
    } finally {
      setIsReforecasting(false);
    }
  }, [allocations, goalsData.monthlyBudget]);

  // Promote to program
  const handlePromote = useCallback(async () => {
    if (!expected) return;

    setIsPromoting(true);
    try {
      // First create a media plan, then promote it
      // For now, we'll create the program directly via the promotion action
      // In a full implementation, you'd save the plan to Airtable first

      const res = await fetch('/api/os/media-lab/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: planName,
          objective: goalsData.objective,
          totalBudget: goalsData.monthlyBudget,
          timeframeStart: getTimeframeDates(goalsData.timeframe, goalsData.customStartDate, goalsData.customEndDate).start,
          timeframeEnd: getTimeframeDates(goalsData.timeframe, goalsData.customStartDate, goalsData.customEndDate).end,
          channels: allocations.map(a => ({
            channel: a.channel,
            budgetAmount: a.budget,
            budgetPercentage: a.percentage,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create plan');
      }

      const { plan } = await res.json();

      // Now promote to program
      const result = await promotePlanToProgramAction({
        companyId,
        mediaPlanId: plan.id,
      });

      if (result.success) {
        router.push(`/c/${companyId}/media/program?programId=${result.programId}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to promote plan:', error);
    } finally {
      setIsPromoting(false);
    }
  }, [companyId, planName, goalsData, allocations, expected, router]);

  return (
    <div className="min-h-screen bg-[#050509] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/c/${companyId}/media`}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">AI Media Planner</h1>
              <p className="text-xs text-slate-500">{companyName}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Step Content */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {step === 'goals' && (
            <GoalsStep
              data={goalsData}
              onChange={setGoalsData}
              onNext={handleGenerateOptions}
            />
          )}

          {step === 'ai-options' && (
            <AIOptionsStep
              options={planOptions}
              isLoading={isGeneratingOptions}
              onSelect={handleSelectPlan}
              onBack={() => setStep('goals')}
            />
          )}

          {step === 'refine' && selectedPlan && expected && (
            <RefineStep
              selectedPlan={selectedPlan}
              allocations={allocations}
              expected={expected}
              totalBudget={goalsData.monthlyBudget}
              onAllocationsChange={setAllocations}
              onReforecast={handleReforecast}
              isReforecasting={isReforecasting}
              onNext={() => setStep('summary')}
              onBack={() => setStep('ai-options')}
            />
          )}

          {step === 'summary' && expected && (
            <SummaryStep
              planName={planName}
              allocations={allocations}
              expected={expected}
              objective={goalsData.objective}
              timeframe={getTimeframeDates(goalsData.timeframe, goalsData.customStartDate, goalsData.customEndDate)}
              onPlanNameChange={setPlanName}
              onPromote={handlePromote}
              isPromoting={isPromoting}
              onBack={() => setStep('refine')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
