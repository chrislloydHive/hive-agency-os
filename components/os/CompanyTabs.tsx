'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getPrimaryCompanyTabs, getCompanyTabFromPath } from '@/lib/nav/companyNav';

interface CompanyTabsProps {
  companyId: string;
  /** Highlight the Programs tab when Strategy has content */
  highlightPrograms?: boolean;
}

export default function CompanyTabs({ companyId, highlightPrograms = false }: CompanyTabsProps) {
  const pathname = usePathname();
  const activeTabId = getCompanyTabFromPath(pathname, companyId);
  const primaryTabs = getPrimaryCompanyTabs();

  return (
    <div className="border-b border-gray-800">
      <nav className="-mb-px flex gap-4 overflow-x-auto sm:gap-6">
        {primaryTabs.map((tab) => {
          const href = tab.href(companyId);
          const isActive = tab.id === activeTabId;
          const shouldHighlight = tab.id === 'programs' && highlightPrograms && !isActive;

          return (
            <Link
              key={tab.id}
              href={href}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'border-amber-400 text-amber-400'
                  : shouldHighlight
                  ? 'border-transparent text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/50'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab.name}
              {shouldHighlight && (
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

