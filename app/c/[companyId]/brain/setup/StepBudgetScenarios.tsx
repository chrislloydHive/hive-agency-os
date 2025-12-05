'use client';

// app/c/[companyId]/setup/StepBudgetScenarios.tsx
// Step 7: Budget & Scenarios

import { useState } from 'react';
import { SetupFormData } from './types';
import { FormSection, FormField, inputStyles } from './components/StepContainer';

interface StepBudgetScenariosProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

interface Scenario {
  id: string;
  name: string;
  budget: number;
  expectedLeads: number;
  expectedCpa: number;
  expectedRoas: number;
  channels: { channel: string; allocation: number }[];
}

const BUDGET_PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

export function StepBudgetScenarios({
  companyId,
  formData,
  updateStepData,
}: StepBudgetScenariosProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: 'conservative',
      name: 'Conservative',
      budget: 25000,
      expectedLeads: 150,
      expectedCpa: 167,
      expectedRoas: 3.0,
      channels: [
        { channel: 'Google Search', allocation: 60 },
        { channel: 'Meta', allocation: 30 },
        { channel: 'LinkedIn', allocation: 10 },
      ],
    },
    {
      id: 'moderate',
      name: 'Moderate Growth',
      budget: 50000,
      expectedLeads: 350,
      expectedCpa: 143,
      expectedRoas: 3.5,
      channels: [
        { channel: 'Google Search', allocation: 50 },
        { channel: 'Meta', allocation: 35 },
        { channel: 'LinkedIn', allocation: 15 },
      ],
    },
    {
      id: 'aggressive',
      name: 'Aggressive',
      budget: 100000,
      expectedLeads: 800,
      expectedCpa: 125,
      expectedRoas: 4.0,
      channels: [
        { channel: 'Google Search', allocation: 45 },
        { channel: 'Meta', allocation: 35 },
        { channel: 'LinkedIn', allocation: 15 },
        { channel: 'YouTube', allocation: 5 },
      ],
    },
  ]);

  const data = formData.budgetScenarios || {
    totalMarketingBudget: null,
    mediaSpendBudget: null,
    budgetPeriod: 'monthly',
    avgCustomerValue: null,
    customerLTV: null,
    selectedScenarioId: null,
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('budgetScenarios', changes);
  };

  const selectedScenario = scenarios.find((s) => s.id === data.selectedScenarioId);

  return (
    <div className="space-y-6">
      {/* Budget Basics */}
      <FormSection
        title="Budget Overview"
        description="Marketing and media budget parameters"
      >
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Budget Period">
            <div className="flex gap-2">
              {BUDGET_PERIODS.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => update({ budgetPeriod: period.value })}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    data.budgetPeriod === period.value
                      ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Total Marketing Budget" hint="Overall marketing budget">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={data.totalMarketingBudget ?? ''}
                onChange={(e) =>
                  update({ totalMarketingBudget: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pl-7`}
                placeholder="100000"
              />
            </div>
          </FormField>

          <FormField label="Media Spend Budget" hint="Paid media portion">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={data.mediaSpendBudget ?? ''}
                onChange={(e) =>
                  update({ mediaSpendBudget: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pl-7`}
                placeholder="75000"
              />
            </div>
          </FormField>
        </div>
      </FormSection>

      {/* Unit Economics */}
      <FormSection
        title="Unit Economics"
        description="Key metrics for scenario planning"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Average Customer Value" hint="Average revenue per customer">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={data.avgCustomerValue ?? ''}
                onChange={(e) =>
                  update({ avgCustomerValue: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pl-7`}
                placeholder="500"
              />
            </div>
          </FormField>

          <FormField label="Customer LTV" hint="Lifetime value per customer">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={data.customerLTV ?? ''}
                onChange={(e) =>
                  update({ customerLTV: e.target.value ? parseFloat(e.target.value) : null })
                }
                className={`${inputStyles.base} pl-7`}
                placeholder="2500"
              />
            </div>
          </FormField>
        </div>
      </FormSection>

      {/* Scenario Selection */}
      <FormSection
        title="Investment Scenarios"
        description="Select a scenario to model expected outcomes"
      >
        <div className="grid grid-cols-3 gap-4">
          {scenarios.map((scenario) => {
            const isSelected = data.selectedScenarioId === scenario.id;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => update({ selectedScenarioId: scenario.id })}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-100">{scenario.name}</h4>
                  {isSelected && (
                    <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="text-2xl font-bold text-slate-100 mb-3">
                  ${scenario.budget.toLocaleString()}
                  <span className="text-sm font-normal text-slate-500">/mo</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Leads</span>
                    <span className="text-slate-200">{scenario.expectedLeads.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected CPA</span>
                    <span className="text-slate-200">${scenario.expectedCpa}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected ROAS</span>
                    <span className="text-slate-200">{scenario.expectedRoas}x</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700">
                  <div className="text-xs text-slate-500 mb-2">Channel Mix</div>
                  <div className="space-y-1">
                    {scenario.channels.map((ch) => (
                      <div key={ch.channel} className="flex items-center gap-2">
                        <div
                          className="h-1.5 bg-purple-500 rounded-full"
                          style={{ width: `${ch.allocation}%` }}
                        />
                        <span className="text-xs text-slate-400">{ch.channel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </FormSection>

      {/* Selected Scenario Details */}
      {selectedScenario && (
        <FormSection
          title="Scenario Projections"
          description={`Projected outcomes for ${selectedScenario.name} scenario`}
        >
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-slate-100">
                ${selectedScenario.budget.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400 mt-1">Monthly Spend</div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400">
                {selectedScenario.expectedLeads.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400 mt-1">Expected Leads</div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-amber-400">
                ${selectedScenario.expectedCpa}
              </div>
              <div className="text-sm text-slate-400 mt-1">Projected CPA</div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-400">
                {selectedScenario.expectedRoas}x
              </div>
              <div className="text-sm text-slate-400 mt-1">Projected ROAS</div>
            </div>
          </div>

          {data.avgCustomerValue && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="text-sm text-green-300">
                At ${data.avgCustomerValue} per customer, this scenario projects{' '}
                <strong>
                  ${(selectedScenario.expectedLeads * data.avgCustomerValue * 0.2).toLocaleString()}
                </strong>{' '}
                in revenue (assuming 20% close rate)
              </div>
            </div>
          )}
        </FormSection>
      )}
    </div>
  );
}
