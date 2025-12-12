'use client';

// app/c/[companyId]/context/ContextWorkspaceClient.tsx
// Context Workspace Client Component
//
// Uses the Draftable Resource framework for unified draft management.
// Provides the context editing form with:
// - Run Diagnostics button (when no prereqs)
// - Auto-generated drafts (when prereqs ready)
// - Regenerate link (when saved context exists)

import { useCallback, useEffect } from 'react';
import {
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Users,
  Target,
  AlertTriangle,
  Lightbulb,
  Play,
  RefreshCw,
} from 'lucide-react';
import type { CompanyContext, Competitor } from '@/lib/types/context';
import type { DraftableState } from '@/lib/os/draft/types';
import type { DiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';
import { useDraftableResource } from '@/hooks/useDraftableResource';
import { CompetitorEditor } from '@/components/context/CompetitorEditor';
import { DiagnosticsDebugDrawer } from '@/components/context/DiagnosticsDebugDrawer';

// ============================================================================
// Types
// ============================================================================

interface ContextWorkspaceClientProps {
  companyId: string;
  companyName: string;
  initialState: DraftableState<CompanyContext>;
  debugInfo?: DiagnosticsDebugInfo;
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextWorkspaceClient({
  companyId,
  companyName,
  initialState,
  debugInfo,
}: ContextWorkspaceClientProps) {
  // Use the generic draftable resource hook
  const {
    formValues: context,
    setFormValues: setContext,
    source,
    prereqsReady,
    shouldShowGenerateButton,
    isGenerating,
    isSaving,
    isRegenerating,
    isDraft,
    error,
    handleGenerate,
    handleRegenerate,
    handleSave,
    clearError,
  } = useDraftableResource<CompanyContext>({
    companyId,
    kind: 'context',
    initialState,
  });

  // ============================================================================
  // Field Update Handlers
  // ============================================================================

  const updateField = useCallback(
    <K extends keyof CompanyContext>(field: K, value: CompanyContext[K]) => {
      setContext(prev => ({ ...prev, [field]: value }));
    },
    [setContext]
  );

  const updateObjectives = useCallback((index: number, value: string) => {
    setContext(prev => {
      const objectives = [...(prev.objectives || [])];
      objectives[index] = value;
      return { ...prev, objectives };
    });
  }, [setContext]);

  const addObjective = useCallback(() => {
    setContext(prev => ({
      ...prev,
      objectives: [...(prev.objectives || []), ''],
    }));
  }, [setContext]);

  const removeObjective = useCallback((index: number) => {
    setContext(prev => ({
      ...prev,
      objectives: (prev.objectives || []).filter((_, i) => i !== index),
    }));
  }, [setContext]);

  const updateCompetitors = useCallback((competitors: Competitor[]) => {
    setContext(prev => ({ ...prev, competitors }));
  }, [setContext]);

  // [TEMP DEBUG] Log competition data for freshness verification
  useEffect(() => {
    if (context.competitors && context.competitors.length > 0) {
      console.log('[Context:CompetitorDebug] Competition data loaded:', {
        competitorCount: context.competitors.length,
        topDomains: context.competitors.slice(0, 5).map(c => c.domain),
        sources: [...new Set(context.competitors.map(c => c.source))],
      });
    }
  }, [context.competitors]);

  // ============================================================================
  // Save Handler
  // ============================================================================

  const saveContext = useCallback(async (values: CompanyContext): Promise<CompanyContext> => {
    const response = await fetch('/api/os/context/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        updates: values,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to save context');
    }

    // Clear draft after successful save
    await fetch('/api/os/context/discard-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    }).catch(() => {/* ignore errors */});

    return data.context ?? values;
  }, [companyId]);

  const onSave = useCallback(async () => {
    await handleSave(saveContext);
  }, [handleSave, saveContext]);

  // ============================================================================
  // Render: No Prerequisites - Show Run Diagnostics button
  // ============================================================================

  if (shouldShowGenerateButton) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            Context for {companyName}
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Run diagnostics to analyze your digital footprint, competitors, and auto-generate context.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-left max-w-md mx-auto">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-cyan-500 text-slate-900 rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Diagnostics...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Diagnostics
              </>
            )}
          </button>

          {isGenerating && (
            <p className="text-xs text-slate-500 mt-3">
              This may take 1-2 minutes...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Loading state (auto-generating or regenerating without content)
  // ============================================================================

  if ((isRegenerating || isGenerating) && !context.businessModel && !context.primaryAudience) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">
            Generating Context...
          </h1>
          <p className="text-sm text-slate-400">
            Analyzing baseline data and building your context draft.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Main Form
  // ============================================================================

  const hasSaved = initialState.saved !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Company Context
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Strategic context for {companyName}
            {isDraft && (
              <span className="ml-2 text-purple-400">(draft - save to confirm)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Regenerate link (when saved context exists) */}
          {hasSaved && prereqsReady && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="text-sm text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Regenerating...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate from diagnostics
                </span>
              )}
            </button>
          )}

          {/* Save button */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              source === 'user_saved' && !isDraft
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : error
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : source === 'user_saved' && !isDraft ? (
              <CheckCircle className="w-4 h-4" />
            ) : error ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving
              ? 'Saving...'
              : source === 'user_saved' && !isDraft
              ? 'Saved'
              : error
              ? 'Error'
              : 'Save Context'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={clearError} className="text-xs text-red-400 hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      {/* Context Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Section */}
        <ContextSection
          icon={<BookOpen className="w-4 h-4" />}
          title="Business Fundamentals"
        >
          <ContextField
            label="Business Model"
            value={context.businessModel || ''}
            onChange={v => updateField('businessModel', v)}
            placeholder="How does the business create and deliver value?"
            multiline
          />
          <ContextField
            label="Value Proposition"
            value={context.valueProposition || ''}
            onChange={v => updateField('valueProposition', v)}
            placeholder="What unique value does the company offer?"
            multiline
          />
          <ContextField
            label="Company Category"
            value={context.companyCategory || ''}
            onChange={v => updateField('companyCategory', v)}
            placeholder="e.g., SaaS, E-commerce, Local Service"
          />
        </ContextSection>

        {/* Audience Section */}
        <ContextSection
          icon={<Users className="w-4 h-4" />}
          title="Audience & ICP"
        >
          <ContextField
            label="Primary Audience"
            value={context.primaryAudience || ''}
            onChange={v => updateField('primaryAudience', v)}
            placeholder="Who is the primary target audience?"
            multiline
          />
          <ContextField
            label="Secondary Audience"
            value={context.secondaryAudience || ''}
            onChange={v => updateField('secondaryAudience', v)}
            placeholder="Any secondary audiences?"
          />
          <ContextField
            label="ICP Description"
            value={context.icpDescription || ''}
            onChange={v => updateField('icpDescription', v)}
            placeholder="Detailed ideal customer profile"
            multiline
          />
        </ContextSection>

        {/* Objectives Section */}
        <ContextSection
          icon={<Target className="w-4 h-4" />}
          title="Objectives & Goals"
        >
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">
              Key Objectives
            </label>
            {(context.objectives || []).map((obj, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={obj}
                  onChange={e => updateObjectives(index, e.target.value)}
                  placeholder={`Objective ${index + 1}`}
                  className="flex-1 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => removeObjective(index)}
                  className="p-2 text-slate-500 hover:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
            <button
              onClick={addObjective}
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              + Add Objective
            </button>
          </div>
        </ContextSection>

        {/* Constraints Section */}
        <ContextSection
          icon={<AlertTriangle className="w-4 h-4" />}
          title="Constraints & Considerations"
        >
          <ContextField
            label="Constraints"
            value={context.constraints || ''}
            onChange={v => updateField('constraints', v)}
            placeholder="Budget limits, resource constraints, timing..."
            multiline
          />
          <ContextField
            label="Budget"
            value={context.budget || ''}
            onChange={v => updateField('budget', v)}
            placeholder="Marketing budget range"
          />
          <ContextField
            label="Timeline"
            value={context.timeline || ''}
            onChange={v => updateField('timeline', v)}
            placeholder="Key timelines or deadlines"
          />
        </ContextSection>

        {/* Competition Section */}
        <ContextSection
          icon={<Lightbulb className="w-4 h-4" />}
          title="Competitive Landscape"
          fullWidth
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Competitors
              </label>
              <CompetitorEditor
                competitors={context.competitors || []}
                onChange={updateCompetitors}
              />
            </div>
            <ContextField
              label="Competitive Notes"
              value={context.competitorsNotes || ''}
              onChange={v => updateField('competitorsNotes', v)}
              placeholder="High-level notes on competitive dynamics, positioning..."
              multiline
              rows={2}
            />
          </div>
        </ContextSection>

        {/* Notes Section */}
        <ContextSection
          icon={<BookOpen className="w-4 h-4" />}
          title="Additional Notes"
        >
          <ContextField
            label="Notes"
            value={context.notes || ''}
            onChange={v => updateField('notes', v)}
            placeholder="Any other relevant context..."
            multiline
            rows={6}
          />
        </ContextSection>
      </div>

      {/* Last updated */}
      {context.updatedAt && (
        <p className="text-xs text-slate-500 text-right">
          Last updated: {new Date(context.updatedAt).toLocaleString()}
        </p>
      )}

      {/* Debug Drawer */}
      {debugInfo && <DiagnosticsDebugDrawer debugInfo={debugInfo} />}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ContextSection({
  icon,
  title,
  children,
  fullWidth,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-5 ${fullWidth ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="text-cyan-400">{icon}</div>
        <h2 className="text-sm font-medium text-slate-200">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ContextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const inputClasses =
    'w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none';

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={inputClasses}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}
    </div>
  );
}
