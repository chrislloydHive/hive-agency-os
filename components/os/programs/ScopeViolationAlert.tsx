'use client';

// components/os/programs/ScopeViolationAlert.tsx
// Renders scope violation alerts with structured escalation paths
//
// Displays when a user tries to create work that violates program scope:
// - Workstream not allowed
// - Concurrency limit reached
//
// Shows recommended actions and escalation options

import { useState } from 'react';
import {
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight,
  ListTodo,
  Archive,
  MessageSquare,
  Layers,
} from 'lucide-react';
import type {
  ScopeViolationResponse,
  RecommendedAction,
  ScopeViolationCode,
} from '@/lib/os/programs/scopeGuard';

// ============================================================================
// Types
// ============================================================================

interface ScopeViolationAlertProps {
  violation: ScopeViolationResponse;
  onDismiss?: () => void;
  onActionClick?: (actionId: string) => void;
  showFullDetails?: boolean;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const ACTION_ICONS: Record<string, React.ReactNode> = {
  use_allowed_workstream: <Layers className="w-4 h-4" />,
  create_adhoc: <ListTodo className="w-4 h-4" />,
  request_expansion: <MessageSquare className="w-4 h-4" />,
  view_active_work: <ListTodo className="w-4 h-4" />,
  complete_work: <ArrowRight className="w-4 h-4" />,
  archive_blocked: <Archive className="w-4 h-4" />,
  request_capacity: <MessageSquare className="w-4 h-4" />,
};

const CODE_STYLES: Record<
  ScopeViolationCode,
  { bg: string; border: string; icon: string; text: string }
> = {
  WORKSTREAM_NOT_ALLOWED: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    text: 'text-amber-400',
  },
  CONCURRENCY_LIMIT_REACHED: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    text: 'text-red-400',
  },
  PROGRAM_REQUIRED: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    icon: 'text-slate-400',
    text: 'text-slate-400',
  },
  PROGRAM_ARCHIVED: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    icon: 'text-slate-400',
    text: 'text-slate-400',
  },
};

// ============================================================================
// Action Button Component
// ============================================================================

interface ActionButtonProps {
  action: RecommendedAction;
  onClick?: () => void;
}

function ActionButton({ action, onClick }: ActionButtonProps) {
  const icon = ACTION_ICONS[action.id] || <ArrowRight className="w-4 h-4" />;

  if (action.type === 'primary') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
      >
        {icon}
        {action.label}
      </button>
    );
  }

  if (action.type === 'link') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {action.label}
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
    >
      {icon}
      {action.label}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ScopeViolationAlert({
  violation,
  onDismiss,
  onActionClick,
  showFullDetails = false,
}: ScopeViolationAlertProps) {
  const [isExpanded, setIsExpanded] = useState(showFullDetails);
  const style = CODE_STYLES[violation.code] || CODE_STYLES.PROGRAM_REQUIRED;

  const primaryAction = violation.recommendedActions.find((a) => a.type === 'primary');
  const secondaryActions = violation.recommendedActions.filter((a) => a.type === 'secondary');
  const linkActions = violation.recommendedActions.filter((a) => a.type === 'link');

  return (
    <div className={`rounded-xl border ${style.bg} ${style.border} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`p-2 rounded-lg ${style.bg}`}>
          <AlertTriangle className={`w-5 h-5 ${style.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`text-sm font-semibold ${style.text}`}>
                {violation.code === 'WORKSTREAM_NOT_ALLOWED'
                  ? 'Workstream Not Allowed'
                  : violation.code === 'CONCURRENCY_LIMIT_REACHED'
                  ? 'Capacity Limit Reached'
                  : 'Scope Violation'}
              </h3>
              <p className="text-sm text-slate-300 mt-1">{violation.message}</p>
            </div>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Context Info */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded">
              {violation.context.programTitle}
            </span>
            {violation.context.domain && (
              <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded">
                {violation.context.domain}
              </span>
            )}
            {violation.context.currentCount !== undefined &&
              violation.context.limit !== undefined && (
                <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded">
                  {violation.context.currentCount}/{violation.context.limit} active
                </span>
              )}
          </div>
        </div>
      </div>

      {/* Allowed Workstreams (for workstream violations) */}
      {violation.code === 'WORKSTREAM_NOT_ALLOWED' &&
        violation.context.allowedWorkstreamLabels.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-500 mb-1.5">Allowed in this program:</p>
            <div className="flex flex-wrap gap-1.5">
              {violation.context.allowedWorkstreamLabels.map((label) => (
                <span
                  key={label}
                  className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* Primary Action */}
      {primaryAction && (
        <div className="px-4 pb-4">
          <ActionButton
            action={primaryAction}
            onClick={() => onActionClick?.(primaryAction.id)}
          />
          <p className="text-xs text-slate-500 mt-1.5">{primaryAction.description}</p>
        </div>
      )}

      {/* Expandable Section */}
      <div className="border-t border-slate-700/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          <span>Other options</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Secondary Actions */}
            {secondaryActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {secondaryActions.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    onClick={() => onActionClick?.(action.id)}
                  />
                ))}
              </div>
            )}

            {/* Link Actions */}
            {linkActions.length > 0 && (
              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-xs text-slate-600 mb-2">Need help?</p>
                <div className="flex flex-wrap gap-4">
                  {linkActions.map((action) => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      onClick={() => onActionClick?.(action.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Inline Violation Banner (for forms)
// ============================================================================

interface InlineViolationBannerProps {
  violation: ScopeViolationResponse;
  onDismiss?: () => void;
}

export function InlineViolationBanner({
  violation,
  onDismiss,
}: InlineViolationBannerProps) {
  const style = CODE_STYLES[violation.code] || CODE_STYLES.PROGRAM_REQUIRED;

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg ${style.bg} border ${style.border}`}
    >
      <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${style.text}`}>{violation.message}</p>
        {violation.context.allowedWorkstreamLabels.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            Allowed: {violation.context.allowedWorkstreamLabels.join(', ')}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-0.5 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default ScopeViolationAlert;
