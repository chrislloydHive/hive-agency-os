// components/flows/PrescribeWorkModal.tsx
// Prescribe Work Modal
//
// Allows users to directly prescribe work without AI discovery.
// Used when users already know what needs to be done.
//
// Features:
// - Work type selection (SEO copy, landing page copy, page edits, other)
// - Scope and goal inputs
// - Optional AI brief generation for better execution guidance

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ClipboardEdit, X, Sparkles, Info } from 'lucide-react';

/**
 * Work types available for prescription
 */
export type PrescribedWorkType = 'seo_copy' | 'landing_page_copy' | 'page_edits' | 'other';

export const PRESCRIBED_WORK_TYPES: Record<PrescribedWorkType, { label: string; description: string }> = {
  seo_copy: {
    label: 'SEO Copy Updates',
    description: 'Title tags, meta descriptions, headings, body copy optimizations',
  },
  landing_page_copy: {
    label: 'Landing Page Copy',
    description: 'Hero headlines, value props, CTAs, conversion copy',
  },
  page_edits: {
    label: 'Page Edits',
    description: 'Layout changes, content restructuring, UX improvements',
  },
  other: {
    label: 'Other',
    description: 'Custom work not covered by other categories',
  },
};

export interface PrescribedWorkData {
  workType: PrescribedWorkType;
  scope: string;
  goal: string;
  notes?: string;
  aiAssist?: boolean;
}

/**
 * Result from work item creation
 */
export interface PrescribedWorkResult {
  workItemId: string;
}

interface PrescribeWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Creates work item and returns the ID */
  onSubmit: (data: PrescribedWorkData) => Promise<PrescribedWorkResult>;
  /** Called after everything is done (including AI brief if enabled) */
  onComplete: () => void;
  companyId: string;
  companyName: string;
}

export function PrescribeWorkModal({
  isOpen,
  onClose,
  onSubmit,
  onComplete,
  companyId,
  companyName,
}: PrescribeWorkModalProps) {
  const router = useRouter();
  const [workType, setWorkType] = useState<PrescribedWorkType | null>(null);
  const [scope, setScope] = useState('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [aiAssist, setAiAssist] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setWorkType(null);
      setScope('');
      setGoal('');
      setNotes('');
      setAiAssist(true);
      setError(null);
      setSubmitting(false);
      setGeneratingBrief(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting && !generatingBrief) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, submitting, generatingBrief, onClose]);

  if (!isOpen) return null;

  const isValid = workType && scope.trim() && goal.trim();
  const isProcessing = submitting || generatingBrief;

  const handleSubmit = async () => {
    if (!isValid || !workType) return;

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Create the work item
      const result = await onSubmit({
        workType,
        scope: scope.trim(),
        goal: goal.trim(),
        notes: notes.trim() || undefined,
        aiAssist,
      });

      // Step 2: If AI assist is enabled, generate the brief and navigate to it
      if (aiAssist && result.workItemId) {
        setSubmitting(false);
        setGeneratingBrief(true);

        try {
          console.log('[PrescribeWork] Calling AI brief endpoint...', {
            companyId,
            workItemId: result.workItemId,
            workType,
          });

          const briefResponse = await fetch(`/api/os/companies/${companyId}/work/prescribe/ai-brief`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workItemId: result.workItemId,
              projectContext: 'website_optimization',
              workType,
              scope: scope.trim(),
              goal: goal.trim(),
              notes: notes.trim() || undefined,
            }),
          });

          console.log('[PrescribeWork] AI brief response status:', briefResponse.status);

          if (briefResponse.ok) {
            const briefData = await briefResponse.json();
            console.log('[PrescribeWork] Brief response data:', briefData);

            // Navigate to the Brief view
            if (briefData.briefId) {
              console.log('[PrescribeWork] Navigating to brief:', `/c/${companyId}/briefs/${briefData.briefId}`);
              router.push(`/c/${companyId}/briefs/${briefData.briefId}`);
              return;
            } else {
              console.error('[PrescribeWork] No briefId in response:', briefData);
              setError('Brief was created but no ID was returned. Check the briefs page.');
            }
          } else {
            const errorData = await briefResponse.json();
            console.error('[PrescribeWork] AI brief generation failed:', errorData);
            setError(`Brief generation failed: ${errorData.error || 'Unknown error'}`);
          }
        } catch (briefErr) {
          console.error('[PrescribeWork] AI brief generation error:', briefErr);
          setError(`Brief generation error: ${briefErr instanceof Error ? briefErr.message : 'Unknown error'}`);
        }

        setGeneratingBrief(false);
        return; // Don't fall through to onComplete - show error instead
      }

      // Step 3: Navigate to work tab (fallback if AI brief not enabled or failed)
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work items');
      setSubmitting(false);
      setGeneratingBrief(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && !isProcessing && onClose()}
    >
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-700">
          <div className="p-2.5 rounded-lg bg-purple-500/20">
            <ClipboardEdit className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">
              Prescribe Work
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {companyName} - Skip AI discovery, define work directly
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Work Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Work Type <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PRESCRIBED_WORK_TYPES) as [PrescribedWorkType, typeof PRESCRIBED_WORK_TYPES[PrescribedWorkType]][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWorkType(key)}
                    disabled={isProcessing}
                    className={`p-3 text-left rounded-lg border transition-all ${
                      workType === key
                        ? 'border-purple-500 bg-purple-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    } disabled:opacity-50`}
                  >
                    <div className="font-medium text-sm">{config.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {config.description}
                    </div>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Scope <span className="text-red-400">*</span>
            </label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={isProcessing}
              placeholder="Which pages, sections, or URLs need work? Be specific..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Example: Homepage hero, /pricing page, all product pages
            </p>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Goal <span className="text-red-400">*</span>
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={isProcessing}
              placeholder="What outcome are you trying to achieve?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Example: Improve rankings for "marketing automation", increase demo CTR
            </p>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes / Constraints <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isProcessing}
              placeholder="Any constraints, brand guidelines, or additional context..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 resize-none"
            />
          </div>

          {/* AI Assist Toggle */}
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiAssist}
                onChange={(e) => setAiAssist(e.target.checked)}
                disabled={isProcessing}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-0 disabled:opacity-50"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-slate-200">
                    Use AI to improve this brief
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
                  <span>
                    Creates a clearer brief with requirements, checklists, and acceptance criteria.
                    {workType === 'seo_copy' && ' Does not write final copy.'}
                  </span>
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700 bg-slate-800/30 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isProcessing}
            className={`
              px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${isValid && !isProcessing
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg shadow-purple-500/25'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Work...
              </>
            ) : generatingBrief ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Brief...
              </>
            ) : (
              <>
                {aiAssist && <Sparkles className="w-4 h-4" />}
                Create Work{aiAssist ? ' with AI Brief' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
