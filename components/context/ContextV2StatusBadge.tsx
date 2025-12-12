// REUSE REQUIRED
// - Must reuse existing Context Workspace section components if present
// - Must map to Context Graph domains (no parallel context model)
// - Must render existing Proposal type (no new diff format)

// components/context/ContextV2StatusBadge.tsx
// Context V2 Status Badge
//
// Displays lifecycle status (Draft / Confirmed / Needs Review)
// Minimal, unobtrusive badge for Context V2 status.

'use client';

import type { ContextLifecycleStatus } from '@/lib/types/contextV2';

interface ContextV2StatusBadgeProps {
  status: ContextLifecycleStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_STYLES: Record<ContextLifecycleStatus, { bg: string; text: string; label: string }> = {
  Draft: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    label: 'Draft',
  },
  Confirmed: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    label: 'Confirmed',
  },
  'Needs Review': {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    label: 'Needs Review',
  },
};

export function ContextV2StatusBadge({ status, size = 'sm', className = '' }: ContextV2StatusBadgeProps) {
  const style = STATUS_STYLES[status];

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${style.bg} ${style.text} ${sizeClasses} ${className}`}
    >
      {style.label}
    </span>
  );
}

// Inline status indicator (smaller, for lists)
export function ContextV2StatusDot({ status }: { status: ContextLifecycleStatus }) {
  const colors: Record<ContextLifecycleStatus, string> = {
    Draft: 'bg-amber-400',
    Confirmed: 'bg-emerald-400',
    'Needs Review': 'bg-blue-400',
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]}`}
      title={status}
    />
  );
}
