'use client';

// app/c/[companyId]/setup/StepAudience.tsx
// Step 3: Audience Foundations

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, LabLink, inputStyles } from './components/StepContainer';

interface StepAudienceProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const SEGMENT_SUGGESTIONS = [
  'Enterprise',
  'Mid-Market',
  'SMB',
  'Startups',
  'Consumers',
  'Decision Makers',
  'Technical Users',
  'Business Users',
  'Millennials',
  'Gen Z',
  'Parents',
  'Homeowners',
];

const BEHAVIORAL_SUGGESTIONS = [
  'Research-heavy',
  'Price-sensitive',
  'Brand-loyal',
  'Impulse buyers',
  'Comparison shoppers',
  'Early adopters',
  'Risk-averse',
  'Value seekers',
  'Quality focused',
  'Convenience-driven',
];

const DEMAND_STATE_SUGGESTIONS = [
  'Active shopping',
  'Researching options',
  'Problem aware',
  'Solution aware',
  'Not yet aware',
  'Comparing vendors',
  'Ready to buy',
  'Budget approved',
];

const MOTIVATION_SUGGESTIONS = [
  'Save time',
  'Save money',
  'Increase revenue',
  'Reduce risk',
  'Improve efficiency',
  'Better quality',
  'Competitive advantage',
  'Innovation',
  'Convenience',
  'Status',
];

const PAIN_POINT_SUGGESTIONS = [
  'High costs',
  'Wasted time',
  'Poor quality',
  'Lack of expertise',
  'Complex processes',
  'Unreliable vendors',
  'Scalability issues',
  'Integration problems',
  'Compliance concerns',
];

export function StepAudience({
  companyId,
  formData,
  updateStepData,
}: StepAudienceProps) {
  const data = formData.audience || {
    coreSegments: [],
    demographics: '',
    geos: '',
    primaryMarkets: [],
    behavioralDrivers: [],
    demandStates: [],
    painPoints: [],
    motivations: [],
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('audience', changes);
  };

  return (
    <div className="space-y-6">
      {/* Lab Integration Banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-medium text-purple-300">Need deeper audience research?</div>
          <div className="text-sm text-purple-400/80 mt-0.5">
            Use Audience Lab to generate detailed personas and audience insights
          </div>
        </div>
        <LabLink companyId={companyId} lab="audience" label="Open Audience Lab" />
      </div>

      {/* Core Segments */}
      <FormSection
        title="Core Audience Segments"
        description="Define your primary target audiences"
      >
        <FormField
          label="Core Segments"
          required
          hint="Who are your primary target audiences?"
        >
          <TagInput
            value={data.coreSegments}
            onChange={(tags) => update({ coreSegments: tags })}
            placeholder="Add audience segments..."
            suggestions={SEGMENT_SUGGESTIONS}
          />
        </FormField>

        <FormField
          label="Demographics"
          hint="Key demographic characteristics of your audience"
        >
          <textarea
            value={data.demographics}
            onChange={(e) => update({ demographics: e.target.value })}
            className={inputStyles.textarea}
            rows={2}
            placeholder="e.g., '25-45 year old professionals, household income $75k+, college educated'"
          />
        </FormField>
      </FormSection>

      {/* Geographic Targeting */}
      <FormSection
        title="Geographic Targeting"
        description="Where are your target customers located?"
      >
        <FormField
          label="Geographic Focus"
          hint="Primary regions or markets you're targeting"
        >
          <input
            type="text"
            value={data.geos}
            onChange={(e) => update({ geos: e.target.value })}
            className={inputStyles.base}
            placeholder="e.g., United States, Canada, UK"
          />
        </FormField>

        <FormField
          label="Primary Markets"
          hint="Specific cities, states, or regions"
        >
          <TagInput
            value={data.primaryMarkets}
            onChange={(tags) => update({ primaryMarkets: tags })}
            placeholder="Add specific markets..."
            suggestions={['New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Austin', 'Seattle']}
          />
        </FormField>
      </FormSection>

      {/* Behavioral & Psychographic */}
      <FormSection
        title="Behavioral Profile"
        description="How does your audience think and act?"
      >
        <FormField
          label="Behavioral Drivers"
          hint="What behaviors characterize your best customers?"
        >
          <TagInput
            value={data.behavioralDrivers}
            onChange={(tags) => update({ behavioralDrivers: tags })}
            placeholder="Add behavioral traits..."
            suggestions={BEHAVIORAL_SUGGESTIONS}
          />
        </FormField>

        <FormField
          label="Demand States"
          hint="Where are prospects in their buying journey?"
        >
          <TagInput
            value={data.demandStates}
            onChange={(tags) => update({ demandStates: tags })}
            placeholder="Add demand states..."
            suggestions={DEMAND_STATE_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Pain Points & Motivations */}
      <FormSection
        title="Needs & Motivations"
        description="What drives your audience's decisions?"
      >
        <div className="grid grid-cols-2 gap-6">
          <FormField
            label="Pain Points"
            hint="Problems your audience is trying to solve"
          >
            <TagInput
              value={data.painPoints}
              onChange={(tags) => update({ painPoints: tags })}
              placeholder="Add pain points..."
              suggestions={PAIN_POINT_SUGGESTIONS}
            />
          </FormField>

          <FormField
            label="Key Motivations"
            hint="What drives them to take action?"
          >
            <TagInput
              value={data.motivations}
              onChange={(tags) => update({ motivations: tags })}
              placeholder="Add motivations..."
              suggestions={MOTIVATION_SUGGESTIONS}
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}
