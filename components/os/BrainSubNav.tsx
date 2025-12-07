'use client';

// components/os/BrainSubNav.tsx
// Sub-navigation for the Brain workspace (4-tab structure):
// Explorer | Context | Insights | Labs
//
// Part of Brain IA:
// - Explorer: Explore mode - visual map for discovery
// - Context: Inspect mode - field-level editor for data entry
// - Insights: Understand mode - AI-generated analysis
// - Labs: Improve mode - diagnostic tools that refine context

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BRAIN_TABS, getBrainTabFromPath } from '@/lib/nav/companyNav';

interface BrainSubNavProps {
  companyId: string;
}

export function BrainSubNav({ companyId }: BrainSubNavProps) {
  const pathname = usePathname();
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const activeTabId = getBrainTabFromPath(pathname, companyId);

  return (
    <div className="relative flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
      {BRAIN_TABS.map((tab) => {
        const href = tab.href(companyId);
        const isActive = tab.id === activeTabId;
        const isHovered = hoveredTab === tab.id;

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
              <span className="text-sm font-medium">{tab.name}</span>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'text-amber-400/70' : 'text-slate-500'}`}>
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
