'use client';

// components/os/QbrSubNav.tsx
// Sub-navigation for the QBR workspace: Story | Scorecard | History
// Canonical structure per navigation architecture spec

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QBR_TABS, getQbrTabFromPath } from '@/lib/nav/companyNav';

interface QbrSubNavProps {
  companyId: string;
}

export function QbrSubNav({ companyId }: QbrSubNavProps) {
  const pathname = usePathname();
  const activeTabId = getQbrTabFromPath(pathname, companyId);

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit overflow-x-auto">
      {QBR_TABS.map((tab) => {
        const href = tab.href(companyId);
        const isActive = tab.id === activeTabId;

        return (
          <Link
            key={tab.id}
            href={href}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              isActive
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
            title={tab.description}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
