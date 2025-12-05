'use client';

// app/c/[companyId]/setup/StepAudience.tsx
// Step 3: Audience Foundations
//
// This step captures the canonical ICP (Ideal Customer Profile) fields
// that become hard constraints for Audience Lab and other Labs.

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

const BUYER_ROLE_SUGGESTIONS = [
  'CEO / Founder',
  'CMO / VP Marketing',
  'Marketing Manager',
  'Digital Marketing Manager',
  'Brand Manager',
  'Product Manager',
  'CTO / VP Engineering',
  'IT Manager',
  'Operations Manager',
  'Finance Manager',
  'Procurement',
  'HR Manager',
  'Business Owner',
  'Consultant',
];

const COMPANY_SIZE_OPTIONS = [
  { value: '', label: 'Select company size...' },
  { value: 'SMB', label: 'SMB (1-100 employees)' },
  { value: 'Mid-Market', label: 'Mid-Market (100-1000 employees)' },
  { value: 'Enterprise', label: 'Enterprise (1000+ employees)' },
  { value: 'Any', label: 'Any size' },
];

const COMPANY_STAGE_OPTIONS = [
  { value: '', label: 'Select company stage...' },
  { value: 'Startup', label: 'Startup (early stage)' },
  { value: 'Growth', label: 'Growth (scaling)' },
  { value: 'Mature', label: 'Mature (established)' },
  { value: 'Enterprise', label: 'Enterprise (large org)' },
  { value: 'Any', label: 'Any stage' },
];

const INDUSTRY_SUGGESTIONS = [
  'SaaS / Software',
  'Technology',
  'Healthcare',
  'Finance / Banking',
  'E-commerce / Retail',
  'Manufacturing',
  'Professional Services',
  'Real Estate',
  'Education',
  'Non-profit',
  'Government',
  'Media / Entertainment',
  'Travel / Hospitality',
  'Consumer Goods',
];

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

      {/* Canonical ICP Section - Most Important */}
      <FormSection
        title="Ideal Customer Profile (ICP)"
        description="These fields define the hard constraints for all Labs. Be specific - this is the canonical audience definition."
      >
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
          <div className="text-amber-300 text-sm">
            <strong>Important:</strong> The ICP defined here will constrain how Audience Lab, Media Lab, and other Labs generate recommendations.
          </div>
        </div>

        <FormField
          label="Primary Audience"
          required
          hint="Who is the business's primary target audience? Be specific."
        >
          <textarea
            value={data.primaryAudience}
            onChange={(e) => update({ primaryAudience: e.target.value })}
            className={inputStyles.textarea}
            rows={3}
            placeholder="e.g., 'B2B SaaS companies with 50-500 employees looking to improve their marketing ROI. They have existing marketing teams but lack the analytics expertise to optimize campaigns.'"
          />
        </FormField>

        <FormField
          label="Primary Buyer Roles"
          hint="Who are the decision makers and influencers?"
        >
          <TagInput
            value={data.primaryBuyerRoles}
            onChange={(tags) => update({ primaryBuyerRoles: tags })}
            placeholder="Add buyer roles..."
            suggestions={BUYER_ROLE_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* B2B Company Profile */}
      <FormSection
        title="Target Company Profile (B2B)"
        description="For B2B businesses, define the characteristics of companies the business wants to reach"
      >
        <div className="grid grid-cols-2 gap-6">
          <FormField
            label="Company Size"
            hint="What size companies does the business target?"
          >
            <select
              value={data.targetCompanySize}
              onChange={(e) => update({ targetCompanySize: e.target.value })}
              className={inputStyles.base}
            >
              {COMPANY_SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Company Stage"
            hint="What stage companies does the business target?"
          >
            <select
              value={data.targetCompanyStage}
              onChange={(e) => update({ targetCompanyStage: e.target.value })}
              className={inputStyles.base}
            >
              {COMPANY_STAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField
          label="Target Industries"
          hint="Which industries does the business serve? Leave empty if industry-agnostic."
        >
          <TagInput
            value={data.targetIndustries}
            onChange={(tags) => update({ targetIndustries: tags })}
            placeholder="Add industries..."
            suggestions={INDUSTRY_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Core Segments - Supporting Data */}
      <FormSection
        title="Additional Audience Segments"
        description="Define additional audience segments beyond the primary ICP"
      >
        <FormField
          label="Core Segments"
          hint="What other audience segments does the business target?"
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
          hint="Key demographic characteristics of the target audience"
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
        description="Where are the target customers located?"
      >
        <FormField
          label="Geographic Focus"
          hint="Primary regions or markets the business is targeting"
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
        description="How does the target audience think and act?"
      >
        <FormField
          label="Behavioral Drivers"
          hint="What behaviors characterize the best customers?"
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
        description="What drives the audience's decisions?"
      >
        <div className="grid grid-cols-2 gap-6">
          <FormField
            label="Pain Points"
            hint="Problems the audience is trying to solve"
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
