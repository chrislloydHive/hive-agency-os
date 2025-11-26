'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: `/c/${companyId}` },
    { name: 'GAP', href: `/c/${companyId}/gap` },
    { name: 'Diagnostics', href: `/c/${companyId}/diagnostics` },
    { name: 'Analytics', href: `/c/${companyId}/analytics` },
    { name: 'Brain', href: `/c/${companyId}/brain` },
    { name: 'Priorities', href: `/c/${companyId}/priorities` },
    { name: 'Work', href: `/c/${companyId}/work` },
    { name: 'Growth Plan', href: `/c/${companyId}/plan` },
    { name: 'Scorecard', href: `/c/${companyId}/scorecard` },
  ];

  return (
    <div className="border-b border-gray-800">
      <nav className="-mb-px flex gap-4 overflow-x-auto sm:gap-8">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
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

