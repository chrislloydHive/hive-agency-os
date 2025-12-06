'use client';

// app/c/[companyId]/brain/setup/SetupClient.tsx
// Main client component for Strategic Setup Mode (within Brain workspace)
//
// This component now reads from and writes to the Context Graph,
// making it a view/editor on Brain data rather than a separate store.
// It renders within the Brain layout with the shared sub-navigation.

import { useState, useCallback, useEffect, useTransition } from 'react';
import {
  SetupStepId,
  SETUP_STEPS,
  SETUP_STEP_CONFIG,
  SetupFormData,
  SetupProgress,
  getNextStep,
  getPreviousStep,
  getStepIndex,
} from './types';
import { NavSidebar } from './components/NavSidebar';
import { ActionFooter } from './components/ActionFooter';
import { StepContainer } from './components/StepContainer';
import { AIAssistPanel } from './components/AIAssistPanel';
import { saveSetupStep, saveSetupFormData } from './actions';
import type { ContextNodeInfo } from '@/lib/contextGraph/setupSchema';

// Step components
import { StepBusinessIdentity } from './StepBusinessIdentity';
import { StepObjectives } from './StepObjectives';
import { StepAudience } from './StepAudience';
import { StepPersonas } from './StepPersonas';
import { StepWebsite } from './StepWebsite';
import { StepMediaFoundations } from './StepMediaFoundations';
import { StepBudgetScenarios } from './StepBudgetScenarios';
import { StepCreativeStrategy } from './StepCreativeStrategy';
import { StepMeasurement } from './StepMeasurement';
import { StepSummary } from './StepSummary';

// ============================================================================
// Types
// ============================================================================

interface SetupClientProps {
  companyId: string;
  companyName: string;
  /** Initial form data populated from Context Graph */
  initialFormData: Partial<SetupFormData>;
  /** Provenance info for each field (contextPath → info) */
  initialProvenanceMap: Map<string, ContextNodeInfo>;
  /** Fields that are missing in Context Graph */
  missingFields: string[];
  /** Whether the Context Graph exists */
  hasGraph: boolean;
  /** Initial step to navigate to (from URL query param) */
  initialStep?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SetupClient({
  companyId,
  companyName,
  initialFormData,
  initialProvenanceMap,
  missingFields,
  hasGraph,
  initialStep,
}: SetupClientProps) {
  // Form data state - initialized from Context Graph
  const [formData, setFormData] = useState<Partial<SetupFormData>>(initialFormData);

  // Provenance tracking for display
  const [provenanceMap] = useState<Map<string, ContextNodeInfo>>(initialProvenanceMap);

  // Calculate which steps have data (are "complete")
  const calculateCompletedSteps = (data: Partial<SetupFormData>): SetupStepId[] => {
    const completed: SetupStepId[] = [];

    // Check each step for meaningful data
    if (data.businessIdentity?.businessName) completed.push('business-identity');
    if (data.objectives?.primaryObjective || data.objectives?.primaryBusinessGoal) completed.push('objectives');
    if (data.audience?.primaryAudience || (data.audience?.coreSegments && data.audience.coreSegments.length > 0)) completed.push('audience');
    if (data.personas?.personaCount && data.personas.personaCount > 0) completed.push('personas');
    if (data.website?.websiteSummary || (data.website?.conversionBlocks && data.website.conversionBlocks.length > 0)) completed.push('website');
    if (data.mediaFoundations?.mediaSummary || (data.mediaFoundations?.activeChannels && data.mediaFoundations.activeChannels.length > 0)) completed.push('media-foundations');
    if (data.budgetScenarios?.totalMarketingBudget || data.budgetScenarios?.mediaSpendBudget) completed.push('budget-scenarios');
    if (data.creativeStrategy?.coreMessages && data.creativeStrategy.coreMessages.length > 0) completed.push('creative-strategy');
    if (data.measurement?.ga4PropertyId || (data.measurement?.trackingTools && data.measurement.trackingTools.length > 0)) completed.push('measurement');
    if (data.summary?.strategySummary) completed.push('summary');

    return completed;
  };

  // Validate initialStep is a valid SetupStepId
  const validInitialStep = initialStep && SETUP_STEPS.includes(initialStep as SetupStepId)
    ? (initialStep as SetupStepId)
    : 'business-identity';

  const [progress, setProgress] = useState<SetupProgress>({
    currentStep: validInitialStep,
    completedSteps: calculateCompletedSteps(initialFormData),
    lastSavedAt: null,
    startedAt: new Date().toISOString(),
  });

  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isAIAssistOpen, setIsAIAssistOpen] = useState(false);

