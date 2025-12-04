'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  // Company navigation tabs:
  // - Overview: Lightweight pulse-check with health summary
  // - Setup: Strategic Setup Mode (SSM) - guided onboarding wizard
  // - QBR: Quarterly Business Review mode
  // - Blueprint: Strategic hub (strategy, tools, analytics, insights)
  // - Brain: Strategic AI memory and documents
  // - Work: Active tasks, experiments, backlog
  // - Media: Performance media programs, campaigns, stores
  const tabs = [
    { name: 'Overview', href: `/c/${companyId}` },
    { name: 'Setup', href: `/c/${companyId}/setup` },
    { name: 'QBR', href: `/c/${companyId}/qbr` },
    { name: 'Blueprint', href: `/c/${companyId}/blueprint` },
    { name: 'Brain', href: `/c/${companyId}/brain` },
    { name: 'Work', href: `/c/${companyId}/work` },
    { name: 'Media', href: `/c/${companyId}/media` },
  ];

  // Check if current path matches a tab or is a child route of that tab
  const isTabActive = (tabHref: string) => {
    if (pathname === tabHref) return true;
    // Check if it's a child route (e.g., /c/123/reports/abc matches /c/123/reports)
    if (tabHref !== `/c/${companyId}` && pathname.startsWith(tabHref + '/')) {
      return true;
    }
    return false;
  };

  return (
    <div className="border-b border-gray-800">
      <nav className="-mb-px flex gap-4 overflow-x-auto sm:gap-6">
        {tabs.map((tab) => {
          const isActive = isTabActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

