'use client';

// components/os/strategy/ProgramsSummaryCard.tsx
// Strategy → Programs → Work Handoff: Draft Management Card
//
// AI-FIRST FLOW:
// 1. User clicks "Generate Programs" → creates draft (no canonical writes)
// 2. User reviews draft programs/initiatives/work items
// 3. User clicks "Apply" → creates canonical Work Items with dedupe
// 4. User can "Discard" to cancel
//
// Shows:
// - Pending draft count with stats
// - Apply/Discard buttons when draft exists
// - Generate button when no draft

import React, { useState, useCallback, useEffect } from 'react';
import {
  Rocket,
  Loader2,
  ArrowRight,
  CheckCircle2,
  X,
  AlertCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { DraftProgram, GenerateHandoffResponse, ApplyHandoffResponse } from '@/lib/types/programHandoff';

// ============================================================================
// Types
// ============================================================================

interface ProgramsSummaryCardProps {
  companyId: string;
  strategyId: string;
  tacticIds: string[];
  /** IDs of tactics that have already been promoted to work */
  promotedTacticIds?: string[];
  /** Callback when user wants to promote specific tactics */
  onPromoteTactics?: (tacticIds: string[]) => void;
  /** Callback when draft state changes */
  onDraftStateChange?: (hasDraft: boolean) => void;
}

interface DraftState {
  draftId: string;
  draftKey: string;
  programs: DraftProgram[];
  reasoning: string;
  warnings: string[];
  tacticIds: string[];
  stats: {
    programCount: number;
    initiativeCount: number;
    workItemCount: number;
  };
}

// ============================================================================
// Component
// ============================================================================

export function ProgramsSummaryCard({
  companyId,
  strategyId,
  tacticIds,
  promotedTacticIds = [],
  onPromoteTactics,
  onDraftStateChange,
}: ProgramsSummaryCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyHandoffResponse | null>(null);

  // Fetch existing draft on mount
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/programs/from-strategy?strategyId=${strategyId}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch draft');
        }

        const data = await response.json();

        if (data.draft) {
          setDraft({
            draftId: data.draft.id,
            draftKey: data.draft.draftKey,
            programs: data.draft.programs,
            reasoning: data.draft.reasoning,
            warnings: data.draft.warnings,
            tacticIds: data.draft.tacticIds,
            stats: data.stats,
          });
          onDraftStateChange?.(true);
        } else {
          onDraftStateChange?.(false);
        }
      } catch (err) {
        console.error('[ProgramsSummaryCard] Error fetching draft:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDraft();
  }, [companyId, strategyId, onDraftStateChange]);

  // Generate new draft
  const handleGenerate = useCallback(async () => {
    if (tacticIds.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setApplyResult(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/programs/from-strategy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId,
            tacticIds,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to generate programs');
      }

      const data: GenerateHandoffResponse = await response.json();

      setDraft({
        draftId: data.draftId,
        draftKey: data.draftKey,
        programs: data.programs,
        reasoning: data.reasoning,
        warnings: data.warnings,
        tacticIds: tacticIds,
        stats: data.stats,
      });
      onDraftStateChange?.(true);

      console.log('[ProgramsSummaryCard] Generated draft:', {
        draftId: data.draftId,
        stats: data.stats,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      console.error('[ProgramsSummaryCard] Error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [companyId, strategyId, tacticIds, onDraftStateChange]);

  // Apply draft
  const handleApply = useCallback(async () => {
    if (!draft) return;

    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/programs/apply-draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: draft.draftId,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to apply draft');
      }

      const data: ApplyHandoffResponse = await response.json();
      setApplyResult(data);
      setDraft(null);
      onDraftStateChange?.(false);

      console.log('[ProgramsSummaryCard] Applied draft:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
      console.error('[ProgramsSummaryCard] Apply error:', err);
    } finally {
      setIsApplying(false);
    }
  }, [companyId, draft, onDraftStateChange]);

  // Discard draft
  const handleDiscard = useCallback(async () => {
    if (!draft) return;

    setIsDiscarding(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/programs/discard-draft?draftId=${draft.draftId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to discard draft');
      }

      setDraft(null);
      onDraftStateChange?.(false);

      console.log('[ProgramsSummaryCard] Discarded draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discard failed');
      console.error('[ProgramsSummaryCard] Discard error:', err);
    } finally {
      setIsDiscarding(false);
    }
  }, [companyId, draft, onDraftStateChange]);

  const tacticCount = tacticIds.length;
  const unpromoted = tacticIds.filter(id => !promotedTacticIds.includes(id));

  // Loading state
  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  // If no tactics, don't show the card
  if (tacticCount === 0) {
    return null;
  }

  // Show apply success result
  if (applyResult) {
    return (
      <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">
            Work Items Created
          </span>
        </div>
        <div className="text-xs text-slate-300 mb-3">
          {applyResult.workItemIds.length} work item{applyResult.workItemIds.length !== 1 ? 's' : ''} created
          {applyResult.skippedCount > 0 && ` • ${applyResult.skippedCount} skipped (already exist)`}
        </div>
        {applyResult.errors.length > 0 && (
          <div className="text-xs text-amber-400 mb-2">
            {applyResult.errors.length} error{applyResult.errors.length !== 1 ? 's' : ''}
          </div>
        )}
        <Link
          href={`/c/${companyId}/work`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
        >
          View Work Items
          <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={() => setApplyResult(null)}
          className="ml-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Show pending draft with Apply/Discard
  if (draft) {
    return (
      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-400">
              Draft Ready
            </span>
          </div>
          <div className="text-xs text-slate-400">
            AI-generated
          </div>
        </div>

        <div className="text-xs text-slate-300 mb-3">
          {draft.stats.programCount} program{draft.stats.programCount !== 1 ? 's' : ''} •{' '}
          {draft.stats.initiativeCount} initiative{draft.stats.initiativeCount !== 1 ? 's' : ''} •{' '}
          {draft.stats.workItemCount} work item{draft.stats.workItemCount !== 1 ? 's' : ''}
        </div>

        {/* Program preview */}
        <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
          {draft.programs.map((program, idx) => (
            <div
              key={idx}
              className="p-2 bg-slate-800/50 rounded text-xs"
            >
              <div className="font-medium text-white">{program.title}</div>
              <div className="text-slate-400 mt-0.5 line-clamp-2">{program.summary}</div>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {draft.warnings.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded mb-3">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-400">
              {draft.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 mb-2">{error}</div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={isApplying || isDiscarding}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Apply & Create Work
              </>
            )}
          </button>
          <button
            onClick={handleDiscard}
            disabled={isApplying || isDiscarding}
            className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50"
          >
            {isDiscarding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2 text-center">
          Review the draft, then Apply to create Work Items
        </p>
      </div>
    );
  }

  // Default: Show generate button
  return (
    <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-slate-300">
            Programs
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {unpromoted.length} tactic{unpromoted.length !== 1 ? 's' : ''} ready
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Convert tactics into actionable work items. AI generates a draft for your review.
      </p>

      {error && (
        <div className="text-xs text-red-400 mb-2">{error}</div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isGenerating || unpromoted.length === 0}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating Draft...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Generate Programs Draft
          </>
        )}
      </button>

      <Link
        href={`/c/${companyId}/work`}
        className="block mt-2 text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        View existing work items →
      </Link>
    </div>
  );
}

export default ProgramsSummaryCard;
