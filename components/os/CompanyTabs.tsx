'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Settings, ChevronDown } from 'lucide-react';
import { getPrimaryCompanyTabs, getCompanyTabFromPath } from '@/lib/nav/companyNav';

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const activeTabId = getCompanyTabFromPath(pathname, companyId);
  const primaryTabs = getPrimaryCompanyTabs();

  // Settings dropdown
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const isSettingsActive =
    pathname.startsWith(`/c/${companyId}/brain/setup`) ||
    pathname.startsWith('/settings');

  // Close on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

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

        {/* Settings dropdown */}
        <div ref={settingsRef} className="relative">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`flex items-center gap-1 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              isSettingsActive
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
            <ChevronDown className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-white/10 bg-gray-900 shadow-xl z-50 py-1">
              <Link
                href={`/c/${companyId}/brain/setup?step=9`}
                onClick={() => setSettingsOpen(false)}
                className="flex flex-col px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-sm text-gray-200">Integrations</span>
                <span className="text-[11px] text-gray-500">Google, measurement, company config</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setSettingsOpen(false)}
                className="flex flex-col px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-sm text-gray-200">App Settings</span>
                <span className="text-[11px] text-gray-500">GA4, Search Console, Airtable, AI</span>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

