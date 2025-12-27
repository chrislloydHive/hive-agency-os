'use client';

// components/os/plans/PlanDiff.tsx
// Plan Diff Visualization Component
//
// Renders a structured diff between approved and proposed plans.
// Shows changes grouped by section with Added/Removed/Changed badges.

import { useState } from 'react';
import {
  Plus,
  Minus,
  Edit3,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type {
  PlanDiff as PlanDiffType,
  SectionChange,
  FieldChange,
  ListItemChange,
  ChangeType,
} from '@/lib/os/plans/diff/planDiff';
import { getDiffSummary } from '@/lib/os/plans/diff/planDiff';

// ============================================================================
// Types
// ============================================================================

interface PlanDiffProps {
  diff: PlanDiffType;
  /** Whether to start with sections expanded */
  defaultExpanded?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const config = {
    added: { label: 'Added', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    removed: { label: 'Removed', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
    changed: { label: 'Changed', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    unchanged: { label: 'Unchanged', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  };

  const { label, className } = config[type];

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${className}`}>
      {label}
    </span>
  );
}

function ChangeIcon({ type }: { type: ChangeType | 'added' | 'removed' | 'changed' }) {
  switch (type) {
    case 'added':
      return <Plus className="w-3.5 h-3.5 text-emerald-400" />;
    case 'removed':
      return <Minus className="w-3.5 h-3.5 text-red-400" />;
    case 'changed':
      return <Edit3 className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return null;
  }
}

function FieldChangeRow({ change, compact }: { change: FieldChange; compact?: boolean }) {
  if (change.type === 'unchanged') return null;

  return (
    <div className={`flex items-start gap-3 ${compact ? 'py-1' : 'py-2'}`}>
      <ChangeIcon type={change.type} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{change.fieldLabel}</p>
        {change.type === 'added' && (
          <p className="text-sm text-emerald-300/90 mt-0.5 break-words">
            {change.newPreview || String(change.newValue)}
          </p>
        )}
        {change.type === 'removed' && (
          <p className="text-sm text-red-300/90 line-through mt-0.5 break-words">
            {change.oldPreview || String(change.oldValue)}
          </p>
        )}
        {change.type === 'changed' && (
          <div className="mt-0.5 space-y-0.5">
            <p className="text-sm text-red-300/70 line-through break-words">
              {change.oldPreview || String(change.oldValue)}
            </p>
            <p className="text-sm text-emerald-300/90 break-words">
              {change.newPreview || String(change.newValue)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ListItemChangeRow({ change, compact }: { change: ListItemChange; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${compact ? 'py-1' : 'py-2'}`}>
      <ChangeIcon type={change.type} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${
          change.type === 'added'
            ? 'text-emerald-300/90'
            : change.type === 'removed'
              ? 'text-red-300/90 line-through'
              : 'text-amber-300/90'
        }`}>
          {change.itemLabel}
        </p>
        {change.type === 'changed' && (
          <p className="text-xs text-slate-500 mt-0.5">
            Modified (compare full details in plan view)
          </p>
        )}
      </div>
    </div>
  );
}

function SectionDiff({
  section,
  defaultExpanded,
  compact,
}: {
  section: SectionChange;
  defaultExpanded?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
  const hasChanges = section.fieldChanges.length > 0 || section.listChanges.length > 0;

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-800/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-sm font-medium text-slate-200">{section.sectionLabel}</span>
          <ChangeTypeBadge type={section.sectionType} />
        </div>
        <span className="text-xs text-slate-500">
          {section.fieldChanges.length + section.listChanges.length} change
          {section.fieldChanges.length + section.listChanges.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Content */}
      {expanded && hasChanges && (
        <div className={`px-3 ${compact ? 'py-2' : 'py-3'} bg-slate-900/30 divide-y divide-slate-700/30`}>
          {section.fieldChanges.map((change, i) => (
            <FieldChangeRow key={`field-${i}`} change={change} compact={compact} />
          ))}
          {section.listChanges.map((change, i) => (
            <ListItemChangeRow key={`list-${i}`} change={change} compact={compact} />
          ))}
        </div>
      )}

      {expanded && !hasChanges && (
        <div className="px-3 py-3 bg-slate-900/30">
          <p className="text-xs text-slate-500">No detailed changes to show.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PlanDiff({ diff, defaultExpanded = true, compact = false }: PlanDiffProps) {
  const summary = getDiffSummary(diff);

  // New plan state
  if (diff.isNewPlan) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-300">New Plan</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {summary}
            </p>
          </div>
        </div>

        {/* Sections */}
        {diff.sections.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Proposed Sections
            </p>
            <div className="space-y-2">
              {diff.sections.map((section) => (
                <SectionDiff
                  key={section.sectionKey}
                  section={section}
                  defaultExpanded={defaultExpanded}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // No changes
  if (!diff.hasChanges) {
    return (
      <div className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
        <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-300">No Changes</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary}
          </p>
        </div>
      </div>
    );
  }

  // Changes detected
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <Edit3 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-300">Changes Detected</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-slate-400">
        {diff.stats.itemsAdded > 0 && (
          <span className="flex items-center gap-1">
            <Plus className="w-3 h-3 text-emerald-400" />
            {diff.stats.itemsAdded} added
          </span>
        )}
        {diff.stats.itemsRemoved > 0 && (
          <span className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-red-400" />
            {diff.stats.itemsRemoved} removed
          </span>
        )}
        {diff.stats.fieldsChanged > 0 && (
          <span className="flex items-center gap-1">
            <Edit3 className="w-3 h-3 text-amber-400" />
            {diff.stats.fieldsChanged} fields changed
          </span>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {diff.sections.map((section) => (
          <SectionDiff
            key={section.sectionKey}
            section={section}
            defaultExpanded={defaultExpanded}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

export default PlanDiff;