  // Update form data for a specific step
  const updateStepData = useCallback(
    <K extends keyof SetupFormData>(
      stepKey: K,
      data: Partial<SetupFormData[K]>
    ) => {
      setFormData((prev) => ({
        ...prev,
        [stepKey]: {
          ...(prev[stepKey] || {}),
          ...data,
        },
      }));
      setIsDirty(true);
    },
    []
  );

  // Map step form key to step ID
  const stepKeyToId: Record<keyof SetupFormData, SetupStepId> = {
    businessIdentity: 'business-identity',
    objectives: 'objectives',
    audience: 'audience',
    personas: 'personas',
    website: 'website',
    mediaFoundations: 'media-foundations',
    budgetScenarios: 'budget-scenarios',
    creativeStrategy: 'creative-strategy',
    measurement: 'measurement',
    summary: 'summary',
  };

  const stepIdToKey: Record<SetupStepId, keyof SetupFormData> = {
    'business-identity': 'businessIdentity',
    'objectives': 'objectives',
    'audience': 'audience',
    'personas': 'personas',
    'website': 'website',
    'media-foundations': 'mediaFoundations',
    'budget-scenarios': 'budgetScenarios',
    'creative-strategy': 'creativeStrategy',
    'measurement': 'measurement',
    'summary': 'summary',
  };

  // Save current step to Context Graph via server action
  const saveStep = useCallback(
    async (stepId: SetupStepId) => {
      setSaveMessage(null);

      const stepKey = stepIdToKey[stepId];
      const stepData = formData[stepKey];

      console.log('[Setup Client] saveStep called:', { stepId, stepKey, hasData: !!stepData, dataKeys: stepData ? Object.keys(stepData) : [] });

      if (!stepData) {
        console.warn(`[Setup] No data for step ${stepId}`);
        return;
      }

      console.log('[Setup Client] Calling server action with data:', stepData);

      startTransition(async () => {
        try {
          const result = await saveSetupStep(
            companyId,
            stepId,
            stepData as Record<string, unknown>
          );

          if (result.success) {
            setProgress((prev) => ({
              ...prev,
              lastSavedAt: new Date().toISOString(),
              completedSteps: prev.completedSteps.includes(stepId)
                ? prev.completedSteps
                : [...prev.completedSteps, stepId],
            }));

            setIsDirty(false);
            setSaveMessage(`Saved to Brain (${result.fieldsWritten} fields)`);
            setTimeout(() => setSaveMessage(null), 3000);

            if (result.fieldsBlocked > 0) {
              console.log(
                `[Setup] ${result.fieldsBlocked} fields blocked by priority rules:`,
                result.blockedPaths
              );
            }
          } else {
            setSaveMessage('Failed to save');
            console.error('[Setup] Save failed:', result.errors);
          }
        } catch (error) {
          console.error('[Setup] Save error:', error);
          setSaveMessage('Failed to save');
        }
      });
    },
    [companyId, formData, stepIdToKey]
  );

  // Navigate to step
  const navigateToStep = useCallback((stepId: SetupStepId) => {
    setProgress((prev) => ({
      ...prev,
      currentStep: stepId,
    }));
  }, []);

  // Go to next step
  const goNext = useCallback(async () => {
    const currentStep = progress.currentStep;
    console.log('[Setup Client] goNext called, saving step:', currentStep);

    // Save current step first
    await saveStep(currentStep);
    console.log('[Setup Client] saveStep completed');

    // Navigate to next
    const next = getNextStep(currentStep);
    if (next) {
      navigateToStep(next);
    }
  }, [progress.currentStep, saveStep, navigateToStep]);

  // Go to previous step
  const goPrevious = useCallback(() => {
    const prev = getPreviousStep(progress.currentStep);
    if (prev) {
      navigateToStep(prev);
    }
  }, [progress.currentStep, navigateToStep]);

