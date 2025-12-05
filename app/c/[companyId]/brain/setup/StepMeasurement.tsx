'use client';

// app/c/[companyId]/setup/StepMeasurement.tsx
// Step 9: Measurement Setup

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, inputStyles } from './components/StepContainer';

interface StepMeasurementProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const CONVERSION_EVENT_SUGGESTIONS = [
  'purchase',
  'generate_lead',
  'submit_form',
  'phone_call',
  'schedule_appointment',
  'add_to_cart',
  'begin_checkout',
  'sign_up',
  'page_view',
  'scroll',
];

const TRACKING_TOOL_SUGGESTIONS = [
  'Google Tag Manager',
  'Google Analytics 4',
  'Google Ads Conversion Tracking',
  'Meta Pixel',
  'LinkedIn Insight Tag',
  'Microsoft UET',
  'CallRail',
  'CallTrackingMetrics',
  'Hotjar',
  'Mixpanel',
];

const ATTRIBUTION_MODELS = [
  { value: 'last_click', label: 'Last Click', description: 'Credit to final touchpoint before conversion' },
  { value: 'first_click', label: 'First Click', description: 'Credit to first touchpoint in the journey' },
  { value: 'linear', label: 'Linear', description: 'Equal credit across all touchpoints' },
  { value: 'time_decay', label: 'Time Decay', description: 'More credit to touchpoints closer to conversion' },
  { value: 'position_based', label: 'Position Based', description: '40% first, 40% last, 20% middle touches' },
  { value: 'data_driven', label: 'Data-Driven', description: 'ML-based attribution using available data' },
];

const ATTRIBUTION_WINDOWS = [
  { value: '1_day', label: '1 Day' },
  { value: '7_days', label: '7 Days' },
  { value: '14_days', label: '14 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '60_days', label: '60 Days' },
  { value: '90_days', label: '90 Days' },
];

const CALL_TRACKING_OPTIONS = [
  { value: 'none', label: 'Not Tracking Calls', description: 'No call tracking in place' },
  { value: 'basic', label: 'Basic Tracking', description: 'Simple call counting only' },
  { value: 'dynamic', label: 'Dynamic Numbers', description: 'Source-level tracking with dynamic insertion' },
  { value: 'advanced', label: 'Advanced', description: 'Call recording, scoring, and CRM integration' },
];

export function StepMeasurement({
  formData,
  updateStepData,
}: StepMeasurementProps) {
  const data = formData.measurement || {
    ga4PropertyId: '',
    ga4ConversionEvents: [],
    callTracking: '',
    trackingTools: [],
    attributionModel: '',
    attributionWindow: '',
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('measurement', changes);
  };

  return (
    <div className="space-y-6">
      {/* GA4 Setup */}
      <FormSection
        title="Google Analytics 4"
        description="Core analytics configuration"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="GA4 Property ID"
            hint="Format: G-XXXXXXXXXX"
          >
            <input
              type="text"
              value={data.ga4PropertyId}
              onChange={(e) => update({ ga4PropertyId: e.target.value })}
              className={inputStyles.base}
              placeholder="G-1234567890"
            />
          </FormField>

          <div /> {/* Spacer */}
        </div>

        <FormField
          label="Conversion Events"
          hint="Key events tracked as conversions"
        >
          <TagInput
            value={data.ga4ConversionEvents}
            onChange={(tags) => update({ ga4ConversionEvents: tags })}
            placeholder="Add conversion events..."
            suggestions={CONVERSION_EVENT_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Call Tracking */}
      <FormSection
        title="Call Tracking"
        description="How is the business tracking phone calls?"
      >
        <FormField label="Call Tracking Setup">
          <div className="grid grid-cols-2 gap-3">
            {CALL_TRACKING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ callTracking: option.value })}
                className={`text-left p-4 rounded-lg border transition-all ${
                  data.callTracking === option.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-slate-200">{option.label}</div>
                <div className="text-xs text-slate-500 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </FormField>
      </FormSection>

      {/* Tracking Stack */}
      <FormSection
        title="Tracking Stack"
        description="Tools and pixels in use"
      >
        <FormField
          label="Tracking Tools"
          hint="All tracking tools and pixels installed"
        >
          <TagInput
            value={data.trackingTools}
            onChange={(tags) => update({ trackingTools: tags })}
            placeholder="Add tracking tools..."
            suggestions={TRACKING_TOOL_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Attribution */}
      <FormSection
        title="Attribution"
        description="How does the business measure marketing effectiveness?"
      >
        <FormField label="Attribution Model" hint="How conversions are credited to touchpoints">
          <div className="grid grid-cols-3 gap-3">
            {ATTRIBUTION_MODELS.map((model) => (
              <button
                key={model.value}
                type="button"
                onClick={() => update({ attributionModel: model.value })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  data.attributionModel === model.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-sm text-slate-200">{model.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{model.description}</div>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Attribution Window" hint="How long after a click to count conversions">
          <div className="flex gap-2">
            {ATTRIBUTION_WINDOWS.map((window) => (
              <button
                key={window.value}
                type="button"
                onClick={() => update({ attributionWindow: window.value })}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  data.attributionWindow === window.value
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                }`}
              >
                {window.label}
              </button>
            ))}
          </div>
        </FormField>
      </FormSection>

      {/* Measurement Readiness */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h4 className="font-medium text-slate-200 mb-3">Measurement Readiness</h4>
        <div className="space-y-2">
          <ReadinessItem
            label="GA4 Property"
            isReady={!!data.ga4PropertyId}
            description={data.ga4PropertyId || 'Not configured'}
          />
          <ReadinessItem
            label="Conversion Events"
            isReady={data.ga4ConversionEvents.length > 0}
            description={`${data.ga4ConversionEvents.length} events configured`}
          />
          <ReadinessItem
            label="Call Tracking"
            isReady={!!data.callTracking && data.callTracking !== 'none'}
            description={data.callTracking || 'Not configured'}
          />
          <ReadinessItem
            label="Attribution Model"
            isReady={!!data.attributionModel}
            description={
              ATTRIBUTION_MODELS.find((m) => m.value === data.attributionModel)?.label ||
              'Not selected'
            }
          />
        </div>
      </div>
    </div>
  );
}

function ReadinessItem({
  label,
  isReady,
  description,
}: {
  label: string;
  isReady: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          isReady ? 'bg-green-500/20' : 'bg-slate-700'
        }`}
      >
        {isReady ? (
          <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-2 h-2 bg-slate-500 rounded-full" />
        )}
      </div>
      <div className="flex-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm text-slate-500 ml-2">— {description}</span>
      </div>
    </div>
  );
}
