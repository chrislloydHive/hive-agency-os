'use client';

// app/c/[companyId]/setup/StepObjectives.tsx
// Step 2: Objectives

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, inputStyles } from './components/StepContainer';

interface StepObjectivesProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const PRIMARY_OBJECTIVES = [
  { value: 'lead_generation', label: 'Lead Generation', description: 'Drive qualified leads' },
  { value: 'sales', label: 'Direct Sales', description: 'Drive online purchases' },
  { value: 'awareness', label: 'Brand Awareness', description: 'Increase brand visibility' },
  { value: 'consideration', label: 'Consideration', description: 'Drive engagement and research' },
  { value: 'retention', label: 'Retention', description: 'Keep existing customers' },
  { value: 'app_installs', label: 'App Installs', description: 'Drive mobile app downloads' },
  { value: 'store_traffic', label: 'Store Traffic', description: 'Drive physical store visits' },
];

const TIME_HORIZONS = [
  { value: '30_days', label: '30 Days', description: 'Short-term sprint' },
  { value: '90_days', label: '90 Days (Quarter)', description: 'Standard planning period' },
  { value: '6_months', label: '6 Months', description: 'Mid-term planning' },
  { value: '12_months', label: '12 Months (Annual)', description: 'Long-term strategy' },
];

const KPI_SUGGESTIONS = [
  'Leads',
  'Revenue',
  'ROAS',
  'CPA',
  'MQLs',
  'SQLs',
  'Pipeline Value',
  'Transactions',
  'AOV',
  'CAC',
  'LTV',
  'MER',
];

export function StepObjectives({
  formData,
  updateStepData,
}: StepObjectivesProps) {
  const data = formData.objectives || {
    primaryObjective: '',
    secondaryObjectives: [],
    primaryBusinessGoal: '',
    timeHorizon: '',
    targetCpa: null,
    targetRoas: null,
    revenueGoal: null,
    leadGoal: null,
    kpiLabels: [],
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('objectives', changes);
  };

  return (
    <div className="space-y-6">
      {/* Primary Objective */}
      <FormSection
        title="Marketing Objective"
        description="What is the business trying to achieve with marketing?"
      >
        <FormField label="Primary Objective" required>
          <div className="grid grid-cols-2 gap-3">
            {PRIMARY_OBJECTIVES.map((obj) => (
              <button
                key={obj.value}
                type="button"
                onClick={() => update({ primaryObjective: obj.value })}
                className={`text-left p-4 rounded-lg border transition-all ${
                  data.primaryObjective === obj.value
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-slate-100">{obj.label}</div>
                <div className="text-sm text-slate-400 mt-0.5">{obj.description}</div>
              </button>
            ))}
          </div>
        </FormField>

        <FormField
          label="Secondary Objectives"
          hint="Additional goals that support the primary objective"
        >
          <TagInput
            value={data.secondaryObjectives}
            onChange={(tags) => update({ secondaryObjectives: tags })}
            placeholder="Select or type secondary objectives..."
            suggestions={PRIMARY_OBJECTIVES.filter(
              (o) => o.value !== data.primaryObjective
            ).map((o) => o.label)}
          />
        </FormField>

        <FormField
          label="Business Goal Statement"
          hint="Describe what success looks like in plain language"
        >
          <textarea
            value={data.primaryBusinessGoal}
            onChange={(e) => update({ primaryBusinessGoal: e.target.value })}
            className={inputStyles.textarea}
            rows={2}
            placeholder="e.g., 'Grow monthly recurring revenue by 30% while maintaining customer acquisition cost under $150'"
          />
        </FormField>
      </FormSection>

      {/* Time Horizon */}
      <FormSection
        title="Planning Period"
        description="How far ahead are we planning?"
      >
        <FormField label="Time Horizon" required>
          <div className="grid grid-cols-4 gap-3">
            {TIME_HORIZONS.map((horizon) => (
              <button
                key={horizon.value}
                type="button"
                onClick={() => update({ timeHorizon: horizon.value })}
                className={`text-center p-3 rounded-lg border transition-all ${
                  data.timeHorizon === horizon.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-slate-100">{horizon.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{horizon.description}</div>
              </button>
            ))}
          </div>
        </FormField>
      </FormSection>

      {/* KPI Targets */}
      <FormSection
        title="KPI Targets"
        description="What metrics will be tracked and what are the targets?"
      >
        <FormField label="Key Performance Indicators" hint="Select the KPIs most relevant to the business">
          <TagInput
            value={data.kpiLabels}
            onChange={(tags) => update({ kpiLabels: tags })}
            placeholder="Add KPIs to track..."
            suggestions={KPI_SUGGESTIONS}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <FormField label="Target CPA" hint="Cost per acquisition target">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={data.targetCpa ?? ''}
                onChange={(e) =>
                  update({ targetCpa: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pl-7`}
                placeholder="150"
              />
            </div>
          </FormField>

          <FormField label="Target ROAS" hint="Return on ad spend target">
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={data.targetRoas ?? ''}
                onChange={(e) =>
                  update({ targetRoas: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pr-7`}
                placeholder="4.0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">x</span>
            </div>
          </FormField>

          <FormField label="Revenue Goal" hint="Target revenue for the period">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={data.revenueGoal ?? ''}
                onChange={(e) =>
                  update({ revenueGoal: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pl-7`}
                placeholder="1000000"
              />
            </div>
          </FormField>

          <FormField label="Lead Goal" hint="Target number of leads">
            <input
              type="number"
              value={data.leadGoal ?? ''}
              onChange={(e) =>
                update({ leadGoal: e.target.value ? parseInt(e.target.value) : null })
              }
              className={inputStyles.base}
              placeholder="500"
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}
