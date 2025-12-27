'use client';

// components/os/plans/editor/SectionCard.tsx
// A card wrapper for plan sections with consistent styling

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  badge?: ReactNode;
}

export function SectionCard({
  title,
  description,
  icon,
  children,
  defaultExpanded = true,
  badge,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/70 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-slate-400">{icon}</div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-slate-200">{title}</h3>
              {badge}
            </div>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/30">
          {children}
        </div>
      )}
    </div>
  );
}

export default SectionCard;
