'use client';

// app/c/[companyId]/setup/SetupClient.tsx
// Main client component for Strategic Setup Mode

import { useState, useCallback, useEffect } from 'react';
import { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import {
  SetupStepId,
  SETUP_STEPS,
  SETUP_STEP_CONFIG,
  SetupFormData,
  SetupProgress,
  createEmptyFormData,
  getNextStep,
  getPreviousStep,
  getStepIndex,
} from './types';
import { NavSidebar } from './components/NavSidebar';
import { ActionFooter } from './components/ActionFooter';
import { StepContainer } from './components/StepContainer';

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

interface SetupClientProps {
  companyId: string;
  companyName: string;
  initialGraph: CompanyContextGraph | null;
}

export function SetupClient({
  companyId,
  companyName,
  initialGraph,
}: SetupClientProps) {
  // Initialize form data from graph or empty
  const [formData, setFormData] = useState<Partial<SetupFormData>>(() =>
    initializeFormDataFromGraph(initialGraph, companyName)
  );

  const [progress, setProgress] = useState<SetupProgress>({
    currentStep: 'business-identity',
    completedSteps: [],
    lastSavedAt: null,
    startedAt: new Date().toISOString(),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  // Save current step to Context Graph
  const saveStep = useCallback(
    async (stepId: SetupStepId) => {
      setIsSaving(true);
      setSaveMessage(null);

      try {
        const response = await fetch(`/api/setup/${companyId}/saveStep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stepId,
            data: formData,
            companyName,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to save');
        }

        setProgress((prev) => ({
          ...prev,
          lastSavedAt: new Date().toISOString(),
          completedSteps: prev.completedSteps.includes(stepId)
            ? prev.completedSteps
            : [...prev.completedSteps, stepId],
        }));

        setIsDirty(false);
        setSaveMessage('Saved successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (error) {
        console.error('Save error:', error);
        setSaveMessage('Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    [companyId, companyName, formData]
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

    // Save current step first
    await saveStep(currentStep);

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

  // Auto-save on step change
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        saveStep(progress.currentStep);
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(timer);
    }
  }, [isDirty, progress.currentStep, saveStep]);

  // Finalize setup
  const finalize = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/setup/${companyId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });

      if (!response.ok) {
        throw new Error('Failed to finalize');
      }

      // Redirect to company overview
      window.location.href = `/c/${companyId}`;
    } catch (error) {
      console.error('Finalize error:', error);
      setSaveMessage('Failed to finalize setup');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, formData]);

  // Render current step
  const renderStep = () => {
    const stepProps = {
      companyId,
      formData,
      updateStepData,
      errors,
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
    <div className="flex h-[calc(100vh-60px)]">
      {/* Left sidebar navigation */}
      <NavSidebar
        currentStep={progress.currentStep}
        completedSteps={progress.completedSteps}
        onNavigate={navigateToStep}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <StepContainer
            title={currentStepConfig.label}
            description={currentStepConfig.description}
            stepNumber={getStepIndex(progress.currentStep) + 1}
            totalSteps={SETUP_STEPS.length}
          >
            {renderStep()}
          </StepContainer>
        </div>

        {/* Footer with navigation */}
        <ActionFooter
          onPrevious={isFirstStep ? undefined : goPrevious}
          onNext={isLastStep ? undefined : goNext}
          onSave={() => saveStep(progress.currentStep)}
          isSaving={isSaving}
          isDirty={isDirty}
          saveMessage={saveMessage}
          isLastStep={isLastStep}
        />
      </div>
    </div>
  );
}

// Helper: Initialize form data from existing context graph
function initializeFormDataFromGraph(
  graph: CompanyContextGraph | null,
  companyName: string
): Partial<SetupFormData> {
  const empty = createEmptyFormData();

  if (!graph) {
    // Pre-fill company name
    if (empty.businessIdentity) {
      empty.businessIdentity.businessName = companyName;
    }
    return empty;
  }

  // Map graph data to form data
  return {
    businessIdentity: {
      businessName: graph.identity.businessName.value || companyName,
      industry: graph.identity.industry.value || '',
      businessModel: graph.identity.businessModel.value || '',
      revenueModel: graph.identity.revenueModel.value || '',
      geographicFootprint: graph.identity.geographicFootprint.value || '',
      serviceArea: graph.identity.serviceArea.value || '',
      seasonalityNotes: graph.identity.seasonalityNotes.value || '',
      peakSeasons: graph.identity.peakSeasons.value || [],
      revenueStreams: graph.identity.revenueStreams.value || [],
      primaryCompetitors: graph.identity.primaryCompetitors.value || [],
    },
    objectives: {
      primaryObjective: graph.objectives.primaryObjective.value || '',
      secondaryObjectives: graph.objectives.secondaryObjectives.value || [],
      primaryBusinessGoal: graph.objectives.primaryBusinessGoal.value || '',
      timeHorizon: graph.objectives.timeHorizon.value || '',
      targetCpa: graph.objectives.targetCpa.value,
      targetRoas: graph.objectives.targetRoas.value,
      revenueGoal: graph.objectives.revenueGoal.value,
      leadGoal: graph.objectives.leadGoal.value,
      kpiLabels: graph.objectives.kpiLabels.value || [],
    },
    audience: {
      coreSegments: graph.audience.coreSegments.value || [],
      demographics: graph.audience.demographics.value || '',
      geos: graph.audience.geos.value || '',
      primaryMarkets: graph.audience.primaryMarkets.value || [],
      behavioralDrivers: graph.audience.behavioralDrivers.value || [],
      demandStates: graph.audience.demandStates.value || [],
      painPoints: graph.audience.painPoints.value || [],
      motivations: graph.audience.motivations.value || [],
    },
    personas: {
      personaSetId: null,
      personaCount: graph.audience.personaNames.value?.length || 0,
    },
    website: {
      websiteSummary: graph.website.websiteSummary.value || '',
      conversionBlocks: graph.website.conversionBlocks.value || [],
      conversionOpportunities: graph.website.conversionOpportunities.value || [],
      criticalIssues: graph.website.criticalIssues.value || [],
      quickWins: graph.website.quickWins.value || [],
    },
    mediaFoundations: {
      mediaSummary: graph.performanceMedia.mediaSummary.value || '',
      activeChannels: (graph.performanceMedia.activeChannels.value || []) as string[],
      attributionModel: graph.performanceMedia.attributionModel.value || '',
      mediaIssues: graph.performanceMedia.mediaIssues.value || [],
      mediaOpportunities: graph.performanceMedia.mediaOpportunities.value || [],
    },
    budgetScenarios: {
      totalMarketingBudget: graph.budgetOps.totalMarketingBudget.value,
      mediaSpendBudget: graph.budgetOps.mediaSpendBudget.value,
      budgetPeriod: graph.budgetOps.budgetPeriod.value || '',
      avgCustomerValue: graph.budgetOps.avgCustomerValue.value,
      customerLTV: graph.budgetOps.customerLTV.value,
      selectedScenarioId: null,
    },
    creativeStrategy: {
      coreMessages: graph.creative.coreMessages.value || [],
      proofPoints: graph.creative.proofPoints.value || [],
      callToActions: graph.creative.callToActions.value || [],
      availableFormats: (graph.creative.availableFormats.value || []) as string[],
      brandGuidelines: graph.creative.brandGuidelines.value || '',
    },
    measurement: {
      ga4PropertyId: graph.digitalInfra.ga4PropertyId.value || '',
      ga4ConversionEvents: graph.digitalInfra.ga4ConversionEvents.value || [],
      callTracking: graph.digitalInfra.callTracking.value || '',
      trackingTools: graph.digitalInfra.trackingTools.value || [],
      attributionModel: graph.digitalInfra.attributionModel.value || '',
      attributionWindow: graph.digitalInfra.attributionWindow.value || '',
    },
    summary: {
      strategySummary: '',
      keyRecommendations: [],
      nextSteps: [],
    },
  };
}
