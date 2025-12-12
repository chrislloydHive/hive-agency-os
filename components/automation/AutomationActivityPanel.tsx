// components/automation/AutomationActivityPanel.tsx
// Automation Activity Panel (PART 5)
//
// Read-only activity log showing:
// - What triggered
// - Why it triggered
// - What ran
// - When

'use client';

import { useState } from 'react';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import type { AutomationActivityEntry } from '@/lib/os/automation/types';
import { AutomationAction, TriggerType } from '@/lib/os/automation/types';
import { getActionLabel } from '@/lib/os/automation/rules';

// ============================================================================
// Types
// ============================================================================

interface AutomationActivityPanelProps {
  activity: AutomationActivityEntry[];
  isEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  isTogglingEnabled?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function getOutcomeStyles(outcome: AutomationActivityEntry['outcome']): {
  bg: string;
  text: string;
  icon: React.ReactNode;
} {
  switch (outcome) {
    case 'success':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    case 'partial':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    case 'failed':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
      };
    case 'skipped':
    default:
      return {
        bg: 'bg-slate-700/50',
        text: 'text-slate-400',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        ),
      };
  }
}

function getTriggerTypeLabel(type: TriggerType): string {
  switch (type) {
    case TriggerType.ContextFieldChanged:
      return 'Context Change';
    case TriggerType.ContextConfirmed:
      return 'Context Confirmed';
    case TriggerType.QuarterRollover:
      return 'Quarter Rollover';
    case TriggerType.QBRGenerated:
      return 'QBR Generated';
    case TriggerType.WorkItemCompleted:
      return 'Work Completed';
    case TriggerType.InitiativeStalled:
      return 'Initiative Stalled';
    case TriggerType.ManualRerun:
      return 'Manual Rerun';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Components
// ============================================================================

function ActivityEntry({ entry }: { entry: AutomationActivityEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getOutcomeStyles(entry.outcome);

  return (
    <div className={`rounded-lg border border-slate-800 ${styles.bg} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 ${styles.text}`}>{styles.icon}</div>
          <div className="min-w-0">
            <div className="text-sm text-slate-200">
              {entry.triggerDescription}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="px-1.5 py-0.5 rounded bg-slate-800">
                {getTriggerTypeLabel(entry.triggerType)}
              </span>
              <span>{formatRelativeTime(entry.timestamp)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-500 hover:text-slate-300 p-1"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          {/* Actions Run */}
          {entry.actionsRun.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Actions Run
              </div>
              <div className="flex flex-wrap gap-1">
                {entry.actionsRun.map((action) => (
                  <span
                    key={action}
                    className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                  >
                    {getActionLabel(action)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="text-xs text-slate-400">
            {entry.summary}
          </div>

          {/* Run ID */}
          <div className="text-[10px] text-slate-500 font-mono">
            Run: {entry.runId}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AutomationActivityPanel({
  activity,
  isEnabled,
  onToggleEnabled,
  isTogglingEnabled = false,
}: AutomationActivityPanelProps) {
  // Feature gate: Automation must be explicitly enabled
  if (!FEATURE_FLAGS.AUTOMATION_ENABLED) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/20">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Automation Activity</h3>
            <p className="text-xs text-slate-500">
              {isEnabled ? 'Labs update automatically on meaningful changes' : 'Automation is paused'}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggleEnabled(!isEnabled)}
          disabled={isTogglingEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnabled ? 'bg-violet-500' : 'bg-slate-700'
          } ${isTogglingEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Activity List */}
      <div className="p-4">
        {activity.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            <svg className="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            No automation activity yet
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((entry) => (
              <ActivityEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {isEnabled && (
        <div className="px-4 pb-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Automations run when you confirm context changes. User-confirmed fields are never overwritten.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutomationActivityPanel;
