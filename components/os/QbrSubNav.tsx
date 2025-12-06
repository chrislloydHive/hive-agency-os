'use client';

// components/os/QbrSubNav.tsx
// Sub-navigation for the QBR workspace: Overview | Strategic Plan | KPIs | Priorities | Next Quarter | Risks

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface QbrSubNavProps {
  companyId: string;
}

export function QbrSubNav({ companyId }: QbrSubNavProps) {
  const pathname = usePathname();

  const subTabs = [
    { name: 'Overview', href: `/c/${companyId}/qbr` },
    { name: 'Story', href: `/c/${companyId}/qbr/story` },
    { name: 'Strategic Plan', href: `/c/${companyId}/qbr/strategic-plan` },
    { name: 'KPIs', href: `/c/${companyId}/qbr/kpis` },
    { name: 'Priorities', href: `/c/${companyId}/qbr/priorities` },
    { name: 'Next Quarter', href: `/c/${companyId}/qbr/next-quarter` },
    { name: 'Risks', href: `/c/${companyId}/qbr/risks` },
  ];

  // Check if current path matches a sub-tab
  const isSubTabActive = (tabHref: string) => {
    // Exact match for Overview (the base /qbr route)
    if (tabHref === `/c/${companyId}/qbr`) {
      return pathname === tabHref;
    }
    // For other tabs, check if pathname starts with the tab href
    if (pathname === tabHref) return true;
    if (pathname.startsWith(tabHref + '/')) return true;
    return false;
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit overflow-x-auto">
      {subTabs.map((tab) => {
        const isActive = isSubTabActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              isActive
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
