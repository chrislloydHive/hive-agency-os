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
        description="Core information about your business"
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
            <select
              value={data.industry}
              onChange={(e) => update({ industry: e.target.value })}
              className={inputStyles.select}
            >
              <option value="">Select industry...</option>
              {INDUSTRY_OPTIONS.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Business Model" required hint="How do you acquire and serve customers?">
            <select
              value={data.businessModel}
              onChange={(e) => update({ businessModel: e.target.value })}
              className={inputStyles.select}
            >
              <option value="">Select model...</option>
              {BUSINESS_MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model.charAt(0).toUpperCase() + model.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Revenue Model" hint="How do you make money?">
            <select
              value={data.revenueModel}
              onChange={(e) => update({ revenueModel: e.target.value })}
              className={inputStyles.select}
            >
              <option value="">Select model...</option>
              {REVENUE_MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Revenue Streams" hint="Your main sources of revenue">
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
        description="Where your business operates"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Geographic Footprint"
            hint="National, regional, local, or global?"
          >
            <select
              value={data.geographicFootprint}
              onChange={(e) => update({ geographicFootprint: e.target.value })}
              className={inputStyles.select}
            >
              <option value="">Select scope...</option>
              <option value="Local">Local (single city/metro)</option>
              <option value="Regional">Regional (multi-state)</option>
              <option value="National">National</option>
              <option value="North America">North America</option>
              <option value="Global">Global</option>
            </select>
          </FormField>

          <FormField
            label="Primary Service Area"
            hint="Main markets or regions you serve"
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
        <FormField label="Peak Seasons" hint="When do you see highest demand?">
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
        description="Who are your main competitors?"
      >
        <FormField
          label="Primary Competitors"
          hint="List your top 3-5 competitors"
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
