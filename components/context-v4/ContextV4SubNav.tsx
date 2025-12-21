'use client';

// components/context-v4/ContextV4SubNav.tsx
// Sub-navigation for Context V4 workspace
//
// 3-tab structure: Fact Sheet | Review | Fields
// Shows active state based on current route.
// Includes badge counts for proposed/confirmed items.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CONTEXT_V4_TABS, getContextV4TabFromPath } from '@/lib/nav/companyNav';

interface ContextV4SubNavProps {
  companyId: string;
  /** Badge counts for tabs */
  counts?: {
    proposed?: number;
    confirmed?: number;
  };
}

export function ContextV4SubNav({ companyId, counts }: ContextV4SubNavProps) {
  const pathname = usePathname();
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const activeTabId = getContextV4TabFromPath(pathname);

  return (
    <div className="relative flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
      {CONTEXT_V4_TABS.map((tab) => {
        const href = tab.href(companyId);
        const isActive = tab.id === activeTabId;
        const isHovered = hoveredTab === tab.id;

        // Get badge count for this tab
        const badgeCount = tab.badgeKey && counts ? counts[tab.badgeKey] : undefined;
        const showBadge = badgeCount !== undefined && badgeCount > 0;

        return (
          <div
            key={tab.id}
            className="relative"
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <Link
              href={href}
              className={`flex flex-col items-center px-4 py-2 text-center rounded-md transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{tab.name}</span>
                {showBadge && (
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      tab.id === 'review'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 ${
                  isActive ? 'text-amber-400/70' : 'text-slate-500'
                }`}
              >
                {tab.subLabel}
              </span>
            </Link>

            {/* Tooltip */}
            {isHovered && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
                <div className="relative">
                  {/* Arrow */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-t border-l border-slate-700 rotate-45" />

                  {/* Content */}
                  <div className="w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                    <div className="text-sm font-medium text-slate-100 mb-1">
                      {tab.tooltip.title}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {tab.tooltip.description}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
