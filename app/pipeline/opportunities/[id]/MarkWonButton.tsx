'use client';

import { useState, useCallback } from 'react';

interface MarkWonButtonProps {
  opportunityId: string;
  hasEngagements: boolean;
  className?: string;
  variant?: 'primary' | 'secondary';
}

type PollingStatus = 'idle' | 'updating' | 'polling' | 'success' | 'timeout' | 'error';

/**
 * MarkWonButton - Sets opportunity stage to "Won" and polls for Airtable-created Engagements.
 *
 * Behavior:
 * 1. On click, calls API to set stage to "won"
 * 2. Polls opportunity 3 times (2s delay) waiting for Engagements to appear
 * 3. Stops polling once Engagements field is populated or after 3 attempts
 * 4. Does NOT create engagements in OS - relies on Airtable automation
 */
export function MarkWonButton({
  opportunityId,
  hasEngagements,
  className = '',
  variant = 'secondary',
}: MarkWonButtonProps) {
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [pollCount, setPollCount] = useState(0);
  const [engagementsFound, setEngagementsFound] = useState(hasEngagements);

  const pollForEngagements = useCallback(async (attempt: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`);
      if (!response.ok) return false;

      const data = await response.json();
      const opp = data.opportunity;

      // Check if Engagements field is now populated
      if (opp?.engagements && opp.engagements.length > 0) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [opportunityId]);

  const handleMarkWon = async () => {
    if (status !== 'idle') return;

    setStatus('updating');
    setPollCount(0);

    try {
      // Step 1: Update stage to "won"
      const updateResponse = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'won' }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to update opportunity');
      }

      // Step 2: Poll for Engagements (3 times, 2s delay)
      setStatus('polling');

      for (let attempt = 1; attempt <= 3; attempt++) {
        setPollCount(attempt);

        // Wait 2 seconds before each poll
        await new Promise(resolve => setTimeout(resolve, 2000));

        const found = await pollForEngagements(attempt);
        if (found) {
          setEngagementsFound(true);
          setStatus('success');
          return;
        }
      }

      // Engagements not found after 3 attempts - this is okay, Airtable automation might be slower
      setStatus('timeout');

    } catch (error) {
      console.error('[MarkWonButton] Error:', error);
      setStatus('error');
    }
  };

  // Already has engagements - show linked state
  if (engagementsFound) {
    return (
      <div className={`flex items-center gap-2 text-emerald-400 text-sm ${className}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Engagement Created</span>
      </div>
    );
  }

  // Determine button styling based on variant
  const baseStyles = variant === 'primary'
    ? 'px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium rounded-lg transition-colors text-sm'
    : 'w-full px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-colors text-sm border border-emerald-500/30';

  const disabledStyles = 'opacity-50 cursor-not-allowed';

  // Render based on status
  if (status === 'updating') {
    return (
      <button disabled className={`${baseStyles} ${disabledStyles} ${className}`}>
        Marking as Won...
      </button>
    );
  }

  if (status === 'polling') {
    return (
      <button disabled className={`${baseStyles} ${disabledStyles} ${className}`}>
        Waiting for Engagement ({pollCount}/3)...
      </button>
    );
  }

  if (status === 'success') {
    return (
      <div className={`flex items-center gap-2 text-emerald-400 text-sm ${className}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Won - Engagement Created</span>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Marked Won - Engagement pending</span>
        </div>
        <p className="text-xs text-slate-500">
          Airtable automation will create the Engagement shortly.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to mark as Won</span>
        </div>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs text-amber-500 hover:text-amber-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleMarkWon} className={`${baseStyles} ${className}`}>
      Mark as Won
    </button>
  );
}
