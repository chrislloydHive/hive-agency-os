'use client';

// components/os/WorkCard.tsx
// Job-rec style Work Card for the daily job board view

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { WorkItem } from '@/lib/types/work';
import {
  WORK_PRIORITY_CONFIG,
  WORK_CATEGORY_CONFIG,
  WORK_EFFORT_CONFIG,
  areaToCategory,
  severityToPriority,
  type WorkPriority,
  type WorkCategory,
  type WorkEffort,
} from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

interface WorkCardProps {
  item: WorkItem;
  isSelected?: boolean;
  onClick?: (item: WorkItem) => void;
  showCompany?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDueDate(dueDate: string | undefined): string | null {
  if (!dueDate) return null;
  try {
    const date = parseISO(dueDate);
    return format(date, 'MMM d');
  } catch {
    return null;
  }
}

function getRelativeTime(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function PriorityBadge({ priority }: { priority: WorkPriority }) {
  const config = WORK_PRIORITY_CONFIG[priority];
  const colorClasses = {
    red: 'bg-red-500/20 text-red-300 border-red-500/50',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
    yellow: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    gray: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  }[config.color] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${colorClasses}`}
    >
      {priority}
    </span>
  );
}

function CategoryBadge({ category }: { category: WorkCategory }) {
  const config = WORK_CATEGORY_CONFIG[category];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/30 px-2 py-0.5 text-[10px] text-slate-400">
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

function EffortBadge({ effort }: { effort: WorkEffort }) {
  const config = WORK_EFFORT_CONFIG[effort];
  return (
    <span
      className="inline-flex items-center rounded-full bg-slate-700/40 px-2 py-0.5 text-[10px] text-slate-400"
      title={config.hours}
    >
      {effort}
    </span>
  );
}

function OwnerAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-600 text-[10px] font-medium text-slate-200"
      title={name}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkCard({ item, isSelected, onClick, showCompany = false }: WorkCardProps) {
  // Derive PM fields from legacy fields if not present
  const priority = item.priority || severityToPriority(item.severity);
  const category = item.category || areaToCategory(item.area);
  const effort = item.effort as WorkEffort | undefined;
  const ownerName = item.ownerName;
  const dueDate = formatDueDate(item.dueDate);
  const lastTouched = getRelativeTime(item.lastTouchedAt || item.updatedAt);

  const handleClick = () => {
    onClick?.(item);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group cursor-pointer rounded-lg border p-4 transition-all
        ${
          isSelected
            ? 'border-yellow-500/50 bg-yellow-500/10 ring-1 ring-yellow-500/30'
            : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
        }
      `}
    >
      {/* Top row: Priority + Title */}
      <div className="flex items-start gap-2">
        <PriorityBadge priority={priority} />
        <h3 className="flex-1 text-sm font-medium leading-snug text-slate-100 line-clamp-2">
          {item.title}
        </h3>
      </div>

      {/* Company name (if showing all companies) */}
      {showCompany && item.companyName && (
        <p className="mt-1.5 text-xs text-slate-400">
          {item.companyName}
        </p>
      )}

      {/* Notes preview (if available) */}
      {item.notes && (
        <p className="mt-2 text-xs text-slate-400 line-clamp-2">
          {item.notes}
        </p>
      )}

      {/* Bottom row: Metadata */}
      <div className="mt-3 flex items-center justify-between">
        {/* Left: Category + Effort */}
        <div className="flex items-center gap-2">
          <CategoryBadge category={category} />
          {effort && <EffortBadge effort={effort} />}
        </div>

        {/* Right: Due date + Owner */}
        <div className="flex items-center gap-2">
          {dueDate && (
            <span className="text-[11px] text-slate-500">
              Due {dueDate}
            </span>
          )}
          {ownerName && <OwnerAvatar name={ownerName} />}
        </div>
      </div>

      {/* Last touched indicator (subtle) */}
      {lastTouched && (
        <p className="mt-2 text-[10px] text-slate-500">
          Updated {lastTouched}
        </p>
      )}
    </div>
  );
}

export default WorkCard;
