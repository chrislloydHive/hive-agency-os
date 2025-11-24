'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: `/os/${companyId}` },
    { name: 'GAP', href: `/os/${companyId}/gap` },
    { name: 'Diagnostics', href: `/os/${companyId}/diagnostics` },
    { name: 'Priorities', href: `/os/${companyId}/priorities` },
    { name: 'Work', href: `/os/${companyId}/work` },
    { name: 'Growth Plan', href: `/os/${companyId}/plan` },
    { name: 'Scorecard', href: `/os/${companyId}/scorecard` },
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

