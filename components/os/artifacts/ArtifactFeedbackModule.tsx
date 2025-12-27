'use client';

// components/os/artifacts/ArtifactFeedbackModule.tsx
// Minimal feedback module for artifact viewer
//
// Features:
// - "Was this artifact helpful?" prompt
// - Rating buttons (helpful/neutral/not helpful)
// - Optional comment input after selection
// - Submitted state

import { useState } from 'react';
import { ThumbsUp, Minus, ThumbsDown, Loader2, Check } from 'lucide-react';
import type { ArtifactFeedbackRating } from '@/lib/types/artifact';

interface ArtifactFeedbackModuleProps {
  companyId: string;
  artifactId: string;
  artifactStatus: 'draft' | 'final' | 'archived';
  existingFeedbackCount?: number;
}

type FeedbackState = 'idle' | 'selected' | 'submitting' | 'submitted';

export function ArtifactFeedbackModule({
  companyId,
  artifactId,
  artifactStatus,
  existingFeedbackCount = 0,
}: ArtifactFeedbackModuleProps) {
  const [state, setState] = useState<FeedbackState>('idle');
  const [selectedRating, setSelectedRating] = useState<ArtifactFeedbackRating | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Don't show feedback for archived artifacts
  if (artifactStatus === 'archived') {
    return null;
  }

  const handleRatingClick = (rating: ArtifactFeedbackRating) => {
    setSelectedRating(rating);
    setState('selected');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedRating) return;

    setState('submitting');
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${artifactId}/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: selectedRating,
            ...(comment.trim() && { comment: comment.trim() }),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setState('submitted');
    } catch (err) {
      console.error('[ArtifactFeedbackModule] Submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setState('selected');
    }
  };

  const handleSkip = () => {
    setState('submitted');
  };

  // Submitted state
  if (state === 'submitted') {
    return (
      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="w-4 h-4" />
          <span>Thanks for your feedback!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4 space-y-3">
      {/* Prompt */}
      <p className="text-sm text-slate-400">Was this artifact helpful?</p>

      {/* Rating Buttons */}
      <div className="flex items-center gap-2">
        <RatingButton
          rating="helpful"
          label="Helpful"
          icon={<ThumbsUp className="w-4 h-4" />}
          isSelected={selectedRating === 'helpful'}
          onClick={() => handleRatingClick('helpful')}
          disabled={state === 'submitting'}
        />
        <RatingButton
          rating="neutral"
          label="Neutral"
          icon={<Minus className="w-4 h-4" />}
          isSelected={selectedRating === 'neutral'}
          onClick={() => handleRatingClick('neutral')}
          disabled={state === 'submitting'}
        />
        <RatingButton
          rating="not_helpful"
          label="Not helpful"
          icon={<ThumbsDown className="w-4 h-4" />}
          isSelected={selectedRating === 'not_helpful'}
          onClick={() => handleRatingClick('not_helpful')}
          disabled={state === 'submitting'}
        />
      </div>

      {/* Comment Input (after selection or during submission) */}
      {(state === 'selected' || state === 'submitting') && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Any additional feedback? (optional)"
            maxLength={1000}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 resize-none"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={state === 'submitting'}
              className="px-3 py-1.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              {state === 'submitting' ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Feedback'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// Rating Button
// ============================================================================

function RatingButton({
  rating,
  label,
  icon,
  isSelected,
  onClick,
  disabled,
}: {
  rating: ArtifactFeedbackRating;
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const baseStyles = 'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors';

  const stateStyles = isSelected
    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-slate-300';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${stateStyles} disabled:opacity-50`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

export default ArtifactFeedbackModule;
