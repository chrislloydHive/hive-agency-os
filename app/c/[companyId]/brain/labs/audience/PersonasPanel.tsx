'use client';

// app/c/[companyId]/diagnostics/audience/PersonasPanel.tsx
// Personas Panel for Audience Lab
//
// Interactive UI for managing personas derived from audience segments.

import { useState, useCallback } from 'react';
import type { PersonaSet, Persona } from '@/lib/audience/personas';

// ============================================================================
// Types
// ============================================================================

interface PersonasPanelProps {
  companyId: string;
  companyName: string;
  hasAudienceModel: boolean;
  initialPersonaSet: PersonaSet | null;
}

// ============================================================================
// Main Component
// ============================================================================

export function PersonasPanel({
  companyId,
  companyName,
  hasAudienceModel,
  initialPersonaSet,
}: PersonasPanelProps) {
  const [personaSet, setPersonaSet] = useState<PersonaSet | null>(initialPersonaSet);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    initialPersonaSet?.personas[0]?.id || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get the currently selected persona
  const selectedPersona = personaSet?.personas.find(p => p.id === selectedPersonaId) || null;

  // ============================================================================
  // Actions
  // ============================================================================

  const handleGeneratePersonas = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate personas');
      }

      setPersonaSet(result.personaSet);
      setSelectedPersonaId(result.personaSet?.personas[0]?.id || null);
      setMessage({
        type: 'success',
        text: `Generated ${result.personaSet.personas.length} personas from ${result.segmentsUsed.length} segments`,
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
    if (!personaSet) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to regenerate');
      }

      setPersonaSet(result.personaSet);
      setSelectedPersonaId(result.personaSet?.personas[0]?.id || null);
      setMessage({
        type: 'success',
        text: `Regenerated personas (v${result.personaSet.version})`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to regenerate',
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, personaSet]);

  const handleSave = useCallback(async () => {
    if (!personaSet) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaSet }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      setPersonaSet(result.personaSet);
      setMessage({ type: 'success', text: 'Personas saved successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setIsSaving(false);
    }
  }, [companyId, personaSet]);

  const handleUpdateContextGraph = useCallback(async () => {
    if (!personaSet) return;

    setIsSaving(true);
    setMessage(null);

    try {
      // First save
      await handleSave();

      // Then update Context Graph
      const response = await fetch(`/api/audience/${companyId}/personas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateContextGraph: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update graph');
      }

      setMessage({
        type: 'success',
        text: `Updated ${result.fieldsUpdated.length} Context Graph fields.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update graph',
      });
    } finally {
      setIsSaving(false);
    }
  }, [companyId, personaSet, handleSave]);

  const handleAddPersona = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addPersona' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add persona');
      }

      setPersonaSet(result.personaSet);
      setSelectedPersonaId(result.persona.id);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add persona',
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const handleDeletePersona = useCallback(async (personaId: string) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/audience/${companyId}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePersona', personaId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete persona');
      }

      setPersonaSet(result.personaSet);
      if (selectedPersonaId === personaId) {
        setSelectedPersonaId(result.personaSet?.personas[0]?.id || null);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete persona',
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, selectedPersonaId]);

  const handleUpdatePersona = useCallback((personaId: string, updates: Partial<Persona>) => {
    if (!personaSet) return;

    setPersonaSet({
      ...personaSet,
      updatedAt: new Date().toISOString(),
      source: personaSet.source === 'ai_seeded' ? 'mixed' : personaSet.source,
      personas: personaSet.personas.map(p =>
        p.id === personaId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    });
  }, [personaSet]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* No Personas State */}
      {!personaSet && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            hasAudienceModel ? 'bg-purple-500/10' : 'bg-amber-500/10'
          }`}>
            <svg className={`w-8 h-8 ${hasAudienceModel ? 'text-purple-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            {hasAudienceModel ? 'No Personas Yet' : 'Create Segments First'}
          </h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            {hasAudienceModel
              ? 'Generate human-centered personas from your audience segments to guide creative and media teams.'
              : 'Personas are created from audience segments. Switch to the Segments tab and generate or create segments first.'}
          </p>

          {!hasAudienceModel && (
            <div className="mb-6 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 max-w-md mx-auto">
              <div className="flex items-start gap-3 text-left">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-amber-400">How to get started:</p>
                  <ol className="mt-1 text-slate-400 list-decimal list-inside space-y-1">
                    <li>Go to the <strong className="text-slate-300">Segments</strong> tab</li>
                    <li>Click <strong className="text-slate-300">Generate from Signals</strong></li>
                    <li>Come back here to generate personas</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleGeneratePersonas}
              disabled={isLoading || !hasAudienceModel}
              className={`rounded-lg px-5 py-2.5 font-medium text-sm flex items-center gap-2 ${
                hasAudienceModel
                  ? 'bg-purple-600 text-white hover:bg-purple-500'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              } disabled:opacity-50`}
              title={hasAudienceModel ? undefined : 'Create segments first'}
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
                  Generate Personas
                </>
              )}
            </button>
            <button
              onClick={handleAddPersona}
              disabled={isLoading}
              className="rounded-lg px-5 py-2.5 border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800"
            >
              Create Manually
            </button>
          </div>
        </div>
      )}

      {/* Personas UI */}
      {personaSet && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Persona List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Persona List */}
            <div className="space-y-2">
              {personaSet.personas.map(persona => (
                <button
                  key={persona.id}
                  onClick={() => setSelectedPersonaId(persona.id)}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    selectedPersonaId === persona.id
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100 text-sm">
                      {persona.name || 'Untitled Persona'}
                    </span>
                    {persona.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        persona.priority === 'primary'
                          ? 'bg-purple-500/20 text-purple-400'
                          : persona.priority === 'secondary'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {persona.priority}
                      </span>
                    )}
                  </div>
                  {persona.tagline && (
                    <span className="text-xs text-slate-500 mt-1 block italic">
                      {persona.tagline}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Add Persona Button */}
            <button
              onClick={handleAddPersona}
              disabled={isLoading}
              className="w-full rounded-lg p-3 border border-dashed border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Persona
            </button>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full rounded-lg px-4 py-2.5 bg-slate-800 text-slate-200 font-medium text-sm hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Spinner /> : null}
                Save Personas
              </button>

              <button
                onClick={handleUpdateContextGraph}
                disabled={isSaving}
                className="w-full rounded-lg px-4 py-2.5 bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Push to Context Graph
              </button>

              <button
                onClick={handleRegenerate}
                disabled={isLoading || !hasAudienceModel}
                className="w-full rounded-lg px-4 py-2.5 border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Spinner /> : null}
                Regenerate All
              </button>
            </div>

            {/* Set Info */}
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
              <div className="flex justify-between mb-1">
                <span>Personas</span>
                <span className="text-slate-400">{personaSet.personas.length}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Version</span>
                <span className="text-slate-400">v{personaSet.version}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Source</span>
                <span className="text-slate-400">{personaSet.source}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span className="text-slate-400">
                  {new Date(personaSet.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Persona Editor */}
          <div className="lg:col-span-2">
            {selectedPersona ? (
              <PersonaEditor
                persona={selectedPersona}
                onUpdate={(updates) => handleUpdatePersona(selectedPersona.id, updates)}
                onDelete={() => handleDeletePersona(selectedPersona.id)}
              />
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
                <p className="text-slate-400">
                  Select a persona to edit, or add a new one.
                </p>
              </div>
            )}
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

function PersonaEditor({
  persona,
  onUpdate,
  onDelete,
}: {
  persona: Persona;
  onUpdate: (updates: Partial<Persona>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={persona.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Persona Name"
            className="text-xl font-semibold text-slate-100 bg-transparent border-none outline-none w-full placeholder-slate-600"
          />
          <input
            type="text"
            value={persona.tagline || ''}
            onChange={(e) => onUpdate({ tagline: e.target.value })}
            placeholder="A catchy tagline for this persona..."
            className="mt-1 w-full text-sm text-purple-400 italic bg-transparent border-none outline-none placeholder-slate-600"
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

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
        <select
          value={persona.priority || ''}
          onChange={(e) => onUpdate({ priority: e.target.value as 'primary' | 'secondary' | 'tertiary' || undefined })}
          className="w-48 rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200"
        >
          <option value="">Not set</option>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="tertiary">Tertiary</option>
        </select>
      </div>

      {/* One Sentence Summary */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">One-Sentence Summary</label>
        <textarea
          value={persona.oneSentenceSummary || ''}
          onChange={(e) => onUpdate({ oneSentenceSummary: e.target.value })}
          placeholder="Capture who this person is in one sentence..."
          rows={2}
          className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
        />
      </div>

      {/* Backstory */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Backstory</label>
        <textarea
          value={persona.backstory || ''}
          onChange={(e) => onUpdate({ backstory: e.target.value })}
          placeholder="Tell this persona's story - their life, work, and how they came to need your product..."
          rows={4}
          className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
        />
      </div>

      {/* Day in the Life */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">A Day in Their Life</label>
        <textarea
          value={persona.dayInTheLife || ''}
          onChange={(e) => onUpdate({ dayInTheLife: e.target.value })}
          placeholder="Describe a typical day including when they might encounter your brand..."
          rows={3}
          className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
        />
      </div>

      {/* Array Fields */}
      <ArrayField
        label="Jobs to be Done"
        values={persona.jobsToBeDone}
        onChange={(values) => onUpdate({ jobsToBeDone: values })}
        placeholder="Functional, emotional, and social jobs..."
      />

      <ArrayField
        label="Triggers"
        values={persona.triggers}
        onChange={(values) => onUpdate({ triggers: values })}
        placeholder="What prompts them to start looking for a solution?"
      />

      <ArrayField
        label="Objections"
        values={persona.objections}
        onChange={(values) => onUpdate({ objections: values })}
        placeholder="Their hesitations and concerns..."
      />

      <ArrayField
        label="Decision Factors"
        values={persona.decisionFactors}
        onChange={(values) => onUpdate({ decisionFactors: values })}
        placeholder="What do they weigh when making a decision?"
      />

      <ArrayField
        label="Key Messages"
        values={persona.keyMessages}
        onChange={(values) => onUpdate({ keyMessages: values })}
        placeholder="Core messages that will resonate..."
      />

      <ArrayField
        label="Proof Points"
        values={persona.proofPoints}
        onChange={(values) => onUpdate({ proofPoints: values })}
        placeholder="Types of evidence they need..."
      />

      <ArrayField
        label="Example Hooks"
        values={persona.exampleHooks}
        onChange={(values) => onUpdate({ exampleHooks: values })}
        placeholder="Attention-grabbing headlines or hooks..."
      />

      {/* Tone Guidance */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Tone Guidance</label>
        <textarea
          value={persona.toneGuidance || ''}
          onChange={(e) => onUpdate({ toneGuidance: e.target.value })}
          placeholder="How to speak to this persona - formal/casual, technical/simple..."
          rows={2}
          className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
        />
      </div>

      {/* Media Habits */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Media Habits</label>
        <textarea
          value={persona.mediaHabits || ''}
          onChange={(e) => onUpdate({ mediaHabits: e.target.value })}
          placeholder="Where and how they consume media throughout their day..."
          rows={2}
          className="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 resize-none"
        />
      </div>

      {/* Channels */}
      <div className="grid grid-cols-2 gap-4">
        <ArrayField
          label="Channels to Use"
          values={persona.channelsToUse}
          onChange={(values) => onUpdate({ channelsToUse: values })}
          placeholder="Priority channels..."
        />
        <ArrayField
          label="Channels to Avoid"
          values={persona.channelsToAvoid}
          onChange={(values) => onUpdate({ channelsToAvoid: values })}
          placeholder="Ineffective channels..."
        />
      </div>

      {/* Content Formats */}
      <ArrayField
        label="Preferred Content Formats"
        values={persona.contentFormatsPreferred}
        onChange={(values) => onUpdate({ contentFormatsPreferred: values })}
        placeholder="Video, UGC, Testimonials, How-to guides..."
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
