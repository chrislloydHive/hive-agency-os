'use client';

// components/os/ReportsSubNav.tsx
// Sub-navigation for the Reports workspace:
// All Reports | Annual Plan | QBR | Diagnostics

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { REPORTS_TABS, getReportsTabFromPath } from '@/lib/nav/companyNav';

interface ReportsSubNavProps {
  companyId: string;
}

export function ReportsSubNav({ companyId }: ReportsSubNavProps) {
  const pathname = usePathname();
  const activeTabId = getReportsTabFromPath(pathname, companyId);

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
      {REPORTS_TABS.map((tab) => {
        const href = tab.href(companyId);
        const isActive = tab.id === activeTabId;

        return (
          <Link
            key={tab.id}
            href={href}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              isActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
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
