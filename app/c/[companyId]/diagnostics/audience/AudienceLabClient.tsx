'use client';

// app/c/[companyId]/diagnostics/audience/AudienceLabClient.tsx
// Audience Lab Client Component
//
// Interactive UI for managing and editing audience segments.

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AudienceModel, AudienceSegment, DemandState } from '@/lib/audience/model';
import type { AudienceSignals } from '@/lib/audience/signals';
import type { PersonaSet } from '@/lib/audience/personas';
import {
  DEMAND_STATE_LABELS,
  DEMAND_STATE_DESCRIPTIONS,
} from '@/lib/audience/model';
import { MEDIA_CHANNEL_LABELS, type MediaChannelId } from '@/lib/contextGraph/enums';
import { PersonasPanel } from './PersonasPanel';
import { InfoTip, InlineHelp } from '@/components/ui/InfoTip';

// ============================================================================
// Types
// ============================================================================

interface AudienceLabClientProps {
  companyId: string;
  companyName: string;
  initialModel: AudienceModel | null;
  initialPersonaSet?: PersonaSet | null;
  signals: AudienceSignals;
  signalsSummary: {
    totalSources: number;
    availableSources: string[];
    missingCritical: string[];
    dataRichness: 'low' | 'medium' | 'high';
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function AudienceLabClient({
  companyId,
  companyName,
  initialModel,
  initialPersonaSet,
  signals,
  signalsSummary,
}: AudienceLabClientProps) {
  const router = useRouter();
  const [model, setModel] = useState<AudienceModel | null>(initialModel);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    initialModel?.segments[0]?.id || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'segments' | 'personas' | 'signals'>('segments');

  // AI Segment expansion state
  const [showExpandModal, setShowExpandModal] = useState(false);
  const [expandSeed, setExpandSeed] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);

  // Get the currently selected segment
  const selectedSegment = model?.segments.find(s => s.id === selectedSegmentId) || null;

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSeedFromAI = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate audience model');
      }

