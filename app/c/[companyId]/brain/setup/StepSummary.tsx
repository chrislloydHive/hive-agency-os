'use client';

// app/c/[companyId]/setup/StepSummary.tsx
// Step 10: Summary & Strategic Plan

import { useState } from 'react';
import { SetupFormData, SETUP_STEP_CONFIG } from './types';

interface StepSummaryProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

export function StepSummary({
  companyId,
  formData,
  updateStepData,
}: StepSummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<{
    strategySummary: string;
    keyRecommendations: string[];
    nextSteps: string[];
  } | null>(null);

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      const response = await fetch(`/api/setup/${companyId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });

      if (response.ok) {
        const result = await response.json();
        const workItemsCreated = result.workItemsCreated || 0;
        // Redirect to company page with success message
        window.location.href = `/c/${companyId}?setup=complete&workItems=${workItemsCreated}`;
      } else {
        console.error('Finalize failed:', await response.text());
        alert('Failed to finalize setup. Please try again.');
      }
    } catch (error) {
      console.error('Finalize error:', error);
      alert('Failed to finalize setup. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const generateStrategySummary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/setup/${companyId}/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.summary) {
          setGeneratedSummary(data.summary);
          // Also update the form data so it gets saved
          updateStepData('summary', {
            strategySummary: data.summary.strategySummary,
            keyRecommendations: data.summary.keyRecommendations,
            nextSteps: data.summary.nextSteps,
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPack = async (format: 'pdf' | 'json') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/setup/${companyId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, formData }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `strategy-pack-${companyId}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate completion stats
  const completionStats = getCompletionStats(formData);

  return (
    <div className="space-y-6">
      {/* Completion Overview */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-100">Strategic Setup Complete</h3>
            <p className="text-slate-400 mt-1">Review the strategic plan and finalize</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-400">
              {completionStats.percentage}%
            </div>
            <div className="text-sm text-slate-500">Complete</div>
          </div>
        </div>

        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${completionStats.percentage}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="text-lg font-semibold text-green-400">{completionStats.complete}</div>
            <div className="text-xs text-slate-500">Complete</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="text-lg font-semibold text-amber-400">{completionStats.partial}</div>
            <div className="text-xs text-slate-500">Partial</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="text-lg font-semibold text-slate-400">{completionStats.empty}</div>
            <div className="text-xs text-slate-500">Empty</div>
          </div>
        </div>
      </div>

      {/* Section Summaries */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          title={SETUP_STEP_CONFIG['business-identity'].label}
          data={formData.businessIdentity}
          items={[
            { label: 'Business', value: formData.businessIdentity?.businessName },
            { label: 'Industry', value: formData.businessIdentity?.industry },
            { label: 'Model', value: formData.businessIdentity?.businessModel },
            { label: 'Geography', value: formData.businessIdentity?.geographicFootprint },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['objectives'].label}
          data={formData.objectives}
          items={[
            { label: 'Primary Objective', value: formData.objectives?.primaryObjective },
            { label: 'Time Horizon', value: formData.objectives?.timeHorizon },
            { label: 'Target CPA', value: formData.objectives?.targetCpa ? `$${formData.objectives.targetCpa}` : undefined },
            { label: 'Target ROAS', value: formData.objectives?.targetRoas ? `${formData.objectives.targetRoas}x` : undefined },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['audience'].label}
          data={formData.audience}
          items={[
            { label: 'Segments', value: formData.audience?.coreSegments?.join(', ') },
            { label: 'Geography', value: cleanGeographyValue(formData.audience?.geos) },
            { label: 'Pain Points', value: `${formData.audience?.painPoints?.length || 0} identified` },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['personas'].label}
          data={formData.personas}
          items={[
            { label: 'Personas', value: formData.personas?.personaCount ? `${formData.personas.personaCount} generated` : 'None' },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['website'].label}
          data={formData.website}
          items={[
            { label: 'Issues', value: `${formData.website?.conversionBlocks?.length || 0} blockers` },
            { label: 'Opportunities', value: `${formData.website?.conversionOpportunities?.length || 0} identified` },
            { label: 'Quick Wins', value: `${formData.website?.quickWins?.length || 0} available` },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['media-foundations'].label}
          data={formData.mediaFoundations}
          items={[
            { label: 'Channels', value: `${formData.mediaFoundations?.activeChannels?.length || 0} active` },
            { label: 'Attribution', value: formData.mediaFoundations?.attributionModel },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['budget-scenarios'].label}
          data={formData.budgetScenarios}
          items={[
            { label: 'Marketing Budget', value: formData.budgetScenarios?.totalMarketingBudget ? `$${formData.budgetScenarios.totalMarketingBudget.toLocaleString()}` : undefined },
            { label: 'Media Spend', value: formData.budgetScenarios?.mediaSpendBudget ? `$${formData.budgetScenarios.mediaSpendBudget.toLocaleString()}` : undefined },
            { label: 'Period', value: formData.budgetScenarios?.budgetPeriod },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['creative-strategy'].label}
          data={formData.creativeStrategy}
          items={[
            { label: 'Messages', value: `${formData.creativeStrategy?.coreMessages?.length || 0} core messages` },
            { label: 'Formats', value: `${formData.creativeStrategy?.availableFormats?.length || 0} formats` },
            { label: 'CTAs', value: formData.creativeStrategy?.callToActions?.join(', ') },
          ]}
        />

        <SummaryCard
          title={SETUP_STEP_CONFIG['measurement'].label}
          data={formData.measurement}
          items={[
            { label: 'GA4', value: formData.measurement?.ga4PropertyId || 'Not configured' },
            { label: 'Events', value: `${formData.measurement?.ga4ConversionEvents?.length || 0} configured` },
            { label: 'Attribution', value: formData.measurement?.attributionModel },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={generateStrategySummary}
          disabled={isGenerating}
          className="p-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Generate AI Summary
            </>
          )}
        </button>

        <button
          onClick={() => exportPack('pdf')}
          disabled={isExporting}
          className="p-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export PDF
        </button>

        <button
          onClick={() => exportPack('json')}
          disabled={isExporting}
          className="p-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export JSON
        </button>
      </div>

      {/* Generated Summary Display */}
      {(generatedSummary || formData.summary?.strategySummary) && (
        <div className="p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <h4 className="font-semibold text-purple-300">AI-Generated Strategic Summary</h4>
          </div>

          {/* Strategy Summary */}
          <div>
            <h5 className="text-sm font-medium text-slate-400 mb-2">Strategy Summary</h5>
            <p className="text-slate-200">
              {generatedSummary?.strategySummary || formData.summary?.strategySummary}
            </p>
          </div>

          {/* Key Recommendations */}
          {((generatedSummary?.keyRecommendations || formData.summary?.keyRecommendations)?.length ?? 0) > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2">Key Recommendations</h5>
              <ul className="space-y-2">
                {(generatedSummary?.keyRecommendations || formData.summary?.keyRecommendations)?.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-200">
                    <span className="text-purple-400 mt-1">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {((generatedSummary?.nextSteps || formData.summary?.nextSteps)?.length ?? 0) > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-400 mb-2">Next Steps</h5>
              <ul className="space-y-2">
                {(generatedSummary?.nextSteps || formData.summary?.nextSteps)?.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-200">
                    <span className="text-emerald-400 mt-1">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Finalize */}
      <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-500/20 rounded-xl">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-green-300">Ready to Finalize?</h4>
            <p className="text-sm text-green-400/80 mt-1">
              Finalizing will save all data to the Context Graph, create recommended work items,
              and mark this setup as complete.
            </p>
            <button
              onClick={handleFinalize}
              disabled={isFinalizing}
              className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {isFinalizing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Finalizing...
                </>
              ) : (
                'Finalize Strategic Setup'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  items,
}: {
  title: string;
  data?: Record<string, unknown>;
  items: { label: string; value?: string | number }[];
}) {
  const hasData = items.some((item) => item.value);

  return (
    <div className={`p-4 rounded-lg border ${hasData ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-800/30 border-slate-700/50'}`}>
      <h4 className="font-medium text-slate-200 mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex text-sm gap-4">
            <span className="text-slate-500 flex-shrink-0 w-24">{item.label}</span>
            <span className={`text-right flex-1 ${item.value ? 'text-slate-300' : 'text-slate-600'}`}>
              {item.value || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Clean up geography values that may have been duplicated
 * e.g., "US, UK | US, UK | US, UK" → "US, UK"
 */
function cleanGeographyValue(geos: string | undefined): string | undefined {
  if (!geos) return undefined;

  // Check if it contains the | separator pattern (indicates duplication)
  if (geos.includes(' | ')) {
    const parts = geos.split(' | ');
    // If all parts are the same, just return one
    const unique = [...new Set(parts)];
    if (unique.length === 1) {
      return unique[0];
    }
    // Otherwise return unique parts joined
    return unique.join(', ');
  }

  return geos;
}

function getCompletionStats(formData: Partial<SetupFormData>) {
  const steps = [
    { key: 'businessIdentity', required: ['businessName', 'industry'] },
    { key: 'objectives', required: ['primaryObjective'] },
    { key: 'audience', required: ['coreSegments'] },
    { key: 'personas', required: [] },
    { key: 'website', required: [] },
    { key: 'mediaFoundations', required: ['activeChannels'] },
    { key: 'budgetScenarios', required: [] },
    { key: 'creativeStrategy', required: ['coreMessages'] },
    { key: 'measurement', required: [] },
  ];

  let complete = 0;
  let partial = 0;
  let empty = 0;

  for (const step of steps) {
    const data = formData[step.key as keyof SetupFormData];
    if (!data) {
      empty++;
      continue;
    }

    const values = Object.values(data as Record<string, unknown>);
    const filledValues = values.filter((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'number') return true;
      return v !== null && v !== undefined;
    });

    if (filledValues.length === 0) {
      empty++;
    } else if (filledValues.length === values.length) {
      complete++;
    } else {
      partial++;
    }
  }

  const total = steps.length;
  const percentage = Math.round(((complete + partial * 0.5) / total) * 100);

  return { complete, partial, empty, total, percentage };
}
