// hooks/useDraftableResource.ts
// Generic hook for managing draftable resources
//
// Provides a unified state machine for Context, Strategy, Creative Strategy, and Work Plan
// resources that support AI-generated drafts.
//
// TRUST: This hook enforces dirty-state awareness for regeneration to prevent
// clobbering unsaved user edits.

'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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

/** Result type for save operations that include revision tracking */
export interface SaveResult<T> {
  /** The saved resource */
  data: T;
  /** Revision identifier (typically updatedAt timestamp) */
  revisionId: string;
}

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
  /** Whether there are unsaved changes (dirty state) */
  isDirty: boolean;
  /** Last saved revision ID for optimistic locking */
  lastSavedRevisionId: string | null;
  /** Error message if any */
  error: string | null;
  /** Handle running diagnostics + generating draft */
  handleGenerate: () => Promise<void>;
  /** Handle regenerating draft from existing data (returns false if blocked by dirty state) */
  handleRegenerate: () => Promise<boolean>;
  /** Handle saving the current values - returns SaveResult with revisionId */
  handleSave: (saveContext: (values: T) => Promise<SaveResult<T>>) => Promise<SaveResult<T> | null>;
  /** Clear error */
  clearError: () => void;
  /** Reset dirty state (call after successful save) */
  resetDirtyState: () => void;
  /** Check if regenerate would clobber unsaved changes */
  wouldClobberChanges: () => boolean;
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

  // TRUST: Track the last saved state to detect dirty changes
  const savedValuesRef = useRef<T | null>(initialState.saved);
  const [lastSavedRevisionId, setLastSavedRevisionId] = useState<string | null>(
    // Initialize from saved context's updatedAt if available
    initialState.saved && typeof initialState.saved === 'object' && 'updatedAt' in initialState.saved
      ? (initialState.saved as { updatedAt?: string }).updatedAt ?? null
      : null
  );

  // TRUST: Compute dirty state by comparing current values to saved values
  const isDirty = useMemo(() => {
    // If no saved state, form is always "dirty" in the sense of having unsaved changes
    // But we only consider it dirty for regeneration blocking if there's meaningful content
    if (!savedValuesRef.current) {
      // Check if formValues has any meaningful content
      if (typeof formValues === 'object' && formValues !== null) {
        const values = formValues as Record<string, unknown>;
        return Object.values(values).some(v => v !== null && v !== undefined && v !== '');
      }
      return false;
    }

    // Deep compare current form values to saved values
    try {
      const currentStr = JSON.stringify(formValues);
      const savedStr = JSON.stringify(savedValuesRef.current);
      return currentStr !== savedStr;
    } catch {
      // If serialization fails, assume dirty to be safe
      return true;
    }
  }, [formValues]);

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
  // TRUST: Check if regenerate would clobber unsaved changes
  // ============================================================================
  const wouldClobberChanges = useCallback(() => {
    return isDirty && hasSaved;
  }, [isDirty, hasSaved]);

  // ============================================================================
  // Handle Regenerate (runs fresh competition + regenerates draft)
  // TRUST: Returns false if blocked by dirty state - caller should show modal
  // ============================================================================
  const handleRegenerate = useCallback(async (): Promise<boolean> => {
    console.log('=== [useDraftableResource] handleRegenerate CALLED ===');
    console.log('[useDraftableResource] regenerateEndpoint:', regenerateEndpoint);
    console.log('[useDraftableResource] isDirty:', isDirty, 'isSaving:', isSaving);

    // TRUST: Block regeneration while save is in-flight to prevent race conditions
    if (isSaving) {
      console.log('[useDraftableResource] Blocked: save in progress');
      setError('Please wait for save to complete before regenerating.');
      return false;
    }

    // TRUST: If dirty, don't proceed - caller should show confirmation modal
    // This check is intentionally done here so the caller can handle the UX
    if (isDirty && hasSaved) {
      console.log('[useDraftableResource] Dirty state detected, returning false for modal handling');
      // Don't set error here - let the caller show a modal instead
      return false;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      // Include baseRevisionId for optimistic locking on the server
      console.log('[useDraftableResource] Calling regenerate with forceCompetition: true, baseRevisionId:', lastSavedRevisionId);
      const response = await fetch(regenerateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          kind,
          forceCompetition: true,
          baseRevisionId: lastSavedRevisionId,
        }),
      });

      const data: DraftRegenerateResponse<T> = await response.json();

      // TRUST: Handle stale revision conflict (409)
      if (response.status === 409) {
        setError('Context was modified elsewhere. Please refresh and try again.');
        return false;
      }

      if (data.error === 'INSUFFICIENT_SIGNAL') {
        // No baseline available - this is expected in some cases
        setError(data.message || 'No baseline data available.');
        return false;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to regenerate draft');
      }

      // Update state with regenerated draft
      // TRUST: This creates a NEW draft, it doesn't replace saved context
      if (data.draft) {
        const draftValue = extractDraftValue<T>(data.draft, kind);
        setFormValues(draftValue);
        setSource('ai_draft');
        onDraftGenerated?.(draftValue);
      }

      return true;
    } catch (err) {
      console.error('[useDraftableResource] Regenerate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate draft');
      return false;
    } finally {
      setIsRegenerating(false);
    }
  }, [companyId, kind, regenerateEndpoint, onDraftGenerated, isDirty, isSaving, hasSaved, lastSavedRevisionId]);

  // ============================================================================
  // Handle Save
  // TRUST: Returns SaveResult with revisionId for tracking
  // ============================================================================
  const handleSave = useCallback(
    async (saveContext: (values: T) => Promise<SaveResult<T>>): Promise<SaveResult<T> | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const result = await saveContext(formValues);

        // TRUST: Update saved state reference and revision ID
        savedValuesRef.current = result.data;
        setLastSavedRevisionId(result.revisionId);
        setSource('user_saved');

        console.log('[useDraftableResource] Saved successfully, revisionId:', result.revisionId);
        onSaveComplete?.(result.data);

        return result;
      } catch (err) {
        console.error('[useDraftableResource] Save error:', err);
        setError(err instanceof Error ? err.message : 'Failed to save');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [formValues, onSaveComplete]
  );

  // ============================================================================
  // TRUST: Reset dirty state (useful after external saves)
  // ============================================================================
  const resetDirtyState = useCallback(() => {
    savedValuesRef.current = formValues;
  }, [formValues]);

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
    isDirty,
    lastSavedRevisionId,
    error,
    handleGenerate,
    handleRegenerate,
    handleSave,
    clearError,
    resetDirtyState,
    wouldClobberChanges,
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
