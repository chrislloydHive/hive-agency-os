'use client';

// components/projects/ProjectWizardShell.tsx
// Universal Project Wizard Shell
//
// 4-step wizard for all delivery project types:
// 1. Select category
// 2. Select project type
// 3. Select start mode (use_existing vs refresh_context)
// 4. Fill brief (config-driven fields) and confirm
//
// Start mode comes BEFORE brief to prevent users from filling out
// a brief and then being rerouted to Context Gathering.
//
// This shell doesn't generate anything - it collects inputs and routes.

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { ProjectCategorySelector } from './steps/ProjectCategorySelector';
import { ProjectTypeSelector } from './steps/ProjectTypeSelector';
import { ProjectBriefForm } from './steps/ProjectBriefForm';
import { ProjectStartModeStep } from './steps/ProjectStartModeStep';
import {
  getProjectTypeConfig,
  getProjectTypesByCategory,
  type ProjectCategory,
  type ProjectTypeConfig,
} from '@/lib/projects/projectTypeRegistry';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Types
// ============================================================================

export type WizardStep = 'category' | 'type' | 'brief' | 'start_mode';

export interface WizardState {
  category: ProjectCategory | null;
  projectTypeKey: string | null;
  brief: Record<string, unknown>;
  startMode: 'use_existing' | 'refresh_context' | null;
}

export interface ProjectWizardShellProps {
  companyId: string;
  onComplete: (state: WizardState & { projectType: ProjectTypeConfig }) => void;
  onCancel: () => void;
  initialCategory?: ProjectCategory;
  initialProjectType?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ProjectWizardShell({
  companyId,
  onComplete,
  onCancel,
  initialCategory,
  initialProjectType,
}: ProjectWizardShellProps) {
  const router = useRouter();

  // Wizard state
  const [state, setState] = useState<WizardState>({
    category: initialCategory ?? null,
    projectTypeKey: initialProjectType ?? null,
    brief: {},
    startMode: null,
  });

  const [currentStep, setCurrentStep] = useState<WizardStep>(
    initialProjectType ? 'start_mode' : initialCategory ? 'type' : 'category'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current project type config
  const projectType = useMemo(
    () => (state.projectTypeKey ? getProjectTypeConfig(state.projectTypeKey) : null),
    [state.projectTypeKey]
  );

  // Get available types for selected category
  const availableTypes = useMemo(
    () => (state.category ? getProjectTypesByCategory(state.category) : []),
    [state.category]
  );

  // Step navigation (start_mode before brief to avoid late redirects)
  const steps: WizardStep[] = ['category', 'type', 'start_mode', 'brief'];
  const currentStepIndex = steps.indexOf(currentStep);

  const canGoBack = currentStepIndex > 0;
  const canGoForward = useMemo(() => {
    switch (currentStep) {
      case 'category':
        return state.category !== null;
      case 'type':
        return state.projectTypeKey !== null;
      case 'start_mode':
        // Only requires projectType to be selected
        return state.startMode !== null;
      case 'brief':
        // Requires projectType AND startMode to be selected
        if (!projectType || !state.startMode) return false;
        const requiredFields = projectType.briefFields.filter((f) => f.required);
        return requiredFields.every((f) => {
          const value = state.brief[f.key];
          return value !== undefined && value !== '' && value !== null;
        });
      default:
        return false;
    }
  }, [currentStep, state, projectType]);

  // Handlers
  const handleCategorySelect = useCallback((category: ProjectCategory) => {
    setState((prev) => ({
      ...prev,
      category,
      projectTypeKey: null, // Reset type when category changes
      brief: {},
    }));
  }, []);

  const handleTypeSelect = useCallback((typeKey: string) => {
    const config = getProjectTypeConfig(typeKey);
    setState((prev) => ({
      ...prev,
      projectTypeKey: typeKey,
      brief: {},
      startMode: config?.defaultStartMode ?? null,
    }));
  }, []);

  const handleBriefChange = useCallback((key: string, value: unknown) => {
    setState((prev) => ({
      ...prev,
      brief: { ...prev.brief, [key]: value },
    }));
  }, []);

  const handleStartModeSelect = useCallback((mode: 'use_existing' | 'refresh_context') => {
    setState((prev) => ({ ...prev, startMode: mode }));
  }, []);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    } else {
      onCancel();
    }
  }, [currentStepIndex, steps, onCancel]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  }, [currentStepIndex, steps]);

  const handleComplete = useCallback(async () => {
    if (!projectType || !state.startMode) return;

    setIsSubmitting(true);
    try {
      await onComplete({
        ...state,
        projectType,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [state, projectType, onComplete]);

  // Step labels for progress indicator
  const stepLabels: Record<WizardStep, string> = {
    category: 'Category',
    type: 'Project Type',
    brief: 'Brief',
    start_mode: 'Start Mode',
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Progress Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <div className="text-sm text-slate-400">
            Step {currentStepIndex + 1} of {steps.length}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = index < currentStepIndex;

            return (
              <div key={step} className="flex items-center">
                {index > 0 && (
                  <div
                    className={`w-8 h-px mx-2 ${
                      isComplete ? 'bg-purple-500' : 'bg-slate-700'
                    }`}
                  />
                )}
                <div
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${isActive ? 'bg-purple-500/20 text-purple-300' : ''}
                    ${isComplete ? 'bg-emerald-500/20 text-emerald-300' : ''}
                    ${!isActive && !isComplete ? 'bg-slate-800 text-slate-500' : ''}
                  `}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-xs">
                      {index + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{stepLabels[step]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-5">
        {currentStep === 'category' && (
          <ProjectCategorySelector
            selectedCategory={state.category}
            onSelectCategory={handleCategorySelect}
          />
        )}

        {currentStep === 'type' && state.category && (
          <ProjectTypeSelector
            category={state.category}
            availableTypes={availableTypes}
            selectedTypeKey={state.projectTypeKey}
            onSelectType={handleTypeSelect}
          />
        )}

        {currentStep === 'start_mode' && projectType && (
          <ProjectStartModeStep
            projectType={projectType}
            selectedMode={state.startMode}
            onSelectMode={handleStartModeSelect}
          />
        )}

        {currentStep === 'brief' && projectType && state.startMode && (
          <ProjectBriefForm
            projectType={projectType}
            values={state.brief}
            onChange={handleBriefChange}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-5 border-t border-slate-800 bg-slate-900/30">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep === 'brief' ? (
            <button
              onClick={handleComplete}
              disabled={!canGoForward || isSubmitting}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                ${
                  canGoForward && !isSubmitting
                    ? 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Start Project
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canGoForward}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                ${
                  canGoForward
                    ? 'bg-purple-500 hover:bg-purple-400 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectWizardShell;
