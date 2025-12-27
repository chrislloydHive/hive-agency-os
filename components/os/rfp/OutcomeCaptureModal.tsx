// components/os/rfp/OutcomeCaptureModal.tsx
// Modal shown when RFP status changes to won/lost to capture outcome details
// Skippable - does not block status update

import { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  XCircle,
  DollarSign,
  Users,
  MessageSquare,
  Tag,
  Building2,
} from 'lucide-react';
import type { OutcomeCaptureData, LossReasonTag } from '@/lib/types/rfp';
import { LOSS_REASON_TAGS } from '@/lib/types/rfp';

// ============================================================================
// Types
// ============================================================================

interface OutcomeCaptureModalProps {
  /** The outcome being captured */
  outcome: 'won' | 'lost';
  /** Known competitors from the RFP (for autocomplete) */
  knownCompetitors?: string[];
  /** Called when user saves outcome details */
  onSave: (data: OutcomeCaptureData) => void;
  /** Called when user skips (closes without saving) */
  onSkip: () => void;
  /** Loading state for save action */
  isLoading?: boolean;
}

// ============================================================================
// Loss Reason Tag Labels
// ============================================================================

const LOSS_REASON_LABELS: Record<LossReasonTag, string> = {
  price: 'Pricing',
  timing: 'Timeline/Timing',
  scope: 'Scope Mismatch',
  competitor: 'Lost to Competitor',
  budget: 'Budget Constraints',
  fit: 'Poor Strategic Fit',
  experience: 'Lacked Experience',
  relationship: 'Incumbent Won',
  internal: 'Went Internal',
  cancelled: 'Project Cancelled',
  other: 'Other',
};

// ============================================================================
// Sub-components
// ============================================================================

function TagButton({
  tag,
  selected,
  onClick,
}: {
  tag: LossReasonTag;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        selected
          ? 'bg-red-500/20 border-red-500/50 text-red-300'
          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      {LOSS_REASON_LABELS[tag]}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OutcomeCaptureModal({
  outcome,
  knownCompetitors = [],
  onSave,
  onSkip,
  isLoading = false,
}: OutcomeCaptureModalProps) {
  const [lossReasonTags, setLossReasonTags] = useState<string[]>([]);
  const [competitorChosen, setCompetitorChosen] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [dealValue, setDealValue] = useState<string>('');
  const [budgetRange, setBudgetRange] = useState('');

  const isWon = outcome === 'won';

  const toggleLossReason = (tag: string) => {
    setLossReasonTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    const data: OutcomeCaptureData = {
      outcomeDecisionAt: new Date().toISOString(),
      lossReasonTags: lossReasonTags.length > 0 ? lossReasonTags : undefined,
      competitorChosen: competitorChosen.trim() || null,
      decisionNotes: decisionNotes.trim() || null,
      dealValue: dealValue ? parseFloat(dealValue) : null,
      budgetRange: budgetRange.trim() || null,
    };
    onSave(data);
  };

  // Show competitor input if "competitor" tag is selected or there are known competitors
  const showCompetitorInput = lossReasonTags.includes('competitor') || knownCompetitors.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {isWon ? (
              <Trophy className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <h2 className="text-lg font-semibold text-white">
              {isWon ? 'Congratulations! You Won' : 'Capture Loss Details'}
            </h2>
          </div>
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Intro text */}
          <p className="text-sm text-slate-400">
            {isWon
              ? 'Help improve future proposals by capturing deal details.'
              : 'Understanding why we lost helps improve future proposals.'}
          </p>

          {/* Loss Reason Tags (only for lost) */}
          {!isWon && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Tag className="w-4 h-4" />
                Why did we lose? (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {LOSS_REASON_TAGS.map(tag => (
                  <TagButton
                    key={tag}
                    tag={tag}
                    selected={lossReasonTags.includes(tag)}
                    onClick={() => toggleLossReason(tag)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Competitor (for lost, or if known competitors exist) */}
          {!isWon && showCompetitorInput && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Building2 className="w-4 h-4" />
                Who won?
              </label>
              {knownCompetitors.length > 0 ? (
                <select
                  value={competitorChosen}
                  onChange={(e) => setCompetitorChosen(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="">Select competitor or type below...</option>
                  {knownCompetitors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : null}
              <input
                type="text"
                value={competitorChosen}
                onChange={(e) => setCompetitorChosen(e.target.value)}
                placeholder="Competitor name"
                className={`w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${knownCompetitors.length > 0 ? 'mt-2' : ''}`}
              />
            </div>
          )}

          {/* Deal Value (for won) */}
          {isWon && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <DollarSign className="w-4 h-4" />
                Deal Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>
          )}

          {/* Budget Range */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Users className="w-4 h-4" />
              Client's Budget Range
            </label>
            <input
              type="text"
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value)}
              placeholder="e.g., $50k-$75k"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <MessageSquare className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder={isWon
                ? "What helped us win? Key factors, client feedback..."
                : "Any additional context about the loss..."
              }
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="px-4 py-2 text-slate-400 hover:text-slate-300 transition-colors text-sm disabled:opacity-50"
          >
            Skip for now
          </button>

          <button
            onClick={handleSave}
            disabled={isLoading}
            className={`flex items-center gap-2 px-6 py-2 font-medium rounded-lg transition-colors ${
              isLoading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : isWon
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            {isLoading ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for managing outcome capture state
// ============================================================================

export interface UseOutcomeCaptureOptions {
  /** Callback when outcome details are saved */
  onSave: (outcome: 'won' | 'lost', data: OutcomeCaptureData) => Promise<void>;
  /** Known competitors from the RFP */
  competitors?: string[];
}

export interface UseOutcomeCaptureReturn {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The current outcome being captured */
  outcome: 'won' | 'lost' | null;
  /** Open the modal for a specific outcome */
  open: (outcome: 'won' | 'lost') => void;
  /** Close the modal */
  close: () => void;
  /** Modal props to spread onto OutcomeCaptureModal */
  modalProps: Omit<OutcomeCaptureModalProps, 'outcome'> | null;
  /** Whether save is in progress */
  isSaving: boolean;
}

export function useOutcomeCapture({
  onSave,
  competitors = [],
}: UseOutcomeCaptureOptions): UseOutcomeCaptureReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const open = (o: 'won' | 'lost') => {
    setOutcome(o);
    setIsOpen(true);
  };

  const close = () => {
    if (!isSaving) {
      setIsOpen(false);
      setOutcome(null);
    }
  };

  const handleSave = async (data: OutcomeCaptureData) => {
    if (!outcome) return;
    setIsSaving(true);
    try {
      await onSave(outcome, data);
      setIsOpen(false);
      setOutcome(null);
    } catch (err) {
      console.error('Failed to save outcome:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    close();
  };

  const modalProps = isOpen && outcome ? {
    knownCompetitors: competitors,
    onSave: handleSave,
    onSkip: handleSkip,
    isLoading: isSaving,
  } : null;

  return {
    isOpen,
    outcome,
    open,
    close,
    modalProps,
    isSaving,
  };
}