      setModel(result.model);
      setSelectedSegmentId(result.model?.segments[0]?.id || null);
      setMessage({
        type: 'success',
        text: `Generated ${result.model.segments.length} segments from ${result.signalsUsed.length} sources`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to generate',
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const handleRegenerate = useCallback(async () => {
    if (!model) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to regenerate');
      }

      setModel(result.model);
      setSelectedSegmentId(result.model?.segments[0]?.id || null);
      setMessage({
        type: 'success',
        text: `Regenerated model (v${result.model.version})`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to regenerate',
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, model]);

  const handleSave = useCallback(async () => {
    if (!model) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      setModel(result.model);
      setMessage({ type: 'success', text: 'Model saved successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setIsSaving(false);
    }
  }, [companyId, model]);

  const handleSetCanonical = useCallback(async () => {
    if (!model) return;

    setIsSaving(true);
    setMessage(null);

    try {
      // First save the model
      await fetch(`/api/audience/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });

      // Then set as canonical
      const response = await fetch(`/api/audience/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: model.id,
          updateContextGraph: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to set canonical');
      }

      setModel({ ...model, isCurrentCanonical: true });
      setMessage({
        type: 'success',
        text: `Model set as canonical. Updated ${result.fieldsUpdated.length} Context Graph fields.`,
      });

      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to set canonical',
      });
    } finally {
      setIsSaving(false);
    }
  }, [companyId, model, router]);

  const handleAddSegment = useCallback(() => {
    if (!model) return;

    const newSegment: AudienceSegment = {
      id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'New Segment',
      description: '',
      jobsToBeDone: [],
      keyPains: [],
      keyGoals: [],
      primaryDemandState: undefined,
      secondaryDemandStates: [],
      demographics: '',
      geos: '',
      behavioralDrivers: [],
      mediaHabits: '',
      keyObjections: [],
      proofPointsNeeded: [],
      priorityChannels: [],
      avoidChannels: [],
      creativeAngles: [],
      recommendedFormats: [],
      priority: undefined,
      estimatedSize: undefined,
    };

    setModel({
      ...model,
      segments: [...model.segments, newSegment],
      source: 'mixed',
    });
    setSelectedSegmentId(newSegment.id);
  }, [model]);

  const handleDeleteSegment = useCallback((segmentId: string) => {
    if (!model) return;

    const newSegments = model.segments.filter(s => s.id !== segmentId);
    setModel({
      ...model,
      segments: newSegments,
      source: 'mixed',
    });

    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId(newSegments[0]?.id || null);
    }
  }, [model, selectedSegmentId]);

  const handleUpdateSegment = useCallback((segmentId: string, updates: Partial<AudienceSegment>) => {
    if (!model) return;

    setModel({
      ...model,
      segments: model.segments.map(s =>
        s.id === segmentId ? { ...s, ...updates } : s
      ),
      source: 'mixed',
    });
  }, [model]);

  const handleExpandSegment = useCallback(async () => {
    if (!expandSeed.trim()) return;

    setIsExpanding(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'expandSegment',
          seed: expandSeed.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to expand segment');
      }

      // If we don't have a model yet, create one
      if (!model) {
        const newModel: AudienceModel = {
          id: `am_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          companyId,
          version: 1,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          description: '',
          segments: [result.segment],
          notes: '',
          source: 'mixed',
          isCurrentCanonical: false,
        };
        setModel(newModel);
        setSelectedSegmentId(result.segment.id);
      } else {
        // Add to existing model
        setModel({
          ...model,
          segments: [...model.segments, result.segment],
          source: 'mixed',
        });
        setSelectedSegmentId(result.segment.id);
      }

      setMessage({
        type: 'success',
        text: `Created segment: ${result.segment.name}`,
      });
      setShowExpandModal(false);
      setExpandSeed('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to expand segment',
      });
    } finally {
      setIsExpanding(false);
    }
  }, [companyId, expandSeed, model]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-100">Audience Lab</h1>
          <InfoTip
            variant="help"
            title="How Audience Lab Works"
            maxWidth={440}
            content={
              <div className="space-y-2">
                <p><strong>1. Generate Segments</strong> — AI creates audience segments from your diagnostics data (GAP, Brand Lab, etc.)</p>
                <p><strong>2. Refine & Edit</strong> — Customize segments with demand states, demographics, media habits, and creative angles.</p>
                <p><strong>3. Set Canonical</strong> — Mark your model as canonical to update the Company Context Graph.</p>
                <p><strong>4. Create Personas</strong> — Generate human-centered personas from your segments for creative teams.</p>
              </div>
            }
          />
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Define and manage audience segments for {companyName}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* No Model State */}
      {!model && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            No Audience Model Yet
          </h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Generate an audience model from your diagnostics data, or create segments manually.
          </p>

          <SignalsSummaryCard summary={signalsSummary} className="mb-6 max-w-md mx-auto" />

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSeedFromAI}
              disabled={isLoading || signalsSummary.totalSources === 0}
              className="rounded-lg px-5 py-2.5 bg-amber-600 text-white font-medium text-sm hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate from Signals
                </>
              )}
            </button>
            <button
              onClick={() => {
                const emptyModel: AudienceModel = {
                  id: `am_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  companyId,
                  version: 1,
                  updatedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  description: '',
                  segments: [],
                  notes: '',
                  source: 'manual',
                  isCurrentCanonical: false,
                };
                setModel(emptyModel);
              }}
              className="rounded-lg px-5 py-2.5 border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800"
            >
              Start from Scratch
            </button>
          </div>
        </div>
      )}

