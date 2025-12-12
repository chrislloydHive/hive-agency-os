// app/c/[companyId]/setup/types.ts
// Types for Strategic Setup Mode

export const SETUP_STEPS = [
  'business-identity',
  'objectives',
  'audience',
  'personas',
  'website',
  'media-foundations',
  'budget-scenarios',
  'creative-strategy',
  'measurement',
  'summary',
] as const;

export type SetupStepId = typeof SETUP_STEPS[number];

export interface SetupStep {
  id: SetupStepId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const SETUP_STEP_CONFIG: Record<SetupStepId, SetupStep> = {
  'business-identity': {
    id: 'business-identity',
    label: 'Business Identity',
    shortLabel: 'Identity',
    description: 'Core business information and market context',
    icon: 'building',
  },
  'objectives': {
    id: 'objectives',
    label: 'Objectives',
    shortLabel: 'Goals',
    description: 'Marketing objectives and KPI targets',
    icon: 'target',
  },
  'audience': {
    id: 'audience',
    label: 'Audience Foundations',
    shortLabel: 'Audience',
    description: 'Core audience segments and targeting',
    icon: 'users',
  },
  'personas': {
    id: 'personas',
    label: 'Audience Preview',
    shortLabel: 'Preview',
    description: 'Review your target audience before continuing',
    icon: 'user-circle',
  },
  'website': {
    id: 'website',
    label: 'Website & Conversion',
    shortLabel: 'Website',
    description: 'Website baseline and conversion analysis',
    icon: 'globe',
  },
  'media-foundations': {
    id: 'media-foundations',
    label: 'Media Foundations',
    shortLabel: 'Media',
    description: 'Channel strategy and constraints',
    icon: 'megaphone',
  },
  'budget-scenarios': {
    id: 'budget-scenarios',
    label: 'Budget & Scenarios',
    shortLabel: 'Budget',
    description: 'Budget planning and scenario modeling',
    icon: 'calculator',
  },
  'creative-strategy': {
    id: 'creative-strategy',
    label: 'Creative Strategy',
    shortLabel: 'Creative',
    description: 'Messaging and creative approach',
    icon: 'palette',
  },
  'measurement': {
    id: 'measurement',
    label: 'Measurement Setup',
    shortLabel: 'Measurement',
    description: 'Tracking and attribution configuration',
    icon: 'chart-bar',
  },
  'summary': {
    id: 'summary',
    label: 'Strategic Plan',
    shortLabel: 'Summary',
    description: 'Final review and recommendations',
    icon: 'document-text',
  },
};

export interface SetupFormData {
  // Step 1: Business Identity
  businessIdentity: {
    businessName: string;
    icpDescription: string; // Canonical ICP description
    industry: string;
    businessModel: string;
    revenueModel: string;
    geographicFootprint: string;
    serviceArea: string;
    seasonalityNotes: string;
    peakSeasons: string[];
    revenueStreams: string[];
    primaryCompetitors: string[];
  };

  // Step 2: Objectives
  objectives: {
    primaryObjective: string;
    secondaryObjectives: string[];
    primaryBusinessGoal: string;
    timeHorizon: string;
    targetCpa: number | null;
    targetRoas: number | null;
    revenueGoal: number | null;
    leadGoal: number | null;
    kpiLabels: string[];
  };

  // Step 3: Audience
  audience: {
    // Canonical ICP fields
    primaryAudience: string; // Who we serve
    primaryBuyerRoles: string[]; // Decision makers, influencers
    targetCompanySize: string; // SMB | Mid-Market | Enterprise
    targetCompanyStage: string; // Startup | Growth | Mature
    targetIndustries: string[]; // Target industries for B2B
    // Supporting audience fields
    coreSegments: string[];
    demographics: string;
    geos: string;
    primaryMarkets: string[];
    behavioralDrivers: string[];
    demandStates: string[];
    painPoints: string[];
    motivations: string[];
  };

  // Step 4: Personas (handled separately via PersonaSet integration)
  personas: {
    personaSetId: string | null;
    personaCount: number;
  };

  // Step 5: Website
  website: {
    websiteSummary: string;
    conversionBlocks: string[];
    conversionOpportunities: string[];
    criticalIssues: string[];
    quickWins: string[];
  };

