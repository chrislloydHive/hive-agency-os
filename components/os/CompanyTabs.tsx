'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  // Canonical tabs for company detail experience
  // - Overview: Company summary and quick stats
  // - Tools: Run diagnostic and planning tools
  // - Reports: View historical diagnostic reports
  // - GAP: Growth Acceleration Plan shortcuts
  // - Analytics: Live GA4/GSC data
  // - Brain: Strategic AI memory and insights
  // - Work: Active work items and suggested priorities
  const tabs = [
    { name: 'Overview', href: `/c/${companyId}` },
    { name: 'Tools', href: `/c/${companyId}/tools` },
    { name: 'Reports', href: `/c/${companyId}/reports` },
    { name: 'GAP', href: `/c/${companyId}/gap` },
    { name: 'Analytics', href: `/c/${companyId}/analytics` },
    { name: 'Experiments', href: `/c/${companyId}/experiments` },
    { name: 'Brain', href: `/c/${companyId}/brain` },
    { name: 'Work', href: `/c/${companyId}/work` },
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

