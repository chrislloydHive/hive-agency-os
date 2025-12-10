'use client';

// components/plan/ViewToggle.tsx
// Segmented control for switching between Plan views
//
// Views: Themes | By Priority | By Lab | All Findings

import { Grid3X3, LayoutList, Layers, List } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type PlanViewType = 'themes' | 'priority' | 'lab' | 'all';

interface ViewToggleProps {
  activeView: PlanViewType;
  onViewChange: (view: PlanViewType) => void;
}

// ============================================================================
// View Config
// ============================================================================

const views: { id: PlanViewType; label: string; icon: React.ElementType }[] = [
  { id: 'themes', label: 'Themes', icon: Layers },
  { id: 'priority', label: 'By Priority', icon: LayoutList },
  { id: 'lab', label: 'By Lab', icon: Grid3X3 },
  { id: 'all', label: 'All Findings', icon: List },
];

// ============================================================================
// Main Component
// ============================================================================

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg bg-slate-800/50 border border-slate-700 p-1">
      {views.map(view => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${isActive
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;
