'use client';

// components/os/decide/DecideSubNav.tsx
// Decide Phase Sub-Navigation Component
//
// Renders three pills: Context | Strategy | Review
// Disabled tabs show tooltip with reason why blocked

import { FileText, Sparkles, CheckCircle2 } from 'lucide-react';
import type { DecideSubView, SubNavState } from '@/lib/os/ui/decideUiState';

// ============================================================================
// Types
// ============================================================================

interface DecideSubNavProps {
  subNav: SubNavState;
  activeSubView: DecideSubView;
  onChange: (subView: DecideSubView) => void;
}

interface SubNavTab {
  id: DecideSubView;
  label: string;
  icon: React.ReactNode;
  disabledTooltip: string;
}

// ============================================================================
// Constants
// ============================================================================

const SUB_NAV_TABS: SubNavTab[] = [
  {
    id: 'context',
    label: 'Context',
    icon: <FileText className="w-3.5 h-3.5" />,
    disabledTooltip: 'Run labs first',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    disabledTooltip: 'Confirm inputs first',
  },
  {
    id: 'review',
    label: 'Review',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    disabledTooltip: 'Complete strategy framing first',
  },
];

// ============================================================================
// Component
// ============================================================================

export function DecideSubNav({
  subNav,
  activeSubView,
  onChange,
}: DecideSubNavProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
      {SUB_NAV_TABS.map((tab) => {
        const isActive = tab.id === activeSubView;
        const isAvailable = subNav.available[tab.id];
        const tooltip = !isAvailable ? tab.disabledTooltip : undefined;

        return (
          <button
            key={tab.id}
            onClick={() => isAvailable && onChange(tab.id)}
            disabled={!isAvailable}
            title={tooltip}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors
              ${isActive
                ? 'text-white bg-purple-600'
                : isAvailable
                  ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                  : 'text-slate-600 cursor-not-allowed'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default DecideSubNav;
