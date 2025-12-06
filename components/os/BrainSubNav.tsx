'use client';

// components/os/BrainSubNav.tsx
// Sub-navigation for the Brain workspace: Context | Insights | History

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface BrainSubNavProps {
  companyId: string;
}

interface SubTab {
  name: string;
  href: string;
  tooltip: {
    title: string;
    description: string;
  };
}

export function BrainSubNav({ companyId }: BrainSubNavProps) {
  const pathname = usePathname();
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const subTabs: SubTab[] = [
    {
      name: 'Context',
      href: `/c/${companyId}/brain/context`,
      tooltip: {
        title: 'Company Context Graph',
        description: 'Unified memory of everything known about this company — identity, audience, brand, objectives, and more. Data flows in from diagnostics and manual inputs.',
      },
    },
    {
      name: 'Strategic Map',
      href: `/c/${companyId}/brain/map`,
      tooltip: {
        title: 'Strategic Map',
        description: 'Visual map of the Context Graph clustered by domain. Understand relationships between Identity, Audience, Brand, Competitive, and more.',
      },
    },
    {
      name: 'Insights',
      href: `/c/${companyId}/brain/insights`,
      tooltip: {
        title: 'AI-Generated Insights',
        description: 'Strategic recommendations and patterns surfaced by analyzing the context graph. Identifies growth opportunities, competitive signals, and prioritized actions.',
      },
    },
    {
      name: 'Library',
      href: `/c/${companyId}/brain/library`,
      tooltip: {
        title: 'Reports & Documents',
        description: 'Access diagnostic reports, uploaded documents, and generated analyses. Upload new files to enrich the context graph.',
      },
    },
    {
      name: 'Setup',
      href: `/c/${companyId}/brain/setup`,
      tooltip: {
        title: 'Strategic Setup Wizard',
        description: 'Guided wizard to build out company context. Pre-fills from existing Brain data and writes back to the Context Graph.',
      },
    },
    {
      name: 'History',
      href: `/c/${companyId}/brain/history`,
      tooltip: {
        title: 'Context History',
        description: 'Timeline of how company knowledge has evolved. Track changes, compare snapshots, and understand what triggered each update.',
      },
    },
  ];

  // Check if current path matches a sub-tab
  const isSubTabActive = (tabHref: string) => {
    if (pathname === tabHref) return true;
    // Also match child routes
    if (pathname.startsWith(tabHref + '/')) return true;
    return false;
  };

  return (
    <div className="relative flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
      {subTabs.map((tab) => {
        const isActive = isSubTabActive(tab.href);
        const isHovered = hoveredTab === tab.name;

        return (
          <div
            key={tab.href}
            className="relative"
            onMouseEnter={() => setHoveredTab(tab.name)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <Link
              href={tab.href}
              className={`block px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              {tab.name}
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
