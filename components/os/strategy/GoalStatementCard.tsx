'use client';

// components/os/strategy/GoalStatementCard.tsx
// Goal Statement capture card for Strategy Workspace
//
// Displays an editable goal statement field that:
// - Shows immediately after strategy creation
// - Auto-saves on blur or Enter
// - Provides character count (0-400)
// - Shows "Goal set" chip when populated
//
// The goalStatement is used as PRIMARY input for objectives, bets, tactics
// and as SECONDARY stabilizer for valueProp, positioning, constraints.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Target, Check, Loader2, AlertCircle, Pencil } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GoalStatementCardProps {
  /** Current strategy ID */
  strategyId: string;
  /** Current company ID */
  companyId: string;
  /** Current goal statement value */
  goalStatement?: string;
  /** Callback when goal statement is updated */
  onGoalStatementChange?: (goalStatement: string) => void;
  /** Whether the card should be in edit mode by default (e.g., for new strategies) */
  defaultEdit?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// Goal Badge (for header)
// ============================================================================

export function GoalBadge({ hasGoal }: { hasGoal: boolean }) {
  if (!hasGoal) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
      <Target className="w-3 h-3" />
      Goal set
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GoalStatementCard({
  strategyId,
  companyId,
  goalStatement: initialGoalStatement,
  onGoalStatementChange,
  defaultEdit = false,
  className = '',
}: GoalStatementCardProps) {
  const [goalStatement, setGoalStatement] = useState(initialGoalStatement || '');
  const [isEditing, setIsEditing] = useState(defaultEdit || !initialGoalStatement);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedValue = useRef(initialGoalStatement || '');

  // Character limit
  const MAX_CHARS = 400;
  const charCount = goalStatement.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Update local state when prop changes
  useEffect(() => {
    if (initialGoalStatement !== undefined && initialGoalStatement !== lastSavedValue.current) {
      setGoalStatement(initialGoalStatement);
      lastSavedValue.current = initialGoalStatement;
    }
  }, [initialGoalStatement]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Save goal statement to API
  const saveGoalStatement = useCallback(async (value: string) => {
    // Skip if value hasn't changed
    if (value === lastSavedValue.current) {
      return;
    }

    // Skip if over limit
    if (value.length > MAX_CHARS) {
      setError(`Goal must be ${MAX_CHARS} characters or less`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalStatement: value }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to save goal statement');
      }

      lastSavedValue.current = value;
      onGoalStatementChange?.(value);

      // Show saved indicator briefly
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);

      // Exit edit mode if we have a value
      if (value.trim()) {
        setIsEditing(false);
      }
    } catch (err) {
      console.error('[GoalStatementCard] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, strategyId, onGoalStatementChange]);

  // Handle blur - auto-save
  const handleBlur = useCallback(() => {
    saveGoalStatement(goalStatement);
  }, [goalStatement, saveGoalStatement]);

  // Handle key press - save on Enter (without Shift)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveGoalStatement(goalStatement);
    }
    if (e.key === 'Escape') {
      // Revert to last saved value
      setGoalStatement(lastSavedValue.current);
      setIsEditing(false);
    }
  }, [goalStatement, saveGoalStatement]);

  // Render display mode
  if (!isEditing && goalStatement.trim()) {
    return (
      <div className={`relative group ${className}`}>
        <div className="p-4 border border-slate-700 rounded-lg bg-slate-800/50">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-500/10 rounded">
                <Target className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="text-sm font-medium text-white">Strategy Goal</h3>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all"
              title="Edit goal"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Goal text */}
          <p className="text-sm text-slate-300 leading-relaxed">
            {goalStatement}
          </p>

          {/* Saved indicator */}
          {showSaved && (
            <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3 h-3" />
              Saved
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render edit mode
  return (
    <div className={`p-4 border border-slate-700 rounded-lg bg-slate-800/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-purple-500/10 rounded">
          <Target className="w-4 h-4 text-purple-400" />
        </div>
        <h3 className="text-sm font-medium text-white">Strategy Goal</h3>
      </div>

      {/* Helper text */}
      <p className="text-xs text-slate-400 mb-3">
        What are you trying to accomplish? This helps the AI generate aligned
        objectives, strategic bets, and tactics.
      </p>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={goalStatement}
          onChange={(e) => setGoalStatement(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Increase qualified leads by 50% in Q1 through targeted content marketing"
          className={`
            w-full h-24 p-3 text-sm text-white placeholder-slate-500
            bg-slate-900 border rounded-lg resize-none
            focus:outline-none focus:ring-2 focus:ring-purple-500/50
            ${isOverLimit ? 'border-red-500' : 'border-slate-600 hover:border-slate-500'}
          `}
          disabled={isSaving}
        />

        {/* Character count */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}
            {isSaving && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </div>
            )}
            {showSaved && !isSaving && (
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="w-3 h-3" />
                Saved
              </div>
            )}
          </div>
          <span className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-slate-500'}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-3 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          <span className="text-slate-400">Tip:</span> Be specific about your
          outcome, audience, and timeframe. Press Enter to save.
        </p>
      </div>
    </div>
  );
}

export default GoalStatementCard;
