'use client';

// components/os/BlueprintSubNav.tsx
// Sub-navigation for the Blueprint workspace: Map | Plan | Pillars | Programs
// Canonical structure per navigation architecture spec

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BLUEPRINT_TABS, getBlueprintTabFromPath } from '@/lib/nav/companyNav';

interface BlueprintSubNavProps {
  companyId: string;
}

export function BlueprintSubNav({ companyId }: BlueprintSubNavProps) {
  const pathname = usePathname();
  const activeTabId = getBlueprintTabFromPath(pathname, companyId);

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit overflow-x-auto">
      {BLUEPRINT_TABS.map((tab) => {
        const href = tab.href(companyId);
        const isActive = tab.id === activeTabId;

        return (
          <Link
            key={tab.id}
            href={href}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              isActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
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
