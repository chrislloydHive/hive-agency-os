'use client';

// components/mediaLab/SmartIntakePlanner.tsx
// Enterprise-Grade AI Media Planner with Smart Intake
//
// Features:
// - 13-category input schema
// - Auto-prefill from Brain & Diagnostics
// - "From Brain" badges for prefilled fields
// - Step-by-step wizard with intelligent grouping
// - Generate 3 AI plan options (Conservative, Balanced, Aggressive)

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  type MediaPlanningInputs,
  type MediaPlanningInputsWithMetadata,
  type FieldMetadata,
  type PrimaryObjective,
  type MarketMaturity,
  type RiskTolerance,
  type TimeHorizon,
  type MediaChannelId,
  PLANNING_CATEGORIES,
  MEDIA_CHANNEL_INFO,
  OBJECTIVE_LABELS,
  MARKET_MATURITY_LABELS,
  RISK_TOLERANCE_LABELS,
  TIME_HORIZON_LABELS,
  FIELD_LABELS,
  countFilledFields,
  calculateCompleteness,
  validateForGeneration,
  createEmptyPlanningInputs,
} from '@/lib/media/planningInput';
import { getSourceBadgeColor } from '@/lib/brain/sourceBadge';

// ============================================================================
// Types
// ============================================================================

type PlannerStep =
  | 'overview'
  | 'business-objectives'
  | 'audience-product'
  | 'history-infra'
  | 'budget-channels'
  | 'confirm'
  | 'generating'
  | 'options'
  | 'refine'
  | 'summary';

interface SmartIntakePlannerProps {
  companyId: string;
  companyName: string;
  initialInputs?: MediaPlanningInputsWithMetadata;
  onClose?: () => void;
}

interface AIPlanOption {
  id: string;
  name: string;
  strategy: 'conservative' | 'balanced' | 'aggressive';
  description: string;
  channelBudgets: Array<{ channelId: MediaChannelId; monthlyBudget: number; rationale: string }>;
  geoAllocation: string;
  creativeRequirements: string;
  targetingStructure: string;
  forecastedOutcomes: {
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    estimatedCpa: number;
    estimatedRoas: number;
  };
  measurementPlan: string;
  testingRoadmap: string;
  riskAnalysis: string;
  rolloutPlan: string;
}

// ============================================================================
// Step Indicator
// ============================================================================

