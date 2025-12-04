'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  // Company navigation tabs (new IA):
  // - Overview: Lightweight pulse-check with health summary
  // - Blueprint: Strategic hub (GAP, plan tools, analytics)
  // - Brain: Company memory & intelligence hub (Context, Insights, History)
  // - Work: Active tasks, experiments, backlog (includes Media access)
  // - QBR: Quarterly Business Review mode
  // - Setup: De-emphasized connections/integrations flow
  const tabs = [
    { name: 'Overview', href: `/c/${companyId}` },
    { name: 'Blueprint', href: `/c/${companyId}/blueprint` },
    { name: 'Brain', href: `/c/${companyId}/brain` },
    { name: 'Work', href: `/c/${companyId}/work` },
    { name: 'QBR', href: `/c/${companyId}/qbr` },
    { name: 'Setup', href: `/c/${companyId}/setup`, deemphasized: true },
  ];

  // Check if current path matches a tab or is a child route of that tab
  const isTabActive = (tabHref: string) => {
    if (pathname === tabHref) return true;
    // Check if it's a child route (e.g., /c/123/brain/context matches /c/123/brain)
    if (tabHref !== `/c/${companyId}` && pathname.startsWith(tabHref + '/')) {
      return true;
    }
    // Special case: /c/123/brain exactly should match brain tab
    if (tabHref === `/c/${companyId}/brain` && pathname === `/c/${companyId}/brain`) {
      return true;
    }
    return false;
  };

  return (
    <div className="border-b border-gray-800">
      <nav className="-mb-px flex gap-4 overflow-x-auto sm:gap-6">
        {tabs.map((tab) => {
          const isActive = isTabActive(tab.href);
          const isDeemphasized = 'deemphasized' in tab && tab.deemphasized;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-amber-400 text-amber-400'
                  : isDeemphasized
                    ? 'border-transparent text-gray-500 hover:text-gray-400 hover:border-gray-700'
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

