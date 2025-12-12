// hooks/useDraftableResource.ts
// Generic hook for managing draftable resources
//
// Provides a unified state machine for Context, Strategy, Creative Strategy, and Work Plan
// resources that support AI-generated drafts.

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  DraftableResourceKind,
  DraftSource,
  DraftableState,
  DraftRunResponse,
  DraftRegenerateResponse,
} from '@/lib/os/draft/types';

// ============================================================================
// Types
// ============================================================================

interface UseDraftableResourceOptions<T> {
  /** Company ID */
  companyId: string;
  /** Resource kind */
  kind: DraftableResourceKind;
  /** Initial state from server */
  initialState: DraftableState<T>;
  /** Custom API endpoints (optional - defaults to /api/os/draft/run and /api/os/draft/regenerate) */
  endpoints?: {
    run?: string;
    regenerate?: string;
  };
  /** Callback when draft is generated */
  onDraftGenerated?: (draft: T) => void;
  /** Callback when save completes */
  onSaveComplete?: (saved: T) => void;
}

interface UseDraftableResourceReturn<T> {
  /** Current form values (from saved, draft, or defaults) */
  formValues: T;
  /** Update form values */
  setFormValues: React.Dispatch<React.SetStateAction<T>>;
  /** Source of current form values */
  source: DraftSource;
  /** Whether prerequisites are ready for draft generation */
  prereqsReady: boolean;
  /** Whether to show the "Run Diagnostics" button */
  shouldShowGenerateButton: boolean;
  /** Whether a draft is currently being generated */
  isGenerating: boolean;
  /** Whether the form is being saved */
  isSaving: boolean;
  /** Whether we're regenerating from existing data */
  isRegenerating: boolean;
  /** Whether the current values are from a draft (unsaved) */
  isDraft: boolean;
  /** Error message if any */
  error: string | null;
  /** Handle running diagnostics + generating draft */
  handleGenerate: () => Promise<void>;
  /** Handle regenerating draft from existing data */
  handleRegenerate: () => Promise<void>;
  /** Handle saving the current values */
  handleSave: (saveContext: (values: T) => Promise<T>) => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDraftableResource<T>({
  companyId,
  kind,
  initialState,
  endpoints,
  onDraftGenerated,
  onSaveComplete,
}: UseDraftableResourceOptions<T>): UseDraftableResourceReturn<T> {
  // Derive initial form values from state
  const getInitialFormValues = useCallback((): T => {
    if (initialState.saved) {
      return initialState.saved;
    }
    if (initialState.draft) {
      return initialState.draft;
    }
    // Return empty object as T - caller should handle defaults
    return {} as T;
  }, [initialState.saved, initialState.draft]);

  // State
  const [formValues, setFormValues] = useState<T>(getInitialFormValues);
  const [source, setSource] = useState<DraftSource>(initialState.source);
  const [prereqsReady, setPrereqsReady] = useState(initialState.prereqsReady);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const isDraft = source === 'ai_draft';
  const hasSaved = initialState.saved !== null;

  // Should show generate button: no prereqs + no saved + not generating
  const shouldShowGenerateButton = useMemo(() => {
    return !prereqsReady && !hasSaved && !isGenerating;
  }, [prereqsReady, hasSaved, isGenerating]);

  // API endpoints
  const runEndpoint = endpoints?.run ?? '/api/os/draft/run';
  const regenerateEndpoint = endpoints?.regenerate ?? '/api/os/draft/regenerate';

  // ============================================================================
  // Auto-generate on mount if prereqs ready but no saved and no draft
  // ============================================================================
  useEffect(() => {
    // Auto-generate if: prereqs ready, no saved content, no draft, and not already generating
    if (prereqsReady && !hasSaved && !initialState.draft && !isGenerating && !isRegenerating) {
      handleRegenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Handle Generate (runs diagnostics first)
  // ============================================================================
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Always force fresh competition when user clicks "Run Diagnostics"
      const response = await fetch(runEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, kind, forceCompetition: true }),
      });

      const data: DraftRunResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to generate draft');
      }

      // Update state with new draft
      if (data.draft) {
        // Extract the context/resource from the draft data structure
        const draftValue = extractDraftValue<T>(data.draft, kind);
        setFormValues(draftValue);
        setSource('ai_draft');
        setPrereqsReady(data.prereqsReady);
        onDraftGenerated?.(draftValue);
      }
    } catch (err) {
      console.error('[useDraftableResource] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setIsGenerating(false);
    }
  }, [companyId, kind, runEndpoint, onDraftGenerated]);

  // ============================================================================
  // Handle Regenerate (runs fresh competition + regenerates draft)
  // ============================================================================
  const handleRegenerate = useCallback(async () => {
    console.log('=== [useDraftableResource] handleRegenerate CALLED ===');
    console.log('[useDraftableResource] regenerateEndpoint:', regenerateEndpoint);
    setIsRegenerating(true);
    setError(null);

    try {
      // Always force fresh competition when user clicks "Regenerate from diagnostics"
      console.log('[useDraftableResource] Calling regenerate with forceCompetition: true');
      const response = await fetch(regenerateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, kind, forceCompetition: true }),
      });

      const data: DraftRegenerateResponse<T> = await response.json();

      if (data.error === 'INSUFFICIENT_SIGNAL') {
        // No baseline available - this is expected in some cases
        setError(data.message || 'No baseline data available.');
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to regenerate draft');
      }

      // Update state with regenerated draft
      if (data.draft) {
        const draftValue = extractDraftValue<T>(data.draft, kind);
        setFormValues(draftValue);
        setSource('ai_draft');
        onDraftGenerated?.(draftValue);
      }
    } catch (err) {
      console.error('[useDraftableResource] Regenerate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate draft');
    } finally {
      setIsRegenerating(false);
    }
  }, [companyId, kind, regenerateEndpoint, onDraftGenerated]);

  // ============================================================================
  // Handle Save
  // ============================================================================
  const handleSave = useCallback(
    async (saveContext: (values: T) => Promise<T>) => {
      setIsSaving(true);
      setError(null);

      try {
        const saved = await saveContext(formValues);
        setSource('user_saved');
        onSaveComplete?.(saved);
      } catch (err) {
        console.error('[useDraftableResource] Save error:', err);
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    [formValues, onSaveComplete]
  );

  // ============================================================================
  // Clear Error
  // ============================================================================
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    formValues,
    setFormValues,
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
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract the actual resource value from the draft data structure.
 * Different resource kinds have different draft structures.
 */
function extractDraftValue<T>(draft: unknown, kind: DraftableResourceKind): T {
  if (!draft || typeof draft !== 'object') {
    return {} as T;
  }

  const draftObj = draft as Record<string, unknown>;

  switch (kind) {
    case 'context':
      // ContextDraftData has { context: CompanyContext, source, createdAt, summary }
      return (draftObj.context ?? draftObj) as T;

    case 'strategy':
      // StrategyDraftData has { strategyJson, ... }
      return (draftObj.strategyJson ?? draftObj) as T;

    case 'creative_strategy':
      return (draftObj.creativeStrategyJson ?? draftObj) as T;

    case 'work_plan':
      return (draftObj.workPlanJson ?? draftObj) as T;

    default:
      return draft as T;
  }
}