  // Auto-save on idle
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        saveStep(progress.currentStep);
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(timer);
    }
  }, [isDirty, progress.currentStep, saveStep]);

  // AI Assist handlers
  const openAIAssist = useCallback(() => {
    setIsAIAssistOpen(true);
  }, []);

  const closeAIAssist = useCallback(() => {
    setIsAIAssistOpen(false);
  }, []);

  const applyAISuggestion = useCallback((field: string, value: unknown) => {
    const stepKey = stepIdToKey[progress.currentStep];
    if (stepKey) {
      updateStepData(stepKey, { [field]: value } as Partial<SetupFormData[typeof stepKey]>);
    }
  }, [progress.currentStep, updateStepData, stepIdToKey]);

  const applyAllAISuggestions = useCallback((suggestions: Array<{ field: string; value: unknown }>) => {
    const stepKey = stepIdToKey[progress.currentStep];
    if (stepKey) {
      const updates: Record<string, unknown> = {};
      for (const suggestion of suggestions) {
        updates[suggestion.field] = suggestion.value;
      }
      updateStepData(stepKey, updates as Partial<SetupFormData[typeof stepKey]>);
    }
  }, [progress.currentStep, updateStepData, stepIdToKey]);

  // Finalize setup - save all and redirect
  const finalize = useCallback(async () => {
    startTransition(async () => {
      try {
        const result = await saveSetupFormData(companyId, formData);

        if (result.success) {
          // Redirect to company overview
          window.location.href = `/c/${companyId}`;
        } else {
          console.error('[Setup] Finalize failed:', result.errors);
          setSaveMessage('Failed to finalize setup');
        }
      } catch (error) {
        console.error('[Setup] Finalize error:', error);
        setSaveMessage('Failed to finalize setup');
      }
    });
  }, [companyId, formData]);

  // Render current step
  const renderStep = () => {
    const stepProps = {
      companyId,
      formData,
      updateStepData,
      errors,
      provenanceMap,
      missingFields,
    };

    switch (progress.currentStep) {
      case 'business-identity':
        return <StepBusinessIdentity {...stepProps} />;
      case 'objectives':
        return <StepObjectives {...stepProps} />;
      case 'audience':
        return <StepAudience {...stepProps} />;
      case 'personas':
        return <StepPersonas {...stepProps} />;
      case 'website':
        return <StepWebsite {...stepProps} />;
      case 'media-foundations':
        return <StepMediaFoundations {...stepProps} />;
      case 'budget-scenarios':
        return <StepBudgetScenarios {...stepProps} />;
      case 'creative-strategy':
        return <StepCreativeStrategy {...stepProps} />;
      case 'measurement':
        return <StepMeasurement {...stepProps} />;
      case 'summary':
        return <StepSummary {...stepProps} />;
      default:
        return null;
    }
  };

  const currentStepConfig = SETUP_STEP_CONFIG[progress.currentStep];
  const isFirstStep = getStepIndex(progress.currentStep) === 0;
  const isLastStep = getStepIndex(progress.currentStep) === SETUP_STEPS.length - 1;

  return (
    <div className="flex gap-6">
      {/* Left sidebar navigation */}
      <div className="flex-shrink-0">
        <NavSidebar
          currentStep={progress.currentStep}
          completedSteps={progress.completedSteps}
          onNavigate={navigateToStep}
          onOpenAIAssist={openAIAssist}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Context Graph status banner */}
        {!hasGraph && (
          <div className="px-4 py-2 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400">
              No existing Brain data found. Fields filled here will be added to the Brain.
            </p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <StepContainer
            title={currentStepConfig.label}
            description={currentStepConfig.description}
            stepNumber={getStepIndex(progress.currentStep) + 1}
            totalSteps={SETUP_STEPS.length}
          >
            {renderStep()}
          </StepContainer>

          {/* Footer with navigation */}
          <ActionFooter
            onPrevious={isFirstStep ? undefined : goPrevious}
            onNext={isLastStep ? undefined : goNext}
            onSave={() => saveStep(progress.currentStep)}
            isSaving={isPending}
            isDirty={isDirty}
            saveMessage={saveMessage}
            isLastStep={isLastStep}
          />
        </div>
      </div>

      {/* AI Assist Panel */}
      <AIAssistPanel
        companyId={companyId}
        currentStep={progress.currentStep}
        formData={formData}
        isOpen={isAIAssistOpen}
        onClose={closeAIAssist}
        onApplySuggestion={applyAISuggestion}
        onApplyAll={applyAllAISuggestions}
      />
    </div>
  );
}
