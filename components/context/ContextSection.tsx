// components/context/ContextSection.tsx
// Context Section Component
//
// Renders a collapsible section container with icon and title.
// Used to group related context fields in Context Workspace and other context editors.

'use client';

import type { ReactNode } from 'react';

export interface ContextSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export function ContextSection({
  icon,
  title,
  children,
  fullWidth,
  className = '',
}: ContextSectionProps) {
  return (
    <div
      className={`bg-slate-900/50 border border-slate-800 rounded-xl p-5 ${
        fullWidth ? 'lg:col-span-2' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="text-cyan-400">{icon}</div>
        <h2 className="text-sm font-medium text-slate-200">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