function StepIndicator({
  currentStep,
  steps,
  onGoToStep,
}: {
  currentStep: PlannerStep;
  steps: Array<{ key: PlannerStep; label: string }>;
  onGoToStep: (step: PlannerStep) => void;
}) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
      {steps.map((step, index) => {
        const isClickable = index <= currentIndex; // Can go back to completed or current steps

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => isClickable && onGoToStep(step.key)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                index === currentIndex
                  ? 'bg-amber-500 text-slate-900'
                  : index < currentIndex
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              {index < currentIndex ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="w-4 text-center">{index + 1}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <div className={`w-4 h-px mx-1 ${index < currentIndex ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Source Badge
// ============================================================================

function SourceBadge({ source }: { source: FieldMetadata['source'] }) {
  // Skip unknown sources
  if (source === 'unknown') return null;

  // Only call getSourceBadgeColor for valid sources
  const validSource = source as 'brain' | 'diagnostics' | 'profile' | 'manual';
  const colors = getSourceBadgeColor(validSource);
  const labels: Record<string, string> = {
    brain: 'From Brain',
    diagnostics: 'From Diagnostics',
    profile: 'From Profile',
    manual: 'Manual',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.text} ${colors.bg} border ${colors.border}`}>
      {source === 'brain' && (
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )}
      {labels[source]}
    </span>
  );
}

// ============================================================================
// Form Field Components
// ============================================================================

interface FieldWrapperProps {
  label: string;
  fieldKey: string;
  metadata?: Record<string, FieldMetadata>;
  required?: boolean;
  children: React.ReactNode;
}

function FieldWrapper({ label, fieldKey, metadata, required, children }: FieldWrapperProps) {
  const fieldMeta = metadata?.[fieldKey];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-300">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {fieldMeta && <SourceBadge source={fieldMeta.source} />}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  prefix,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{prefix}</span>
      )}
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 ${prefix ? 'pl-7' : ''}`}
      />
    </div>
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function ChipSelector<T extends string>({
  value,
  onChange,
  options,
  multiple = false,
}: {
  value: T | T[] | undefined;
  onChange: (value: T | T[]) => void;
  options: Array<{ value: T; label: string; description?: string }>;
  multiple?: boolean;
}) {
  // Debug: log what value we're receiving
  console.log('[ChipSelector] value:', value, 'options:', options.map(o => o.value));

  const isSelected = (opt: T) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(opt);
    }
    return value === opt;
  };

  const toggle = (opt: T) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      const updated = current.includes(opt)
        ? current.filter(v => v !== opt)
        : [...current, opt];
      onChange(updated);
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isSelected(opt.value)
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Step 0: Overview
// ============================================================================

// Map category IDs to step names
const CATEGORY_TO_STEP: Record<string, PlannerStep> = {
  businessBrand: 'business-objectives',
  objectivesKpis: 'business-objectives',
  audience: 'audience-product',
  productOffer: 'audience-product',
  historical: 'history-infra',
  digitalInfra: 'history-infra',
  competitive: 'history-infra',
  creativeContent: 'history-infra',
  operational: 'budget-channels',
  budget: 'budget-channels',
  channels: 'budget-channels',
  storeLocation: 'budget-channels',
  risk: 'budget-channels',
};

function OverviewStep({
  inputs,
  metadata,
  sources,
  onNext,
  onGoToStep,
}: {
  inputs: MediaPlanningInputs | null | undefined;
  metadata: Record<string, FieldMetadata> | null | undefined;
  sources: { brain: boolean; profile: boolean; diagnostics: boolean; memory: boolean } | null | undefined;
  onNext: () => void;
  onGoToStep: (step: PlannerStep) => void;
}) {
  const completeness = calculateCompleteness(inputs);
  const safeSources = sources || { brain: false, profile: false, diagnostics: false, memory: false };
  const safeMetadata = metadata || {};

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Planning Context Overview</h2>
        <p className="text-sm text-slate-400 mt-2">
          We&apos;ve prefilled what we know from Brain and diagnostics. Review and fill in any gaps.
        </p>
      </div>

      {/* Sources Summary */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {safeSources.brain && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-medium text-purple-300">Brain Connected</span>
          </div>
        )}
        {safeSources.diagnostics && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium text-blue-300">Diagnostics Loaded</span>
          </div>
        )}
        {safeSources.profile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium text-emerald-300">Profile Found</span>
          </div>
        )}
      </div>

      {/* Completeness Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Overall Completeness</span>
          <span className="text-sm font-medium text-slate-300">{completeness}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${completeness > 70 ? 'bg-emerald-500' : completeness > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {PLANNING_CATEGORIES.map((category) => {
          const { filled, total } = countFilledFields(inputs, category.id);
          const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
          const targetStep = CATEGORY_TO_STEP[category.id];

          return (
            <button
              key={category.id}
              onClick={() => targetStep && onGoToStep(targetStep)}
              className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-left hover:bg-slate-800 hover:border-slate-600 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-300 group-hover:text-slate-100">{category.name}</h4>
                <span className={`text-xs font-medium ${percentage === 100 ? 'text-emerald-400' : percentage > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {filled}/{total}
                </span>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${percentage === 100 ? 'bg-emerald-500' : percentage > 0 ? 'bg-amber-500' : 'bg-slate-600'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="mt-2 flex items-center text-[10px] text-slate-500 group-hover:text-slate-400">
                <span>Click to edit</span>
                <svg className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Prefill Summary */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mb-8">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Prefilled from Brain</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(safeMetadata).slice(0, 10).map(([key, meta]) => (
            <span
              key={key}
              className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400"
            >
              {FIELD_LABELS[key] || key}
            </span>
          ))}
          {Object.keys(safeMetadata).length > 10 && (
            <span className="px-2 py-1 text-xs text-slate-500">
              +{Object.keys(safeMetadata).length - 10} more
            </span>
          )}
          {Object.keys(safeMetadata).length === 0 && (
            <span className="text-xs text-slate-500">No prefilled data yet - loading...</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
        >
          Review & Edit Details
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 1: Business & Objectives
// ============================================================================

function BusinessObjectivesStep({
  inputs,
  metadata,
  onChange,
  onNext,
  onBack,
}: {
  inputs: MediaPlanningInputs;
  metadata: Record<string, FieldMetadata>;
  onChange: (inputs: MediaPlanningInputs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const objectiveOptions = Object.entries(OBJECTIVE_LABELS).map(([value, label]) => ({
    value: value as PrimaryObjective,
    label,
  }));

  const maturityOptions = Object.entries(MARKET_MATURITY_LABELS).map(([value, label]) => ({
    value: value as MarketMaturity,
    label,
  }));

  const timeHorizonOptions = Object.entries(TIME_HORIZON_LABELS).map(([value, label]) => ({
    value: value as TimeHorizon,
    label,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Business & Objectives</h2>
        <p className="text-sm text-slate-400 mt-2">
          Define your business context and marketing objectives.
        </p>
      </div>

      <div className="space-y-8">
        {/* Business Context Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Business Context</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="Business Model" fieldKey="businessModel" metadata={metadata}>
              <TextInput
                value={inputs.businessBrand.businessModel}
                onChange={(v) => onChange({
                  ...inputs,
                  businessBrand: { ...inputs.businessBrand, businessModel: v },
                })}
                placeholder="e.g., Retail, DTC, SaaS, Services"
              />
            </FieldWrapper>

            <FieldWrapper label="Market Maturity" fieldKey="marketMaturity" metadata={metadata}>
              <SelectInput
                value={inputs.businessBrand.marketMaturity}
                onChange={(v) => onChange({
                  ...inputs,
                  businessBrand: { ...inputs.businessBrand, marketMaturity: v },
                })}
                options={maturityOptions}
                placeholder="Select maturity stage"
              />
            </FieldWrapper>

            <div className="col-span-2">
              <FieldWrapper label="Geographic Footprint" fieldKey="geographicFootprint" metadata={metadata}>
                <TextInput
                  value={inputs.businessBrand.geographicFootprint}
                  onChange={(v) => onChange({
                    ...inputs,
                    businessBrand: { ...inputs.businessBrand, geographicFootprint: v },
                  })}
                  placeholder="e.g., Pacific Northwest, 15 locations in WA/OR"
                />
              </FieldWrapper>
            </div>

            <div className="col-span-2">
              <FieldWrapper label="Brand Positioning" fieldKey="positioning" metadata={metadata}>
                <TextArea
                  value={inputs.businessBrand.positioning}
                  onChange={(v) => onChange({
                    ...inputs,
                    businessBrand: { ...inputs.businessBrand, positioning: v },
                  })}
                  placeholder="How does your brand position itself in the market?"
                  rows={2}
                />
              </FieldWrapper>
            </div>
          </div>
        </div>

        {/* Objectives Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Marketing Objectives</h3>
          <div className="space-y-4">
            <FieldWrapper label="Primary Objective" fieldKey="primaryObjective" metadata={metadata} required>
              <ChipSelector
                value={inputs.objectivesKpis.primaryObjective}
                onChange={(v) => onChange({
                  ...inputs,
                  objectivesKpis: { ...inputs.objectivesKpis, primaryObjective: v as PrimaryObjective },
                })}
                options={objectiveOptions}
              />
            </FieldWrapper>

            <FieldWrapper label="Time Horizon" fieldKey="timeHorizon" metadata={metadata}>
              <ChipSelector
                value={inputs.objectivesKpis.timeHorizon}
                onChange={(v) => onChange({
                  ...inputs,
                  objectivesKpis: { ...inputs.objectivesKpis, timeHorizon: v as TimeHorizon },
                })}
                options={timeHorizonOptions}
              />
            </FieldWrapper>

            <div className="grid grid-cols-3 gap-4">
              <FieldWrapper label="Target CPA" fieldKey="targetCpa" metadata={metadata}>
                <NumberInput
                  value={inputs.objectivesKpis.targetCpa}
                  onChange={(v) => onChange({
                    ...inputs,
                    objectivesKpis: { ...inputs.objectivesKpis, targetCpa: v },
                  })}
                  placeholder="0"
                  prefix="$"
                />
              </FieldWrapper>

              <FieldWrapper label="Target CPL" fieldKey="targetCpl" metadata={metadata}>
                <NumberInput
                  value={inputs.objectivesKpis.targetCpl}
                  onChange={(v) => onChange({
                    ...inputs,
                    objectivesKpis: { ...inputs.objectivesKpis, targetCpl: v },
                  })}
                  placeholder="0"
                  prefix="$"
                />
              </FieldWrapper>

              <FieldWrapper label="Target ROAS" fieldKey="targetRoas" metadata={metadata}>
                <NumberInput
                  value={inputs.objectivesKpis.targetRoas}
                  onChange={(v) => onChange({
                    ...inputs,
                    objectivesKpis: { ...inputs.objectivesKpis, targetRoas: v },
                  })}
                  placeholder="0"
                />
              </FieldWrapper>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Audience & Product
// ============================================================================

function AudienceProductStep({
  inputs,
  metadata,
  onChange,
  onNext,
  onBack,
}: {
  inputs: MediaPlanningInputs;
  metadata: Record<string, FieldMetadata>;
  onChange: (inputs: MediaPlanningInputs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Audience & Product</h2>
        <p className="text-sm text-slate-400 mt-2">
          Define your target audience and product context.
        </p>
      </div>

      <div className="space-y-8">
        {/* Audience Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Target Audience</h3>
          <div className="space-y-4">
            <FieldWrapper label="Core Segments" fieldKey="coreSegments" metadata={metadata}>
              <TextArea
                value={inputs.audience.coreSegments?.join(', ')}
                onChange={(v) => onChange({
                  ...inputs,
                  audience: { ...inputs.audience, coreSegments: v.split(',').map(s => s.trim()).filter(Boolean) },
                })}
                placeholder="e.g., Homeowners 35-55, First-time buyers, Renovation enthusiasts"
                rows={2}
              />
            </FieldWrapper>

            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Demographics" fieldKey="demographics" metadata={metadata}>
                <TextInput
                  value={inputs.audience.demographics}
                  onChange={(v) => onChange({
                    ...inputs,
                    audience: { ...inputs.audience, demographics: v },
                  })}
                  placeholder="Age, income, household type"
                />
              </FieldWrapper>

              <FieldWrapper label="Geographic Targets" fieldKey="geos" metadata={metadata}>
                <TextInput
                  value={inputs.audience.geos}
                  onChange={(v) => onChange({
                    ...inputs,
                    audience: { ...inputs.audience, geos: v },
                  })}
                  placeholder="DMAs, ZIPs, regions"
                />
              </FieldWrapper>
            </div>

            <FieldWrapper label="Media Habits" fieldKey="mediaHabits" metadata={metadata}>
              <TextArea
                value={inputs.audience.mediaHabits}
                onChange={(v) => onChange({
                  ...inputs,
                  audience: { ...inputs.audience, mediaHabits: v },
                })}
                placeholder="Where does your audience spend time? What media do they consume?"
                rows={2}
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Product Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Products & Offers</h3>
          <div className="space-y-4">
            <FieldWrapper label="Product Lines" fieldKey="productLines" metadata={metadata}>
              <TextArea
                value={inputs.productOffer.productLines?.join(', ')}
                onChange={(v) => onChange({
                  ...inputs,
                  productOffer: { ...inputs.productOffer, productLines: v.split(',').map(s => s.trim()).filter(Boolean) },
                })}
                placeholder="List your main product lines or service categories"
                rows={2}
              />
            </FieldWrapper>

            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Pricing Notes" fieldKey="pricingNotes" metadata={metadata}>
                <TextInput
                  value={inputs.productOffer.pricingNotes}
                  onChange={(v) => onChange({
                    ...inputs,
                    productOffer: { ...inputs.productOffer, pricingNotes: v },
                  })}
                  placeholder="Avg ticket, price ranges"
                />
              </FieldWrapper>

              <FieldWrapper label="Promo Windows" fieldKey="promoWindows" metadata={metadata}>
                <TextInput
                  value={inputs.productOffer.promoWindows}
                  onChange={(v) => onChange({
                    ...inputs,
                    productOffer: { ...inputs.productOffer, promoWindows: v },
                  })}
                  placeholder="Key promotional periods"
                />
              </FieldWrapper>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: History, Infra, Competitive
// ============================================================================

function HistoryInfraStep({
  inputs,
  metadata,
  onChange,
  onNext,
  onBack,
}: {
  inputs: MediaPlanningInputs;
  metadata: Record<string, FieldMetadata>;
  onChange: (inputs: MediaPlanningInputs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">History, Infrastructure & Competitive</h2>
        <p className="text-sm text-slate-400 mt-2">
          Past performance, tracking capabilities, and competitive landscape.
        </p>
      </div>

      <div className="space-y-8">
        {/* Historical Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Historical Performance</h3>
          <div className="space-y-4">
            <FieldWrapper label="Past Spend by Channel" fieldKey="pastSpendByChannelSummary" metadata={metadata}>
              <TextArea
                value={inputs.historical.pastSpendByChannelSummary}
                onChange={(v) => onChange({
                  ...inputs,
                  historical: { ...inputs.historical, pastSpendByChannelSummary: v },
                })}
                placeholder="Summary of past media spend across channels"
                rows={2}
              />
            </FieldWrapper>

            <FieldWrapper label="Past Performance Summary" fieldKey="pastPerformanceSummary" metadata={metadata}>
              <TextArea
                value={inputs.historical.pastPerformanceSummary}
                onChange={(v) => onChange({
                  ...inputs,
                  historical: { ...inputs.historical, pastPerformanceSummary: v },
                })}
                placeholder="CPA, ROAS, CTR, CVR trends and notes"
                rows={2}
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Digital Infra Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Digital Infrastructure</h3>
          <div className="space-y-4">
            <FieldWrapper label="Tracking Stack" fieldKey="trackingStackSummary" metadata={metadata}>
              <TextArea
                value={inputs.digitalInfra.trackingStackSummary}
                onChange={(v) => onChange({
                  ...inputs,
                  digitalInfra: { ...inputs.digitalInfra, trackingStackSummary: v },
                })}
                placeholder="GA4, GTM, pixels, call tracking, etc."
                rows={2}
              />
            </FieldWrapper>

            <div className="grid grid-cols-3 gap-4">
              <FieldWrapper label="GA4 Health" fieldKey="ga4Health" metadata={metadata}>
                <TextInput
                  value={inputs.digitalInfra.ga4Health}
                  onChange={(v) => onChange({
                    ...inputs,
                    digitalInfra: { ...inputs.digitalInfra, ga4Health: v },
                  })}
                  placeholder="Good, Needs work, etc."
                />
              </FieldWrapper>

              <FieldWrapper label="GBP Health" fieldKey="gbpHealth" metadata={metadata}>
                <TextInput
                  value={inputs.digitalInfra.gbpHealth}
                  onChange={(v) => onChange({
                    ...inputs,
                    digitalInfra: { ...inputs.digitalInfra, gbpHealth: v },
                  })}
                  placeholder="Good, Needs work, etc."
                />
              </FieldWrapper>

              <FieldWrapper label="Call Tracking" fieldKey="callTracking" metadata={metadata}>
                <TextInput
                  value={inputs.digitalInfra.callTracking}
                  onChange={(v) => onChange({
                    ...inputs,
                    digitalInfra: { ...inputs.digitalInfra, callTracking: v },
                  })}
                  placeholder="CallRail, CTM, etc."
                />
              </FieldWrapper>
            </div>
          </div>
        </div>

        {/* Competitive Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Competitive Intelligence</h3>
          <div className="space-y-4">
            <FieldWrapper label="Competitive Landscape" fieldKey="shareOfVoice" metadata={metadata}>
              <TextArea
                value={inputs.competitive.shareOfVoice}
                onChange={(v) => onChange({
                  ...inputs,
                  competitive: { ...inputs.competitive, shareOfVoice: v },
                })}
                placeholder="Key competitors, share of voice, market position"
                rows={2}
              />
            </FieldWrapper>

            <FieldWrapper label="Competitor Media Mix" fieldKey="competitorMediaMix" metadata={metadata}>
              <TextArea
                value={inputs.competitive.competitorMediaMix}
                onChange={(v) => onChange({
                  ...inputs,
                  competitive: { ...inputs.competitive, competitorMediaMix: v },
                })}
                placeholder="What channels are competitors using?"
                rows={2}
              />
            </FieldWrapper>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Budget, Channels, Risk
// ============================================================================

function BudgetChannelsStep({
  inputs,
  metadata,
  onChange,
  onNext,
  onBack,
}: {
  inputs: MediaPlanningInputs;
  metadata: Record<string, FieldMetadata>;
  onChange: (inputs: MediaPlanningInputs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const riskOptions = Object.entries(RISK_TOLERANCE_LABELS).map(([value, label]) => ({
    value: value as RiskTolerance,
    label,
  }));

  const channelOptions = MEDIA_CHANNEL_INFO.map(c => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Budget, Channels & Risk</h2>
        <p className="text-sm text-slate-400 mt-2">
          Set your budget parameters, channel preferences, and risk appetite.
        </p>
      </div>

      <div className="space-y-8">
        {/* Budget Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Budget</h3>
          <div className="grid grid-cols-3 gap-4">
            <FieldWrapper label="Monthly Budget" fieldKey="totalBudgetMonthly" metadata={metadata} required>
              <NumberInput
                value={inputs.budget.totalBudgetMonthly}
                onChange={(v) => onChange({
                  ...inputs,
                  budget: { ...inputs.budget, totalBudgetMonthly: v },
                })}
                placeholder="0"
                prefix="$"
              />
            </FieldWrapper>

            <FieldWrapper label="Quarterly Budget" fieldKey="totalBudgetQuarterly" metadata={metadata}>
              <NumberInput
                value={inputs.budget.totalBudgetQuarterly}
                onChange={(v) => onChange({
                  ...inputs,
                  budget: { ...inputs.budget, totalBudgetQuarterly: v },
                })}
                placeholder="0"
                prefix="$"
              />
            </FieldWrapper>

            <FieldWrapper label="Annual Budget" fieldKey="totalBudgetAnnual" metadata={metadata}>
              <NumberInput
                value={inputs.budget.totalBudgetAnnual}
                onChange={(v) => onChange({
                  ...inputs,
                  budget: { ...inputs.budget, totalBudgetAnnual: v },
                })}
                placeholder="0"
                prefix="$"
              />
            </FieldWrapper>
          </div>

          <div className="mt-4">
            <FieldWrapper label="Testing Budget Notes" fieldKey="testingBudgetNotes" metadata={metadata}>
              <TextInput
                value={inputs.budget.testingBudgetNotes}
                onChange={(v) => onChange({
                  ...inputs,
                  budget: { ...inputs.budget, testingBudgetNotes: v },
                })}
                placeholder="How much budget for testing new channels/tactics?"
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Channels Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Channel Preferences</h3>
          <div className="space-y-4">
            <FieldWrapper label="Required Channels" fieldKey="requiredChannels" metadata={metadata}>
              <ChipSelector
                value={inputs.channels.requiredChannels || []}
                onChange={(v) => onChange({
                  ...inputs,
                  channels: { ...inputs.channels, requiredChannels: v as MediaChannelId[] },
                })}
                options={channelOptions}
                multiple
              />
            </FieldWrapper>

            <FieldWrapper label="Disallowed Channels" fieldKey="disallowedChannels" metadata={metadata}>
              <ChipSelector
                value={inputs.channels.disallowedChannels || []}
                onChange={(v) => onChange({
                  ...inputs,
                  channels: { ...inputs.channels, disallowedChannels: v as MediaChannelId[] },
                })}
                options={channelOptions}
                multiple
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Risk Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Risk Appetite</h3>
          <div className="space-y-4">
            <FieldWrapper label="Risk Tolerance" fieldKey="riskTolerance" metadata={metadata}>
              <div className="grid grid-cols-3 gap-3">
                {riskOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({
                      ...inputs,
                      risk: { ...inputs.risk, riskTolerance: opt.value },
                    })}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      inputs.risk.riskTolerance === opt.value
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <p className={`text-sm font-medium ${inputs.risk.riskTolerance === opt.value ? 'text-amber-300' : 'text-slate-200'}`}>
                      {opt.label}
                    </p>
                  </button>
                ))}
              </div>
            </FieldWrapper>

            <FieldWrapper label="Testing Comfort" fieldKey="testingComfort" metadata={metadata}>
              <TextInput
                value={inputs.risk.testingComfort}
                onChange={(v) => onChange({
                  ...inputs,
                  risk: { ...inputs.risk, testingComfort: v },
                })}
                placeholder="Comfort level with testing new channels/tactics"
              />
            </FieldWrapper>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
        >
          Review & Generate
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 5: Confirm & Generate
// ============================================================================

function ConfirmStep({
  inputs,
  onBack,
  onGenerate,
  isGenerating,
}: {
  inputs: MediaPlanningInputs;
  onBack: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const validation = validateForGeneration(inputs);
  const completeness = calculateCompleteness(inputs);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Review & Generate</h2>
        <p className="text-sm text-slate-400 mt-2">
          Confirm your inputs and generate AI-powered plan options.
        </p>
      </div>

      {/* Validation Errors */}
      {!validation.valid && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h4 className="text-sm font-medium text-red-400 mb-2">Required fields missing:</h4>
          <ul className="list-disc list-inside text-sm text-red-300">
            {validation.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Objective</h4>
          <p className="text-lg font-medium text-slate-200">
            {inputs.objectivesKpis.primaryObjective
              ? OBJECTIVE_LABELS[inputs.objectivesKpis.primaryObjective]
              : 'Not set'}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Monthly Budget</h4>
          <p className="text-lg font-medium text-slate-200">
            {inputs.budget.totalBudgetMonthly
              ? `$${inputs.budget.totalBudgetMonthly.toLocaleString()}`
              : 'Not set'}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Risk Tolerance</h4>
          <p className="text-lg font-medium text-slate-200">
            {inputs.risk.riskTolerance
              ? RISK_TOLERANCE_LABELS[inputs.risk.riskTolerance]
              : 'Balanced'}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Completeness</h4>
          <p className="text-lg font-medium text-slate-200">{completeness}%</p>
        </div>
      </div>

      {/* What AI Will Generate */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">AI Will Generate</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            3 Strategy Options (Conservative, Balanced, Aggressive)
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Channel Budget Allocations
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Forecasted Outcomes & KPIs
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Creative Requirements
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Targeting Structure
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Measurement & Testing Plan
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Risk Analysis
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Rollout Plan
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onGenerate}
          disabled={!validation.valid || isGenerating}
          className={`px-8 py-3 rounded-xl text-sm font-medium transition-all ${
            validation.valid && !isGenerating
              ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating Plans...
            </span>
          ) : (
            'Generate AI Plan Options'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SmartIntakePlanner({
  companyId,
  companyName,
  initialInputs,
  onClose,
}: SmartIntakePlannerProps) {
  const router = useRouter();
  const [step, setStep] = useState<PlannerStep>('overview');
  const [inputs, setInputs] = useState<MediaPlanningInputs>(
    initialInputs?.inputs || createEmptyPlanningInputs()
  );
  const [metadata, setMetadata] = useState<Record<string, FieldMetadata>>(() => {
    // Convert Partial to full Record, filtering out undefined values
    const initial = initialInputs?.metadata || {};
    const result: Record<string, FieldMetadata> = {};
    for (const [key, value] of Object.entries(initial)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  });
  const [sources, setSources] = useState({
    brain: false,
    profile: false,
    diagnostics: false,
    memory: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialInputs);
  const [planOptions, setPlanOptions] = useState<AIPlanOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<AIPlanOption | null>(null);

  // Load prefilled data on mount if not provided
  useEffect(() => {
    if (!initialInputs) {
      loadPrefilledData();
    } else {
      // Determine sources from metadata
      const metadataValues = Object.values(initialInputs.metadata || {}).filter((m): m is FieldMetadata => m !== undefined);
      const hasBrain = metadataValues.some(m => m.source === 'brain');
      const hasDiagnostics = metadataValues.some(m => m.source === 'diagnostics');
      const hasProfile = metadataValues.some(m => m.source === 'profile');
      setSources({ brain: hasBrain, profile: hasProfile, diagnostics: hasDiagnostics, memory: false });
      setIsLoading(false);
    }
  }, [initialInputs, companyId]);

  const loadPrefilledData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/media/planning/prefill?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[SmartIntakePlanner] Prefill response:', data);
        if (data.success && data.data) {
          console.log('[SmartIntakePlanner] Setting inputs:', data.data.inputs);
          console.log('[SmartIntakePlanner] objectivesKpis:', data.data.inputs?.objectivesKpis);
          setInputs(data.data.inputs);
          setMetadata(data.data.metadata || {});
          setSources(data.data.sources || { brain: false, profile: false, diagnostics: false, memory: false });
        }
      }
    } catch (error) {
      console.error('Failed to load prefilled data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStep('generating');

    try {
      const response = await fetch('/api/media/planning/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, inputs }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate plans');
      }

      const data = await response.json();
      setPlanOptions(data.options);
      setStep('options');
    } catch (error) {
      console.error('Failed to generate plans:', error);
      setStep('confirm');
    } finally {
      setIsGenerating(false);
    }
  };

  const steps: Array<{ key: PlannerStep; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'business-objectives', label: 'Business' },
    { key: 'audience-product', label: 'Audience' },
    { key: 'history-infra', label: 'History' },
    { key: 'budget-channels', label: 'Budget' },
    { key: 'confirm', label: 'Generate' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/c/${companyId}/diagnostics/media`}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors mb-1 inline-block"
            >
              &larr; Back to Media Lab
            </Link>
            <h1 className="text-xl font-semibold text-slate-100">AI Media Planner</h1>
            <p className="text-sm text-slate-400">{companyName}</p>
          </div>
          <button
            onClick={onClose || (() => router.push(`/c/${companyId}/diagnostics/media`))}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      {!isLoading && step !== 'generating' && step !== 'options' && step !== 'refine' && step !== 'summary' && (
        <StepIndicator currentStep={step} steps={steps} onGoToStep={setStep} />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-amber-500 mb-4" />
          <p className="text-sm text-slate-400">Loading planning context from Brain...</p>
        </div>
      )}

      {/* Step Content */}
      {!isLoading && (
      <div className="max-w-4xl mx-auto">
        {step === 'overview' && (
          <OverviewStep
            inputs={inputs}
            metadata={metadata}
            sources={sources}
            onNext={() => setStep('business-objectives')}
            onGoToStep={setStep}
          />
        )}

        {step === 'business-objectives' && inputs.businessBrand && (
          <BusinessObjectivesStep
            inputs={inputs}
            metadata={metadata}
            onChange={setInputs}
            onNext={() => setStep('audience-product')}
            onBack={() => setStep('overview')}
          />
        )}

        {step === 'audience-product' && (
          <AudienceProductStep
            inputs={inputs}
            metadata={metadata}
            onChange={setInputs}
            onNext={() => setStep('history-infra')}
            onBack={() => setStep('business-objectives')}
          />
        )}

        {step === 'history-infra' && (
          <HistoryInfraStep
            inputs={inputs}
            metadata={metadata}
            onChange={setInputs}
            onNext={() => setStep('budget-channels')}
            onBack={() => setStep('audience-product')}
          />
        )}

        {step === 'budget-channels' && (
          <BudgetChannelsStep
            inputs={inputs}
            metadata={metadata}
            onChange={setInputs}
            onNext={() => setStep('confirm')}
            onBack={() => setStep('history-infra')}
          />
        )}

        {step === 'confirm' && (
          <ConfirmStep
            inputs={inputs}
            onBack={() => setStep('budget-channels')}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}

        {step === 'generating' && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
              <svg className="w-8 h-8 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Generating AI Plan Options</h2>
            <p className="text-sm text-slate-400">
              Analyzing your inputs and creating 3 strategic options...
            </p>
          </div>
        )}

        {step === 'options' && planOptions.length > 0 && (
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">Plan Options Generated</h2>
            <p className="text-sm text-slate-400 mb-8">
              {planOptions.length} options ready for review
            </p>
            {/* TODO: Implement options selection UI */}
            <button
              onClick={() => router.push(`/c/${companyId}/diagnostics/media`)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              View Plan Options
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
