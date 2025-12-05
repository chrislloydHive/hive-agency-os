'use client';

// app/c/[companyId]/labs/creative/CreativeLabClient.tsx
// Creative Lab Client Component
//
// Main UI for Creative Lab showing messaging architecture, creative territories,
// campaign concepts, and guidelines.

import { useState, useCallback } from 'react';
import type { CreativeLabContext } from './loadCreativeLab';
import type { CreativeLabOutput } from './runCreativeLab';
import { MessagingSection } from './components/MessagingSection';
import { AudienceMessagingSection } from './components/AudienceMessagingSection';
import { TerritoriesSection } from './components/TerritoriesSection';
import { CampaignConceptsSection } from './components/CampaignConceptsSection';
import { GuidelinesSection } from './components/GuidelinesSection';
import { ReadinessPanel } from './components/ReadinessPanel';

// ============================================================================
// Types
// ============================================================================

interface CreativeLabClientProps {
  companyId: string;
  companyName: string;
  labContext: CreativeLabContext;
}

type TabId = 'messaging' | 'audience' | 'territories' | 'concepts' | 'guidelines';

// ============================================================================
// Component
// ============================================================================

export function CreativeLabClient({
  companyId,
  companyName,
  labContext,
}: CreativeLabClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('messaging');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  ];

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
          </>
        )}
      </div>
    </div>
  );
}
