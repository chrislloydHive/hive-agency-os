'use client';

// app/c/[companyId]/labs/creative/CreativeLabClient.tsx
// Creative Lab Client Component
//
// Main UI for Creative Lab showing messaging architecture, creative territories,
// campaign concepts, and guidelines.

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeLabContext } from './loadCreativeLab';
import type { CreativeLabOutput } from './runCreativeLab';
import type { LabRefinementRunResult } from '@/lib/labs/refinementTypes';
import { MessagingSection } from './components/MessagingSection';
import { AudienceMessagingSection } from './components/AudienceMessagingSection';
import { TerritoriesSection } from './components/TerritoriesSection';
import { CampaignConceptsSection } from './components/CampaignConceptsSection';
import { GuidelinesSection } from './components/GuidelinesSection';
import { ReadinessPanel } from './components/ReadinessPanel';
import { RefinementSummary } from '@/components/labs/RefinementSummary';

// ============================================================================
// Types
// ============================================================================

interface CreativeLabClientProps {
  companyId: string;
  companyName: string;
  labContext: CreativeLabContext;
}

type TabId = 'messaging' | 'audience' | 'territories' | 'concepts' | 'guidelines' | 'refinement';

// ============================================================================
// Component
// ============================================================================

export function CreativeLabClient({
  companyId,
  companyName,
  labContext,
}: CreativeLabClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('messaging');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningRefinement, setIsRunningRefinement] = useState(false);
  const [refinementResult, setRefinementResult] = useState<LabRefinementRunResult | null>(null);
  const [output, setOutput] = useState<CreativeLabOutput | null>(
    labContext.existingOutput.messaging
      ? {
          messaging: labContext.existingOutput.messaging,
          segmentMessages: labContext.existingOutput.segmentMessages || {},
          creativeTerritories: labContext.existingOutput.creativeTerritories || [],
          campaignConcepts: labContext.existingOutput.campaignConcepts || [],
          guidelines: labContext.existingOutput.guidelines || {
            voice: '',
            tone: '',
            visual: '',
            testingRoadmap: [],
          },
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  // Tabs configuration
  const tabs: { id: TabId; label: string; description: string }[] = [
    { id: 'messaging', label: 'Messaging', description: 'Core value proposition and messaging architecture' },
    { id: 'audience', label: 'Audience Messaging', description: 'Segment-specific messaging' },
    { id: 'territories', label: 'Territories', description: 'Creative territories and themes' },
    { id: 'concepts', label: 'Campaigns', description: 'Campaign concepts and ideas' },
    { id: 'guidelines', label: 'Guidelines', description: 'Brand and creative guidelines' },
    { id: 'refinement', label: 'Refinement', description: 'Refine creative context in Brain' },
  ];

  // Run Creative Lab refinement
  const runRefinement = useCallback(async () => {
    setIsRunningRefinement(true);
    setRefinementResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/labs/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId: 'creative' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to run refinement');
        return;
      }

      setRefinementResult(data.result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
      setIsRunningRefinement(false);
    }
  }, [companyId, router]);

  // Generate creative strategy
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/creative/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await response.json();

      if (data.success && data.output) {
        setOutput(data.output);
        setLastRunId(data.runId);
      } else {
        throw new Error(data.error || 'No output generated');
      }
    } catch (err) {
      console.error('[CreativeLab] Generation error:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [companyId]);

  // Save to Context Graph
  const handleSave = useCallback(async () => {
    if (!output) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/creative/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output,
          runId: lastRunId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Save failed');
      }

      // Show success feedback
      const data = await response.json();
      console.log('[CreativeLab] Saved successfully:', data);
    } catch (err) {
      console.error('[CreativeLab] Save error:', err);
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, output, lastRunId]);

  // Update output section
  const handleUpdateOutput = useCallback((
    section: keyof CreativeLabOutput,
    value: CreativeLabOutput[keyof CreativeLabOutput]
  ) => {
    if (!output) return;
    setOutput({
      ...output,
      [section]: value,
    });
  }, [output]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Creative Lab</h1>
        <p className="mt-2 text-slate-400">
          Generate messaging architecture, creative territories, and campaign concepts for {companyName}
        </p>
      </div>

      {/* Readiness Panel */}
      <ReadinessPanel
        readiness={labContext.readiness}
        companyId={companyId}
      />

      {/* Action Bar */}
      <div className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-slate-900/50 border border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isGenerating
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-amber-500 text-slate-900 hover:bg-amber-400'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </span>
            ) : output ? (
              'Regenerate'
            ) : (
              'Generate Creative Strategy'
            )}
          </button>

          {output && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isSaving
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save to Brain'}
            </button>
          )}
        </div>

        {!labContext.readiness.canRunHighConfidence && (
          <div className="text-sm text-amber-400">
            Low confidence mode - missing critical context
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-800">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
              }`}
              title={tab.description}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {!output ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              No Creative Strategy Yet
            </h3>
            <p className="text-slate-500 max-w-md mb-6">
              Generate a complete creative strategy including messaging architecture,
              creative territories, and campaign concepts based on your brand and audience context.
            </p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-lg font-medium bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors"
            >
              Generate Creative Strategy
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'messaging' && (
              <MessagingSection
                messaging={output.messaging}
                onUpdate={(messaging) => handleUpdateOutput('messaging', messaging)}
              />
            )}
            {activeTab === 'audience' && (
              <AudienceMessagingSection
                segmentMessages={output.segmentMessages}
                segments={labContext.audienceSegments}
                onUpdate={(messages) => handleUpdateOutput('segmentMessages', messages)}
              />
            )}
            {activeTab === 'territories' && (
              <TerritoriesSection
                territories={output.creativeTerritories}
                onUpdate={(territories) => handleUpdateOutput('creativeTerritories', territories)}
              />
            )}
            {activeTab === 'concepts' && (
              <CampaignConceptsSection
                concepts={output.campaignConcepts}
                onUpdate={(concepts) => handleUpdateOutput('campaignConcepts', concepts)}
              />
            )}
            {activeTab === 'guidelines' && (
              <GuidelinesSection
                guidelines={output.guidelines}
                onUpdate={(guidelines) => handleUpdateOutput('guidelines', guidelines)}
              />
            )}
            {activeTab === 'refinement' && (
              <div className="max-w-2xl space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-100">Creative Lab Refinement</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Refine creative context in Brain. Labs respect human overrides and source priorities.
                    </p>
                  </div>
                  <button
                    onClick={runRefinement}
                    disabled={isRunningRefinement}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRunningRefinement ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refining...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Run Refinement
                      </>
                    )}
                  </button>
                </div>

                {/* Refinement Result */}
                {refinementResult ? (
                  <RefinementSummary result={refinementResult} showDetails />
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-200 mb-2">
                      Run Creative Lab Refinement
                    </h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                      Analyze current creative context and propose refinements to messaging framework, key messages, proof points, and CTAs. Changes are written to Brain with full provenance tracking.
                    </p>
                  </div>
                )}

                {/* Info Box */}
                <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
                  <h4 className="text-sm font-medium text-slate-200 mb-2">How Refinement Mode Works</h4>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">1.</span>
                      Loads current creative context from Brain
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">2.</span>
                      AI analyzes and proposes delta updates (not full replacements)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">3.</span>
                      Respects human overrides — never overwrites user-entered values
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">4.</span>
                      Records provenance with confidence scores for traceability
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