      {/* Model Editing UI */}
      {model && (
        <div>
          {/* Top Tabs - Segments vs Personas */}
          <div className="flex gap-1 mb-6 p-1 bg-slate-800/50 rounded-lg max-w-md">
            <button
              onClick={() => setActiveTab('segments')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'segments'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Segments ({model.segments.length})
            </button>
            <button
              onClick={() => setActiveTab('personas')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'personas'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Personas
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'signals'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Signals
            </button>
          </div>

          {/* Personas Tab */}
          {activeTab === 'personas' && (
            <PersonasPanel
              companyId={companyId}
              companyName={companyName}
              hasAudienceModel={!!model}
              initialPersonaSet={initialPersonaSet || null}
            />
          )}

          {/* Signals Tab */}
          {activeTab === 'signals' && (
            <div className="max-w-2xl">
              <SignalsPanel signals={signals} summary={signalsSummary} />
            </div>
          )}

          {/* Segments Tab */}
          {activeTab === 'segments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Segment List */}
          <div className="lg:col-span-1">
            {/* Segment List */}
            <div className="space-y-2 mb-4">
              {model.segments.map(segment => (
                <button
                  key={segment.id}
                  onClick={() => setSelectedSegmentId(segment.id)}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    selectedSegmentId === segment.id
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100 text-sm">
                      {segment.name || 'Untitled Segment'}
                    </span>
                    {segment.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        segment.priority === 'primary'
                          ? 'bg-amber-500/20 text-amber-400'
                          : segment.priority === 'secondary'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {segment.priority}
                      </span>
                    )}
                  </div>
                  {segment.primaryDemandState && (
                    <span className="text-xs text-slate-500 mt-1 block">
                      {DEMAND_STATE_LABELS[segment.primaryDemandState]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Add Segment Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setShowExpandModal(true)}
                className="w-full rounded-lg p-3 border border-dashed border-amber-500/30 bg-amber-500/5 text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Add with AI
              </button>
              <button
                onClick={handleAddSegment}
                className="w-full rounded-lg p-3 border border-dashed border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Blank
              </button>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full rounded-lg px-4 py-2.5 bg-slate-800 text-slate-200 font-medium text-sm hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Spinner /> : null}
                Save Model
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSetCanonical}
                  disabled={isSaving || model.isCurrentCanonical}
                  className="flex-1 rounded-lg px-4 py-2.5 bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {model.isCurrentCanonical ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Canonical Model
                    </>
                  ) : (
                    'Set as Canonical & Update Graph'
                  )}
                </button>
                <InfoTip
                  variant="tip"
                  title="Context Graph Integration"
                  maxWidth={340}
                  content={
                    <div className="space-y-2">
                      <p>Setting a model as <strong>canonical</strong> copies your audience segments into the Company Context Graph.</p>
                      <p>This makes your audience data available to:</p>
                      <ul className="list-disc list-inside text-slate-400">
                        <li>Media Lab planning</li>
                        <li>Creative generation</li>
                        <li>AI-powered recommendations</li>
                      </ul>
                    </div>
                  }
                />
              </div>

              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="w-full rounded-lg px-4 py-2.5 border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Spinner /> : null}
                Regenerate from Signals
              </button>
            </div>

            {/* Model Info */}
            <div className="mt-6 p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
              <div className="flex justify-between mb-1">
                <span>Version</span>
                <span className="text-slate-400">v{model.version}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Source</span>
                <span className="text-slate-400">{model.source}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span className="text-slate-400">
                  {new Date(model.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Segment Editor */}
          <div className="lg:col-span-2">
            {selectedSegment ? (
              <SegmentEditor
                segment={selectedSegment}
                onUpdate={(updates) => handleUpdateSegment(selectedSegment.id, updates)}
                onDelete={() => handleDeleteSegment(selectedSegment.id)}
              />
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
                <p className="text-slate-400">
                  Select a segment to edit, or add a new one.
                </p>
              </div>
            )}
          </div>
        </div>
          )}
        </div>
      )}

      {/* AI Segment Expansion Modal */}
      {showExpandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!isExpanding) {
                setShowExpandModal(false);
                setExpandSeed('');
              }
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Add Segment with AI
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Describe your audience and AI will fill in the details
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isExpanding) {
                    setShowExpandModal(false);
                    setExpandSeed('');
                  }
                }}
                disabled={isExpanding}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Describe this audience segment
              </label>
              <textarea
                value={expandSeed}
                onChange={(e) => setExpandSeed(e.target.value)}
                placeholder="e.g., Older men, 45-65, interested in premium car audio upgrades, own trucks or SUVs..."
                rows={4}
                disabled={isExpanding}
                className="w-full rounded-lg px-4 py-3 bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 disabled:opacity-50 resize-none"
                autoFocus
              />
              <p className="mt-2 text-xs text-slate-500">
                Include any details you know: demographics, interests, behaviors, location, etc. AI will expand this into a complete segment profile.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900/50">
              <button
                onClick={() => {
                  setShowExpandModal(false);
                  setExpandSeed('');
                }}
                disabled={isExpanding}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExpandSegment}
                disabled={isExpanding || !expandSeed.trim()}
                className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExpanding ? (
                  <>
                    <Spinner />
                    Expanding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Create Segment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function SignalsSummaryCard({
  summary,
  className = '',
}: {
  summary: { totalSources: number; availableSources: string[]; dataRichness: 'low' | 'medium' | 'high' };
  className?: string;
}) {
  return (
    <div className={`rounded-lg bg-slate-800/50 border border-slate-700 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-2 h-2 rounded-full ${
          summary.dataRichness === 'high' ? 'bg-emerald-400' :
          summary.dataRichness === 'medium' ? 'bg-amber-400' : 'bg-red-400'
        }`} />
        <span className="text-sm font-medium text-slate-200">
          {summary.totalSources} data sources available
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {summary.availableSources.map(source => (
          <span
            key={source}
            className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300"
          >
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

function SignalsPanel({
  signals,
  summary,
}: {
  signals: AudienceSignals;
  summary: { totalSources: number; availableSources: string[]; dataRichness: 'low' | 'medium' | 'high' };
}) {
  return (
    <div className="space-y-4">
      <SignalsSummaryCard summary={summary} />

      {/* GAP */}
      {signals.gapNarrative && (
        <SignalCard title="GAP Analysis" content={signals.gapNarrative} />
      )}

      {/* Brand */}
      {signals.brandNarrative && (
        <SignalCard title="Brand Lab" content={signals.brandNarrative} />
      )}

      {/* Content */}
      {signals.contentNarrative && (
        <SignalCard title="Content Lab" content={signals.contentNarrative} />
      )}

      {/* SEO */}
      {signals.seoNarrative && (
        <SignalCard title="SEO Lab" content={signals.seoNarrative} />
      )}

      {/* Demand */}
      {signals.demandNarrative && (
        <SignalCard title="Demand Lab" content={signals.demandNarrative} />
      )}

      {/* Existing Audience */}
      {signals.existingAudienceFields?.coreSegments?.length && (
        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-4">
          <h4 className="text-sm font-medium text-slate-200 mb-2">Existing Segments</h4>
          <div className="flex flex-wrap gap-1.5">
            {signals.existingAudienceFields.coreSegments.map((segment, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                {segment}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SignalCard({ title, content }: { title: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = content.length > 200;

  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-4">
      <h4 className="text-sm font-medium text-slate-200 mb-2">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed">
        {truncated && !expanded ? `${content.slice(0, 200)}...` : content}
      </p>
      {truncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-amber-400 hover:text-amber-300 mt-2"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function SegmentEditor({
  segment,
  onUpdate,
  onDelete,
}: {
  segment: AudienceSegment;
  onUpdate: (updates: Partial<AudienceSegment>) => void;
  onDelete: () => void;
}) {
  const demandStates: DemandState[] = ['unaware', 'problem_aware', 'solution_aware', 'in_market', 'post_purchase'];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={segment.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Segment Name"
            className="text-xl font-semibold text-slate-100 bg-transparent border-none outline-none w-full placeholder-slate-600"
          />
          <textarea
            value={segment.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Brief description of this segment..."
            rows={2}
            className="mt-2 w-full text-sm text-slate-400 bg-transparent border-none outline-none resize-none placeholder-slate-600"
          />
        </div>
        <button
          onClick={onDelete}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Priority & Size */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
          <select
            value={segment.priority || ''}
            onChange={(e) => onUpdate({ priority: e.target.value as 'primary' | 'secondary' | 'tertiary' || undefined })}
            className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200"
          >
            <option value="">Not set</option>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="tertiary">Tertiary</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Estimated Size</label>
          <input
            type="text"
            value={segment.estimatedSize || ''}
            onChange={(e) => onUpdate({ estimatedSize: e.target.value })}
            placeholder="e.g., Large, Medium, Small"
            className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600"
          />
        </div>
      </div>

      {/* Demand State */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Primary Demand State</label>
        <div className="grid grid-cols-5 gap-2">
          {demandStates.map(state => (
            <button
              key={state}
              onClick={() => onUpdate({ primaryDemandState: segment.primaryDemandState === state ? undefined : state })}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                segment.primaryDemandState === state
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                  : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
              title={DEMAND_STATE_DESCRIPTIONS[state]}
            >
              {DEMAND_STATE_LABELS[state]}
            </button>
          ))}
        </div>
      </div>

      {/* Demographics & Geos */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Demographics</label>
          <textarea
            value={segment.demographics || ''}
            onChange={(e) => onUpdate({ demographics: e.target.value })}
            placeholder="Age, income, family status..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Geographic Focus</label>
          <textarea
            value={segment.geos || ''}
            onChange={(e) => onUpdate({ geos: e.target.value })}
            placeholder="Regions, markets, constraints..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
          />
        </div>
      </div>

      {/* Array Fields */}
      <ArrayField
        label="Jobs to be Done"
        values={segment.jobsToBeDone}
        onChange={(values) => onUpdate({ jobsToBeDone: values })}
        placeholder="What job is the customer hiring your product/service for?"
      />

      <ArrayField
        label="Key Pains"
        values={segment.keyPains}
        onChange={(values) => onUpdate({ keyPains: values })}
        placeholder="What problems or frustrations do they have?"
      />

      <ArrayField
        label="Key Goals"
        values={segment.keyGoals}
        onChange={(values) => onUpdate({ keyGoals: values })}
        placeholder="What outcomes are they trying to achieve?"
      />

      <ArrayField
        label="Behavioral Drivers"
        values={segment.behavioralDrivers}
        onChange={(values) => onUpdate({ behavioralDrivers: values })}
        placeholder="What drives their behavior and decisions?"
      />

      <ArrayField
        label="Key Objections"
        values={segment.keyObjections}
        onChange={(values) => onUpdate({ keyObjections: values })}
        placeholder="What objections might they have?"
      />

      <ArrayField
        label="Proof Points Needed"
        values={segment.proofPointsNeeded}
        onChange={(values) => onUpdate({ proofPointsNeeded: values })}
        placeholder="What evidence do they need to convert?"
      />

      {/* Media Habits */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Media Habits</label>
        <textarea
          value={segment.mediaHabits || ''}
          onChange={(e) => onUpdate({ mediaHabits: e.target.value })}
          placeholder="Where do they consume media? What platforms, times, formats?"
          rows={2}
          className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
        />
      </div>

      {/* Creative Fields */}
      <ArrayField
        label="Creative Angles"
        values={segment.creativeAngles}
        onChange={(values) => onUpdate({ creativeAngles: values })}
        placeholder="What messaging angles resonate?"
      />

      <ArrayField
        label="Recommended Formats"
        values={segment.recommendedFormats}
        onChange={(values) => onUpdate({ recommendedFormats: values })}
        placeholder="UGC, explainer, carousel, testimonial..."
      />
    </div>
  );
}

function ArrayField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newValue.trim()) {
      onChange([...values, newValue.trim()]);
      setNewValue('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((value, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 text-xs text-slate-300"
          >
            {value}
            <button
              onClick={() => handleRemove(i)}
              className="text-slate-500 hover:text-red-400"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="flex-1 rounded-lg px-3 py-1.5 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600"
        />
        <button
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