  // Step 6: Media Foundations
  mediaFoundations: {
    mediaSummary: string;
    activeChannels: string[];
    attributionModel: string;
    mediaIssues: string[];
    mediaOpportunities: string[];
  };

  // Step 7: Budget & Scenarios
  budgetScenarios: {
    totalMarketingBudget: number | null;
    mediaSpendBudget: number | null;
    budgetPeriod: string;
    avgCustomerValue: number | null;
    customerLTV: number | null;
    selectedScenarioId: string | null;
  };

  // Step 8: Creative Strategy
  creativeStrategy: {
    coreMessages: string[];
    proofPoints: string[];
    callToActions: string[];
    availableFormats: string[];
    brandGuidelines: string;
  };

  // Step 9: Measurement
  measurement: {
    ga4PropertyId: string;
    ga4ConversionEvents: string[];
    callTracking: string;
    trackingTools: string[];
    attributionModel: string;
    attributionWindow: string;
  };

  // Step 10: Summary (derived, not user-entered)
  summary: {
    strategySummary: string;
    keyRecommendations: string[];
    nextSteps: string[];
  };
}

export interface SetupProgress {
  currentStep: SetupStepId;
  completedSteps: SetupStepId[];
  lastSavedAt: string | null;
  startedAt: string | null;
}

export interface SetupState {
  companyId: string;
  companyName: string;
  progress: SetupProgress;
  formData: Partial<SetupFormData>;
  isDirty: boolean;
  isSaving: boolean;
  errors: Record<string, string[]>;
}

// Initial empty form data
export function createEmptyFormData(): Partial<SetupFormData> {
  return {
    businessIdentity: {
      businessName: '',
      icpDescription: '',
      industry: '',
      businessModel: '',
      revenueModel: '',
      geographicFootprint: '',
      serviceArea: '',
      seasonalityNotes: '',
      peakSeasons: [],
      revenueStreams: [],
      primaryCompetitors: [],
    },
    objectives: {
      primaryObjective: '',
      secondaryObjectives: [],
      primaryBusinessGoal: '',
      timeHorizon: '',
      targetCpa: null,
      targetRoas: null,
      revenueGoal: null,
      leadGoal: null,
      kpiLabels: [],
    },
    audience: {
      // Canonical ICP fields
      primaryAudience: '',
      primaryBuyerRoles: [],
      targetCompanySize: '',
      targetCompanyStage: '',
      targetIndustries: [],
      // Supporting fields
      coreSegments: [],
      demographics: '',
      geos: '',
      primaryMarkets: [],
      behavioralDrivers: [],
      demandStates: [],
      painPoints: [],
      motivations: [],
    },
    personas: {
      personaSetId: null,
      personaCount: 0,
    },
    website: {
      websiteSummary: '',
      conversionBlocks: [],
      conversionOpportunities: [],
      criticalIssues: [],
      quickWins: [],
    },
    mediaFoundations: {
      mediaSummary: '',
      activeChannels: [],
      attributionModel: '',
      mediaIssues: [],
      mediaOpportunities: [],
    },
    budgetScenarios: {
      totalMarketingBudget: null,
      mediaSpendBudget: null,
      budgetPeriod: '',
      avgCustomerValue: null,
      customerLTV: null,
      selectedScenarioId: null,
    },
    creativeStrategy: {
      coreMessages: [],
      proofPoints: [],
      callToActions: [],
      availableFormats: [],
      brandGuidelines: '',
    },
    measurement: {
      ga4PropertyId: '',
      ga4ConversionEvents: [],
      callTracking: '',
      trackingTools: [],
      attributionModel: '',
      attributionWindow: '',
    },
    summary: {
      strategySummary: '',
      keyRecommendations: [],
      nextSteps: [],
    },
  };
}

// Get step index
export function getStepIndex(stepId: SetupStepId): number {
  return SETUP_STEPS.indexOf(stepId);
}

// Get next step
export function getNextStep(currentStep: SetupStepId): SetupStepId | null {
  const currentIndex = getStepIndex(currentStep);
  if (currentIndex < SETUP_STEPS.length - 1) {
    return SETUP_STEPS[currentIndex + 1];
  }
  return null;
}

// Get previous step
export function getPreviousStep(currentStep: SetupStepId): SetupStepId | null {
  const currentIndex = getStepIndex(currentStep);
  if (currentIndex > 0) {
    return SETUP_STEPS[currentIndex - 1];
  }
  return null;
}
