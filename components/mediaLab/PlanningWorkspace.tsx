'use client';

// components/mediaLab/PlanningWorkspace.tsx
// Main Planning Workspace - orchestrates the full planning flow

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  type MediaPlaybook,
  type MediaObjectivesInput,
  type MediaPlanV2,
  type MediaChannelAllocation,
  type ChannelReadinessStatus,
  MEDIA_CHANNEL_LABELS,
  MEDIA_PRIMARY_GOAL_CONFIG,
  formatMediaBudget,
} from '@/lib/types/mediaLab';
import {
  generateMediaMixRecommendation,
  generateForecast,
  generateChannelReadinessChecklist,
  calculateReadinessScore,
  createPlanFromPlaybook,
  generatePlanFromObjectives,
  generateWorkItemsFromPlanV2,
  exportPlanAsJSON,
  generatePlanSummary,
} from '@/lib/mediaLab/planning';
import { ObjectivesForm } from './ObjectivesForm';
import { PlaybookSelector } from './PlaybookSelector';
import { ChannelReadinessCard } from './ChannelReadinessCard';
import { ForecastCard } from './ForecastCard';

// ============================================================================
// Types
// ============================================================================

type WorkspaceStep = 'select' | 'objectives' | 'review' | 'ready';

interface PlanningWorkspaceProps {
  companyId: string;
  companyName: string;
  onSavePlan: (plan: MediaPlanV2) => Promise<void>;
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function PlanningWorkspace({
  companyId,
  companyName,
  onSavePlan,
  onClose,
}: PlanningWorkspaceProps) {
  const [step, setStep] = useState<WorkspaceStep>('select');
  const [selectedPlaybook, setSelectedPlaybook] = useState<MediaPlaybook | null>(null);
  const [objectives, setObjectives] = useState<MediaObjectivesInput | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(5000);
  const [planName, setPlanName] = useState<string>('');
  const [generatedPlan, setGeneratedPlan] = useState<MediaPlanV2 | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingWorkItems, setIsCreatingWorkItems] = useState(false);

  // Handle playbook selection
  const handleSelectPlaybook = useCallback((playbook: MediaPlaybook) => {
    setSelectedPlaybook(playbook);
    setStep('review');
  }, []);

  // Handle custom plan flow
  const handleCustomPlan = useCallback(() => {
    setSelectedPlaybook(null);
    setStep('objectives');
  }, []);

  // Handle objectives submission
  const handleObjectivesSubmit = useCallback((obj: MediaObjectivesInput) => {
    setObjectives(obj);
    setStep('review');
  }, []);

