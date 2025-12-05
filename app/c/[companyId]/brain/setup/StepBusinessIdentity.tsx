'use client';

// app/c/[companyId]/setup/StepBusinessIdentity.tsx
// Step 1: Business Identity

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, inputStyles } from './components/StepContainer';

interface StepBusinessIdentityProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const INDUSTRY_OPTIONS = [
  'B2B SaaS',
  'B2C E-commerce',
  'B2B Services',
  'Healthcare',
  'Financial Services',
  'Education',
  'Real Estate',
  'Home Services',
  'Retail',
  'Manufacturing',
  'Technology',
  'Other',
];

const BUSINESS_MODEL_OPTIONS = [
  'subscription',
  'ecommerce',
  'lead_gen',
  'marketplace',
  'transactional',
  'freemium',
  'hybrid',
];

const REVENUE_MODEL_OPTIONS = [
  'Subscription/Recurring',
  'One-time Purchase',
  'Transaction Fee',
  'Advertising',
  'Freemium',
  'Licensing',
  'Commission',
];

const SEASON_SUGGESTIONS = [
  'Q1 (Jan-Mar)',
  'Q2 (Apr-Jun)',
  'Q3 (Jul-Sep)',
  'Q4 (Oct-Dec)',
  'Back to School',
  'Holiday Season',
  'Summer',
  'Year-round',
];

export function StepBusinessIdentity({
  formData,
  updateStepData,
  errors,
}: StepBusinessIdentityProps) {
  const data = formData.businessIdentity || {
    businessName: '',
    industry: '',
    businessModel: '',
    revenueModel: '',
    geographicFootprint: '',
    serviceArea: '',
    seasonalityNotes: '',
    peakSeasons: [],
    revenueStreams: [],
    primaryCompetitors: [],
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('businessIdentity', changes);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <FormSection
        title="Business Overview"
        description="Core information about the business"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Business Name" required>
            <input
              type="text"
              value={data.businessName}
              onChange={(e) => update({ businessName: e.target.value })}
              className={inputStyles.base}
              placeholder="Acme Corporation"
            />
          </FormField>

          <FormField label="Industry" required>
            <input
              type="text"
              value={data.industry}
              onChange={(e) => update({ industry: e.target.value })}
              className={inputStyles.base}
              placeholder="e.g., B2B SaaS, E-commerce, Healthcare"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Business Model" required hint="How does the business acquire and serve customers?">
            <input
              type="text"
              value={data.businessModel}
              onChange={(e) => update({ businessModel: e.target.value })}
              className={inputStyles.base}
              placeholder="e.g., Subscription, Lead generation, E-commerce"
            />
          </FormField>

          <FormField label="Revenue Model" hint="How does the business make money?">
            <input
              type="text"
              value={data.revenueModel}
              onChange={(e) => update({ revenueModel: e.target.value })}
              className={inputStyles.base}
              placeholder="e.g., Recurring subscriptions, One-time purchases"
            />
          </FormField>
        </div>

        <FormField label="Revenue Streams" hint="Main sources of revenue">
          <TagInput
            value={data.revenueStreams}
            onChange={(tags) => update({ revenueStreams: tags })}
            placeholder="e.g., Software subscriptions, Professional services..."
            suggestions={['SaaS Subscriptions', 'Services', 'Licensing', 'Commission', 'Advertising']}
          />
        </FormField>
      </FormSection>

      {/* Geographic */}
      <FormSection
        title="Geographic Footprint"
        description="Where the business operates"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Geographic Footprint"
            hint="National, regional, local, or global?"
          >
            <input
              type="text"
              value={data.geographicFootprint}
              onChange={(e) => update({ geographicFootprint: e.target.value })}
              className={inputStyles.base}
              placeholder="e.g., National, Global, Pacific Northwest"
            />
          </FormField>

          <FormField
            label="Primary Service Area"
            hint="Main markets or regions the business serves"
          >
            <input
              type="text"
              value={data.serviceArea}
              onChange={(e) => update({ serviceArea: e.target.value })}
              className={inputStyles.base}
              placeholder="e.g., US & Canada, New York Metro, EMEA"
            />
          </FormField>
        </div>
      </FormSection>

      {/* Seasonality */}
      <FormSection
        title="Seasonality"
        description="When is demand highest and lowest?"
      >
        <FormField label="Peak Seasons" hint="When does the business see highest demand?">
          <TagInput
            value={data.peakSeasons}
            onChange={(tags) => update({ peakSeasons: tags })}
            placeholder="Add peak periods..."
            suggestions={SEASON_SUGGESTIONS}
          />
        </FormField>

        <FormField
          label="Seasonality Notes"
          hint="Any important patterns or considerations"
        >
          <textarea
            value={data.seasonalityNotes}
            onChange={(e) => update({ seasonalityNotes: e.target.value })}
            className={inputStyles.textarea}
            rows={3}
            placeholder="Describe any important seasonal patterns, e.g., 'Q4 is our biggest quarter due to holiday shopping. January is typically slow.'"
          />
        </FormField>
      </FormSection>

      {/* Competitors */}
      <FormSection
        title="Competitive Landscape"
        description="Who are the main competitors?"
      >
        <FormField
          label="Primary Competitors"
          hint="List the top 3-5 competitors"
        >
          <TagInput
            value={data.primaryCompetitors}
            onChange={(tags) => update({ primaryCompetitors: tags })}
            placeholder="Type competitor name and press Enter..."
          />
        </FormField>
      </FormSection>
    </div>
  );
}
