'use client';

// app/c/[companyId]/context/components/LockBadge.tsx
// Lock Badge Component
//
// Shows lock status on fields with tooltip explaining who/why.

import { useState } from 'react';
import type { FieldLock } from '@/lib/contextGraph/governance/locks';

// ============================================================================
// Types
// ============================================================================

interface LockBadgeProps {
  lock: FieldLock;
  onUnlock?: () => void;
  canUnlock?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function LockBadge({ lock, onUnlock, canUnlock = false }: LockBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const isHard = lock.severity === 'hard';

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onBlur={() => setTimeout(() => setShowTooltip(false), 100)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
          'border transition-colors cursor-pointer',
          isHard
            ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
        )}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        {isHard ? 'Hard Lock' : 'Soft Lock'}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-64">
          <div className="rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-3">
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  'mt-0.5 p-1.5 rounded-md',
                  isHard ? 'bg-red-500/20' : 'bg-amber-500/20'
                )}
              >
                <svg
                  className={cn('w-4 h-4', isHard ? 'text-red-400' : 'text-amber-400')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium text-slate-100">
                  {isHard ? 'Hard Locked' : 'Soft Locked'}
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {isHard
                    ? 'No changes allowed (human or AI)'
                    : 'Human can override, AI cannot modify'}
                </p>
              </div>
            </div>

            {/* Lock Details */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-500">Locked by:</span>
                <span className="text-slate-300">{lock.lockedBy}</span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-500">Locked at:</span>
                <span className="text-slate-300">{formatDate(lock.lockedAt)}</span>
              </div>

              {lock.reason && (
                <div className="text-[11px]">
                  <span className="text-slate-500">Reason:</span>
                  <p className="mt-0.5 text-slate-300">{lock.reason}</p>
                </div>
              )}

              {lock.expiresAt && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Expires:</span>
                  <span className="text-slate-300">{formatDate(lock.expiresAt)}</span>
                </div>
              )}
            </div>

            {/* Unlock Button */}
            {canUnlock && onUnlock && (
              <button
                onClick={() => {
                  onUnlock();
                  setShowTooltip(false);
                }}
                className={cn(
                  'mt-3 w-full px-3 py-1.5 rounded-md text-xs font-medium',
                  'border transition-colors',
                  'border-slate-700 bg-slate-800 text-slate-300',
                  'hover:bg-slate-700 hover:text-slate-100'
                )}
              >
                Unlock Field
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Lock Icon (for use in tight spaces)
// ============================================================================

interface LockIconProps {
  severity: 'hard' | 'soft';
  onClick?: () => void;
}

export function LockIcon({ severity, onClick }: LockIconProps) {
  const isHard = severity === 'hard';

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-1 rounded-md transition-colors',
        isHard
          ? 'text-red-400 hover:bg-red-500/20'
          : 'text-amber-400 hover:bg-amber-500/20'
      )}
      title={isHard ? 'Hard locked - no changes allowed' : 'Soft locked - AI cannot modify'}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    </button>
  );
}

export default LockBadge;
