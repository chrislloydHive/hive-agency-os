'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getPrimaryCompanyTabs, getCompanyTabFromPath } from '@/lib/nav/companyNav';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const activeTabId = getCompanyTabFromPath(pathname, companyId);
  const primaryTabs = getPrimaryCompanyTabs();

  return (
    <div className="border-b border-gray-800">
      <nav className="-mb-px flex gap-4 overflow-x-auto sm:gap-6">
        {primaryTabs.map((tab) => {
          const href = tab.href(companyId);
          const isActive = tab.id === activeTabId;

          return (
            <Link
              key={tab.id}
              href={href}
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

