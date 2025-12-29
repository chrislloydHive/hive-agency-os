'use client';

// components/os/decide/DecideSubNav.tsx
// Decide Phase Sub-Navigation Component
//
// Renders three pills: Context | Strategy | Confirm
// Disabled tabs show tooltip with reason why blocked
// "Confirm" is a checkpoint gate that confirms decisions are locked

import { FileText, Sparkles, ShieldCheck } from 'lucide-react';
import type { DecideSubView, SubNavState } from '@/lib/os/ui/decideUiState';

// ============================================================================
// Types
// ============================================================================

interface DecideSubNavProps {
  subNav: SubNavState;
  activeSubView: DecideSubView;
  onChange: (subView: DecideSubView) => void;
  /** Optional: if all checks are complete, show a subtle indicator */
  allConfirmed?: boolean;
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
    label: 'Confirm',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
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
  allConfirmed,
}: DecideSubNavProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
      {SUB_NAV_TABS.map((tab) => {
        const isActive = tab.id === activeSubView;
        const isAvailable = subNav.available[tab.id];
        const tooltip = !isAvailable ? tab.disabledTooltip : undefined;
        const isConfirmTab = tab.id === 'review';

        return (
          <button
            key={tab.id}
            onClick={() => isAvailable && onChange(tab.id)}
            disabled={!isAvailable}
            title={tooltip}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors
              ${isActive
                ? isConfirmTab && allConfirmed
                  ? 'text-white bg-emerald-600'
                  : 'text-white bg-purple-600'
                : isAvailable
                  ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                  : 'text-slate-600 cursor-not-allowed'
              }
            `}
          >
            {tab.icon}
            {tab.label}
            {/* Show checkpoint indicator when confirmed */}
            {isConfirmTab && allConfirmed && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default DecideSubNav;