  // Generate plan based on selection
  const handleGeneratePlan = useCallback(() => {
    let plan: Omit<MediaPlanV2, 'id' | 'createdAt' | 'updatedAt'>;

    if (selectedPlaybook) {
      plan = createPlanFromPlaybook(
        companyId,
        selectedPlaybook,
        monthlyBudget,
        planName || undefined
      );
    } else if (objectives) {
      plan = generatePlanFromObjectives(
        objectives,
        monthlyBudget,
        planName || undefined
      );
    } else {
      return;
    }

    // Add generated IDs and timestamps
    const fullPlan: MediaPlanV2 = {
      ...plan,
      id: `plan_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setGeneratedPlan(fullPlan);
    setStep('ready');
  }, [companyId, selectedPlaybook, objectives, monthlyBudget, planName]);

  // Update readiness status
  const handleUpdateReadinessStatus = useCallback(
    (requirementId: string, status: ChannelReadinessStatus) => {
      if (!generatedPlan) return;

      const updatedRequirements = generatedPlan.channelRequirements.map((req) =>
        req.id === requirementId ? { ...req, status } : req
      );

      const channels = generatedPlan.channelAllocations.map((a) => a.channel);
      const checklists = generateChannelReadinessChecklist(
        channels,
        Object.fromEntries(updatedRequirements.map((r) => [r.id, r.status]))
      );
      const newScore = calculateReadinessScore(checklists);

      setGeneratedPlan({
        ...generatedPlan,
        channelRequirements: updatedRequirements,
        readinessScore: newScore,
      });
    },
    [generatedPlan]
  );

  // Save plan
  const handleSavePlan = useCallback(async () => {
    if (!generatedPlan) return;

    setIsSaving(true);
    try {
      await onSavePlan(generatedPlan);
    } catch (error) {
      console.error('Failed to save plan:', error);
    } finally {
      setIsSaving(false);
    }
  }, [generatedPlan, onSavePlan]);

  // Create work items
  const handleCreateWorkItems = useCallback(async () => {
    if (!generatedPlan) return;

    setIsCreatingWorkItems(true);
    try {
      const workItems = generateWorkItemsFromPlanV2(generatedPlan);

      // Create work items via API
      const res = await fetch('/api/os/work-items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          items: workItems.map((item) => ({
            title: item.title,
            notes: item.description,
            area: item.area,
            severity: item.severity,
            status: 'Backlog',
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create work items');
      }
    } catch (error) {
      console.error('Failed to create work items:', error);
    } finally {
      setIsCreatingWorkItems(false);
    }
  }, [generatedPlan, companyId]);

  // Export plan
  const handleExportPlan = useCallback(() => {
    if (!generatedPlan) return;

    const json = exportPlanAsJSON(generatedPlan, {
      id: companyId,
      name: companyName,
    });

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedPlan.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedPlan, companyId, companyName]);

  // Render based on step
  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className="text-slate-500">Media Lab</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-300">Plan Builder</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-100">
                Create Media Plan
              </h1>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Progress Steps */}
          <div className="mt-4 flex items-center gap-2">
            <StepIndicator
              step={1}
              label="Choose"
              isActive={step === 'select'}
              isComplete={step !== 'select'}
            />
            <div className="w-8 h-px bg-slate-700" />
            <StepIndicator
              step={2}
              label="Configure"
              isActive={step === 'objectives' || step === 'review'}
              isComplete={step === 'ready'}
            />
            <div className="w-8 h-px bg-slate-700" />
            <StepIndicator
              step={3}
              label="Ready"
              isActive={step === 'ready'}
              isComplete={false}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-6">
        {step === 'select' && (
          <PlaybookSelector
            onSelect={handleSelectPlaybook}
            onCustom={handleCustomPlan}
            selectedId={selectedPlaybook?.id}
          />
        )}

        {step === 'objectives' && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setStep('select')}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Playbooks
            </button>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-200 mb-4">
                Define Your Objectives
              </h2>
              <ObjectivesForm
                companyId={companyId}
                initialValues={objectives || undefined}
                onSubmit={handleObjectivesSubmit}
                onCancel={() => setStep('select')}
              />
            </div>
          </div>
        )}

        {step === 'review' && (
          <ReviewStep
            selectedPlaybook={selectedPlaybook}
            objectives={objectives}
            monthlyBudget={monthlyBudget}
            planName={planName}
            onBudgetChange={setMonthlyBudget}
            onNameChange={setPlanName}
            onBack={() => setStep(selectedPlaybook ? 'select' : 'objectives')}
            onGenerate={handleGeneratePlan}
          />
        )}

        {step === 'ready' && generatedPlan && (
          <ReadyStep
            plan={generatedPlan}
            companyId={companyId}
            onUpdateReadiness={handleUpdateReadinessStatus}
            onSave={handleSavePlan}
            onCreateWorkItems={handleCreateWorkItems}
            onExport={handleExportPlan}
            isSaving={isSaving}
            isCreatingWorkItems={isCreatingWorkItems}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step Indicator
// ============================================================================

function StepIndicator({
  step,
  label,
  isActive,
  isComplete,
}: {
  step: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          isComplete
            ? 'bg-emerald-500 text-white'
            : isActive
            ? 'bg-amber-500 text-slate-900'
            : 'bg-slate-700 text-slate-400'
        }`}
      >
        {isComplete ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          step
        )}
      </div>
      <span
        className={`text-xs font-medium ${
          isActive ? 'text-slate-200' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// Review Step
// ============================================================================

function ReviewStep({
  selectedPlaybook,
  objectives,
  monthlyBudget,
  planName,
  onBudgetChange,
  onNameChange,
  onBack,
  onGenerate,
}: {
  selectedPlaybook: MediaPlaybook | null;
  objectives: MediaObjectivesInput | null;
  monthlyBudget: number;
  planName: string;
  onBudgetChange: (budget: number) => void;
  onNameChange: (name: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const source = selectedPlaybook || objectives;
  const goalConfig = source
    ? MEDIA_PRIMARY_GOAL_CONFIG[
        selectedPlaybook?.targetGoal || objectives?.primaryGoal || 'leads'
      ]
    : null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Configuration */}
        <div className="space-y-6">
          {/* Selected Strategy */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Selected Strategy
            </h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {selectedPlaybook?.name || 'Custom Plan'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedPlaybook?.description || 'Based on your objectives'}
                </p>
                {goalConfig && (
                  <span className={`inline-flex mt-2 text-[10px] px-1.5 py-0.5 rounded ${goalConfig.color} bg-current/10`}>
                    {goalConfig.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Budget Configuration */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Budget & Name
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={selectedPlaybook?.name || 'My Media Plan'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Monthly Budget
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => onBudgetChange(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-slate-600"
                  />
                  <span className="text-sm text-slate-400">/month</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Annual: {formatMediaBudget(monthlyBudget * 12)}
                </p>
              </div>

              {/* Budget Quick Selects */}
              <div className="flex flex-wrap gap-2">
                {[3000, 5000, 10000, 15000, 25000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => onBudgetChange(amount)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      monthlyBudget === amount
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    ${amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Recommended Mix Preview
          </h3>

          {selectedPlaybook ? (
            <div className="space-y-3">
              {selectedPlaybook.channelMix.map((ch) => (
                <div key={ch.channel} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300">
                        {MEDIA_CHANNEL_LABELS[ch.channel]}
                      </span>
                      <span className="text-xs text-slate-400">{ch.percentOfBudget}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${ch.percentOfBudget}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      ~{formatMediaBudget(Math.round(monthlyBudget * (ch.percentOfBudget / 100)))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : objectives ? (
            <PreviewFromObjectives objectives={objectives} monthlyBudget={monthlyBudget} />
          ) : (
            <p className="text-sm text-slate-500">Configure objectives to see preview</p>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onGenerate}
          className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors"
        >
          Generate Plan
        </button>
      </div>
    </div>
  );
}

function PreviewFromObjectives({
  objectives,
  monthlyBudget,
}: {
  objectives: MediaObjectivesInput;
  monthlyBudget: number;
}) {
  const allocations = generateMediaMixRecommendation({
    primaryGoal: objectives.primaryGoal,
    monthlyBudget,
    seasonality: objectives.seasonality,
    geographicFocus: objectives.geographicFocus,
    categoryFocus: objectives.categoryFocus,
    requiredChannels: objectives.requiredChannels,
    excludedChannels: objectives.excludedChannels,
  });

  return (
    <div className="space-y-3">
      {allocations.map((ch) => (
        <div key={ch.channel} className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-300">{ch.label}</span>
              <span className="text-xs text-slate-400">{ch.percentOfBudget}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${ch.percentOfBudget}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              ~{formatMediaBudget(ch.monthlySpend)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Ready Step
// ============================================================================

function ReadyStep({
  plan,
  companyId,
  onUpdateReadiness,
  onSave,
  onCreateWorkItems,
  onExport,
  isSaving,
  isCreatingWorkItems,
}: {
  plan: MediaPlanV2;
  companyId: string;
  onUpdateReadiness: (reqId: string, status: ChannelReadinessStatus) => void;
  onSave: () => void;
  onCreateWorkItems: () => void;
  onExport: () => void;
  isSaving: boolean;
  isCreatingWorkItems: boolean;
}) {
  const summary = generatePlanSummary(plan);
  const checklists = generateChannelReadinessChecklist(
    plan.channelAllocations.map((a) => a.channel),
    Object.fromEntries(plan.channelRequirements.map((r) => [r.id, r.status]))
  );

  return (
    <div className="space-y-6">
      {/* Plan Summary Header */}
      <div className="bg-gradient-to-r from-amber-500/10 to-slate-900/50 border border-amber-500/30 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{plan.name}</h2>
            <p className="text-sm text-slate-400 mt-1">{summary.headline}</p>
            <ul className="mt-3 space-y-1">
              {summary.bullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-amber-400">+</span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${
                plan.readinessScore >= 80
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : plan.readinessScore >= 50
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {summary.readinessStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Forecast & Allocations */}
        <div className="space-y-6">
          <ForecastCard
            forecast={plan.forecast}
            primaryGoal={plan.objectives.primaryGoal}
            monthlyBudget={plan.monthlyBudget}
          />

          {/* Seasonal Bursts */}
          {plan.seasonalBursts.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Seasonal Bursts
              </h3>
              <div className="space-y-2">
                {plan.seasonalBursts.map((burst) => (
                  <div
                    key={burst.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/20"
                  >
                    <div>
                      <p className="text-sm text-purple-300">{burst.label}</p>
                      <p className="text-xs text-slate-500">{burst.months}</p>
                    </div>
                    <span className="text-sm font-medium text-purple-400">
                      +{burst.spendLiftPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Readiness & Actions */}
        <div className="space-y-6">
          <ChannelReadinessCard
            checklists={checklists}
            readinessScore={plan.readinessScore}
            onUpdateStatus={onUpdateReadiness}
          />

          {/* Actions */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Actions</h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="w-full px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Media Plan'}
              </button>

              <button
                type="button"
                onClick={onCreateWorkItems}
                disabled={isCreatingWorkItems}
                className="w-full px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isCreatingWorkItems ? 'Creating...' : 'Create Work Items'}
              </button>

              <button
                type="button"
                onClick={onExport}
                className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-medium text-sm transition-colors"
              >
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
